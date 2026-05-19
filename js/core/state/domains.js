// @ts-check

export const StateSlice = Object.freeze({
    PLAYER: 'player',
    UNIVERSE: 'universe',
    ECONOMY: 'economy',
    ROUTES: 'routes',
    CAPTAINS: 'captains',
    DIALOGUE: 'dialogue',
    PERSISTENCE: 'persistence',
    UI_RUNTIME: 'uiRuntime',
    EVENTS: 'events',
    DATA_CARGO: 'dataCargo',
    LOGISTICS_OBJECTIVES: 'logisticsObjectives'
});

export const DOMAIN_SLICE_MAP = Object.freeze({
    player: { keys: ['player'], slices: [StateSlice.PLAYER] },
    universe: { keys: ['universe', 'sitesById', 'siteIdByCoord', 'world', 'worldgenSettings'], slices: [StateSlice.UNIVERSE] },
    economy: { keys: ['ports', 'planets', 'ambientTrade', 'companies', 'people', 'polities'], slices: [StateSlice.ECONOMY] },
    routes: { keys: ['tradeRoutes', 'nextTradeRouteId'], slices: [StateSlice.ROUTES] },
    captains: { keys: ['captains', 'captainEventLog', 'nextCaptainEventId'], slices: [StateSlice.CAPTAINS] },
    dialogue: { keys: ['dialogueConversations', 'selectedDialogueConversationId', 'dialogueConversationParts'], slices: [StateSlice.DIALOGUE] },
    persistence: { keys: ['rng', 'nextMissionId'], slices: [StateSlice.PERSISTENCE] },
    uiRuntime: { keys: ['currentScreen', 'selectedSectorId', 'mapViewport', 'mapLayers', 'appMode'], slices: [StateSlice.UI_RUNTIME] },
    events: { keys: ['worldEvents', 'simulationTrace', 'nextWorldEventId', 'nextSimulationTraceId'], slices: [StateSlice.EVENTS] },
    dataCargo: { keys: ['dataCargo'], slices: [StateSlice.DATA_CARGO] },
    logisticsObjectives: { keys: ['logisticsObjectives', 'nextLogisticsObjectiveId'], slices: [StateSlice.LOGISTICS_OBJECTIVES] }
});

export function stateChanged(...slices) {
    return slices.filter(Boolean);
}
