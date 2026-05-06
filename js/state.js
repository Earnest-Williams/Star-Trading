export function createInitialState() {
    return {
        player: null,
        universe: {},
        ports: {},
        planets: {},
        missions: [],
        captains: {},
        captainEventLog: [],
        nextCaptainEventId: 1,
        worldEvents: [],
        nextWorldEventId: 1,
        tradeRoutes: [],
        nextTradeRouteId: 1,
        starField: [],
        nextMissionId: 1,
        selectedSectorId: 1,
        currentScreen: "sector",
        reputationTab: "factions",
        selectedCaptainId: null,
        mapNodeCache: {}
    };
}

export const state = createInitialState();

export function resetState() {
    const freshState = createInitialState();
    Object.keys(state).forEach(key => delete state[key]);
    Object.assign(state, freshState);
}
