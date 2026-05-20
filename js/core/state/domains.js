// @ts-check

const CORE_STATE_SLICE = Object.freeze({
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
    LOGISTICS_OBJECTIVES: 'logisticsObjectives',
    MISSIONS: 'missions',
    ENTANGLEMENTS: 'entanglements'
});

export const StateSlice = Object.freeze({
    ...CORE_STATE_SLICE
});


export const DOMAIN_SLICE_MAP = Object.freeze({
    player: { keys: ['player'], slices: [StateSlice.PLAYER] },
    universe: { keys: ['universe', 'sitesById', 'siteIdByCoord', 'world', 'worldgenSettings'], slices: [StateSlice.UNIVERSE] },
    economy: { keys: ['ports', 'planets', 'ambientTrade', 'companies', 'people', 'polities'], slices: [StateSlice.ECONOMY] },
    routes: { keys: ['tradeRoutes', 'nextTradeRouteId'], slices: [StateSlice.ROUTES] },
    captains: { keys: ['captains', 'captainEventLog', 'nextCaptainEventId'], slices: [StateSlice.CAPTAINS] },
    dialogue: { keys: ['dialogueConversations', 'selectedDialogueConversationId', 'dialogueConversationParts'], slices: [StateSlice.DIALOGUE] },
    persistence: { keys: ['rng'], slices: [StateSlice.PERSISTENCE] },
    missions: { keys: ['missions', 'nextMissionId'], slices: [StateSlice.MISSIONS] },
    uiRuntime: { keys: ['currentScreen', 'selectedSectorId', 'mapViewport', 'mapLayers', 'appMode', 'reputationTab', 'mapInspectorCompact', 'mapLayersOpen', 'mapHelpOpen', 'selectedCaptainId', 'screenPanelMode', 'mapPanelMode'], slices: [StateSlice.UI_RUNTIME] },
    events: { keys: ['worldEvents', 'priorityBriefing', 'simulationTrace', 'nextWorldEventId', 'nextSimulationTraceId'], slices: [StateSlice.EVENTS] },
    dataCargo: { keys: ['dataCargo'], slices: [StateSlice.DATA_CARGO] },
    logisticsObjectives: { keys: ['logisticsObjectives', 'nextLogisticsObjectiveId'], slices: [StateSlice.LOGISTICS_OBJECTIVES] },
    entanglements: { keys: ['entanglements'], slices: [StateSlice.ENTANGLEMENTS] }
});


export function stateChanged(...slices) {
    return slices.filter(Boolean);
}

export function mapStateSlicesForInvalidation(...slices) {
    return [...new Set(slices.filter(Boolean))];
}
