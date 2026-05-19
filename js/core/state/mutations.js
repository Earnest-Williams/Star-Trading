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

export const patchPlayer = patch => mergeInto(state.player, patch) ? stateChanged(StateSlice.PLAYER) : [];
export const patchPlayerCargo = patch => mergeInto(state.player?.cargo, patch) ? stateChanged(StateSlice.PLAYER) : [];
export const setPlayerCredits = value => {
    if (!state.player || !Number.isFinite(value)) return [];
    state.player.credits = Number(value);
    return stateChanged(StateSlice.PLAYER);
};
export const patchSite = (siteId, patch) => mergeInto(state.universe?.[siteId], patch) ? stateChanged(StateSlice.UNIVERSE) : [];
export const patchPort = (sectorId, patch) => mergeInto(state.ports?.[sectorId], patch) ? stateChanged(StateSlice.ECONOMY) : [];
export const patchPlanet = (sectorId, patch) => mergeInto(state.planets?.[sectorId], patch) ? stateChanged(StateSlice.ECONOMY) : [];
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
    const originStock = state.ports?.[route.originSector]?.stock || state.planets?.[route.originSector]?.stock;
    const destinationStock = state.ports?.[route.destinationSector]?.stock || state.planets?.[route.destinationSector]?.stock;
    const destinationMaxStock = state.ports?.[route.destinationSector]?.maxStock || state.planets?.[route.destinationSector]?.maxStock;
    if (!originStock || !destinationStock || !destinationMaxStock) return [];
    originStock[route.commodity] = Math.max(0, (originStock[route.commodity] || 0) - amount);
    destinationStock[route.commodity] = Math.min(
        destinationMaxStock[route.commodity] || 0,
        (destinationStock[route.commodity] || 0) + amount
    );
    return stateChanged(StateSlice.ECONOMY);
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
