import { state } from '../state.js';
import { SAVE_KEY, SAVE_VERSION, COMMODITIES, FACTION_RELATIONS, PORT_TYPES } from '../constants.js';
import { ensureFactionState, clampPlayerState } from './factions.js';
import { normaliseSectorInfluence, getDominantInfluence } from './influence.js';
import { getSectorStatusLabel } from './influence.js';
import { normaliseCaptains } from '../systems/captains.js';
import { normaliseTradeRoutes } from '../systems/tradeRoutes.js';
import { prepareMissionOpportunity } from '../systems/missions.js';
import { createContactState } from './factions.js';
import { makeStock } from '../utils.js';
import { Notifications } from '../ui/notifications.js';
import { log } from '../utils.js';
import { updateUI } from '../events.js';

function createPlayer() {
    return {
        ship: { name: "Vagrant Star", maxHolds: 100, travelMinutesPerWarp: 30, scannerLevel: 1, miningPower: 10, maxShields: 200, maxHull: 100, maxFighters: 100 },
        credits: 5000,
        cargo: { ore: 0, org: 0, eq: 0 },
        fighters: 20, shields: 200, hull: 100,
        currentSector: 1,
        reputation: 0,
        time: { day: 1, minuteOfDay: 480, wakeMinute: 480, sleepMinute: 1320 },
        factions: null
    };
}

export function saveGame() {
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
        factionRelations: FACTION_RELATIONS
    };
    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        log("Game saved.");
        Notifications.show("Game saved", 1);
    } catch (e) {
        log("Save failed: " + e.message);
    }
}

export function loadGame() {
    const saved = localStorage.getItem(SAVE_KEY);
    if (!saved) { log("No saved game found."); return; }
    try {
        const data = JSON.parse(saved);
        if (!data || !data.player || !data.universe || !data.ports || !data.planets) {
            log("Save data is missing required fields.");
            return;
        }
        state.player = data.player;
        state.universe = data.universe;
        state.ports = data.ports;
        state.planets = data.planets;
        state.missions = Array.isArray(data.missions) ? data.missions : [];
        state.captains = data.captains || {};
        state.captainEventLog = Array.isArray(data.captainEventLog) ? data.captainEventLog : [];
        state.nextCaptainEventId = data.nextCaptainEventId || (state.captainEventLog.length + 1);
        state.worldEvents = Array.isArray(data.worldEvents) ? data.worldEvents : [];
        state.nextWorldEventId = data.nextWorldEventId || (state.worldEvents.length + 1);
        state.tradeRoutes = Array.isArray(data.tradeRoutes) ? data.tradeRoutes : [];
        state.nextTradeRouteId = data.nextTradeRouteId || (state.tradeRoutes.length + 1);
        state.nextMissionId = data.nextMissionId || (state.missions.length + 1);
        if (data.factionRelations) {
            Object.keys(data.factionRelations).forEach(a => {
                if (!FACTION_RELATIONS[a]) return;
                Object.keys(data.factionRelations[a]).forEach(b => {
                    if (typeof FACTION_RELATIONS[a][b] === "number") FACTION_RELATIONS[a][b] = data.factionRelations[a][b];
                });
            });
        }
        normaliseLoadedGame();
        state.selectedSectorId = state.player.currentSector;
        state.currentScreen = "sector";
        log("Game loaded.");
        Notifications.show("Game loaded", 2);
        updateUI();
    } catch (err) {
        log("Could not load save data. The saved JSON appears to be invalid.");
    }
}

export function normaliseLoadedGame() {
    if (!state.player.time) state.player.time = { day: 1, minuteOfDay: 480, wakeMinute: 480, sleepMinute: 1320 };
    if (!state.player.ship) state.player.ship = createPlayer().ship;
    if (!state.player.cargo) state.player.cargo = { ore: 0, org: 0, eq: 0 };
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
