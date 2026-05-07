import { state } from '../state.js';
import { BALANCE, PORT_TYPES, PLANET_TYPES, DEFAULT_FACTION_RELATIONS } from '../constants.js';
import { makeStock, seededRng } from '../utils.js';
import { createBaseInfluence, addSectorInfluence } from './influence.js';
import { createFactionState } from './factions.js';

export { makeStock };

// Module-level RNG — replaced by initRng() before each generation call.
let rng = seededRng(0);

const SITE_TYPE_LABELS = {
    stellar_system: "Stellar System",
    brown_dwarf_system: "Brown Dwarf System",
    rogue_system: "Rogue System",
    way_station: "Way Station",
    white_dwarf_remnant: "White Dwarf Remnant",
    circumbinary_system: "Circumbinary System",
    multiple_star_system: "Multiple Star System",
    exotic_remnant: "Exotic Remnant"
};

const RICHNESS_LABELS = {
    barren: "Barren",
    sparse: "Sparse",
    developing: "Developing",
    settled: "Settled",
    hub: "Hub",
    strategic: "Strategic"
};

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

export function coordKey(coord) {
    return `${coord.x},${coord.y},${coord.z}`;
}

export function getSiteTypeLabel(siteType) {
    return SITE_TYPE_LABELS[siteType] || siteType || "Unknown Site";
}

export function getRichnessLabel(richness) {
    return RICHNESS_LABELS[richness] || richness || "Unrated";
}

function pickWeighted(weights) {
    const entries = Object.entries(weights);
    const total = entries.reduce((sum, entry) => sum + entry[1], 0);
    let roll = rng() * total;
    for (const [key, weight] of entries) {
        roll -= weight;
        if (roll <= 0) return key;
    }
    return entries[entries.length - 1][0];
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function distanceBetweenCoords(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function generateClusterCenters(archetype, count) {
    if (archetype.armCount === 0) {
        return Array.from({ length: count }, (_, index) => ({
            x: Math.round(-16 + rng() * 32 + index * 1.5),
            y: Math.round(-12 + rng() * 24),
            z: Math.round((rng() - 0.5) * archetype.zScale)
        }));
    }
    return Array.from({ length: count }, (_, index) => {
        const arm = index % archetype.armCount;
        const radius = 10 + index * 3.5 + rng() * 5;
        const angle = arm * (Math.PI * 2 / archetype.armCount) + radius * 0.16;
        return {
            x: Math.round(Math.cos(angle) * radius),
            y: Math.round(Math.sin(angle) * radius),
            z: Math.round((rng() - 0.5) * archetype.zScale)
        };
    });
}

function metricShearAtCoord(coord) {
    const planarDistance = Math.sqrt(coord.x * coord.x + coord.y * coord.y);
    const centralNoise = Math.max(0, (9 - planarDistance) / 9) * 1.18;
    const offPlaneRelief = Math.min(0.12, Math.abs(coord.z) * 0.015);
    const lumpyNoise = (Math.sin(coord.x * 0.31) + Math.cos(coord.y * 0.27) + Math.sin(coord.z * 0.73)) * 0.045;
    return clamp(0.12 + centralNoise + lumpyNoise - offPlaneRelief, 0, 1.35);
}

function sampleCorridorMetric(fromCoord, toCoord) {
    const samples = 5;
    let sum = 0;
    let peak = 0;
    for (let index = 0; index <= samples; index++) {
        const t = index / samples;
        const coord = {
            x: fromCoord.x + (toCoord.x - fromCoord.x) * t,
            y: fromCoord.y + (toCoord.y - fromCoord.y) * t,
            z: fromCoord.z + (toCoord.z - fromCoord.z) * t
        };
        const shear = metricShearAtCoord(coord);
        sum += shear;
        peak = Math.max(peak, shear);
    }
    return { avg: sum / (samples + 1), peak };
}

export function calculateEffectiveSpanCost(fromCoord, toCoord) {
    const d = distanceBetweenCoords(fromCoord, toCoord);
    const shear = sampleCorridorMetric(fromCoord, toCoord);
    return d * (1 + BALANCE.GATE_PHYSICS.SHEAR_AVG_MULT * shear.avg + BALANCE.GATE_PHYSICS.SHEAR_PEAK_MULT * shear.peak);
}

export function calculateGatePulseCost({ effectiveSpanCost, apertureDiameterM, holdSeconds }) {
    const energy = BALANCE.GATE_PHYSICS.ENERGY;
    const vacuumSpan = BALANCE.GATE_PHYSICS.VACUUM_SPAN;
    const r = effectiveSpanCost / vacuumSpan;
    const sourcePulseTJ = energy.SOURCE_BASE_TJ
        * (1 + energy.SOURCE_RANGE_MULT * r * r)
        * Math.pow(apertureDiameterM / energy.REFERENCE_APERTURE_DIAMETER_M, energy.SOURCE_DIAMETER_EXPONENT)
        * Math.exp(Math.max(0, holdSeconds - energy.SOURCE_HOLD_GRACE_SECONDS) / energy.SOURCE_HOLD_EXP_SECONDS);
    const anchorPulseTJ = energy.ANCHOR_BASE_TJ
        * (1 + energy.ANCHOR_RANGE_MULT * r)
        * Math.pow(apertureDiameterM / energy.REFERENCE_APERTURE_DIAMETER_M, energy.ANCHOR_DIAMETER_EXPONENT)
        * Math.exp(Math.max(0, holdSeconds - energy.ANCHOR_HOLD_GRACE_SECONDS) / energy.ANCHOR_HOLD_EXP_SECONDS);
    return {
        sourcePulseTJ,
        anchorPulseTJ,
        totalTJ: sourcePulseTJ + anchorPulseTJ,
        sourceCredits: sourcePulseTJ * energy.CREDIT_PER_TJ,
        anchorCredits: anchorPulseTJ * energy.CREDIT_PER_TJ,
        totalCredits: (sourcePulseTJ + anchorPulseTJ) * energy.CREDIT_PER_TJ
    };
}

function createWorldConfig() {
    const config = state.worldgenSettings || {};
    const worldgen = BALANCE.WORLDGEN;
    const requestedSiteCount = Number(config.occupiedSites) || worldgen.DEFAULT_OCCUPIED_SITES;
    return {
        archetypeKey: config.galaxyArchetype || worldgen.DEFAULT_ARCHETYPE,
        occupiedSites: clamp(requestedSiteCount, 1, worldgen.MAX_OCCUPIED_SITES),
        routeDensity: Number(config.routeDensity) || worldgen.DEFAULT_ROUTE_DENSITY,
        chartedFraction: Number(config.chartedFraction) || worldgen.DEFAULT_CHARTED_FRACTION
    };
}

function generateSiteCoordinate(archetype, centers, index) {
    const center = centers[index % centers.length];
    for (let attempt = 0; attempt < 24; attempt++) {
        const scale = index < 22 ? 3.8 : index < 45 ? 4.7 : 5.5;
        const coord = {
            x: Math.round(center.x + (rng() - 0.5) * archetype.clusterJitter * scale),
            y: Math.round(center.y + (rng() - 0.5) * archetype.clusterJitter * scale),
            z: Math.round(center.z + (rng() - 0.5) * archetype.zScale * 2)
        };
        if (metricShearAtCoord(coord) < 0.9) return coord;
    }
    return { x: center.x + index, y: center.y, z: center.z };
}

function createSparseSites(config) {
    const archetype = BALANCE.WORLDGEN.ARCHETYPES[config.archetypeKey]
        || BALANCE.WORLDGEN.ARCHETYPES[BALANCE.WORLDGEN.DEFAULT_ARCHETYPE];
    const centers = generateClusterCenters(archetype, Math.max(5, Math.ceil(config.occupiedSites / 12)));
    const occupiedCoords = new Set();
    const sites = {};
    const siteIdByCoord = {};
    for (let id = 1; id <= config.occupiedSites; id++) {
        let coord = generateSiteCoordinate(archetype, centers, id - 1);
        while (occupiedCoords.has(coordKey(coord))) coord = { ...coord, x: coord.x + 1 };
        occupiedCoords.add(coordKey(coord));
        let siteType = pickWeighted(BALANCE.WORLDGEN.SITE_TYPE_MIX);
        let richness = pickWeighted(BALANCE.WORLDGEN.RICHNESS_MIX);
        if (siteType === "way_station") richness = rng() < 0.65 ? "sparse" : "strategic";
        const region = id <= Math.ceil(config.occupiedSites * 0.30) ? "Core"
            : id <= Math.ceil(config.occupiedSites * 0.72) ? "Frontier" : "Badlands";
        sites[id] = {
            id,
            siteId: `site-${id}`,
            coord,
            coordKey: coordKey(coord),
            name: `${getSiteTypeLabel(siteType)} ${id}`,
            region,
            siteType,
            richness,
            charted: false,
            reachable: false,
            surveyed: false,
            jumpGates: [],
            pirateThreat: id <= 8 ? 0 : Math.floor(rng() * (region === "Badlands" ? 5 : 3)),
            asteroids: null,
            influence: createBaseInfluence(region),
            front: null,
            metricShear: metricShearAtCoord(coord)
        };
        siteIdByCoord[coordKey(coord)] = id;
    }
    return { sites, siteIdByCoord, archetypeName: archetype.name };
}

export function addJumpGateCorridor(a, b, options = {}) {
    if (a === b || !state.universe[a] || !state.universe[b]) return null;
    if (!Array.isArray(state.universe[a].jumpGates)) state.universe[a].jumpGates = [];
    if (!Array.isArray(state.universe[b].jumpGates)) state.universe[b].jumpGates = [];
    const existing = state.universe[a].jumpGates.find(gate => gate.destinationSectorId === b && gate.status !== "closed");
    if (existing) return existing.corridorId;
    const fromCoord = state.universe[a].coord || { x: a, y: 0, z: 0 };
    const toCoord = state.universe[b].coord || { x: b, y: 0, z: 0 };
    const effectiveSpanCost = typeof options.effectiveSpanCost === "number"
        ? options.effectiveSpanCost : calculateEffectiveSpanCost(fromCoord, toCoord);
    const pulseCost = calculateGatePulseCost({
        effectiveSpanCost,
        apertureDiameterM: BALANCE.GATE_PHYSICS.ENERGY.REFERENCE_APERTURE_DIAMETER_M,
        holdSeconds: BALANCE.GATE_PHYSICS.ENERGY.REFERENCE_HOLD_SECONDS
    });
    const corridorId = options.corridorId || `corridor-${Math.min(a, b)}-${Math.max(a, b)}-${state.universe[a].jumpGates.length + state.universe[b].jumpGates.length}`;
    const gateAId = options.gateAId || `gate-${a}-${corridorId}`;
    const gateBId = options.gateBId || `gate-${b}-${corridorId}`;
    const common = {
        corridorId,
        status: options.status || "active",
        owningFactionId: options.owningFactionId || null,
        toll: options.toll || 0,
        stability: typeof options.stability === "number" ? options.stability : 100,
        effectiveSpanCost,
        sourcePulseCredits: pulseCost.sourceCredits,
        anchorPulseCredits: pulseCost.anchorCredits,
        scheduleHours: options.scheduleHours || 0,
        relayClass: options.relayClass || "direct"
    };
    state.universe[a].jumpGates.push({ ...common, id: gateAId, destinationSectorId: b, destinationGateId: gateBId });
    state.universe[b].jumpGates.push({ ...common, id: gateBId, destinationSectorId: a, destinationGateId: gateAId });
    return corridorId;
}

function buildCorridors(config) {
    const ids = Object.keys(state.universe).map(Number);
    const maxCost = BALANCE.GATE_PHYSICS.VACUUM_SPAN * config.routeDensity;
    ids.forEach(id => {
        const candidates = ids
            .filter(target => target !== id)
            .map(target => ({
                target,
                cost: calculateEffectiveSpanCost(state.universe[id].coord, state.universe[target].coord)
            }))
            .filter(candidate => candidate.cost <= maxCost)
            .sort((a, b) => a.cost - b.cost)
            .slice(0, 3);
        candidates.forEach(candidate => addJumpGateCorridor(id, candidate.target, { effectiveSpanCost: candidate.cost }));
    });
    ids.forEach(id => {
        if (state.universe[id].jumpGates.length > 0) return;
        const nearest = ids
            .filter(target => target !== id)
            .map(target => ({
                target,
                cost: calculateEffectiveSpanCost(state.universe[id].coord, state.universe[target].coord)
            }))
            .sort((a, b) => a.cost - b.cost)[0];
        if (nearest) {
            addJumpGateCorridor(id, nearest.target, {
                effectiveSpanCost: nearest.cost,
                relayClass: nearest.cost > BALANCE.GATE_PHYSICS.VACUUM_SPAN ? "scheduled_relay" : "direct",
                scheduleHours: nearest.cost > BALANCE.GATE_PHYSICS.VACUUM_SPAN ? 24 : 0
            });
        }
    });
}

function scoreAnchorCandidate(id) {
    const site = state.universe[id];
    const richnessScore = { hub: 0, settled: 1, strategic: 2, developing: 3, sparse: 4, barren: 5 };
    const typeScore = site.siteType === "stellar_system" ? 0
        : site.siteType === "multiple_star_system" ? 1
            : site.siteType === "circumbinary_system" ? 2 : 3;
    const coord = site.coord || { x: id, y: 0, z: 0 };
    const planeDistance = Math.sqrt(coord.x * coord.x + coord.y * coord.y);
    return (richnessScore[site.richness] ?? 6) * 12
        + typeScore * 5
        + (site.metricShear || 0) * 4
        + Math.abs(planeDistance - 14) * 0.05
        + id * 0.0001;
}

function getNearestSiteIds(originId, candidates) {
    const origin = state.universe[originId];
    if (!origin) return [];
    return candidates.slice().sort((a, b) => {
        const distanceDelta = distanceBetweenCoords(origin.coord, state.universe[a].coord)
            - distanceBetweenCoords(origin.coord, state.universe[b].coord);
        if (distanceDelta !== 0) return distanceDelta;
        return a - b;
    });
}

function assignAnchorsAndVisibility(config) {
    const ids = Object.keys(state.universe).map(Number);
    const sortedByAnchorScore = ids.slice().sort((a, b) => {
        const scoreDelta = scoreAnchorCandidate(a) - scoreAnchorCandidate(b);
        if (scoreDelta !== 0) return scoreDelta;
        return a - b;
    });
    const homeSiteId = sortedByAnchorScore[0];
    const shipyardSiteId = homeSiteId;
    const startingPortSiteId = homeSiteId;
    const sortedByStartNetwork = [homeSiteId].concat(
        getNearestSiteIds(homeSiteId, sortedByAnchorScore.filter(id => id !== homeSiteId))
    );
    const chartedTarget = Math.max(1, Math.round(ids.length * config.chartedFraction));
    const chartedIds = sortedByStartNetwork.slice(0, chartedTarget);
    const reachableTarget = Math.max(1, Math.round(chartedIds.length * BALANCE.WORLDGEN.DEFAULT_REACHABLE_CHARTED_FRACTION));
    chartedIds.forEach((id, index) => {
        state.universe[id].charted = true;
        state.universe[id].reachable = index < reachableTarget;
    });
    state.universe[homeSiteId].name = "StarDock";
    state.universe[homeSiteId].richness = "hub";
    state.universe[homeSiteId].siteType = "stellar_system";
    state.universe[homeSiteId].surveyed = true;
    state.world.roles = { homeSiteId, shipyardSiteId, startingPortSiteId, capitalSiteId: homeSiteId };
    state.player.currentSector = homeSiteId;
    state.selectedSectorId = homeSiteId;
}

function seedPortsPlanetsAndResources() {
    const ids = Object.keys(state.universe).map(Number);
    const roles = state.world.roles;
    state.ports[roles.startingPortSiteId] = makePort("stardock");
    const starterPorts = ["mining", "agricultural", "industrial", "consumer"];
    const starterCandidates = getNearestSiteIds(roles.homeSiteId, ids)
        .filter(id => id !== roles.startingPortSiteId && state.universe[id].siteType !== "way_station");
    starterPorts.forEach((typeKey, index) => {
        const id = starterCandidates[index];
        if (id && !state.ports[id]) state.ports[id] = makePort(typeKey);
    });
    const portKeys = ["mining", "agricultural", "industrial", "consumer", "refinery"];
    ids.forEach(id => {
        if (state.ports[id]) return;
        const site = state.universe[id];
        if (site.siteType === "way_station") {
            if (rng() < 0.7) state.ports[id] = makePort("refinery");
            return;
        }
        const chance = site.region === "Core" ? 0.42 : site.region === "Frontier" ? 0.34 : 0.24;
        if (rng() < chance) state.ports[id] = makePort(portKeys[Math.floor(rng() * portKeys.length)]);
    });
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
    ids.forEach(id => {
        const site = state.universe[id];
        if (site.siteType === "way_station" || site.siteType === "exotic_remnant") return;
        const chance = site.region === "Core" ? 0.24 : 0.32;
        if (rng() < chance) state.planets[id] = makePlanet(planetKeys[Math.floor(rng() * planetKeys.length)]);
    });
    ids.forEach(id => {
        const site = state.universe[id];
        const chance = site.region === "Badlands" ? 0.55 : site.siteType === "brown_dwarf_system" ? 0.42 : 0.28;
        if (site.siteType !== "way_station" && rng() < chance) {
            const asteroidOre = 2500 + Math.floor(rng() * 9000);
            site.asteroids = {
                ore: asteroidOre, maxOre: asteroidOre,
                richness: 0.7 + rng() * 1.1,
                hazard: site.region === "Badlands" ? 0.12 + rng() * 0.18 : rng() * 0.12,
                surveyed: false
            };
            addSectorInfluence(id, "hc", 5, "");
            if (site.region === "Badlands" && rng() < 0.4) addSectorInfluence(id, "vc", 5, "");
        }
        if (site.siteType === "way_station") {
            const station = BALANCE.GATE_PHYSICS.WAY_STATION;
            const strategic = site.richness === "strategic";
            const min = strategic ? station.FRONTIER_RESERVE_MIN : station.ORDINARY_RESERVE_MIN;
            const max = strategic ? station.FRONTIER_RESERVE_MAX : station.ORDINARY_RESERVE_MAX;
            site.station = {
                baselinePowerCreditsPerHour: station.BASELINE_POWER_CREDITS_PER_HOUR,
                pulseReserveCredits: min + Math.floor(rng() * (max - min + 1)),
                pulseReserveMaxCredits: max
            };
        }
    });
}

export function generateUniverse() {
    initRng(state.player.seed);
    state.universe = {}; state.ports = {}; state.planets = {}; state.missions = []; state.nextMissionId = 1;
    const config = createWorldConfig();
    const sparse = createSparseSites(config);
    state.universe = sparse.sites;
    state.sitesById = state.universe;
    state.siteIdByCoord = sparse.siteIdByCoord;
    state.world = {
        saveModel: "sparse-3d-sites",
        archetypeKey: config.archetypeKey,
        archetypeName: sparse.archetypeName,
        occupiedSites: config.occupiedSites,
        vacuumSpan: BALANCE.GATE_PHYSICS.VACUUM_SPAN,
        roles: {}
    };
    assignAnchorsAndVisibility(config);
    buildCorridors(config);
    seedPortsPlanetsAndResources();
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
        ship: { name: "Merchant Cruiser", maxHolds: 75, travelMinutesPerCorridor: 45, miningPower: 25, scannerLevel: 1, maxFighters: 2500, maxShields: 400, maxHull: 100 },
        cargo: { ore: 0, org: 0, eq: 0 },
        contrabandHold: [],
        fighters: 30,
        shields: 400,
        hull: 100,
        reputation: 0,
        seed: Date.now(),
        factionRelations: JSON.parse(JSON.stringify(DEFAULT_FACTION_RELATIONS)),
        factions: createFactionState()
    };
}
