import { state } from '../state.js';
import { BALANCE, COMMODITIES, MARKET_COMMODITIES, PORT_TYPES } from '../constants.js';
import { clampRange, makeStock, formatCommodity, formatCredits, log, random } from '../utils.js';
import { addSectorInfluence } from '../core/influence.js';
import { addWorldEvent } from '../core/worldEvents.js';
import { getFactionPoliticalPole, addFactionRep, addFactionTrust } from '../core/factions.js';
import { spendTime } from '../core/time.js';
import { nudgeCaptainRelation, getKnownCaptains } from './captains.js';
import {
    findShortestSectorPath,
    findShortestCorridorPath as findNavigationCorridorPath,
    getCorridorRiskForPath,
    getRelaySurchargeForPath
} from '../core/navigation.js';
import { findCheapestCorridorPath, getPathCost, getWorldGraphRevision } from '../core/routePlanner.js';

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
    const originSector = Number(partial.originSector);
    const destinationSector = Number(partial.destinationSector);
    const commodity = partial.commodity || context.commodity || "ore";
    const route = {
        ...partial,
        id: typeof partial.id === "number" ? partial.id : nextTradeRouteId(),
        name: partial.name || `${formatCommodity(commodity)} ${originSector}->${destinationSector}`,
        originSector,
        destinationSector,
        commodity,
        amount: typeof partial.amount === "number" ? partial.amount : BALANCE.TRADE_ROUTE_BASE_AMOUNT,
        intervalDays: typeof partial.intervalDays === "number" ? partial.intervalDays : BALANCE.TRADE_ROUTE_INTERVAL_DAYS,
        nextRunDay: typeof partial.nextRunDay === "number" ? partial.nextRunDay : state.player.time.day + 1,
        factionId: partial.factionId || context.factionId || "traders",
        ownerType,
        ownerId,
        operatorType: partial.operatorType || context.operatorType || ownerType,
        createdBy: partial.createdBy || context.createdBy || ownerType,
        escortCaptainId: typeof partial.escortCaptainId === "undefined" ? null : partial.escortCaptainId,
        status: partial.status || "active",
        runs: typeof partial.runs === "number" ? partial.runs : 0,
        failures: typeof partial.failures === "number" ? partial.failures : 0,
        starvedDays: typeof partial.starvedDays === "number" ? partial.starvedDays : 0,
        profit: typeof partial.profit === "number" ? partial.profit : 0,
        heat: typeof partial.heat === "number" ? partial.heat : 0,
        reliability: typeof partial.reliability === "number" ? partial.reliability : 50
    };
    if (route.status !== "closed" && !findShortestSectorPath(route.originSector, route.destinationSector)) {
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
    delayDays = 1,
    factionId = "traders",
    operatorType = ownerType,
    createdBy = ownerType,
    reliability = 50
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
    state.nextTradeRouteId = Math.max(state.nextTradeRouteId, state.tradeRoutes.reduce((best, r) => Math.max(best, r.id + 1), 1));
}

export function getLogisticsNode(sectorId) {
    const port = state.ports[sectorId];
    const planet = state.planets[sectorId];
    if (port) {
        const type = PORT_TYPES[port.typeKey];
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
            maxStock: makeStock(9000, 9000, 9000),
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
    return risk + Math.max(0, route.heat || 0) / 12;
}

export function getRouteEscortPower(route) {
    const captain = route.escortCaptainId ? state.captains[route.escortCaptainId] : null;
    if (!captain || captain.status !== "active") return 0;
    const relation = captain.relationshipToPlayer || { opinion: 0, trust: 0, rivalry: 0 };
    return (captain.ship.combatRating || 0) / 14 + Math.max(0, relation.trust || 0) / 8 + Math.max(0, relation.opinion || 0) / 25;
}

export function getRouteMarketValue(sectorId, commodity, mode) {
    const node = getLogisticsNode(sectorId);
    if (!node) return 0;
    const stock = Math.max(0, (node.stock || {})[commodity] || 0);
    const maxStock = Math.max(1, (node.maxStock || {})[commodity] || 1);
    const ratio = Math.max(0, Math.min(1, stock / maxStock));
    const colonyBasePrices = { ore: 85, org: 160, eq: 320, pulse_canister: 7, heavy_pulse_module: 26 };
    const base = node.kind === "port"
        ? (state.ports[sectorId].basePrices || {})[commodity]
        : colonyBasePrices[commodity];
    if (typeof base !== "number") return 0;
    if (mode === "buy") return Math.max(BALANCE.MIN_TRADE_PRICE, Math.round(base * (0.72 + (1 - ratio) * 0.65)));
    return Math.max(BALANCE.MIN_TRADE_PRICE, Math.round(base * (0.70 + (1 - ratio) * 1.10)));
}

export function estimateRouteProfit(originSector, destinationSector, commodity, amount = BALANCE.TRADE_ROUTE_BASE_AMOUNT) {
    const buyValue = getRouteMarketValue(originSector, commodity, "buy");
    const sellValue = getRouteMarketValue(destinationSector, commodity, "sell");
    const spread = Math.max(8, sellValue - buyValue);
    return Math.max(25, Math.floor(spread * amount * 0.38));
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
    const marketChanged = universeChanged || routeMetricsPortsRef !== state.ports || routeMetricsPlanetsRef !== state.planets;
    routeMetricsUniverseRef = state.universe;
    routeMetricsPortsRef = state.ports;
    routeMetricsPlanetsRef = state.planets;
    return { universeChanged, marketChanged };
}

function getRouteMetricsMarketRevision() {
    const rootChange = detectRouteMetricsRootChange();
    if (rootChange.marketChanged) {
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

function ensureRoutePathMetricsCacheFresh() {
    const revision = getWorldGraphRevision();
    if (routePathMetricsRevision !== revision || detectRouteMetricsRootChange().universeChanged) {
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
    const physicalCost = metrics.hopCount * 140 + effectiveSpanCost * 24;
    const riskCost = metrics.risk * 130;
    return Math.round((BALANCE.TRADE_ROUTE_BASE_COST + physicalCost + riskCost) * surchargeMultiplier);
}

function getProfitBand(originSector, destinationSector, commodity) {
    const expected = estimateRouteProfit(originSector, destinationSector, commodity);
    return {
        commodity,
        low: Math.max(0, Math.floor(expected * 0.75)),
        expected,
        high: Math.ceil(expected * 1.25),
        estimatedProfit: expected
    };
}

export function deriveRouteMetrics(originSector, destinationSector) {
    const revision = ensureRoutePathMetricsCacheFresh();
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

    const marketRevision = getRouteMetricsMarketRevision();
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
            const risk = baseRisk === null ? null : baseRisk + Math.max(0, route.heat || 0) / 12;
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
    destinationSector = parseInt(destinationSector, 10);
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
    if (!spendTime(180)) return;
    state.player.credits -= cost;
    const route = createRouteRecord({
        originSector,
        destinationSector,
        commodity,
        factionId: destination.factionId || origin.factionId || "traders",
        reliability: 55
    });
    state.tradeRoutes.push(route);
    addFactionRep("traders", 3, "opened a persistent route");
    addFactionTrust("traders", 1, "route brokerage");
    addSectorInfluence(originSector, getFactionPoliticalPole(origin.factionId || "traders"), 1, "new logistics route");
    addSectorInfluence(destinationSector, getFactionPoliticalPole(destination.factionId || "traders"), 1, "new logistics route");
    addWorldEvent({
        type: "route_opened", sectorId: destinationSector, factionId: route.factionId,
        text: `You opened an explicit ${formatCommodity(commodity)} trade route from sector ${originSector} to sector ${destinationSector}.`,
        importance: 2, alert: true
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
        amount: options.amount || Math.max(6, Math.floor((captain.ship.cargoCapacity || 60) * 0.18)),
        intervalDays: options.intervalDays || BALANCE.TRADE_ROUTE_INTERVAL_DAYS,
        delayDays: options.delayDays || 1,
        factionId: destination.factionId || origin.factionId || captain.preferredFaction || "traders",
        ownerType: "captain",
        ownerId: captain.id,
        operatorType: "captain",
        createdBy: captain.id,
        reliability: 52
    });
    state.tradeRoutes.push(route);
    return route;
}

export function toggleTradeRoute(routeId) {
    routeId = parseInt(routeId, 10);
    const route = state.tradeRoutes.find(r => r.id === routeId);
    if (!route || route.status === "closed") return;
    route.status = route.status === "active" ? "paused" : "active";
    addWorldEvent({ type: "route_status", text: `${route.name} is now ${route.status}.`, sectorId: route.destinationSector, importance: 1, alert: false });
}

export function closeTradeRoute(routeId) {
    routeId = parseInt(routeId, 10);
    const route = state.tradeRoutes.find(r => r.id === routeId);
    if (!route || route.status === "closed") return;
    route.status = "closed";
    route.escortCaptainId = null;
    addWorldEvent({ type: "route_closed", text: `${route.name} was closed.`, sectorId: route.destinationSector, importance: 1, alert: true });
}

export function assignCaptainToRoute(routeId, captainId) {
    routeId = parseInt(routeId, 10);
    const route = state.tradeRoutes.find(r => r.id === routeId);
    const captain = state.captains[captainId];
    if (!route || !captain || route.status === "closed") return;
    const relation = captain.relationshipToPlayer || { opinion: 0, trust: 0, rivalry: 0 };
    const cost = Math.max(350, Math.floor(450 + (captain.ship.combatRating || 10) * 8 - Math.max(0, relation.opinion || 0) * 4));
    if (state.player.credits < cost) { log(`Hiring ${captain.name} for convoy escort requires ${formatCredits(cost)} credits.`); return; }
    if (!spendTime(45)) return;
    state.tradeRoutes.forEach(r => { if (r.escortCaptainId === captainId) r.escortCaptainId = null; });
    state.player.credits -= cost;
    route.escortCaptainId = captainId;
    captain.known = true;
    nudgeCaptainRelation(captainId, { opinion: 4, trust: 2, debt: 1 }, `took escort duty on ${route.name}`);
    addWorldEvent({
        type: "route_escort", captainId, sectorId: route.originSector,
        text: `${captain.name} joined the convoy wing for ${route.name}.`,
        importance: 2, alert: true
    });
}

export function unassignRouteEscort(routeId) {
    routeId = parseInt(routeId, 10);
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
        addWorldEvent({ type: "route_paused", text: `${route.name} paused because one endpoint is no longer valid.`, importance: 2, alert: true });
        return;
    }
    const available = Math.max(0, origin.stock[route.commodity] || 0);
    const capacity = Math.max(0, (destination.maxStock[route.commodity] || 9999) - (destination.stock[route.commodity] || 0));
    const amount = Math.min(route.amount, available, capacity);
    if (amount <= 0) {
        route.failures += 1;
        route.starvedDays = (route.starvedDays || 0) + 1;
        if (route.starvedDays >= 3) route.status = "paused";
        route.reliability = clampRange(route.reliability - 3, 0, 100);
        addWorldEvent({
            type: "route_shortage", sectorId: route.originSector, factionId: route.factionId,
            text: `${route.name} missed a run because ${formatCommodity(route.commodity)} was unavailable or the destination was full.`,
            importance: 1, alert: false
        });
        return;
    }
    const risk = getRouteRisk(route);
    if (risk === null) {
        route.status = "paused";
        addWorldEvent({
            type: "route_disconnected", sectorId: route.originSector, factionId: route.factionId,
            text: `${route.name} paused because no connected jump-gate corridor path exists between sector ${route.originSector} and sector ${route.destinationSector}.`,
            importance: 3, alert: true
        });
        return;
    }
    const escortPower = getRouteEscortPower(route);
    const failureChance = Math.max(0.02, Math.min(0.55, 0.04 + risk * 0.035 - escortPower * 0.025));
    const escortCaptain = route.escortCaptainId ? state.captains[route.escortCaptainId] : null;
    if (random() < failureChance) {
        route.failures += 1;
        route.heat = Math.min(100, route.heat + 3 + Math.floor(risk));
        route.reliability = clampRange(route.reliability - 8, 0, 100);
        const path = getRoutePath(route);
        const hotSector = path ? path.sort((a, b) => (state.universe[b].pirateThreat || 0) - (state.universe[a].pirateThreat || 0))[0] || route.destinationSector : route.destinationSector;
        if (state.universe[hotSector]) state.universe[hotSector].pirateThreat = Math.min(6, (state.universe[hotSector].pirateThreat || 0) + 1);
        if (escortCaptain) nudgeCaptainRelation(escortCaptain.id, { opinion: 1, trust: 1, rivalry: 1 }, `fought through a failed convoy run on ${route.name}`);
        addWorldEvent({
            type: "route_raid", sectorId: hotSector,
            captainId: escortCaptain ? escortCaptain.id : null,
            factionId: "vc",
            text: `${route.name} was hit en route. Pirate pressure increased near sector ${hotSector}.`,
            importance: 3, alert: true
        });
        return;
    }
    origin.stock[route.commodity] -= amount;
    destination.stock[route.commodity] = Math.min(destination.maxStock[route.commodity] || 9999, (destination.stock[route.commodity] || 0) + amount);
    const profit = estimateRouteProfit(route.originSector, route.destinationSector, route.commodity, amount);
    if (route.ownerType === "captain" && route.ownerId && state.captains[route.ownerId]) {
        state.captains[route.ownerId].credits = (state.captains[route.ownerId].credits || 0) + profit;
    } else {
        state.player.credits += profit;
    }
    route.profit += profit;
    route.runs += 1;
    route.starvedDays = 0;
    route.heat = Math.max(0, route.heat - 1);
    route.reliability = clampRange(route.reliability + 2, 0, 100);
    addFactionRep("traders", 1, "route income");
    addSectorInfluence(route.originSector, getFactionPoliticalPole(origin.factionId || "traders"), 1, "regular logistics traffic");
    addSectorInfluence(route.destinationSector, getFactionPoliticalPole(destination.factionId || route.factionId || "traders"), 1, "regular logistics traffic");
    maybeRoutePoliticalSideEffect(route, amount, escortCaptain);
    if (escortCaptain && route.runs % 3 === 0) {
        nudgeCaptainRelation(escortCaptain.id, { opinion: 2, trust: 1 }, `kept ${route.name} running`);
    }
    addWorldEvent({
        type: "route_success", sectorId: route.destinationSector,
        captainId: escortCaptain ? escortCaptain.id : null, factionId: route.factionId,
        text: `${route.name} delivered ${amount} ${formatCommodity(route.commodity)} and earned ${formatCredits(profit)} credits.`,
        importance: route.runs % 3 === 0 ? 2 : 1, alert: false
    });
}

export function maybeRoutePoliticalSideEffect(route, amount, escortCaptain) {
    const destination = getLogisticsNode(route.destinationSector);
    if (!destination) return;
    const pole = getFactionPoliticalPole(destination.factionId || "traders");
    if (route.commodity === "eq" && pole === "hc") addFactionTrust("hc", 1, "equipment route reliability");
    if (route.commodity === "org" && state.planets[route.destinationSector]) addFactionTrust("colonists", 1, "colony food route");
    if (route.commodity === "ore" && pole === "hc") addFactionRep("miners", 1, "ore route throughput");
    if (escortCaptain && escortCaptain.preferredFaction === "smugglers" && random() < 0.15) {
        route.heat = Math.min(100, route.heat + 2);
        addFactionRep("vc", 1, "quiet convoy side business", "private");
    }
}

export function getRouteEscortCandidates() {
    return getKnownCaptains()
        .filter(c => c.status === "active")
        .filter(c => c.archetype === "mercenary" || c.archetype === "trader" || c.archetype === "smuggler" || c.ship.combatRating >= 20)
        .sort((a, b) => (b.ship.combatRating || 0) - (a.ship.combatRating || 0));
}
