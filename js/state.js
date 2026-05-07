export function createInitialState() {
    return {
        player: null,
        universe: {},
        sitesById: {},
        siteIdByCoord: {},
        world: { saveModel: "sparse-3d-sites", roles: {} },
        worldgenSettings: null,
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
        mapNodeCache: {},
        ambientTrade: { day: 0, moved: { ore: 0, org: 0, eq: 0 }, flows: 0 },
        rng: null
    };
}

export const state = createInitialState();

export function resetState() {
    const freshState = createInitialState();
    Object.keys(state).forEach(key => delete state[key]);
    Object.assign(state, freshState);
}
