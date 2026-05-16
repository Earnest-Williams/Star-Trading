export const APP_MODES = Object.freeze({
    MAIN_MENU: "mainMenu",
    IN_GAME: "inGame",
    SETTINGS: "settings"
});

const APP_MODE_VALUES = new Set(Object.values(APP_MODES));

export function isValidAppMode(mode) {
    return APP_MODE_VALUES.has(mode);
}

export function setAppMode(mode) {
    if (!isValidAppMode(mode)) {
        throw new Error(`Invalid app mode: ${mode}`);
    }
    state.appMode = mode;
    return state.appMode;
}

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
        companies: {},
        companyIdsBySector: {},
        nextCompanyId: 1,
        people: {},
        peopleBySector: {},
        peopleByCompany: {},
        nextPersonId: 1,
        polities: {},
        polityIdsBySector: {},
        missions: [],
        captains: {},
        captainEventLog: [],
        nextCaptainEventId: 1,
        worldEvents: [],
        nextWorldEventId: 1,
        dialogueMemories: [],
        dialogueTasks: [],
        dialogueMessages: [],
        dialogueConversationParts: [],
        dialogueConversations: [],
        dialogueEventLog: [],
        nextDialogueMemoryId: 1,
        nextDialogueTaskId: 1,
        nextDialogueMessageId: 1,
        nextDialogueConversationPartId: 1,
        nextDialogueConversationId: 1,
        nextDialogueEventId: 1,
        entanglements: [],
        nextEntanglementId: 1,
        tradeRoutes: [],
        nextTradeRouteId: 1,
        starField: [],
        nextMissionId: 1,
        selectedSectorId: 1,
        currentScreen: "sector",
        reputationTab: "factions",
        appMode: APP_MODES.MAIN_MENU,
        shellMessage: null,
        settingsOpenTab: "general",
        isTransitioning: false,
        selectedCaptainId: null,
        mapNodeCache: {},
        hoveredSectorId: null,
        mapViewport: { scale: 1, offsetX: 0, offsetY: 0 },
        worldGraphRevision: 0,
        ambientTrade: { day: 0, moved: { ore: 0, org: 0, eq: 0 }, flows: 0 },
        dataCargo: {
            sectorKnowledge: {},
            playerHold: {
                publicSnapshots: {},
                privatePayloads: [],
                securePayloads: []
            },
            secureContracts: [],
            ambientTransfers: [],
            nextPayloadId: 1,
            license: {
                secureCourier: false,
                issuedByFactionId: null,
                issuedDay: null
            }
        },
        rng: null
    };
}

export const state = createInitialState();

export function resetState() {
    const freshState = createInitialState();
    Object.keys(state).forEach(key => delete state[key]);
    Object.assign(state, freshState);
}
