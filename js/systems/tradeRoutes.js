import { state } from '../state.js';
import { BALANCE, COMMODITIES, PORT_TYPES, FACTIONS } from '../constants.js';
import { clampRange, makeStock, formatCommodity, formatCredits, log, random } from '../utils.js';
import { getDominantInfluence, addSectorInfluence } from '../core/influence.js';
import { addWorldEvent } from '../core/worldEvents.js';
import { getFactionPoliticalPole, addFactionRep, addFactionTrust, applyPoliticalEffect } from '../core/factions.js';
import { spendTime } from '../core/time.js';
import { nudgeCaptainRelation, getKnownCaptains } from './captains.js';
import { getPortPrice } from './market.js';
import { getColonyDailyNeeds } from './colonies.js';
import { findShortestSectorPath, getSectorPathDistance, getCorridorRiskForPath } from '../core/navigation.js';

export function normaliseTradeRoutes() {
    if (!Array.isArray(state.tradeRoutes)) state.tradeRoutes = [];
    state.tradeRoutes.forEach(route => {
        if (typeof route.id !== "number") route.id = state.nextTradeRouteId++;
        if (!route.status) route.status = "active";
        if (typeof route.amount !== "number") route.amount = BALANCE.TRADE_ROUTE_BASE_AMOUNT;
        if (typeof route.intervalDays !== "number") route.intervalDays = BALANCE.TRADE_ROUTE_INTERVAL_DAYS;
        if (typeof route.nextRunDay !== "number") route.nextRunDay = state.player.time.day + 1;
        if (typeof route.runs !== "number") route.runs = 0;
        if (typeof route.failures !== "number") route.failures = 0;
        if (typeof route.starvedDays !== "number") route.starvedDays = 0;
        if (typeof route.profit !== "number") route.profit = 0;
        if (typeof route.heat !== "number") route.heat = 0;
        if (typeof route.reliability !== "number") route.reliability = 50;
        if (!route.ownerType) route.ownerType = "player";
        if (typeof route.ownerId === "undefined") route.ownerId = route.ownerType === "player" ? null : route.ownerId;
        if (!route.operatorType) route.operatorType = route.ownerType;
        if (!route.createdBy) route.createdBy = route.ownerType;
        if (typeof route.escortCaptainId === "undefined") route.escortCaptainId = null;
        if (route.status !== "closed" && !findShortestSectorPath(route.originSector, route.destinationSector)) {
            route.status = "paused";
        }
    });
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

export function routeExists(originSector, destinationSector, commodity) {
    return state.tradeRoutes.some(r => r.status !== "closed" && r.originSector === originSector && r.destinationSector === destinationSector && r.commodity === commodity);
}

export function findShortestPath(start, goal) {
    return findShortestSectorPath(start, goal);
}

export function getRoutePath(route) { return findShortestSectorPath(route.originSector, route.destinationSector); }
export function getRouteDistance(originSector, destinationSector) {
    return getSectorPathDistance(originSector, destinationSector);
}

export function getRouteCommodityOptions(originSector, destinationSector) {
    const origin = getLogisticsNode(originSector);
    const destination = getLogisticsNode(destinationSector);
    if (!origin || !destination || originSector === destinationSector) return [];
    if (!findShortestSectorPath(originSector, destinationSector)) return [];
    return COMMODITIES.filter(c => origin.sells.includes(c) && destination.buys.includes(c));
}

export function getRouteSetupCost(originSector, destinationSector) {
    const distance = getRouteDistance(originSector, destinationSector);
    const risk = getRouteRiskForSectors(originSector, destinationSector);
    if (distance === null || risk === null) return null;
    return BALANCE.TRADE_ROUTE_BASE_COST + distance * 220 + risk * 130;
}

export function getRouteRiskForSectors(originSector, destinationSector) {
    const path = findShortestSectorPath(originSector, destinationSector);
    return path ? getCorridorRiskForPath(path) : null;
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
    const stock = Math.max(0, node.stock[commodity] || 0);
    const maxStock = Math.max(1, node.maxStock[commodity] || 1);
    const ratio = Math.max(0, Math.min(1, stock / maxStock));
    const base = node.kind === "port" ? state.ports[sectorId].basePrices[commodity] : { ore: 85, org: 160, eq: 320 }[commodity];
    if (mode === "buy") return Math.max(BALANCE.MIN_TRADE_PRICE, Math.round(base * (0.72 + (1 - ratio) * 0.65)));
    return Math.max(BALANCE.MIN_TRADE_PRICE, Math.round(base * (0.70 + (1 - ratio) * 1.10)));
}

export function estimateRouteProfit(originSector, destinationSector, commodity, amount = BALANCE.TRADE_ROUTE_BASE_AMOUNT) {
    const buyValue = getRouteMarketValue(originSector, commodity, "buy");
    const sellValue = getRouteMarketValue(destinationSector, commodity, "sell");
    const spread = Math.max(8, sellValue - buyValue);
    return Math.max(25, Math.floor(spread * amount * 0.38));
}

export function createTradeRoute(destinationSector, commodity) {
    destinationSector = parseInt(destinationSector, 10);
    const originSector = state.player.currentSector;
    const origin = getLogisticsNode(originSector);
    const destination = getLogisticsNode(destinationSector);
    if (!origin || !destination) { log("Trade routes need a port or player colony at both ends."); return; }
    if (!findShortestSectorPath(originSector, destinationSector)) { log(`No connected jump-gate corridor path exists from sector ${originSector} to sector ${destinationSector}. Route creation cancelled.`); return; }
    if (!getRouteCommodityOptions(originSector, destinationSector).includes(commodity)) { log("That route does not have a useful commodity flow."); return; }
    if (routeExists(originSector, destinationSector, commodity)) { log("That route already exists."); return; }
    const cost = getRouteSetupCost(originSector, destinationSector);
    if (cost === null) { log(`No connected jump-gate corridor path exists from sector ${originSector} to sector ${destinationSector}. Route creation cancelled.`); return; }
    if (state.player.credits < cost) { log(`Opening that route requires ${formatCredits(cost)} credits.`); return; }
    if (!spendTime(180)) return;
    state.player.credits -= cost;
    const route = {
        id: state.nextTradeRouteId++,
        name: `${formatCommodity(commodity)} ${originSector}->${destinationSector}`,
        originSector, destinationSector, commodity,
        amount: BALANCE.TRADE_ROUTE_BASE_AMOUNT,
        intervalDays: BALANCE.TRADE_ROUTE_INTERVAL_DAYS,
        nextRunDay: state.player.time.day + 1,
        factionId: destination.factionId || origin.factionId || "traders",
        ownerType: "player",
        ownerId: null,
        operatorType: "player",
        createdBy: "player",
        escortCaptainId: null,
        status: "active",
        runs: 0, failures: 0, starvedDays: 0, profit: 0, heat: 0, reliability: 55
    };
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
    if (!findShortestSectorPath(originSector, destinationSector)) return null;
    if (!getRouteCommodityOptions(originSector, destinationSector).includes(commodity)) return null;
    if (routeExists(originSector, destinationSector, commodity)) return null;
    const route = {
        id: state.nextTradeRouteId++,
        name: `${captain.callsign || captain.name} ${formatCommodity(commodity)} ${originSector}->${destinationSector}`,
        originSector, destinationSector, commodity,
        amount: options.amount || Math.max(6, Math.floor((captain.ship.cargoCapacity || 60) * 0.18)),
        intervalDays: options.intervalDays || BALANCE.TRADE_ROUTE_INTERVAL_DAYS,
        nextRunDay: state.player.time.day + (options.delayDays || 1),
        factionId: destination.factionId || origin.factionId || captain.preferredFaction || "traders",
        ownerType: "captain",
        ownerId: captain.id,
        operatorType: "captain",
        createdBy: captain.id,
        escortCaptainId: null,
        status: "active",
        runs: 0, failures: 0, starvedDays: 0, profit: 0, heat: 0, reliability: 52
    };
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
