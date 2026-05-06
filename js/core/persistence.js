import { createInitialState, state } from '../state.js';
import { SAVE_KEY, SAVE_KEY_LEGACY, SAVE_VERSION, COMMODITIES, DEFAULT_FACTION_RELATIONS, PORT_TYPES } from '../constants.js';
import { createPlayer } from './universe.js';
import { ensureFactionState, clampPlayerState } from './factions.js';
import { normaliseSectorInfluence, getDominantInfluence } from './influence.js';
import { getSectorStatusLabel } from './influence.js';
import { normaliseCaptains } from '../systems/captains.js';
import { normaliseTradeRoutes } from '../systems/tradeRoutes.js';
import { prepareMissionOpportunity } from '../systems/missions.js';
import { createContactState } from './factions.js';
import { makeStock, restoreSessionRng } from '../utils.js';
import { log } from '../utils.js';


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

function cloneSaveValue(value) {
    return JSON.parse(JSON.stringify(value));
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

function validateRawSave(data) {
    return isObject(data)
        && isObject(data.player)
        && isObject(data.universe)
        && isObject(data.ports)
        && isObject(data.planets);
}

function buildLoadedState(data) {
    const loadedState = createInitialState();
    loadedState.player = data.player;
    loadedState.universe = data.universe;
    loadedState.ports = data.ports;
    loadedState.planets = data.planets;
    loadedState.missions = Array.isArray(data.missions) ? data.missions : [];
    loadedState.captains = isObject(data.captains) ? data.captains : {};
    loadedState.captainEventLog = Array.isArray(data.captainEventLog) ? data.captainEventLog : [];
    loadedState.nextCaptainEventId = data.nextCaptainEventId || (loadedState.captainEventLog.length + 1);
    loadedState.worldEvents = Array.isArray(data.worldEvents) ? data.worldEvents : [];
    loadedState.nextWorldEventId = data.nextWorldEventId || (loadedState.worldEvents.length + 1);
    loadedState.tradeRoutes = Array.isArray(data.tradeRoutes) ? data.tradeRoutes : [];
    loadedState.nextTradeRouteId = data.nextTradeRouteId || (loadedState.tradeRoutes.length + 1);
    loadedState.nextMissionId = data.nextMissionId || (loadedState.missions.length + 1);
    loadedState.rng = data.rng || null;
    normaliseLoadedGame(loadedState);
    loadedState.selectedSectorId = loadedState.player.currentSector;
    loadedState.currentScreen = "sector";
    return loadedState;
}

function getStorage() {
    if (persistenceAdapters.storage) return persistenceAdapters.storage;
    return globalThis.localStorage || null;
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
    data.version = SAVE_VERSION;
    return data;
}

export function saveGame() {
    const storage = getStorage();
    if (!storage || typeof storage.setItem !== "function") {
        writeLog("Save failed: no storage adapter is available.");
        return false;
    }
    const data = {
        version: SAVE_VERSION,
        player: state.player,
        universe: state.universe,
        ports: state.ports,
        planets: state.planets,
        missions: state.missions,
        captains: state.captains,
        captainEventLog: state.captainEventLog,
        nextCaptainEventId: state.nextCaptainEventId,
        worldEvents: state.worldEvents,
        nextWorldEventId: state.nextWorldEventId,
        tradeRoutes: state.tradeRoutes,
        nextTradeRouteId: state.nextTradeRouteId,
        nextMissionId: state.nextMissionId,
        rng: state.rng
    };
    try {
        storage.setItem(SAVE_KEY, JSON.stringify(data));
        writeLog("Game saved.");
        notify("Game saved", 1);
        return true;
    } catch (e) {
        writeLog("Save failed: " + e.message);
        return false;
    }
}

export function loadGame() {
    const storage = getStorage();
    if (!storage || typeof storage.getItem !== "function") {
        writeLog("Load failed: no storage adapter is available.");
        return false;
    }
    let saved = storage.getItem(SAVE_KEY);
    if (!saved && SAVE_KEY_LEGACY) {
        saved = storage.getItem(SAVE_KEY_LEGACY);
        if (saved) writeLog("Migrating save from legacy key.");
    }
    if (!saved) { writeLog("No saved game found."); return false; }

    let data;
    try {
        data = JSON.parse(saved);
    } catch (err) {
        writeLog("Could not load save data. The saved JSON appears to be invalid.");
        return false;
    }
    if (!validateRawSave(data)) {
        writeLog("Save data is missing required fields.");
        return false;
    }

    try {
        const migrated = migrateSave(cloneSaveValue(data));
        const loadedState = buildLoadedState(migrated);
        replaceStateContents(loadedState);
        restoreSessionRng(state.rng, state.player.seed);
        writeLog("Game loaded.");
        notify("Game loaded", 2);
        afterLoad();
        return true;
    } catch (err) {
        writeLog("Could not load save data. The save failed validation or normalisation.");
        return false;
    }
}

function normaliseCurrentLoadedGame() {
    if (!state.player.time) state.player.time = { day: 1, minuteOfDay: 480, wakeMinute: 480, sleepMinute: 1320 };
    if (!state.player.ship) state.player.ship = createPlayer().ship;
    if (!state.player.cargo) state.player.cargo = { ore: 0, org: 0, eq: 0 };
    if (!state.player.seed) state.player.seed = Date.now();
    if (!state.player.factionRelations) {
        state.player.factionRelations = JSON.parse(JSON.stringify(DEFAULT_FACTION_RELATIONS));
    }
    ensureFactionState();
    if (!state.player.factions.contacts) state.player.factions.contacts = createContactState();
    COMMODITIES.forEach(c => { if (typeof state.player.cargo[c] !== "number") state.player.cargo[c] = 0; });
    Object.values(state.universe).forEach(sector => {
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
    });
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
    normaliseCaptains();
    normaliseTradeRoutes();
    if (!Array.isArray(state.worldEvents)) state.worldEvents = [];
    if (typeof state.nextWorldEventId !== "number") state.nextWorldEventId = state.worldEvents.length + 1;
    state.missions.forEach(m => {
        if (typeof m.rewardRep !== "number") m.rewardRep = 2;
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
