import { createInitialEconomyState } from './systems/economy/migration.js';

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

/**
 * Bootstrap source of truth for runtime state shape.
 * Legacy direct state imports remain supported; prefer js/core/state selectors + mutators in new code.
 * @returns {import("./core/state/types.js").AppState & Record<string, any>}
 */
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
        bounties: { byId: {}, allIds: [], nextId: 1 },
        simulationTrace: [],
        nextSimulationTraceId: 1,
        dialogueMemories: [],
        dialogueProposals: [],
        dialogueTasks: [],
        dialogueOffers: [],
        dialogueMessages: [],
        dialogueConversationParts: [],
        dialogueConversations: [],
        dialogueEventLog: [],
        nextDialogueMemoryId: 1,
        nextDialogueProposalId: 1,
        nextDialogueTaskId: 1,
        nextDialogueOfferId: 1,
        nextDialogueMessageId: 1,
        nextDialogueConversationPartId: 1,
        nextDialogueConversationId: 1,
        nextDialogueEventId: 1,
        entanglements: [],
        nextEntanglementId: 1,
        tradeRoutes: [],
        nextTradeRouteId: 1,
        logisticsObjectives: [],
        nextLogisticsObjectiveId: 1,
        starField: [],
        nextMissionId: 1,
        selectedSectorId: 1,
        currentScreen: "sector",
        selectedDialogueConversationId: null,
        reputationTab: "factions",
        appMode: APP_MODES.MAIN_MENU,
        shellMessage: null,
        settingsOpenTab: "general",
        isTransitioning: false,
        selectedCaptainId: null,
        economyFocus: { sectorId: null, commodity: null, source: null, updatedDay: null },
        mapNodeCache: {},
        hoveredSectorId: null,
        mapLayers: {
            systems: true,
            asteroids: true,
            influence: true,
            tradeRoutes: true,
            contestedZones: true,
            dataFreshness: true
        },
        mapLayersOpen: true,
        mapHelpOpen: false,
        mapInspectorCompact: false,
        mapPanelMode: "full",
        screenPanelMode: "full",
        mapViewport: { scale: 1, offsetX: 0, offsetY: 0 },
        worldGraphRevision: 0,
        economy: createInitialEconomyState(),
        marketRevision: 0,
        logisticsNodeRevision: 0,
        influenceRevision: 0,
        ambientTrade: { day: 0, moved: { ore: 0, org: 0, eq: 0 }, flows: 0 },
        priorityBriefing: {
            dismissed: {}
        },
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

/**
 * Live mutable app state.
 * Legacy compatibility export; new modules should use js/core/state/index.js boundaries.
 */
export const state = createInitialState();

export function resetState() {
    const freshState = createInitialState();
    Object.keys(state).forEach(key => delete state[key]);
    Object.assign(state, freshState);
}
