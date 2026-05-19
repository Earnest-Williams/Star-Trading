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
    LOGISTICS_OBJECTIVES: 'logisticsObjectives'
});

export const StateSlice = Object.freeze({
    ...CORE_STATE_SLICE,

    // Compatibility-only aliases for legacy UI invalidation wiring.
    TIME: 'time',
    PORTS: 'ports',
    PLANETS: 'planets',
    FACTIONS: 'factions',
    MISSIONS: 'missions',
    TRADE_ROUTES: 'tradeRoutes',
    ENTANGLEMENTS: 'entanglements',
    WORLD_EVENTS: 'worldEvents',
    PRIORITY_BRIEFING: 'priorityBriefing',

    CURRENT_SCREEN: 'currentScreen',
    REPUTATION_TAB: 'reputationTab',
    APP_MODE: 'appMode',
    SHELL_MESSAGE: 'shellMessage',
    PREFERENCES: 'preferences',
    SELECTED_SECTOR: 'selectedSector',
    SELECTED_CAPTAIN: 'selectedCaptain',
    MAP_VIEW: 'mapView'
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

const CORE_TO_RENDERER_SLICES = Object.freeze({
    [CORE_STATE_SLICE.ECONOMY]: [StateSlice.PORTS, StateSlice.PLANETS, StateSlice.FACTIONS],
    [CORE_STATE_SLICE.ROUTES]: [StateSlice.TRADE_ROUTES],
    [CORE_STATE_SLICE.UI_RUNTIME]: [StateSlice.CURRENT_SCREEN, StateSlice.SELECTED_SECTOR, StateSlice.MAP_VIEW, StateSlice.APP_MODE],
    [CORE_STATE_SLICE.EVENTS]: [StateSlice.WORLD_EVENTS]
});

export function stateChanged(...slices) {
    return slices.filter(Boolean);
}

export function mapStateSlicesForInvalidation(...slices) {
    const mapped = [];
    for (const slice of slices.filter(Boolean)) {
        mapped.push(slice);
        const compatSlices = CORE_TO_RENDERER_SLICES[slice];
        if (compatSlices) mapped.push(...compatSlices);
    }
    return [...new Set(mapped)];
}
