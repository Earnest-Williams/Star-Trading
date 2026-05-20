// @ts-check
import { state } from '../../state.js';
import { StateSlice, stateChanged } from './domains.js';

const cleanPatch = patch => Object.fromEntries(Object.entries(patch || {}).filter(([, value]) => typeof value !== 'undefined'));
const mergeInto = (target, patch) => {
    const safePatch = cleanPatch(patch);
    if (!target || Object.keys(safePatch).length === 0) return false;
    Object.assign(target, safePatch);
    return true;
};
const incrementRevision = key => {
    const value = Number(state[key]);
    state[key] = Number.isFinite(value) ? value + 1 : 1;
};
export const bumpMarketRevision = () => incrementRevision('marketRevision');
export const bumpLogisticsNodeRevision = () => incrementRevision('logisticsNodeRevision');
export const bumpInfluenceRevision = () => incrementRevision('influenceRevision');
export const bumpWorldGraphRevision = () => incrementRevision('worldGraphRevision');
export const setSectorPirateThreat = (sectorId, value) => {
    const sector = state.universe?.[sectorId];
    if (!sector || !Number.isFinite(value)) return [];
    const nextValue = Math.max(0, Number(value));
    if ((sector.pirateThreat || 0) === nextValue) return [];
    sector.pirateThreat = nextValue;
    incrementRevision('influenceRevision');
    return stateChanged(StateSlice.UNIVERSE);
};
export const adjustSectorPirateThreat = (sectorId, delta, cap = Number.POSITIVE_INFINITY) => {
    const sector = state.universe?.[sectorId];
    if (!sector || !Number.isFinite(delta)) return [];
    const base = Number(sector.pirateThreat) || 0;
    const nextValue = Math.max(0, Math.min(Number(cap), base + Number(delta)));
    return setSectorPirateThreat(sectorId, nextValue);
};

export const patchPlayer = patch => mergeInto(state.player, patch) ? stateChanged(StateSlice.PLAYER) : [];
export const patchPlayerCargo = patch => mergeInto(state.player?.cargo, patch) ? stateChanged(StateSlice.PLAYER) : [];
export const setPlayerCredits = value => {
    if (!state.player || !Number.isFinite(value)) return [];
    state.player.credits = Number(value);
    return stateChanged(StateSlice.PLAYER);
};
export const patchSite = (siteId, patch) => {
    const site = state.universe?.[siteId];
    const safePatch = cleanPatch(patch);
    if (!site || Object.keys(safePatch).length === 0) return [];
    Object.assign(site, safePatch);
    const keys = Object.keys(safePatch);
    if (keys.some(key => key === 'jumpGates' || key === 'coord')) bumpWorldGraphRevision();
    if (keys.some(key => key === 'pirateThreat' || key === 'influence' || key === 'front' || key === 'station' || key === 'asteroids')) bumpInfluenceRevision();
    if (keys.some(key => key === 'asteroids')) bumpLogisticsNodeRevision();
    return stateChanged(StateSlice.UNIVERSE);
};
export const patchPort = (sectorId, patch) => {
    const safePatch = cleanPatch(patch);
    if (!mergeInto(state.ports?.[sectorId], safePatch)) return [];
    const keys = Object.keys(safePatch);
    if (keys.some(key => key === 'stock' || key === 'basePrices' || key === 'maxStock' || key === 'priceBias')) incrementRevision('marketRevision');
    if (keys.some(key => key === 'stock' || key === 'maxStock' || key === 'hiddenFactionId' || key === 'factionId' || key === 'publicFactionId')) incrementRevision('logisticsNodeRevision');
    if (keys.some(key => ['hiddenFactionId', 'factionId', 'publicFactionId'].includes(key))) incrementRevision('influenceRevision');
    return stateChanged(StateSlice.ECONOMY);
};
export const patchPlanet = (sectorId, patch) => {
    const safePatch = cleanPatch(patch);
    if (!mergeInto(state.planets?.[sectorId], safePatch)) return [];
    const keys = Object.keys(safePatch);
    if (keys.some(key => key === 'stock' || key === 'basePrices' || key === 'maxStock')) incrementRevision('marketRevision');
    if (keys.some(key => key === 'stock' || key === 'maxStock' || key === 'colonists' || key === 'satisfaction' || key === 'owner' || key === 'factionId')) incrementRevision('logisticsNodeRevision');
    if (keys.some(key => ['colonists', 'satisfaction', 'owner', 'factionId'].includes(key))) incrementRevision('influenceRevision');
    return stateChanged(StateSlice.ECONOMY);
};
export const patchRoute = (routeId, patch) => {
    const route = Array.isArray(state.tradeRoutes) ? state.tradeRoutes.find(item => item?.id === routeId) : null;
    return mergeInto(route, patch) ? stateChanged(StateSlice.ROUTES) : [];
};
export const addTradeRoute = route => {
    if (!route || !Array.isArray(state.tradeRoutes)) return [];
    state.tradeRoutes.push(route);
    return stateChanged(StateSlice.ROUTES);
};
export const removeOrCloseTradeRoute = routeId => patchRoute(routeId, { status: 'closed' });

export const setTradeRoutes = routes => {
    if (!Array.isArray(routes)) return [];
    state.tradeRoutes = routes;
    return stateChanged(StateSlice.ROUTES);
};
export const clearEscortAssignmentsForCaptain = captainId => {
    if (!Array.isArray(state.tradeRoutes)) return [];
    let changed = false;
    state.tradeRoutes.forEach(route => {
        if (route?.escortCaptainId === captainId) {
            route.escortCaptainId = null;
            changed = true;
        }
    });
    return changed ? stateChanged(StateSlice.ROUTES) : [];
};
export const patchRouteEconomyAtEndpoints = (route, amount) => {
    if (!route || !Number.isFinite(amount)) return [];
    const originPort = state.ports?.[route.originSector];
    const originPlanet = state.planets?.[route.originSector];
    const destPort = state.ports?.[route.destinationSector];
    const destPlanet = state.planets?.[route.destinationSector];
    const originNode = originPort || originPlanet;
    const destNode = destPort || destPlanet;
    if (!originNode?.stock || !destNode?.stock || !destNode?.maxStock) return [];
    const originCommodityStock = Math.max(0, (originNode.stock[route.commodity] || 0) - amount);
    const destCommodityStock = Math.min(
        destNode.maxStock[route.commodity] || 0,
        (destNode.stock[route.commodity] || 0) + amount
    );
    const patchNodeStock = (sectorId, isPort, node, value) => {
        const updatedStock = { ...node.stock, [route.commodity]: value };
        return isPort
            ? patchPort(sectorId, { stock: updatedStock })
            : patchPlanet(sectorId, { stock: updatedStock });
    };
    const results = [
        ...patchNodeStock(route.originSector, Boolean(originPort), originNode, originCommodityStock),
        ...patchNodeStock(route.destinationSector, Boolean(destPort), destNode, destCommodityStock)
    ];
    return [...new Set(results)];
};
export const addPlayerCredits = value => {
    if (!state.player || !Number.isFinite(value)) return [];
    state.player.credits = (state.player.credits || 0) + Number(value);
    return stateChanged(StateSlice.PLAYER);
};
export const addCaptainCredits = (captainId, value) => {
    if (!state.captains?.[captainId] || !Number.isFinite(value)) return [];
    state.captains[captainId].credits = (state.captains[captainId].credits || 0) + Number(value);
    return stateChanged(StateSlice.CAPTAINS);
};
export const patchCaptain = (captainId, patch) => mergeInto(state.captains?.[captainId], patch) ? stateChanged(StateSlice.CAPTAINS) : [];

export const consumeNextTradeRouteId = () => {
    if (!Number.isInteger(state.nextTradeRouteId)) state.nextTradeRouteId = 1;
    const routeId = state.nextTradeRouteId;
    state.nextTradeRouteId += 1;
    return routeId;
};
export const ensureMinNextTradeRouteId = minimum => {
    if (!Number.isInteger(minimum)) return;
    const current = Number.isInteger(state.nextTradeRouteId) ? state.nextTradeRouteId : 1;
    state.nextTradeRouteId = Math.max(current, minimum);
};
export const setCurrentScreen = screen => {
    if (typeof screen !== 'string') return [];
    state.currentScreen = screen;
    return stateChanged(StateSlice.UI_RUNTIME);
};
export const setSelectedSectorId = sectorId => {
    state.selectedSectorId = sectorId;
    return stateChanged(StateSlice.UI_RUNTIME);
};
export const patchMapViewport = patch => mergeInto(state.mapViewport, patch) ? stateChanged(StateSlice.UI_RUNTIME) : [];
export const patchAmbientTrade = patch => mergeInto(state.ambientTrade, patch) ? stateChanged(StateSlice.ECONOMY) : [];
export const appendWorldEvent = event => {
    if (!event || !Array.isArray(state.worldEvents)) return [];
    state.worldEvents.unshift(event);
    return stateChanged(StateSlice.EVENTS);
};
export const appendSimulationTrace = trace => {
    if (!trace || !Array.isArray(state.simulationTrace)) return [];
    state.simulationTrace.unshift(trace);
    return stateChanged(StateSlice.EVENTS);
};
