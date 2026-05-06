import { state } from '../state.js';
import { BALANCE, PORT_TYPES, PLANET_TYPES, FACTIONS, CAPTAIN_DEFS, CONTACT_DEFS, DEFAULT_FACTION_RELATIONS } from '../constants.js';
import { makeStock, seededRng } from '../utils.js';
import { createBaseInfluence, addSectorInfluence } from './influence.js';
import { createFactionState, createContactState } from './factions.js';

export { makeStock };

// Module-level RNG — replaced by initRng() before each generation call.
let rng = seededRng(0);

/**
 * Seed the PRNG used by generateUniverse() and generateStars().
 * Call this before generation; it is called automatically by generateUniverse.
 */
export function initRng(seed) {
    rng = seededRng(seed >>> 0);
}

export function makePort(typeKey) {
    return {
        typeKey,
        factionId: PORT_TYPES[typeKey].factionId,
        publicFactionId: PORT_TYPES[typeKey].factionId,
        hiddenFactionId: null,
        stock: makeStock(1500 + Math.floor(rng() * 3500), 1200 + Math.floor(rng() * 3000), 800 + Math.floor(rng() * 2400)),
        maxStock: makeStock(6000, 5000, 4000),
        basePrices: { ore: 80, org: 150, eq: 300 }
    };
}

export function makePlanet(typeKey) {
    return {
        typeKey, owner: null, factionId: null, colonists: 0,
        stock: makeStock(0, 0, 0), satisfaction: 60, shortages: makeStock(0, 0, 0),
        buildings: { habitat: 0, mine: 0, farm: 0, factory: 0, defense: 0 }
    };
}

export function addWarp(a, b) {
    if (a === b) return;
    if (!state.universe[a].warps.includes(b)) state.universe[a].warps.push(b);
    if (!state.universe[b].warps.includes(a)) state.universe[b].warps.push(a);
}

export function generateUniverse() {
    initRng(state.player.seed);
    state.universe = {}; state.ports = {}; state.planets = {}; state.missions = []; state.nextMissionId = 1;
    for (let i = 1; i <= BALANCE.SECTOR_COUNT; i++) {
        let region = "Core";
        if (i > 20) region = "Badlands";
        else if (i > 10) region = "Frontier";
        state.universe[i] = {
            id: i, name: i === 1 ? "StarDock" : `${region} Sector ${i}`,
            region, warps: [], surveyed: i === 1,
            pirateThreat: i <= 8 ? 0 : Math.floor(rng() * (region === "Badlands" ? 5 : 3)),
            asteroids: null, influence: createBaseInfluence(region), front: null
        };
    }
    for (let i = 1; i <= BALANCE.SECTOR_COUNT; i++) addWarp(i, i === BALANCE.SECTOR_COUNT ? 1 : i + 1);
    for (let i = 1; i <= BALANCE.SECTOR_COUNT; i++) {
        const extraLinks = 1 + Math.floor(rng() * 2);
        for (let j = 0; j < extraLinks; j++) addWarp(i, 1 + Math.floor(rng() * BALANCE.SECTOR_COUNT));
    }
    state.ports[1] = makePort("stardock");
    state.ports[2] = makePort("mining");
    state.ports[3] = makePort("agricultural");
    state.ports[4] = makePort("industrial");
    state.ports[5] = makePort("consumer");
    const portKeys = ["mining", "agricultural", "industrial", "consumer", "refinery"];
    for (let i = 6; i <= BALANCE.SECTOR_COUNT; i++) {
        const chance = state.universe[i].region === "Core" ? 0.35 : 0.45;
        if (rng() < chance) state.ports[i] = makePort(portKeys[Math.floor(rng() * portKeys.length)]);
    }
    Object.keys(state.ports).forEach(sec => {
        const sectorId = Number(sec);
        const port = state.ports[sectorId];
        const dominant = state.universe[sectorId].region === "Badlands" && rng() < 0.18 ? "vc" : port.factionId;
        port.publicFactionId = port.factionId;
        port.hiddenFactionId = dominant === port.factionId ? null : dominant;
        addSectorInfluence(sectorId, port.factionId, 16, "");
        if (port.hiddenFactionId) {
            state.universe[sectorId].front = {
                publicFactionId: port.factionId,
                hiddenFactionId: port.hiddenFactionId,
                suspicion: 10 + Math.floor(rng() * 25)
            };
            addSectorInfluence(sectorId, port.hiddenFactionId, 10, "");
        }
    });
    const planetKeys = Object.keys(PLANET_TYPES);
    state.planets[6] = makePlanet("terran");
    for (let i = 7; i <= BALANCE.SECTOR_COUNT; i++) {
        const chance = state.universe[i].region === "Core" ? 0.18 : 0.32;
        if (rng() < chance) state.planets[i] = makePlanet(planetKeys[Math.floor(rng() * planetKeys.length)]);
    }
    state.universe[7].asteroids = { ore: 8000, maxOre: 8000, richness: 1.25, hazard: 0.08, surveyed: false };
    addSectorInfluence(7, "hc", 8, "");
    for (let i = 8; i <= BALANCE.SECTOR_COUNT; i++) {
        const chance = state.universe[i].region === "Badlands" ? 0.55 : 0.30;
        if (rng() < chance) {
            const asteroidOre = 2500 + Math.floor(rng() * 9000);
            state.universe[i].asteroids = {
                ore: asteroidOre, maxOre: asteroidOre,
                richness: 0.7 + rng() * 1.1,
                hazard: state.universe[i].region === "Badlands" ? 0.12 + rng() * 0.18 : rng() * 0.12,
                surveyed: false
            };
            addSectorInfluence(i, "hc", 5, "");
            if (state.universe[i].region === "Badlands" && rng() < 0.4) addSectorInfluence(i, "vc", 5, "");
        }
    }
    // Callers (main.js) are responsible for calling createCaptains, generateMissionPool, generateFactionAsks
}

export function generateStars() {
    initRng(state.player.seed);
    state.starField = [];
    for (let i = 0; i < 100; i++) {
        state.starField.push({ x: rng() * 700, y: rng() * 420, size: rng() < 0.85 ? 1 : 2 });
    }
}

export function createPlayer() {
    return {
        credits: 5000,
        currentSector: 1,
        time: { day: 1, minuteOfDay: BALANCE.DEFAULT_WAKE, wakeMinute: BALANCE.DEFAULT_WAKE, sleepMinute: BALANCE.DEFAULT_SLEEP },
        ship: { name: "Merchant Cruiser", maxHolds: 75, travelMinutesPerWarp: 45, miningPower: 25, scannerLevel: 1, maxFighters: 2500, maxShields: 400, maxHull: 100 },
        cargo: { ore: 0, org: 0, eq: 0 },
        fighters: 30,
        shields: 400,
        hull: 100,
        reputation: 0,
        seed: Date.now(),
        factionRelations: JSON.parse(JSON.stringify(DEFAULT_FACTION_RELATIONS)),
        factions: createFactionState()
    };
}
