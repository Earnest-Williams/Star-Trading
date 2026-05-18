import { state } from '../../state.js';
import { BALANCE, COMMODITIES, MARKET_COMMODITIES } from '../../constants.js';
import { getPortType } from '../../core/ports.js';
import { PORT_DEFAULTS } from '../../config/worldgen.js';
import { clampRange, makeStock, formatCommodity, formatCredits, log, random } from '../../utils.js';
import { addSectorInfluence } from '../../core/influence.js';
import { addWorldEvent } from '../../core/worldEvents.js';
import { getFactionPoliticalPole, addFactionRep, addFactionTrust } from '../../core/factions.js';
import { spendTime } from '../../core/time.js';
import { nudgeCaptainRelation, getKnownCaptains } from '../captains.js';
import {
    findShortestSectorPath,
    findShortestCorridorPath as findNavigationCorridorPath,
    getCorridorRiskForPath,
    getRelaySurchargeForPath
} from '../../core/navigation.js';
import { findCheapestCorridorPath, getPathCost, getWorldGraphRevision } from '../../core/routePlanner.js';
import { getRouteReliabilityAdjustment, getRouteRiskAdjustment } from '../../core/characterChecks.js';

function finiteNumber(value, fallback) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
}

function finiteInteger(value, fallback) {
    const numericValue = finiteNumber(value, fallback);
    return Math.trunc(numericValue);
}

function positiveNumber(value, fallback) {
    const numericValue = finiteNumber(value, fallback);
    return numericValue > 0 ? numericValue : fallback;
}

function positiveIntegerOrNull(value) {
    const numericValue = Number(value);
    if (!Number.isInteger(numericValue) || numericValue <= 0) return null;
    return numericValue;
}

function nextTradeRouteId() {
    const routeId = state.nextTradeRouteId;
    state.nextTradeRouteId += 1;
    return routeId;
}

export function hydrateTradeRoute(partial, context = {}) {
    const ownerType = partial.ownerType || context.ownerType || "player";
    const ownerId = typeof partial.ownerId === "undefined"
        ? (ownerType === "player" ? null : context.ownerId)
        : partial.ownerId;
    const originSector = finiteInteger(partial.originSector, 0);
    const destinationSector = finiteInteger(partial.destinationSector, 0);
    const commodity = partial.commodity || context.commodity || "ore";
    const route = {
        ...partial,
        id: positiveIntegerOrNull(partial.id) || nextTradeRouteId(),
        name: partial.name || `${formatCommodity(commodity)} ${originSector}->${destinationSector}`,
        originSector,
        destinationSector,
        commodity,
        amount: positiveNumber(partial.amount, BALANCE.TRADE_ROUTE_BASE_AMOUNT),
        intervalDays: positiveNumber(partial.intervalDays, BALANCE.TRADE_ROUTE_INTERVAL_DAYS),
        nextRunDay: finiteInteger(partial.nextRunDay, state.player.time.day + BALANCE.TRADE_ROUTE.DEFAULT_DELAY_DAYS),
        factionId: partial.factionId || context.factionId || "traders",
        ownerType,
        ownerId,
        operatorType: partial.operatorType || context.operatorType || ownerType,
        createdBy: partial.createdBy || context.createdBy || ownerType,
        escortCaptainId: typeof partial.escortCaptainId === "undefined" ? null : partial.escortCaptainId,
        status: partial.status || "active",
        runs: Math.max(0, finiteInteger(partial.runs, 0)),
        failures: Math.max(0, finiteInteger(partial.failures, 0)),
        starvedDays: Math.max(0, finiteInteger(partial.starvedDays, 0)),
        profit: finiteNumber(partial.profit, 0),
        heat: Math.max(0, finiteNumber(partial.heat, 0)),
        reliability: clampRange(finiteNumber(partial.reliability, BALANCE.TRADE_ROUTE.DEFAULT_RELIABILITY), 0, 100)
    };
    if (route.status !== "closed" && (!state.universe[route.originSector] || !state.universe[route.destinationSector] || !findShortestSectorPath(route.originSector, route.destinationSector))) {
        route.status = "paused";
    }
    return route;
}

export function createRouteRecord({
    originSector,
    destinationSector,
    commodity,
    ownerType = "player",
    ownerId = null,
    name = null,
    amount = BALANCE.TRADE_ROUTE_BASE_AMOUNT,
    intervalDays = BALANCE.TRADE_ROUTE_INTERVAL_DAYS,
    delayDays = BALANCE.TRADE_ROUTE.DEFAULT_DELAY_DAYS,
    factionId = "traders",
    operatorType = ownerType,
    createdBy = ownerType,
    reliability = BALANCE.TRADE_ROUTE.DEFAULT_RELIABILITY
}) {
    return hydrateTradeRoute({
        name: name || `${formatCommodity(commodity)} ${originSector}->${destinationSector}`,
        originSector,
        destinationSector,
        commodity,
        amount,
        intervalDays,
        nextRunDay: state.player.time.day + delayDays,
        factionId,
        ownerType,
        ownerId,
        operatorType,
        createdBy,
        reliability,
        status: "active"
    });
}

export function normaliseTradeRoutes() {
    if (!Array.isArray(state.tradeRoutes)) state.tradeRoutes = [];
    state.tradeRoutes = state.tradeRoutes.map(route => hydrateTradeRoute(route));
    state.nextTradeRouteId = Math.max(state.nextTradeRouteId, state.tradeRoutes.reduce((best, r) => Math.max(best, finiteInteger(r.id, 0) + 1), 1));
}

export function getLogisticsNode(sectorId) {
    const port = state.ports[sectorId];
    const planet = state.planets[sectorId];
    if (port) {
        const type = getPortType(port);
        return {
            sectorId, kind: "port",
            name: `${type.name} S${sectorId}`,
            factionId: port.factionId || type.factionId,
            stock: port.stock, maxStock: port.maxStock,
            sells: type.sells.slice(), buys: type.buys.slice()
        };
    }
    if (planet && planet.owner === "Player") {
        return {
            sectorId, kind: "colony",
            name: `Player Colony S${sectorId}`,
            factionId: planet.factionId || "colonists",
            stock: planet.stock,
            maxStock: makeStock({ ore: PORT_DEFAULTS.MAX_STOCK.ore, org: PORT_DEFAULTS.MAX_STOCK.org, eq: PORT_DEFAULTS.MAX_STOCK.eq }),
            sells: COMMODITIES.slice(), buys: COMMODITIES.slice()
        };
    }
    return null;
}

export function getAllLogisticsNodes() {
    return Object.keys(state.universe).map(Number).map(getLogisticsNode).filter(Boolean).sort((a, b) => a.sectorId - b.sectorId);
}

export function routeExists(originSector, destinationSector, commodity, ownerType = "player", ownerId = null) {
    return state.tradeRoutes.some(r => {
        const routeOwnerId = typeof r.ownerId === "undefined" ? null : r.ownerId;
        return r.status !== "closed"
            && r.originSector === originSector
            && r.destinationSector === destinationSector
            && r.commodity === commodity
            && (r.ownerType || "player") === ownerType
            && routeOwnerId === ownerId;
    });
}

export function findShortestCorridorPath(start, goal) {
    return findNavigationCorridorPath(start, goal);
}

export function getRoutePath(route) {
    return deriveRouteMetrics(route.originSector, route.destinationSector).path;
}

export function getRouteDistance(originSector, destinationSector) {
    return deriveRouteMetrics(originSector, destinationSector).hopCount;
}

export function getRouteCommodityOptions(originSector, destinationSector) {
    return deriveRouteMetrics(originSector, destinationSector).viableCommodities.slice();
}

export function getRouteSetupCost(originSector, destinationSector) {
    return deriveRouteMetrics(originSector, destinationSector).setupCost;
}

export function getRouteRiskForSectors(originSector, destinationSector) {
    return deriveRouteMetrics(originSector, destinationSector).risk;
}

export function getRouteRisk(route) {
    const risk = getRouteRiskForSectors(route.originSector, route.destinationSector);
    if (risk === null) return null;
    const actorCharacter = route.ownerType === "player" ? state.player.character : state.captains?.[route.ownerId]?.character;
    return Math.max(
        0,
        risk
            + Math.max(0, route.heat || 0) / BALANCE.TRADE_ROUTE.RISK_HEAT_DIVISOR
            + getRouteRiskAdjustment(actorCharacter)
    );
}

export function getRouteEscortPower(route) {
    const captain = route.escortCaptainId ? state.captains[route.escortCaptainId] : null;
    if (!captain || captain.status !== "active") return 0;
    const relation = captain.relationshipToPlayer || { opinion: 0, trust: 0, rivalry: 0 };
    return (captain.ship.combatRating || 0) / BALANCE.TRADE_ROUTE.ESCORT_COMBAT_DIVISOR
        + Math.max(0, relation.trust || 0) / BALANCE.TRADE_ROUTE.ESCORT_TRUST_DIVISOR
        + Math.max(0, relation.opinion || 0) / BALANCE.TRADE_ROUTE.ESCORT_OPINION_DIVISOR;
}

export function getRouteMarketValue(sectorId, commodity, mode) {
    const node = getLogisticsNode(sectorId);
    if (!node) return 0;
    const stock = Math.max(0, (node.stock || {})[commodity] || 0);
    const maxStock = Math.max(1, (node.maxStock || {})[commodity] || 1);
    const ratio = Math.max(0, Math.min(1, stock / maxStock));
    const base = node.kind === "port"
        ? (state.ports[sectorId].basePrices || {})[commodity]
        : PORT_DEFAULTS.BASE_PRICES[commodity];
    if (typeof base !== "number") return 0;
    if (mode === "buy") {
        const multiplier = BALANCE.TRADE_ROUTE.BUY_PRICE_BASE_MULTIPLIER
            + (1 - ratio) * BALANCE.TRADE_ROUTE.BUY_PRICE_SCARCITY_MULTIPLIER;
        return Math.max(BALANCE.MIN_TRADE_PRICE, Math.round(base * multiplier));
    }
    const multiplier = BALANCE.TRADE_ROUTE.SELL_PRICE_BASE_MULTIPLIER
        + (1 - ratio) * BALANCE.TRADE_ROUTE.SELL_PRICE_SCARCITY_MULTIPLIER;
    return Math.max(BALANCE.MIN_TRADE_PRICE, Math.round(base * multiplier));
}

export function estimateRouteProfit(originSector, destinationSector, commodity, amount = BALANCE.TRADE_ROUTE_BASE_AMOUNT) {
    const buyValue = getRouteMarketValue(originSector, commodity, "buy");
    const sellValue = getRouteMarketValue(destinationSector, commodity, "sell");
    const spread = Math.max(BALANCE.TRADE_ROUTE.PROFIT_SPREAD_FLOOR, sellValue - buyValue);
    return Math.max(
        BALANCE.TRADE_ROUTE.PROFIT_FLOOR,
        Math.floor(spread * amount * BALANCE.TRADE_ROUTE.PROFIT_MULTIPLIER)
    );
}

const routePathMetricsCache = new Map();
const routeMarketMetricsCache = new Map();
let routeMetricsMarketSignature = '';
let routeMetricsMarketRevision = 0;
let routeMetricsCachedMarketRevision = null;
let routeMetricsMarketMicrotaskScheduled = false;
let routePathMetricsRevision = null;
let routeMetricsUniverseRef = null;
let routeMetricsPortsRef = null;
let routeMetricsPlanetsRef = null;

function buildRouteMetricsMarketSignature() {
    return getAllLogisticsNodes()
        .map(node => [
            node.sectorId,
            node.kind,
            node.factionId || '',
            node.sells.join(','),
            node.buys.join(','),
            MARKET_COMMODITIES.map(commodity => (node.stock || {})[commodity] || 0).join(','),
            MARKET_COMMODITIES.map(commodity => (node.maxStock || {})[commodity] || 0).join(',')
        ].join(':'))
        .join('|');
}

function detectRouteMetricsRootChange() {
    const universeChanged = routeMetricsUniverseRef !== state.universe;
    const marketInputsChanged = universeChanged || routeMetricsPortsRef !== state.ports || routeMetricsPlanetsRef !== state.planets;
    routeMetricsUniverseRef = state.universe;
    routeMetricsPortsRef = state.ports;
    routeMetricsPlanetsRef = state.planets;
    return { universeChanged, marketInputsChanged };
}

function getRouteMetricsMarketRevision(rootChange = detectRouteMetricsRootChange()) {
    if (rootChange.marketInputsChanged) {
        routeMarketMetricsCache.clear();
        routeMetricsMarketSignature = '';
        routeMetricsCachedMarketRevision = null;
    }
    if (routeMetricsCachedMarketRevision !== null) return routeMetricsCachedMarketRevision;
    const marketSignature = buildRouteMetricsMarketSignature();
    if (routeMetricsMarketSignature !== marketSignature) {
        routeMarketMetricsCache.clear();
        routeMetricsMarketSignature = marketSignature;
        routeMetricsMarketRevision += 1;
    }
    routeMetricsCachedMarketRevision = routeMetricsMarketRevision;
    if (!routeMetricsMarketMicrotaskScheduled) {
        routeMetricsMarketMicrotaskScheduled = true;
        Promise.resolve().then(() => {
            routeMetricsMarketMicrotaskScheduled = false;
            routeMetricsCachedMarketRevision = null;
        });
    }
    return routeMetricsCachedMarketRevision;
}

function ensureRoutePathMetricsCacheFresh(rootChange = detectRouteMetricsRootChange()) {
    const revision = getWorldGraphRevision();
    if (routePathMetricsRevision !== revision || rootChange.universeChanged) {
        routePathMetricsCache.clear();
        routePathMetricsRevision = revision;
    }
    return revision;
}

function routeMetricKey(originSector, destinationSector) {
    return `${originSector}->${destinationSector}`;
}

function routeMetricCacheKey(revision, key) {
    return `${revision}:${key}`;
}

function computeRouteSetupCost(metrics) {
    if (!metrics.path) return null;
    const effectiveSpanCost = metrics.totalEffectiveSpan;
    const surchargeMultiplier = 1 + metrics.surcharge;
    const physicalCost = metrics.hopCount * BALANCE.TRADE_ROUTE.SETUP_HOP_COST
        + effectiveSpanCost * BALANCE.TRADE_ROUTE.SETUP_EFFECTIVE_SPAN_COST;
    const riskCost = metrics.risk * BALANCE.TRADE_ROUTE.SETUP_RISK_COST;
    return Math.round((BALANCE.TRADE_ROUTE_BASE_COST + physicalCost + riskCost) * surchargeMultiplier);
}

function getProfitBand(originSector, destinationSector, commodity) {
    const expected = estimateRouteProfit(originSector, destinationSector, commodity);
    return {
        commodity,
        low: Math.max(0, Math.floor(expected * BALANCE.TRADE_ROUTE.PROFIT_BAND_LOW_MULTIPLIER)),
        expected,
        high: Math.ceil(expected * BALANCE.TRADE_ROUTE.PROFIT_BAND_HIGH_MULTIPLIER),
        estimatedProfit: expected
    };
}

export function deriveRouteMetrics(originSector, destinationSector) {
    const rootChange = detectRouteMetricsRootChange();
    const revision = ensureRoutePathMetricsCacheFresh(rootChange);
    const key = routeMetricKey(originSector, destinationSector);
    const pathCacheKey = routeMetricCacheKey(revision, key);
    let pathMetrics = routePathMetricsCache.get(pathCacheKey);
    if (!pathMetrics) {
        const corridorPath = findCheapestCorridorPath(originSector, destinationSector);
        const path = corridorPath
            ? [originSector].concat(corridorPath.map(segment => segment.toSectorId))
            : null;
        const hopCount = path ? Math.max(0, path.length - 1) : null;
        const totalEffectiveSpan = corridorPath
            ? corridorPath.reduce((sum, segment) => sum + Math.max(0, segment.effectiveSpanCost || 0), 0)
            : null;
        pathMetrics = {
            path,
            corridorPath,
            hopCount,
            distance: hopCount,
            totalEffectiveSpan,
            pathCost: corridorPath ? getPathCost(corridorPath) : null,
            risk: path ? getCorridorRiskForPath(path) : null,
            surcharge: path ? getRelaySurchargeForPath(path) : 0
        };
        routePathMetricsCache.set(pathCacheKey, pathMetrics);
    }

    const marketRevision = getRouteMetricsMarketRevision(rootChange);
    const marketCacheKey = routeMetricCacheKey(marketRevision, key);
    const origin = getLogisticsNode(originSector);
    const destination = getLogisticsNode(destinationSector);
    let marketMetrics = routeMarketMetricsCache.get(marketCacheKey);
    if (!marketMetrics) {
        const viableCommodities = origin && destination && originSector !== destinationSector && pathMetrics.path
            ? MARKET_COMMODITIES.filter(commodity => origin.sells.includes(commodity) && destination.buys.includes(commodity))
            : [];
        const profitBands = viableCommodities.map(commodity => getProfitBand(originSector, destinationSector, commodity));
        marketMetrics = {
            viableCommodities,
            profitBands
        };
        routeMarketMetricsCache.set(marketCacheKey, marketMetrics);
    }

    const metrics = {
        origin,
        destination,
        ...pathMetrics,
        setupCost: null,
        viableCommodities: marketMetrics.viableCommodities,
        commodities: marketMetrics.profitBands,
        profitBands: marketMetrics.profitBands
    };
    metrics.setupCost = computeRouteSetupCost(metrics);
    return {
        ...metrics,
        path: metrics.path ? metrics.path.slice() : null,
        corridorPath: metrics.corridorPath ? metrics.corridorPath.map(segment => ({ ...segment })) : null,
        viableCommodities: metrics.viableCommodities.slice(),
        profitBands: metrics.profitBands.map(option => ({ ...option }))
    };
}

function buildRouteMetrics(origin, destination) {
    const metrics = deriveRouteMetrics(origin.sectorId, destination.sectorId);
    const availableCommodities = metrics.profitBands.filter(option => !routeExists(
        origin.sectorId,
        destination.sectorId,
        option.commodity,
        "player",
        null
    ));
    return {
        ...metrics,
        origin,
        destination,
        commodities: metrics.profitBands,
        availableCommodities
    };
}


export function buildLogisticsSnapshot(originSector = state.player.currentSector) {
    const nodes = getAllLogisticsNodes();
    const bySector = new Map(nodes.map(node => [node.sectorId, node]));
    const origin = bySector.get(originSector) || null;
    const candidates = origin
        ? nodes
            .filter(node => node.sectorId !== originSector)
            .map(node => buildRouteMetrics(origin, node))
            .filter(metric => metric.commodities.length > 0)
        : [];
    const availableRouteOptions = candidates
        .filter(metric => metric.availableCommodities.length > 0)
        .map(metric => ({
            ...metric,
            commodities: metric.availableCommodities
        }));
    const activeRouteSummaries = state.tradeRoutes
        .filter(route => route.status !== "closed")
        .map(route => {
            const routeOrigin = bySector.get(route.originSector) || null;
            const routeDestination = bySector.get(route.destinationSector) || null;
            const metrics = deriveRouteMetrics(route.originSector, route.destinationSector);
            const baseRisk = metrics.risk;
            const risk = baseRisk === null
                ? null
                : baseRisk + Math.max(0, route.heat || 0) / BALANCE.TRADE_ROUTE.RISK_HEAT_DIVISOR;
            return { route, origin: routeOrigin, destination: routeDestination, path: metrics.path, metrics, risk };
        });
    const playerColonies = Object.fromEntries(
        Object.entries(state.planets).filter(([, planet]) => planet.owner === "Player")
    );
    return {
        originSector,
        origin,
        nodes,
        candidates,
        availableRouteOptions,
        activeRouteSummaries,
        playerColonies,
        captains: state.captains,
        ambientTradeFlows: state.ambientTrade ? state.ambientTrade.flows : 0
    };
}

export function createTradeRoute(destinationSector, commodity) {
    destinationSector = positiveIntegerOrNull(destinationSector);
    if (destinationSector === null) {
        log("Choose a valid destination sector before opening a route.");
        return;
    }
    const originSector = state.player.currentSector;
    const origin = getLogisticsNode(originSector);
    const destination = getLogisticsNode(destinationSector);
    if (!origin || !destination) { log("Trade routes need a port or player colony at both ends."); return; }
    const metrics = deriveRouteMetrics(originSector, destinationSector);
    if (!metrics.path) { log(`No connected jump-gate corridor path exists from sector ${originSector} to sector ${destinationSector}. Route creation cancelled.`); return; }
    if (!metrics.viableCommodities.includes(commodity)) { log("That route does not have a useful commodity flow."); return; }
    if (routeExists(originSector, destinationSector, commodity, "player", null)) { log("You already operate that route."); return; }
    const cost = metrics.setupCost;
    if (cost === null) { log(`No connected jump-gate corridor path exists from sector ${originSector} to sector ${destinationSector}. Route creation cancelled.`); return; }
    if (state.player.credits < cost) { log(`Opening that route requires ${formatCredits(cost)} credits.`); return; }
    if (!spendTime(BALANCE.TRADE_ROUTE.OPEN_TIME_MINUTES)) return;
    state.player.credits -= cost;
    const route = createRouteRecord({
        originSector,
        destinationSector,
        commodity,
        factionId: destination.factionId || origin.factionId || "traders",
        reliability: BALANCE.TRADE_ROUTE.PLAYER_START_RELIABILITY
    });
    state.tradeRoutes.push(route);
    addFactionRep("traders", BALANCE.TRADE_ROUTE.OPEN_REPUTATION_GAIN, "opened a persistent route");
    addFactionTrust("traders", BALANCE.TRADE_ROUTE.OPEN_TRUST_GAIN, "route brokerage");
    addSectorInfluence(originSector, getFactionPoliticalPole(origin.factionId || "traders"), BALANCE.TRADE_ROUTE.OPEN_INFLUENCE_GAIN, "new logistics route");
    addSectorInfluence(destinationSector, getFactionPoliticalPole(destination.factionId || "traders"), BALANCE.TRADE_ROUTE.OPEN_INFLUENCE_GAIN, "new logistics route");
    addWorldEvent({
        type: "route_opened", sourceSystem: "trade_routes", routeId: route.id,
        sectorId: destinationSector, factionId: route.factionId,
        text: `You opened an explicit ${formatCommodity(commodity)} trade route from sector ${originSector} to sector ${destinationSector}.`,
        importance: 2, alert: true,
        payload: { originSector, destinationSector, commodity }
    });
}

export function createCaptainTradeRoute(captain, originSector, destinationSector, commodity, options = {}) {
    const origin = getLogisticsNode(originSector);
    const destination = getLogisticsNode(destinationSector);
    if (!captain || !origin || !destination) return null;
    const metrics = deriveRouteMetrics(originSector, destinationSector);
    if (!metrics.path) return null;
    if (!metrics.viableCommodities.includes(commodity)) return null;
    if (routeExists(originSector, destinationSector, commodity, "captain", captain.id)) return null;
    const route = createRouteRecord({
        name: `${captain.callsign || captain.name} ${formatCommodity(commodity)} ${originSector}->${destinationSector}`,
        originSector,
        destinationSector,
        commodity,
        amount: positiveNumber(
            options.amount,
            Math.max(
                BALANCE.TRADE_ROUTE.CAPTAIN_MIN_AMOUNT,
                Math.floor(
                    positiveNumber(
                        captain.ship.cargoCapacity,
                        BALANCE.TRADE_ROUTE.CAPTAIN_DEFAULT_CARGO_CAPACITY
                    ) * BALANCE.TRADE_ROUTE.CAPTAIN_CARGO_SHARE
                )
            )
        ),
        intervalDays: positiveNumber(options.intervalDays, BALANCE.TRADE_ROUTE_INTERVAL_DAYS),
        delayDays: positiveNumber(options.delayDays, BALANCE.TRADE_ROUTE.DEFAULT_DELAY_DAYS),
        factionId: destination.factionId || origin.factionId || captain.preferredFaction || "traders",
        ownerType: "captain",
        ownerId: captain.id,
        operatorType: "captain",
        createdBy: captain.id,
        reliability: BALANCE.TRADE_ROUTE.CAPTAIN_START_RELIABILITY
    });
    state.tradeRoutes.push(route);
    return route;
}

export function toggleTradeRoute(routeId) {
    routeId = positiveIntegerOrNull(routeId);
    if (routeId === null) return;
    const route = state.tradeRoutes.find(r => r.id === routeId);
    if (!route || route.status === "closed") return;
    route.status = route.status === "active" ? "paused" : "active";
    addWorldEvent({
        type: "route_status", sourceSystem: "trade_routes", routeId: route.id,
        text: `${route.name} is now ${route.status}.`,
        sectorId: route.destinationSector, importance: 1, alert: false
    });
}

export function closeTradeRoute(routeId) {
    routeId = positiveIntegerOrNull(routeId);
    if (routeId === null) return;
    const route = state.tradeRoutes.find(r => r.id === routeId);
    if (!route || route.status === "closed") return;
    route.status = "closed";
    route.escortCaptainId = null;
    addWorldEvent({
        type: "route_closed", sourceSystem: "trade_routes", routeId: route.id,
        text: `${route.name} was closed.`,
        sectorId: route.destinationSector, importance: 1, alert: true
    });
}

export function assignCaptainToRoute(routeId, captainId) {
    routeId = positiveIntegerOrNull(routeId);
    if (routeId === null) return;
    const route = state.tradeRoutes.find(r => r.id === routeId);
    const captain = state.captains[captainId];
    if (!route || !captain || route.status === "closed") return;
    const relation = captain.relationshipToPlayer || { opinion: 0, trust: 0, rivalry: 0 };
    const cost = Math.max(
        BALANCE.TRADE_ROUTE.ESCORT_MIN_COST,
        Math.floor(
            BALANCE.TRADE_ROUTE.ESCORT_BASE_COST
                + positiveNumber(
                    captain.ship.combatRating,
                    BALANCE.TRADE_ROUTE.ESCORT_DEFAULT_COMBAT_RATING
                ) * BALANCE.TRADE_ROUTE.ESCORT_COMBAT_COST_MULTIPLIER
                - Math.max(0, relation.opinion || 0) * BALANCE.TRADE_ROUTE.ESCORT_OPINION_DISCOUNT
        )
    );
    if (state.player.credits < cost) { log(`Hiring ${captain.name} for convoy escort requires ${formatCredits(cost)} credits.`); return; }
    if (!spendTime(BALANCE.TRADE_ROUTE.ESCORT_HIRE_TIME_MINUTES)) return;
    state.tradeRoutes.forEach(r => { if (r.escortCaptainId === captainId) r.escortCaptainId = null; });
    state.player.credits -= cost;
    route.escortCaptainId = captainId;
    captain.known = true;
    nudgeCaptainRelation(captainId, {
        opinion: BALANCE.TRADE_ROUTE.ESCORT_HIRE_OPINION_GAIN,
        trust: BALANCE.TRADE_ROUTE.ESCORT_HIRE_TRUST_GAIN,
        debt: BALANCE.TRADE_ROUTE.ESCORT_HIRE_DEBT_GAIN
    }, `took escort duty on ${route.name}`);
    addWorldEvent({
        type: "route_escort", captainId, sectorId: route.originSector,
        text: `${captain.name} joined the convoy wing for ${route.name}.`,
        importance: 2, alert: true
    });
}

export function unassignRouteEscort(routeId) {
    routeId = positiveIntegerOrNull(routeId);
    if (routeId === null) return;
    const route = state.tradeRoutes.find(r => r.id === routeId);
    if (!route) return;
    route.escortCaptainId = null;
}

export function runTradeRoutesDaily() {
    normaliseTradeRoutes();
    state.tradeRoutes.forEach(route => {
        if (route.status !== "active") return;
        if (route.nextRunDay > state.player.time.day) return;
        runTradeRoute(route);
        route.nextRunDay = state.player.time.day + route.intervalDays;
    });
}

export function runTradeRoute(route) {
    const origin = getLogisticsNode(route.originSector);
    const destination = getLogisticsNode(route.destinationSector);
    if (!origin || !destination) {
        route.status = "paused";
        addWorldEvent({
            type: "route_paused", sourceSystem: "trade_routes", routeId: route.id,
            text: `${route.name} paused because one endpoint is no longer valid.`,
            importance: 2, alert: true,
            causedBy: [{ sourceSystem: "trade_routes", eventType: "route_endpoint_missing" }]
        });
        return;
    }
    const available = Math.max(0, origin.stock[route.commodity] || 0);
    const capacity = Math.max(
        0,
        (destination.maxStock[route.commodity] || BALANCE.AMBIENT_TRADE.DEFAULT_MAX_STOCK_CAP)
            - (destination.stock[route.commodity] || 0)
    );
    const amount = Math.min(route.amount, available, capacity);
    if (amount <= 0) {
        route.failures += 1;
        route.starvedDays = (route.starvedDays || 0) + 1;
        if (route.starvedDays >= BALANCE.TRADE_ROUTE.STARVED_PAUSE_DAYS) route.status = "paused";
        route.reliability = clampRange(route.reliability - BALANCE.TRADE_ROUTE.STARVED_RELIABILITY_LOSS, 0, 100);
        addWorldEvent({
            type: "route_shortage", sourceSystem: "trade_routes", routeId: route.id,
            sectorId: route.originSector, factionId: route.factionId,
            text: `${route.name} missed a run because ${formatCommodity(route.commodity)} was unavailable or the destination was full.`,
            importance: 1, alert: false,
            causedBy: [{
                sourceSystem: "economy",
                eventType: "route_capacity_or_supply_shortfall",
                label: `${formatCommodity(route.commodity)} available ${available}, capacity ${capacity}`
            }],
            payload: { available, capacity, commodity: route.commodity }
        });
        return;
    }
    const risk = getRouteRisk(route);
    if (risk === null) {
        route.status = "paused";
        addWorldEvent({
            type: "route_disconnected", sourceSystem: "trade_routes", routeId: route.id,
            sectorId: route.originSector, factionId: route.factionId,
            text: `${route.name} paused because no connected jump-gate corridor path exists between sector ${route.originSector} and sector ${route.destinationSector}.`,
            importance: 3, alert: true,
            causedBy: [{ sourceSystem: "travel", eventType: "corridor_path_missing" }],
            payload: { originSector: route.originSector, destinationSector: route.destinationSector }
        });
        return;
    }
    const escortPower = getRouteEscortPower(route);
    const reliabilityAdjustment = getRouteReliabilityAdjustment(route.ownerType === "player" ? state.player.character : state.captains?.[route.ownerId]?.character);
    const failureChance = Math.max(
        BALANCE.TRADE_ROUTE.FAILURE_MIN_CHANCE,
        Math.min(
            BALANCE.TRADE_ROUTE.FAILURE_MAX_CHANCE,
            BALANCE.TRADE_ROUTE.FAILURE_BASE_CHANCE
                + risk * BALANCE.TRADE_ROUTE.FAILURE_RISK_MULTIPLIER
                - escortPower * BALANCE.TRADE_ROUTE.FAILURE_ESCORT_MULTIPLIER
                - reliabilityAdjustment * BALANCE.TRADE_ROUTE.FAILURE_RELIABILITY_MULTIPLIER
        )
    );
    const escortCaptain = route.escortCaptainId ? state.captains[route.escortCaptainId] : null;
    if (random() < failureChance) {
        route.failures += 1;
        route.heat = Math.min(100, route.heat + BALANCE.TRADE_ROUTE.FAILURE_HEAT_BASE + Math.floor(risk));
        route.reliability = clampRange(
            route.reliability - Math.max(
                BALANCE.TRADE_ROUTE.STARVED_RELIABILITY_LOSS,
                BALANCE.TRADE_ROUTE.FAILURE_RELIABILITY_LOSS - reliabilityAdjustment
            ),
            0,
            100
        );
        const path = getRoutePath(route);
        const hotSector = path ? path.sort((a, b) => (state.universe[b].pirateThreat || 0) - (state.universe[a].pirateThreat || 0))[0] || route.destinationSector : route.destinationSector;
        if (state.universe[hotSector]) {
            state.universe[hotSector].pirateThreat = Math.min(
                BALANCE.TRADE_ROUTE.FAILURE_PIRATE_THREAT_CAP,
                (state.universe[hotSector].pirateThreat || 0) + 1
            );
        }
        if (escortCaptain) nudgeCaptainRelation(escortCaptain.id, { opinion: 1, trust: 1, rivalry: 1 }, `fought through a failed convoy run on ${route.name}`);
        addWorldEvent({
            type: "route_raid", sourceSystem: "trade_routes", routeId: route.id,
            sectorId: hotSector,
            captainId: escortCaptain ? escortCaptain.id : null,
            factionId: "vc",
            text: `${route.name} was hit en route. Pirate pressure increased near sector ${hotSector}.`,
            importance: 3, alert: true,
            causedBy: [{
                sourceSystem: "threat",
                eventType: "route_risk_check",
                label: `risk ${risk}, escort ${escortPower}, failure chance ${Math.round(failureChance * 100)}%`
            }],
            payload: { risk, escortPower, failureChance, hotSector }
        });
        return;
    }
    origin.stock[route.commodity] -= amount;
    destination.stock[route.commodity] = Math.min(
        destination.maxStock[route.commodity] || BALANCE.AMBIENT_TRADE.DEFAULT_MAX_STOCK_CAP,
        (destination.stock[route.commodity] || 0) + amount
    );
    const profit = estimateRouteProfit(route.originSector, route.destinationSector, route.commodity, amount);
    if (route.ownerType === "captain" && route.ownerId && state.captains[route.ownerId]) {
        state.captains[route.ownerId].credits = (state.captains[route.ownerId].credits || 0) + profit;
    } else {
        state.player.credits += profit;
    }
    route.profit += profit;
    route.runs += 1;
    route.starvedDays = 0;
    route.heat = Math.max(0, route.heat - BALANCE.TRADE_ROUTE.SUCCESS_HEAT_LOSS);
    route.reliability = clampRange(
        route.reliability
            + BALANCE.TRADE_ROUTE.SUCCESS_RELIABILITY_GAIN
            + Math.max(
                0,
                Math.floor(reliabilityAdjustment / BALANCE.TRADE_ROUTE.SUCCESS_RELIABILITY_ADJUSTMENT_DIVISOR)
            ),
        0,
        100
    );
    addFactionRep("traders", 1, "route income");
    addSectorInfluence(route.originSector, getFactionPoliticalPole(origin.factionId || "traders"), 1, "regular logistics traffic");
    addSectorInfluence(route.destinationSector, getFactionPoliticalPole(destination.factionId || route.factionId || "traders"), 1, "regular logistics traffic");
    maybeRoutePoliticalSideEffect(route, amount, escortCaptain);
    if (escortCaptain && route.runs % BALANCE.TRADE_ROUTE.ESCORT_RELATION_RUN_INTERVAL === 0) {
        nudgeCaptainRelation(escortCaptain.id, {
            opinion: BALANCE.TRADE_ROUTE.ESCORT_RELATION_OPINION_GAIN,
            trust: BALANCE.TRADE_ROUTE.ESCORT_RELATION_TRUST_GAIN
        }, `kept ${route.name} running`);
    }
    addWorldEvent({
        type: "route_success", sourceSystem: "trade_routes", routeId: route.id,
        sectorId: route.destinationSector,
        captainId: escortCaptain ? escortCaptain.id : null, factionId: route.factionId,
        text: `${route.name} delivered ${amount} ${formatCommodity(route.commodity)} and earned ${formatCredits(profit)} credits.`,
        importance: route.runs % BALANCE.TRADE_ROUTE.ESCORT_RELATION_RUN_INTERVAL === 0 ? 2 : 1, alert: false,
        causedBy: [{
            sourceSystem: "economy",
            eventType: "route_profit_check",
            label: `${amount} ${formatCommodity(route.commodity)} moved for ${formatCredits(profit)}`
        }],
        payload: { amount, commodity: route.commodity, profit }
    });
}

export function maybeRoutePoliticalSideEffect(route, amount, escortCaptain) {
    const destination = getLogisticsNode(route.destinationSector);
    if (!destination) return;
    const pole = getFactionPoliticalPole(destination.factionId || "traders");
    if (route.commodity === "eq" && pole === "hc") addFactionTrust("hc", 1, "equipment route reliability");
    if (route.commodity === "org" && state.planets[route.destinationSector]) addFactionTrust("colonists", 1, "colony food route");
    if (route.commodity === "ore" && pole === "hc") addFactionRep("miners", 1, "ore route throughput");
    if (escortCaptain
        && escortCaptain.preferredFaction === "smugglers"
        && random() < BALANCE.TRADE_ROUTE.SMUGGLER_SIDE_BUSINESS_CHANCE) {
        route.heat = Math.min(100, route.heat + BALANCE.TRADE_ROUTE.SMUGGLER_SIDE_BUSINESS_HEAT);
        addFactionRep("vc", 1, "quiet convoy side business", "private");
    }
}

export function getRouteEscortCandidates() {
    return getKnownCaptains()
        .filter(c => c.status === "active")
        .filter(c => c.archetype === "mercenary" || c.archetype === "trader" || c.archetype === "smuggler" || c.ship.combatRating >= 20)
        .sort((a, b) => (b.ship.combatRating || 0) - (a.ship.combatRating || 0));
}
