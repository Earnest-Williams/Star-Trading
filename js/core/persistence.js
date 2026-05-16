import { createInitialState, state } from '../state.js';
import { BALANCE, SAVE_KEY, SAVE_KEY_LEGACY, SAVE_KEY_CLASSIC, SAVE_VERSION, CARGO_COMMODITIES, MARKET_COMMODITIES, DEFAULT_FACTION_RELATIONS, PORT_TYPES } from '../constants.js';
import { createPlayer } from './universe.js';
import { ensureFactionState, clampPlayerState } from './factions.js';
import { normaliseSectorInfluence, getDominantInfluence } from './influence.js';
import { getSectorStatusLabel } from './influence.js';
import { normaliseCaptains } from '../systems/captains.js';
import { normaliseTradeRoutes } from '../systems/tradeRoutes.js';
import { normaliseEntanglements } from '../systems/entanglements.js';
import { ensureContrabandHold } from '../systems/contraband.js';
import { prepareMissionOpportunity } from '../systems/missions.js';
import { createContactState } from './factions.js';
import { makeStock, restoreSessionRng } from '../utils.js';
import { log } from '../utils.js';
import { createCharacter, normaliseCharacter } from './characters.js';
import { normaliseDataCargoState } from './dataCargo.js';
import { normaliseDialogueTables } from '../systems/people/conversationParts.js';
import { normaliseDialogueConversations } from '../systems/people/conversations.js';
import { normaliseDialogueEvents } from '../systems/people/dialogueEvents.js';
import { normaliseDialogueMessages } from '../systems/people/messages.js';
import { normaliseDialogueTasks } from '../systems/people/dialogueTasks.js';
import { normaliseDialogueMemories } from '../systems/people/memory.js';

const defaultPersistenceAdapters = {
    storage: null,
    logger: log,
    notifier: null,
    afterLoad: null
};

let persistenceAdapters = { ...defaultPersistenceAdapters };

function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}


function migrateLegacyWarpAdjacencyToJumpGates(universe) {
    if (!isObject(universe)) return;
    Object.values(universe).forEach(sector => {
        if (!Array.isArray(sector.jumpGates)) sector.jumpGates = [];
    });
    Object.values(universe).forEach(sector => {
        if (!Array.isArray(sector.warps)) return;
        sector.warps.forEach(targetId => {
            const target = universe[targetId];
            if (!target || sector.id === targetId) return;
            if (sector.jumpGates.some(gate => gate.destinationSectorId === targetId)) return;
            if (!Array.isArray(target.jumpGates)) target.jumpGates = [];
            const corridorId = `legacy-corridor-${Math.min(sector.id, targetId)}-${Math.max(sector.id, targetId)}`;
            const gateAId = `legacy-gate-${sector.id}-${targetId}`;
            const gateBId = `legacy-gate-${targetId}-${sector.id}`;
            sector.jumpGates.push({ id: gateAId, corridorId, destinationSectorId: targetId, destinationGateId: gateBId, status: "active", owningFactionId: null, toll: 0, stability: 100 });
            if (!target.jumpGates.some(gate => gate.destinationSectorId === sector.id)) {
                target.jumpGates.push({ id: gateBId, corridorId, destinationSectorId: sector.id, destinationGateId: gateAId, status: "active", owningFactionId: null, toll: 0, stability: 100 });
            }
        });
    });
    Object.values(universe).forEach(sector => { delete sector.warps; });
}

function normaliseRouteOwnership(data) {
    if (!Array.isArray(data.tradeRoutes)) data.tradeRoutes = [];
    data.tradeRoutes.forEach(route => {
        if (!route.ownerType) route.ownerType = "player";
        if (typeof route.ownerId === "undefined") route.ownerId = route.ownerType === "player" ? null : route.ownerId;
        if (!route.operatorType) route.operatorType = route.ownerType;
        if (!route.createdBy) route.createdBy = route.ownerType;
    });
}

function migrateShipTransitFields(player) {
    if (!player || !player.ship) return;
    // Legacy save migration: old ship saves stored this as travelMinutesPerWarp.
    const legacyTransitMinutes = player.ship.travelMinutesPerWarp;
    if (typeof player.ship.travelMinutesPerCorridor !== "number") {
        player.ship.travelMinutesPerCorridor = typeof legacyTransitMinutes === "number" ? legacyTransitMinutes : 45;
    }
    delete player.ship.travelMinutesPerWarp;
}

function deterministicSeedFromPayload(data) {
    const payload = JSON.stringify(data);
    let hash = 2166136261;
    for (let i = 0; i < payload.length; i++) {
        hash ^= payload.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) || 1;
}

function replaceStateContents(target) {
    Object.keys(state).forEach(key => delete state[key]);
    Object.assign(state, target);
}

function withStateTarget(target, fn) {
    const liveSnapshot = { ...state };
    replaceStateContents(target);
    try {
        fn();
        Object.keys(target).forEach(key => delete target[key]);
        Object.assign(target, state);
    } finally {
        replaceStateContents(liveSnapshot);
    }
}

export function validateRawSave(data) {
    return isObject(data)
        && isObject(data.player)
        && isObject(data.universe)
        && isObject(data.ports)
        && isObject(data.planets);
}

export function buildLoadedState(data) {
    const loadedState = createInitialState();
    loadedState.player = data.player;
    loadedState.universe = data.universe;
    loadedState.sitesById = data.universe;
    loadedState.siteIdByCoord = data.siteIdByCoord || {};
    loadedState.world = data.world || loadedState.world;
    loadedState.worldgenSettings = data.worldgenSettings || null;
    loadedState.ports = data.ports;
    loadedState.planets = data.planets;
    loadedState.companies = isObject(data.companies) ? data.companies : {};
    loadedState.companyIdsBySector = isObject(data.companyIdsBySector) ? data.companyIdsBySector : {};
    loadedState.nextCompanyId = data.nextCompanyId || (Object.keys(loadedState.companies).length + 1);
    loadedState.people = isObject(data.people) ? data.people : {};
    loadedState.peopleBySector = isObject(data.peopleBySector) ? data.peopleBySector : {};
    loadedState.peopleByCompany = isObject(data.peopleByCompany) ? data.peopleByCompany : {};
    loadedState.nextPersonId = data.nextPersonId || (Object.keys(loadedState.people).length + 1);
    loadedState.polities = isObject(data.polities) ? data.polities : {};
    loadedState.polityIdsBySector = isObject(data.polityIdsBySector) ? data.polityIdsBySector : {};
    loadedState.missions = Array.isArray(data.missions) ? data.missions : [];
    loadedState.captains = isObject(data.captains) ? data.captains : {};
    loadedState.captainEventLog = Array.isArray(data.captainEventLog) ? data.captainEventLog : [];
    loadedState.nextCaptainEventId = data.nextCaptainEventId || (loadedState.captainEventLog.length + 1);
    loadedState.worldEvents = Array.isArray(data.worldEvents) ? data.worldEvents : [];
    loadedState.nextWorldEventId = data.nextWorldEventId || (loadedState.worldEvents.length + 1);
    loadedState.dialogueMemories = Array.isArray(data.dialogueMemories) ? data.dialogueMemories : [];
    loadedState.dialogueTasks = Array.isArray(data.dialogueTasks) ? data.dialogueTasks : [];
    loadedState.dialogueMessages = Array.isArray(data.dialogueMessages) ? data.dialogueMessages : [];
    loadedState.dialogueConversationParts = Array.isArray(data.dialogueConversationParts) ? data.dialogueConversationParts : [];
    loadedState.dialogueConversations = Array.isArray(data.dialogueConversations) ? data.dialogueConversations : [];
    loadedState.dialogueEventLog = Array.isArray(data.dialogueEventLog) ? data.dialogueEventLog : [];
    loadedState.nextDialogueMemoryId = data.nextDialogueMemoryId || (loadedState.dialogueMemories.length + 1);
    loadedState.nextDialogueTaskId = data.nextDialogueTaskId || (loadedState.dialogueTasks.length + 1);
    loadedState.nextDialogueMessageId = data.nextDialogueMessageId || (loadedState.dialogueMessages.length + 1);
    loadedState.nextDialogueConversationPartId = data.nextDialogueConversationPartId || (loadedState.dialogueConversationParts.length + 1);
    loadedState.nextDialogueConversationId = data.nextDialogueConversationId || (loadedState.dialogueConversations.length + 1);
    loadedState.nextDialogueEventId = data.nextDialogueEventId || (loadedState.dialogueEventLog.length + 1);
    loadedState.entanglements = Array.isArray(data.entanglements) ? data.entanglements : [];
    loadedState.nextEntanglementId = data.nextEntanglementId || (loadedState.entanglements.length + 1);
    loadedState.tradeRoutes = Array.isArray(data.tradeRoutes) ? data.tradeRoutes : [];
    loadedState.nextTradeRouteId = data.nextTradeRouteId || (loadedState.tradeRoutes.length + 1);
    loadedState.nextMissionId = data.nextMissionId || (loadedState.missions.length + 1);
    loadedState.ambientTrade = data.ambientTrade || loadedState.ambientTrade;
    loadedState.dataCargo = data.dataCargo || loadedState.dataCargo;
    loadedState.rng = data.rng || null;
    normaliseLoadedGame(loadedState);
    loadedState.selectedSectorId = loadedState.player.currentSector;
    loadedState.currentScreen = "sector";
    return loadedState;
}

export function getPersistenceStorage() {
    if (persistenceAdapters.storage) return persistenceAdapters.storage;
    try {
        return globalThis.localStorage || null;
    } catch (err) {
        console.warn('Persistence storage unavailable:', err);
        return null;
    }
}

function readPrimarySave(storage) {
    if (!storage || typeof storage.getItem !== "function") return null;
    return storage.getItem(SAVE_KEY)
        || (SAVE_KEY_LEGACY ? storage.getItem(SAVE_KEY_LEGACY) : null)
        || (SAVE_KEY_CLASSIC ? storage.getItem(SAVE_KEY_CLASSIC) : null);
}

function loadSavePayload(savePayload, successMessage) {
    if (!savePayload) {
        writeLog("No saved game found.");
        return false;
    }

    let data;
    try {
        data = JSON.parse(savePayload);
    } catch (err) {
        writeLog("Could not load save data. The saved JSON appears to be invalid.");
        console.error('Save JSON parse failed:', err);
        return false;
    }
    if (!validateRawSave(data)) {
        writeLog("Save data is missing required fields.");
        return false;
    }

    try {
        const migrated = migrateSave(data);
        const loadedState = buildLoadedState(migrated);
        replaceStateContents(loadedState);
        restoreSessionRng(state.rng, state.player.seed);
        const notice = typeof successMessage === "string" && successMessage.trim().length > 0
            ? successMessage.trim()
            : "Save loaded";
        writeLog(notice);
        notify(notice, 2);
        afterLoad();
        return true;
    } catch (err) {
        writeLog("Could not load save data. The save failed validation or normalisation.");
        console.error('Save load failed during migration or normalisation:', err);
        return false;
    }
}

function writeLog(message) {
    if (typeof persistenceAdapters.logger === "function") {
        persistenceAdapters.logger(message);
    }
}

function notify(message, priority) {
    if (typeof persistenceAdapters.notifier === "function") {
        persistenceAdapters.notifier(message, priority);
    }
}

function afterLoad() {
    if (typeof persistenceAdapters.afterLoad === "function") {
        persistenceAdapters.afterLoad();
    }
}

export function setPersistenceAdapters(adapters = {}) {
    persistenceAdapters = { ...defaultPersistenceAdapters, ...(adapters || {}) };
}

export function migrateSave(data) {
    const v = data.version || 0;
    // v1-v5: faction state was absent or had a different shape; force a full rebuild
    if (v < 6) {
        if (data.player) delete data.player.factions;
    }
    // v6: captainEventLog and worldEvents were not yet persisted
    if (v < 7) {
        data.captainEventLog = data.captainEventLog || [];
        data.worldEvents = data.worldEvents || [];
    }
    // v7: tradeRoutes and nextTradeRouteId added
    if (v < 8) {
        data.tradeRoutes = data.tradeRoutes || [];
        data.nextTradeRouteId = data.nextTradeRouteId || 1;
    }
    // v8: sector.politicalMemory added — normaliseLoadedGame rebuilds missing entries
    // v9→v10: seed added; factionRelations moved from top-level into player object
    // v10: session RNG state added — normaliseLoadedGame restores missing entries
    if (v < 10) {
        if (data.player) {
            if (!data.player.seed) data.player.seed = deterministicSeedFromPayload(data);
            if (!data.player.factionRelations) {
                // Prefer the top-level field from old saves; fall back to defaults
                data.player.factionRelations = data.factionRelations
                    ? JSON.parse(JSON.stringify(data.factionRelations))
                    : JSON.parse(JSON.stringify(DEFAULT_FACTION_RELATIONS));
            }
        }
    }
    migrateLegacyWarpAdjacencyToJumpGates(data.universe);
    normaliseRouteOwnership(data);
    migrateShipTransitFields(data.player);
    if (!data.ambientTrade) data.ambientTrade = { day: 0, moved: { ore: 0, org: 0, eq: 0 }, flows: 0 };
    if (!data.dataCargo) {
        data.dataCargo = { sectorKnowledge: {}, playerHold: { publicSnapshots: {}, privatePayloads: [], securePayloads: [] }, secureContracts: [], ambientTransfers: [], nextPayloadId: 1, license: { secureCourier: false, issuedByFactionId: null, issuedDay: null } };
    }
    // v14: character block added to player and captains
    if (v < 14) {
        if (data.player) {
            data.player.character = normaliseCharacter(data.player.character || createCharacter());
        }
        if (data.captains && typeof data.captains === "object") {
            Object.values(data.captains).forEach(captain => {
                captain.character = normaliseCharacter(captain.character || createCharacter());
            });
        }
    }
    // v15: chargen platforms became explicit ship/employer packages; normalisers map legacy ids.
    if (v < 15) {
        if (data.player) data.player.character = normaliseCharacter(data.player.character || createCharacter());
        if (data.captains && typeof data.captains === "object") {
            Object.values(data.captains).forEach(captain => {
                captain.character = normaliseCharacter(captain.character || createCharacter());
            });
        }
    }
    data.version = SAVE_VERSION;
    return data;
}

// Persisted state manifest: this is the only list buildSaveData() may serialize.
// Persisted fields below are durable game data needed to resume a run.
// Derived/transient fields intentionally excluded include sitesById, starField,
// selectedSectorId, currentScreen, reputationTab, selectedCaptainId,
// mapNodeCache, and worldGraphRevision. Add new save fields here first so tests
// catch accidental cache/UI leakage or serializer drift.
export const SAVE_STATE_FIELDS = [
    "player",
    "universe",
    "siteIdByCoord",
    "world",
    "worldgenSettings",
    "ports",
    "planets",
    "companies",
    "companyIdsBySector",
    "nextCompanyId",
    "people",
    "peopleBySector",
    "peopleByCompany",
    "nextPersonId",
    "polities",
    "polityIdsBySector",
    "missions",
    "captains",
    "captainEventLog",
    "nextCaptainEventId",
    "worldEvents",
    "nextWorldEventId",
    "dialogueMemories",
    "dialogueTasks",
    "dialogueMessages",
    "dialogueConversationParts",
    "dialogueConversations",
    "dialogueEventLog",
    "nextDialogueMemoryId",
    "nextDialogueTaskId",
    "nextDialogueMessageId",
    "nextDialogueConversationPartId",
    "nextDialogueConversationId",
    "nextDialogueEventId",
    "entanglements",
    "nextEntanglementId",
    "tradeRoutes",
    "nextTradeRouteId",
    "nextMissionId",
    "ambientTrade",
    "dataCargo",
    "rng"
];

export function buildSaveData() {
    const data = { version: SAVE_VERSION };
    SAVE_STATE_FIELDS.forEach(field => {
        data[field] = state[field];
    });
    return data;
}

export function hasSavedGame(storage = getPersistenceStorage()) {
    return Boolean(readPrimarySave(storage));
}

export function getSavedGameSummary(storage = getPersistenceStorage()) {
    const saved = readPrimarySave(storage);
    if (!saved) return null;
    try {
        const data = JSON.parse(saved);
        if (!validateRawSave(data)) return null;
        return {
            version: Number(data.version) || 0,
            credits: Number(data.player.credits) || 0,
            day: Number(data.player.time?.day) || 1,
            currentSector: Number(data.player.currentSector) || 1,
            shipName: typeof data.player.ship?.name === "string" ? data.player.ship.name : null
        };
    } catch (err) {
        console.error('Saved game summary failed:', err);
        return null;
    }
}

export function exportSaveData() {
    try {
        return JSON.stringify(buildSaveData());
    } catch (err) {
        writeLog("Save export failed.");
        console.error('Save export failed:', err);
        return null;
    }
}

export function importSavePayload(text) {
    if (typeof text !== "string") {
        writeLog("Could not import save data. The saved JSON appears to be invalid.");
        return false;
    }
    return loadSavePayload(text, "Save imported");
}

export function saveGame() {
    const storage = getPersistenceStorage();
    if (!storage || typeof storage.setItem !== "function") {
        writeLog("Save failed: no storage adapter is available.");
        return false;
    }
    try {
        storage.setItem(SAVE_KEY, JSON.stringify(buildSaveData()));
        writeLog("Game saved.");
        notify("Game saved", 1);
        return true;
    } catch (e) {
        writeLog("Save failed: " + e.message);
        return false;
    }
}

export function loadGame() {
    const storage = getPersistenceStorage();
    if (!storage || typeof storage.getItem !== "function") {
        writeLog("Load failed: no storage adapter is available.");
        return false;
    }
    return loadSavePayload(readPrimarySave(storage), "Game loaded");
}

function normaliseCurrentLoadedGame() {
    if (!state.player.time) state.player.time = { day: 1, minuteOfDay: 480, wakeMinute: 480, sleepMinute: 1320 };
    if (!state.player.ship) state.player.ship = createPlayer().ship;
    migrateShipTransitFields(state.player);
    if (!state.player.cargo) state.player.cargo = { ore: 0, org: 0, eq: 0 };
    if (!state.world) state.world = { saveModel: "sparse-3d-sites", roles: {} };
    if (!state.world.roles) state.world.roles = {};
    if (!state.player.currentSector) state.player.currentSector = state.world.roles.homeSiteId || 1;
    ensureContrabandHold();
    if (!state.player.seed) state.player.seed = Date.now();
    if (!state.player.factionRelations) {
        state.player.factionRelations = JSON.parse(JSON.stringify(DEFAULT_FACTION_RELATIONS));
    }
    ensureFactionState();
    if (!state.player.factions.contacts) state.player.factions.contacts = createContactState();
    state.player.character = normaliseCharacter(state.player.character || createCharacter());
    CARGO_COMMODITIES.forEach(c => { if (typeof state.player.cargo[c] !== "number") state.player.cargo[c] = 0; });
    state.sitesById = state.universe;
    if (!state.siteIdByCoord) state.siteIdByCoord = {};
    Object.values(state.universe).forEach(sector => {
        if (!sector.siteId) sector.siteId = `site-${sector.id}`;
        if (!sector.coord) sector.coord = { x: sector.id, y: 0, z: 0 };
        sector.coordKey = sector.coordKey || `${sector.coord.x},${sector.coord.y},${sector.coord.z}`;
        state.siteIdByCoord[sector.coordKey] = sector.id;
        if (!sector.siteType) sector.siteType = "stellar_system";
        if (!sector.richness) sector.richness = sector.id === (state.world.roles.shipyardSiteId || 1) ? "hub" : "developing";
        if (typeof sector.charted !== "boolean") sector.charted = true;
        if (typeof sector.reachable !== "boolean") sector.reachable = true;
        if (typeof sector.metricShear !== "number") sector.metricShear = 0.25;
        if (!Array.isArray(sector.jumpGates)) sector.jumpGates = [];
        delete sector.warps;
        if (typeof sector.surveyed !== "boolean") sector.surveyed = false;
        if (typeof sector.pirateThreat !== "number") sector.pirateThreat = 0;
        normaliseSectorInfluence(sector);
        if (typeof sector.front === "undefined") sector.front = null;
        if (!sector.politicalMemory) {
            sector.politicalMemory = {
                dominantFactionId: getDominantInfluence(sector.id),
                status: getSectorStatusLabel(sector.id),
                contestedDays: 0
            };
        }
        if (sector.front && typeof sector.front.suspicion !== "number") sector.front.suspicion = 10;
        if (sector.asteroids && typeof sector.asteroids.maxOre !== "number") sector.asteroids.maxOre = Math.max(sector.asteroids.ore, 2500);
    });
    Object.values(state.ports).forEach(port => {
        if (!port.factionId) port.factionId = PORT_TYPES[port.typeKey].factionId;
        if (!port.publicFactionId) port.publicFactionId = port.factionId;
        if (typeof port.hiddenFactionId === "undefined") port.hiddenFactionId = null;
        if (!port.stock) port.stock = makeStock(0, 0, 0);
        if (!port.maxStock) port.maxStock = makeStock(6000, 5000, 4000, 120, 40);
        if (!port.basePrices) port.basePrices = { ore: 80, org: 150, eq: 300 };
        MARKET_COMMODITIES.forEach(commodity => {
            if (typeof port.stock[commodity] !== "number") port.stock[commodity] = 0;
            if (typeof port.maxStock[commodity] !== "number") {
                port.maxStock[commodity] = commodity === "pulse_canister" ? 120
                    : commodity === "heavy_pulse_module" ? 40 : 1;
            }
            if (typeof port.basePrices[commodity] !== "number") {
                port.basePrices[commodity] = commodity === "pulse_canister" ? 7
                    : commodity === "heavy_pulse_module" ? 26 : 80;
            }
        });
    });
    if (!state.companies) state.companies = {};
    if (!state.companyIdsBySector) state.companyIdsBySector = {};
    if (typeof state.nextCompanyId !== "number") state.nextCompanyId = Object.keys(state.companies).length + 1;
    if (!state.people) state.people = {};
    if (!state.peopleBySector) state.peopleBySector = {};
    if (!state.peopleByCompany) state.peopleByCompany = {};
    if (typeof state.nextPersonId !== "number") state.nextPersonId = Object.keys(state.people).length + 1;
    if (!state.polities) state.polities = {};
    if (!state.polityIdsBySector) state.polityIdsBySector = {};
    Object.values(state.planets).forEach(planet => {
        if (!planet.stock) planet.stock = makeStock(0, 0, 0);
        if (!planet.shortages) planet.shortages = { ore: 0, org: 0, eq: 0 };
        if (typeof planet.satisfaction !== "number") planet.satisfaction = planet.owner ? 60 : 0;
        if (!planet.buildings) planet.buildings = { habitat: 0, mine: 0, farm: 0, factory: 0, defense: 0 };
        if (typeof planet.factionId === "undefined") planet.factionId = null;
        if (planet.owner === "Player" && !planet.policy) {
            planet.policy = { registration: "registered", economy: "free_trade", security: "local_militia", hiddenInfluence: { vc: 0 } };
        }
    });
    if (!state.world.roles.homeSiteId) state.world.roles.homeSiteId = state.player.currentSector;
    if (!state.world.roles.shipyardSiteId) state.world.roles.shipyardSiteId = state.world.roles.homeSiteId;
    if (!state.world.roles.startingPortSiteId) state.world.roles.startingPortSiteId = state.world.roles.homeSiteId;
    normaliseCaptains();
    if (!Array.isArray(state.entanglements)) state.entanglements = [];
    if (typeof state.nextEntanglementId !== "number") {
        state.nextEntanglementId = state.entanglements.length + 1;
    }
    normaliseEntanglements();
    normaliseTradeRoutes();
    if (!state.ambientTrade) state.ambientTrade = { day: 0, moved: makeStock(0, 0, 0), flows: 0 };
    normaliseDataCargoState();
    if (!Array.isArray(state.worldEvents)) state.worldEvents = [];
    if (typeof state.nextWorldEventId !== "number") state.nextWorldEventId = state.worldEvents.length + 1;
    normaliseDialogueTables();
    normaliseDialogueConversations();
    normaliseDialogueEvents();
    normaliseDialogueMemories();
    normaliseDialogueTasks();
    normaliseDialogueMessages();
    normaliseDialogueConversations();
    normaliseDialogueEvents();
    state.missions.forEach(m => {
        if (typeof m.rewardRep !== "number") m.rewardRep = 2;
        if (m.type === "stale_signal") {
            m.originSectorId = Number(m.originSectorId || m.originSector || state.player.currentSector);
            m.originSector = Number(m.originSector || m.originSectorId);
            m.targetSectorId = Number(m.targetSectorId || m.targetSector || m.originSectorId);
            m.targetSector = Number(m.targetSector || m.targetSectorId);
            m.returnSectorId = Number(m.returnSectorId || m.originSectorId);
            if (typeof m.createdDay !== "number") m.createdDay = state.player.time.day;
            if (typeof m.expiresDay !== "number") {
                m.expiresDay = m.createdDay + BALANCE.DATA_CARGO.STALE_SIGNAL_EXPIRY_DAYS;
            }
            if (typeof m.requiredSnapshotObservedDay === "undefined") m.requiredSnapshotObservedDay = null;
            if (!m.text) {
                m.text = `Recover a fresh signal packet from Sector ${m.targetSectorId}.`;
            }
            if (!m.title) m.title = `Recover stale signal from sector ${m.targetSectorId}`;
        }
        if (m.type === "contest" && typeof m.operationMinutes !== "number") m.operationMinutes = 90;
        if (m.status === "available") prepareMissionOpportunity(m);
    });
    clampPlayerState();
}


export function normaliseLoadedGame(target = state) {
    if (target === state) {
        normaliseCurrentLoadedGame();
        return;
    }
    withStateTarget(target, normaliseCurrentLoadedGame);
}
