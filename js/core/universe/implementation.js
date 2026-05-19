import { state } from '../../state.js';
import { BALANCE, PORT_TYPES, PLANET_TYPES, DEFAULT_FACTION_RELATIONS, MARKET_COMMODITIES } from '../../constants.js';
import { GATE_DEFAULTS, PLANET_DEFAULTS, PORT_DEFAULTS, STARFIELD, WORLDGEN_ANCHORS, WORLDGEN_GEOMETRY, WORLDGEN_SPAWN } from '../../config/worldgen.js';
import { STARTER_PLAYER } from '../../config/player.js';
import { DEFAULT_BUILD_SPEC, DEFAULT_EMPLOYER_LANE_ID, EMPLOYER_LANES, PLATFORM_PACKAGES, START_PACKAGES, createStarterShipFromPlatform, getStarterCredits } from '../../config/chargen.js';
import { makeStock, seededRng, hasEconomicActivity } from '../../utils.js';
import { createBaseInfluence, addSectorInfluence } from '../influence.js';
import { createFactionState } from '../factions.js';
import { createCharacter } from '../characters.js';
import { buildCharacterFromSpec, isPlatformEmployed, validateBuild } from '../characterBuild.js';
import { getEmploymentTerms } from '../characterChecks.js';
import { createStartingProperties } from '../../systems/properties.js';
import { markGraphDirty } from '../routePlanner.js';

import { invalidateMapProjectionCache } from '../../ui/renderMap.js';
import { stateChanged, StateSlice } from '../../ui/stateSlices.js';
import { getTraitDefinition } from '../../config/traits.js';
import { assignSectorPolities } from '../../systems/polities.js';
import { seedCompaniesAndPeople } from '../../systems/companies.js';

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

function getPortFillRatio(portType, commodity) {
    const sells = portType.sells.includes(commodity);
    const buys = portType.buys.includes(commodity);
    if (sells && buys) return 0.35 + rng() * 0.35;
    if (sells) return 0.55 + rng() * 0.35;
    if (buys) return 0.08 + rng() * 0.27;
    return 0.12 + rng() * 0.28;
}

export function makePort(typeKey) {
    const portType = PORT_TYPES[typeKey];
    const stock = makeStock();
    const maxStock = makeStock();
    MARKET_COMMODITIES.forEach(commodity => {
        maxStock[commodity] = PORT_DEFAULTS.MAX_STOCK[commodity] || 1;
        stock[commodity] = Math.floor(maxStock[commodity] * getPortFillRatio(portType, commodity));
    });
    return {
        typeKey,
        factionId: portType.factionId,
        publicFactionId: portType.factionId,
        hiddenFactionId: null,
        stock,
        maxStock,
        basePrices: { ...PORT_DEFAULTS.BASE_PRICES }
    };
}

export function makePlanet(typeKey) {
    return {
        typeKey, owner: null, factionId: null, colonists: PLANET_DEFAULTS.COLONISTS,
        stock: makeStock(), satisfaction: PLANET_DEFAULTS.SATISFACTION, shortages: makeStock(),
        buildings: { ...PLANET_DEFAULTS.BUILDINGS }
    };
}

export function coordKey(coord) {
    return `${coord.x},${coord.y},${coord.z}`;
}

export function setSiteCoord(siteId, coord) {
    const site = state.universe?.[siteId];
    if (!site) return { ok: false, message: `Unknown site id: ${siteId}` };
    const next = coord || {};
    if (![next.x, next.y, next.z].every(value => Number.isFinite(value))) {
        return { ok: false, message: 'Invalid coordinates.' };
    }
    const nextCoord = { x: Number(next.x), y: Number(next.y), z: Number(next.z) };
    const nextKey = coordKey(nextCoord);
    const occupiedSiteId = state.siteIdByCoord?.[nextKey];
    if (occupiedSiteId !== undefined && String(occupiedSiteId) !== String(siteId)) {
        return { ok: false, message: `Coordinate ${nextKey} is already occupied by site ${occupiedSiteId}.` };
    }
    const oldKey = site.coordKey || coordKey(site.coord || { x: siteId, y: 0, z: 0 });
    if (state.siteIdByCoord && oldKey) delete state.siteIdByCoord[oldKey];
    site.coord = nextCoord;
    site.coordKey = nextKey;
    if (!state.siteIdByCoord) state.siteIdByCoord = {};
    state.siteIdByCoord[site.coordKey] = siteId;
    invalidateMapProjectionCache();
    markGraphDirty();
    return { ok: true, slices: stateChanged(StateSlice.UNIVERSE, StateSlice.MAP_VIEW) };
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
        let previous = { x: 0, y: 0, z: 0 };
        return Array.from({ length: count }, (_, index) => {
            const newClump = index === 0 || rng() < 0.28;
            if (newClump) {
                previous = {
                    x: Math.round(WORLDGEN_GEOMETRY.CLUSTERS.IRREGULAR_X_MIN
                        + rng() * WORLDGEN_GEOMETRY.CLUSTERS.IRREGULAR_X_SPAN
                        + index * WORLDGEN_GEOMETRY.CLUSTERS.IRREGULAR_X_INDEX_DRIFT),
                    y: Math.round(WORLDGEN_GEOMETRY.CLUSTERS.IRREGULAR_Y_MIN
                        + rng() * WORLDGEN_GEOMETRY.CLUSTERS.IRREGULAR_Y_SPAN),
                    z: Math.round((rng() - 0.5) * archetype.zScale)
                };
            } else {
                previous = {
                    x: Math.round(previous.x + (rng() - 0.35) * (archetype.chainDrift || 2)),
                    y: Math.round(previous.y + (rng() - 0.5) * (archetype.chainDrift || 2)),
                    z: Math.round(previous.z + (rng() - 0.5) * archetype.zScale)
                };
            }
            return previous;
        });
    }
    return Array.from({ length: count }, (_, index) => {
        if (archetype.barLength && index < Math.max(6, Math.floor(count * 0.18))) {
            const t = (index / Math.max(1, Math.floor(count * 0.18) - 1)) * 2 - 1;
            return {
                x: Math.round(t * archetype.barLength + (rng() - 0.5) * 3),
                y: Math.round((rng() - 0.5) * 6),
                z: Math.round((rng() - 0.5) * archetype.zScale)
            };
        }
        const arm = index % archetype.armCount;
        const spacing = archetype.armSpacing || WORLDGEN_GEOMETRY.CLUSTERS.SPIRAL_RADIUS_STEP;
        const radiusBase = archetype.ringRadius && index < Math.floor(count * 0.28)
            ? archetype.ringRadius : WORLDGEN_GEOMETRY.CLUSTERS.SPIRAL_RADIUS_BASE;
        const radius = radiusBase + index * spacing + rng() * WORLDGEN_GEOMETRY.CLUSTERS.SPIRAL_RADIUS_JITTER;
        const curve = archetype.armTwist || WORLDGEN_GEOMETRY.CLUSTERS.SPIRAL_ANGLE_CURVE;
        const satelliteOffset = archetype.satelliteEvery && index % archetype.satelliteEvery === 0 ? 8 + rng() * 10 : 0;
        const angle = arm * (Math.PI * 2 / archetype.armCount) + radius * curve;
        return {
            x: Math.round(Math.cos(angle) * (radius + satelliteOffset)),
            y: Math.round(Math.sin(angle) * (radius + satelliteOffset)),
            z: Math.round((rng() - 0.5) * archetype.zScale)
        };
    });
}

function metricShearAtCoord(coord) {
    const shear = WORLDGEN_GEOMETRY.SHEAR;
    const planarDistance = Math.sqrt(coord.x * coord.x + coord.y * coord.y);
    const centralNoise = Math.max(0, (shear.CENTRAL_RADIUS - planarDistance) / shear.CENTRAL_RADIUS)
        * shear.CENTRAL_MULTIPLIER;
    const offPlaneRelief = Math.min(shear.OFF_PLANE_RELIEF_MAX, Math.abs(coord.z) * shear.OFF_PLANE_RELIEF_MULTIPLIER);
    const lumpyNoise = (Math.sin(coord.x * shear.LUMPY_X_FREQUENCY)
        + Math.cos(coord.y * shear.LUMPY_Y_FREQUENCY)
        + Math.sin(coord.z * shear.LUMPY_Z_FREQUENCY)) * shear.LUMPY_MULTIPLIER;
    return clamp(shear.BASELINE + centralNoise + lumpyNoise - offPlaneRelief, shear.MIN, shear.MAX);
}

function sampleCorridorMetric(fromCoord, toCoord) {
    const samples = WORLDGEN_GEOMETRY.CORRIDORS.METRIC_SAMPLES;
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
    for (let attempt = 0; attempt < WORLDGEN_GEOMETRY.SITE_PLACEMENT.MAX_ATTEMPTS; attempt++) {
        const scale = index < WORLDGEN_GEOMETRY.SITE_PLACEMENT.EARLY_SITE_LIMIT
            ? WORLDGEN_GEOMETRY.SITE_PLACEMENT.EARLY_SCALE
            : index < WORLDGEN_GEOMETRY.SITE_PLACEMENT.MID_SITE_LIMIT
                ? WORLDGEN_GEOMETRY.SITE_PLACEMENT.MID_SCALE : WORLDGEN_GEOMETRY.SITE_PLACEMENT.LATE_SCALE;
        const coord = {
            x: Math.round(center.x + (rng() - 0.5) * archetype.clusterJitter * scale),
            y: Math.round(center.y + (rng() - 0.5) * archetype.clusterJitter * scale),
            z: Math.round(center.z + (rng() - 0.5) * archetype.zScale * 2)
        };
        if (metricShearAtCoord(coord) < WORLDGEN_GEOMETRY.SITE_PLACEMENT.ACCEPTABLE_SHEAR) return coord;
    }
    return { x: center.x + index * WORLDGEN_GEOMETRY.SITE_PLACEMENT.FALLBACK_X_OFFSET_PER_INDEX, y: center.y, z: center.z };
}

function createSparseSites(config) {
    const archetype = BALANCE.WORLDGEN.ARCHETYPES[config.archetypeKey]
        || BALANCE.WORLDGEN.ARCHETYPES[BALANCE.WORLDGEN.DEFAULT_ARCHETYPE];
    const centers = generateClusterCenters(
        archetype,
        Math.max(WORLDGEN_ANCHORS.CENTER_COUNT_MIN, Math.ceil(config.occupiedSites / WORLDGEN_ANCHORS.SITES_PER_CLUSTER_CENTER))
    );
    const occupiedCoords = new Set();
    const sites = {};
    const siteIdByCoord = {};
    for (let id = 1; id <= config.occupiedSites; id++) {
        let coord = generateSiteCoordinate(archetype, centers, id - 1);
        while (occupiedCoords.has(coordKey(coord))) coord = { ...coord, x: coord.x + 1 };
        occupiedCoords.add(coordKey(coord));
        let siteType = pickWeighted(BALANCE.WORLDGEN.SITE_TYPE_MIX);
        let richness = pickWeighted(BALANCE.WORLDGEN.RICHNESS_MIX);
        if (siteType === "way_station") richness = rng() < WORLDGEN_ANCHORS.WAY_STATION_SPARSE_CHANCE ? "sparse" : "strategic";
        const region = id <= Math.ceil(config.occupiedSites * WORLDGEN_GEOMETRY.REGIONS.CORE_FRACTION) ? "Core"
            : id <= Math.ceil(config.occupiedSites * WORLDGEN_GEOMETRY.REGIONS.FRONTIER_FRACTION) ? "Frontier" : "Badlands";
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
            pirateThreat: id <= WORLDGEN_GEOMETRY.REGIONS.PIRATE_SAFE_SITE_LIMIT
                ? 0 : Math.floor(rng() * WORLDGEN_GEOMETRY.REGIONS.PIRATE_THREAT_CAPS[region]),
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
        stability: typeof options.stability === "number" ? options.stability : GATE_DEFAULTS.STABILITY,
        effectiveSpanCost,
        sourcePulseCredits: pulseCost.sourceCredits,
        anchorPulseCredits: pulseCost.anchorCredits,
        scheduleHours: options.scheduleHours || 0,
        relayClass: options.relayClass || "direct"
    };
    state.universe[a].jumpGates.push({ ...common, id: gateAId, destinationSectorId: b, destinationGateId: gateBId });
    state.universe[b].jumpGates.push({ ...common, id: gateBId, destinationSectorId: a, destinationGateId: gateAId });
    markGraphDirty();
    return corridorId;
}

function getCandidateSectorIds(originId, ids, bucketIndex, cellSize) {
    const origin = state.universe[originId];
    const cell = {
        x: Math.floor(origin.coord.x / cellSize),
        y: Math.floor(origin.coord.y / cellSize),
        z: Math.floor(origin.coord.z / cellSize)
    };
    const candidates = new Set();
    for (let radius = 0; radius <= 3 && candidates.size < 24; radius++) {
        for (let x = cell.x - radius; x <= cell.x + radius; x++) {
            for (let y = cell.y - radius; y <= cell.y + radius; y++) {
                for (let z = cell.z - radius; z <= cell.z + radius; z++) {
                    const bucket = bucketIndex.get(`${x},${y},${z}`) || [];
                    bucket.forEach(id => {
                        if (id !== originId) candidates.add(id);
                    });
                }
            }
        }
    }
    if (candidates.size === 0) ids.forEach(id => { if (id !== originId) candidates.add(id); });
    return Array.from(candidates);
}

function buildCorridors(config) {
    const ids = Object.keys(state.universe).map(Number);
    const maxCost = BALANCE.GATE_PHYSICS.VACUUM_SPAN * config.routeDensity;
    const cellSize = Math.max(BALANCE.GATE_PHYSICS.VACUUM_SPAN * 3, 12);
    const bucketIndex = new Map();
    ids.forEach(id => {
        const coord = state.universe[id].coord;
        const key = `${Math.floor(coord.x / cellSize)},${Math.floor(coord.y / cellSize)},${Math.floor(coord.z / cellSize)}`;
        if (!bucketIndex.has(key)) bucketIndex.set(key, []);
        bucketIndex.get(key).push(id);
    });
    ids.forEach(id => {
        const candidates = getCandidateSectorIds(id, ids, bucketIndex, cellSize)
            .map(target => ({
                target,
                cost: calculateEffectiveSpanCost(state.universe[id].coord, state.universe[target].coord)
            }))
            .filter(candidate => candidate.cost <= maxCost)
            .sort((a, b) => a.cost - b.cost)
            .slice(0, WORLDGEN_GEOMETRY.CORRIDORS.NEAREST_NEIGHBORS);
        candidates.forEach(candidate => addJumpGateCorridor(id, candidate.target, { effectiveSpanCost: candidate.cost }));
    });
    ids.forEach(id => {
        if (state.universe[id].jumpGates.length > 0) return;
        const nearest = getCandidateSectorIds(id, ids, bucketIndex, cellSize)
            .map(target => ({
                target,
                cost: calculateEffectiveSpanCost(state.universe[id].coord, state.universe[target].coord)
            }))
            .sort((a, b) => a.cost - b.cost)[0];
        if (nearest) {
            addJumpGateCorridor(id, nearest.target, {
                effectiveSpanCost: nearest.cost,
                relayClass: nearest.cost > BALANCE.GATE_PHYSICS.VACUUM_SPAN ? "scheduled_relay" : "direct",
                scheduleHours: nearest.cost > BALANCE.GATE_PHYSICS.VACUUM_SPAN
                    ? WORLDGEN_GEOMETRY.CORRIDORS.SCHEDULED_RELAY_HOURS : 0
            });
        }
    });
}

function getActiveEconomicComponents(activeIds) {
    const activeSet = new Set(activeIds);
    const visited = new Set();
    const components = [];
    activeIds.forEach(start => {
        if (visited.has(start)) return;
        const queue = [start];
        const component = [];
        visited.add(start);
        while (queue.length > 0) {
            const id = queue.shift();
            component.push(id);
            (state.universe[id]?.jumpGates || []).forEach(gate => {
                const next = gate.destinationSectorId;
                if (gate.status === "closed" || !activeSet.has(next) || visited.has(next)) return;
                visited.add(next);
                queue.push(next);
            });
        }
        components.push(component);
    });
    return components;
}

function makeDisjointSet(ids) {
    const parent = new Map(ids.map(id => [id, id]));
    const rank = new Map(ids.map(id => [id, 0]));
    const find = id => {
        let root = parent.get(id);
        while (root !== parent.get(root)) root = parent.get(root);
        let current = id;
        while (current !== root) {
            const next = parent.get(current);
            parent.set(current, root);
            current = next;
        }
        return root;
    };
    const union = (a, b) => {
        const rootA = find(a);
        const rootB = find(b);
        if (rootA === rootB) return false;
        const rankA = rank.get(rootA) || 0;
        const rankB = rank.get(rootB) || 0;
        if (rankA < rankB) {
            parent.set(rootA, rootB);
        } else if (rankA > rankB) {
            parent.set(rootB, rootA);
        } else {
            parent.set(rootB, rootA);
            rank.set(rootA, rankA + 1);
        }
        return true;
    };
    return { find, union };
}

export function ensureEconomicActivityConnectivity() {
    const activeIds = Object.keys(state.universe).map(Number).filter(hasEconomicActivity);
    const components = getActiveEconomicComponents(activeIds);
    if (components.length <= 1) return;
    const componentBySectorId = new Map();
    components.forEach((component, index) => {
        component.forEach(sectorId => componentBySectorId.set(sectorId, index));
    });
    const disjointSet = makeDisjointSet(components.map((_, index) => index));
    const candidateEdges = [];
    for (let aIndex = 0; aIndex < activeIds.length; aIndex++) {
        const a = activeIds[aIndex];
        for (let bIndex = aIndex + 1; bIndex < activeIds.length; bIndex++) {
            const b = activeIds[bIndex];
            const componentA = componentBySectorId.get(a);
            const componentB = componentBySectorId.get(b);
            if (componentA === componentB) continue;
            candidateEdges.push({
                a,
                b,
                componentA,
                componentB,
                cost: calculateEffectiveSpanCost(state.universe[a].coord, state.universe[b].coord)
            });
        }
    }
    candidateEdges.sort((left, right) => left.cost - right.cost);
    let connectedEdges = 0;
    candidateEdges.some(edge => {
        if (!disjointSet.union(edge.componentA, edge.componentB)) return false;
        addJumpGateCorridor(edge.a, edge.b, {
            effectiveSpanCost: edge.cost,
            relayClass: edge.cost > BALANCE.GATE_PHYSICS.VACUUM_SPAN ? "scheduled_relay" : "direct",
            scheduleHours: edge.cost > BALANCE.GATE_PHYSICS.VACUUM_SPAN
                ? WORLDGEN_GEOMETRY.CORRIDORS.SCHEDULED_RELAY_HOURS : 0
        });
        connectedEdges += 1;
        return connectedEdges >= components.length - 1;
    });
}


function scoreAnchorCandidate(id) {
    const site = state.universe[id];
    const richnessScore = WORLDGEN_ANCHORS.RICHNESS_SCORE[site.richness] ?? WORLDGEN_ANCHORS.DEFAULT_RICHNESS_SCORE;
    const typeScore = WORLDGEN_ANCHORS.TYPE_SCORE[site.siteType] ?? WORLDGEN_ANCHORS.DEFAULT_TYPE_SCORE;
    const coord = site.coord || { x: id, y: 0, z: 0 };
    const planeDistance = Math.sqrt(coord.x * coord.x + coord.y * coord.y);
    return richnessScore * WORLDGEN_ANCHORS.RICHNESS_SCORE_MULTIPLIER
        + typeScore * WORLDGEN_ANCHORS.TYPE_SCORE_MULTIPLIER
        + (site.metricShear || 0) * WORLDGEN_ANCHORS.SHEAR_SCORE_MULTIPLIER
        + Math.abs(planeDistance - WORLDGEN_ANCHORS.IDEAL_PLANE_DISTANCE) * WORLDGEN_ANCHORS.PLANE_DISTANCE_MULTIPLIER
        + id * WORLDGEN_ANCHORS.ID_TIEBREAKER_MULTIPLIER;
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


function rebaseStartingAssetsToHomeSite(player, homeSiteId) {
    if (!player || !Array.isArray(player.properties) || !Number.isFinite(homeSiteId)) return;
    player.properties.forEach(property => {
        if (!property || property.chargenAsset !== true) return;
        property.siteId = homeSiteId;
    });
}

function seedPortsPlanetsAndResources() {
    const ids = Object.keys(state.universe).map(Number);
    const roles = state.world.roles;
    state.ports[roles.startingPortSiteId] = makePort("stardock");
    const starterPorts = WORLDGEN_SPAWN.STARTER_PORTS;
    const starterCandidates = getNearestSiteIds(roles.homeSiteId, ids)
        .filter(id => id !== roles.startingPortSiteId && state.universe[id].siteType !== "way_station");
    starterPorts.forEach((typeKey, index) => {
        const id = starterCandidates[index];
        if (id && !state.ports[id]) state.ports[id] = makePort(typeKey);
    });
    const portKeys = WORLDGEN_SPAWN.RANDOM_PORT_TYPES;
    ids.forEach(id => {
        if (state.ports[id]) return;
        const site = state.universe[id];
        if (site.siteType === "way_station") {
            if (rng() < WORLDGEN_SPAWN.WAY_STATION_REFINERY_CHANCE) state.ports[id] = makePort("refinery");
            return;
        }
        const chance = WORLDGEN_SPAWN.PORT_CHANCE_BY_REGION[site.region];
        if (rng() < chance) state.ports[id] = makePort(portKeys[Math.floor(rng() * portKeys.length)]);
    });
    Object.keys(state.ports).forEach(sec => {
        const sectorId = Number(sec);
        const port = state.ports[sectorId];
        const dominant = state.universe[sectorId].region === "Badlands"
            && rng() < WORLDGEN_SPAWN.HIDDEN_BADLANDS_PORT_CHANCE ? "vc" : port.factionId;
        port.publicFactionId = port.factionId;
        port.hiddenFactionId = dominant === port.factionId ? null : dominant;
        addSectorInfluence(sectorId, port.factionId, WORLDGEN_SPAWN.PORT_INFLUENCE, "");
        if (port.hiddenFactionId) {
            state.universe[sectorId].front = {
                publicFactionId: port.factionId,
                hiddenFactionId: port.hiddenFactionId,
                suspicion: WORLDGEN_SPAWN.FRONT_SUSPICION_BASE + Math.floor(rng() * WORLDGEN_SPAWN.FRONT_SUSPICION_SPAN)
            };
            addSectorInfluence(sectorId, port.hiddenFactionId, WORLDGEN_SPAWN.HIDDEN_PORT_INFLUENCE, "");
        }
    });
    const planetKeys = Object.keys(PLANET_TYPES);
    ids.forEach(id => {
        const site = state.universe[id];
        if (site.siteType === "way_station" || site.siteType === "exotic_remnant") return;
        const chance = WORLDGEN_SPAWN.PLANET_CHANCE_BY_REGION[site.region];
        if (rng() < chance) state.planets[id] = makePlanet(planetKeys[Math.floor(rng() * planetKeys.length)]);
    });
    ids.forEach(id => {
        const site = state.universe[id];
        const chance = WORLDGEN_SPAWN.ASTEROID_CHANCE_BY_REGION[site.region]
            || WORLDGEN_SPAWN.ASTEROID_CHANCE_BY_SITE_TYPE[site.siteType]
            || WORLDGEN_SPAWN.ASTEROID_DEFAULT_CHANCE;
        if (site.siteType !== "way_station" && rng() < chance) {
            const asteroidOre = WORLDGEN_SPAWN.ASTEROID_ORE_BASE
                + Math.floor(rng() * WORLDGEN_SPAWN.ASTEROID_ORE_SPAN);
            site.asteroids = {
                ore: asteroidOre, maxOre: asteroidOre,
                richness: WORLDGEN_SPAWN.ASTEROID_RICHNESS_BASE + rng() * WORLDGEN_SPAWN.ASTEROID_RICHNESS_SPAN,
                hazard: site.region === "Badlands"
                    ? WORLDGEN_SPAWN.ASTEROID_BADLANDS_HAZARD_BASE + rng() * WORLDGEN_SPAWN.ASTEROID_BADLANDS_HAZARD_SPAN
                    : rng() * WORLDGEN_SPAWN.ASTEROID_HAZARD_SPAN,
                surveyed: false
            };
            addSectorInfluence(id, "hc", WORLDGEN_SPAWN.ASTEROID_HC_INFLUENCE, "");
            if (site.region === "Badlands" && rng() < WORLDGEN_SPAWN.ASTEROID_BADLANDS_VC_CHANCE) {
                addSectorInfluence(id, "vc", WORLDGEN_SPAWN.ASTEROID_BADLANDS_VC_INFLUENCE, "");
            }
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
    state.companies = {}; state.companyIdsBySector = {}; state.nextCompanyId = 1;
    state.people = {}; state.peopleBySector = {}; state.peopleByCompany = {}; state.nextPersonId = 1;
    state.polities = {}; state.polityIdsBySector = {};
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
    rebaseStartingAssetsToHomeSite(state.player, state.world.roles.homeSiteId);
    buildCorridors(config);
    seedPortsPlanetsAndResources();
    ensureEconomicActivityConnectivity();
    assignSectorPolities();
    seedCompaniesAndPeople(rng);
    // Callers (main.js) are responsible for calling createCaptains, generateMissionPool, generateFactionAsks
}

export function generateStars() {
    initRng(state.player.seed);
    state.starField = [];
    for (let i = 0; i < STARFIELD.COUNT; i++) {
        const depth = rng() < 0.55 ? 0 : (rng() < 0.78 ? 1 : 2);
        state.starField.push({
            x: rng() * STARFIELD.WIDTH,
            y: rng() * STARFIELD.HEIGHT,
            size: rng() < STARFIELD.SMALL_STAR_CHANCE ? STARFIELD.SMALL_SIZE : STARFIELD.LARGE_SIZE,
            depth,
            alpha: 0.42 + rng() * 0.45,
            twinkle: rng() * Math.PI * 2
        });
    }
}

function addStartBenefitTotals(totals, benefits) {
    if (!benefits) return;
    totals.credits += benefits.credits || 0;
    Object.entries(benefits.cargo || {}).forEach(([commodity, amount]) => {
        totals.cargo[commodity] = (totals.cargo[commodity] || 0) + amount;
    });
    ["contacts", "equipment"].forEach(key => {
        (benefits[key] || []).forEach(item => {
            if (!totals[key].includes(item)) totals[key].push(item);
        });
    });
    ["memberships", "publicRep", "privateRep", "heat"].forEach(key => {
        Object.entries(benefits[key] || {}).forEach(([id, amount]) => {
            totals[key][id] = (totals[key][id] || 0) + amount;
        });
    });
    totals.employerRankBonus += benefits.employerRankBonus || 0;
    totals.wageBonus += benefits.wageBonus || 0;
    totals.commissionBonus += benefits.commissionBonus || 0;
    if (benefits.paperwork) totals.paperwork = benefits.paperwork;
}

function collectStartBenefits(character) {
    const totals = {
        credits: 0, cargo: {}, contacts: [], equipment: [], memberships: {}, publicRep: {},
        privateRep: {}, heat: {}, employerRankBonus: 0, wageBonus: 0, commissionBonus: 0, paperwork: null
    };
    (character.traits || []).forEach(traitId => {
        const trait = getTraitDefinition(traitId);
        if (trait) addStartBenefitTotals(totals, trait.startBenefits);
    });
    (character.packageIds || []).forEach(packageId => {
        addStartBenefitTotals(totals, START_PACKAGES[packageId]?.benefits);
    });
    return totals;
}

function applyStartBenefitsToPlayer(player, benefits) {
    Object.entries(benefits.cargo).forEach(([commodity, amount]) => {
        player.cargo[commodity] = (player.cargo[commodity] || 0) + amount;
    });
    benefits.contacts.forEach(contactId => {
        if (!player.character.contacts.includes(contactId)) player.character.contacts.push(contactId);
    });
    benefits.equipment.forEach(item => {
        if (!player.character.equipment.includes(item)) player.character.equipment.push(item);
    });
    Object.entries(benefits.memberships).forEach(([factionId, tier]) => {
        player.factions.membership[factionId] = Math.max(player.factions.membership[factionId] || 0, tier);
    });
    Object.entries(benefits.publicRep).forEach(([factionId, amount]) => {
        player.factions.reputation[factionId] = (player.factions.reputation[factionId] || 0) + amount;
        player.factions.publicRep[factionId] = (player.factions.publicRep[factionId] || 0) + amount;
    });
    Object.entries(benefits.privateRep).forEach(([factionId, amount]) => {
        player.factions.privateRep[factionId] = (player.factions.privateRep[factionId] || 0) + amount;
    });
    Object.entries(benefits.heat).forEach(([factionId, amount]) => {
        player.factions.heat[factionId] = Math.max(0, (player.factions.heat[factionId] || 0) + amount);
    });
    if (benefits.paperwork) player.character.paperwork = benefits.paperwork;
    if (player.employment && benefits.employerRankBonus) {
        player.employment.rankLevel = (player.employment.rankLevel || 0) + benefits.employerRankBonus;
        player.employment.rank = `${player.employment.rank} +${benefits.employerRankBonus}`;
    }
    if (player.employment) {
        player.employment.wageDaily = (player.employment.wageDaily || 0) + benefits.wageBonus;
        player.employment.commissionShare = (player.employment.commissionShare || 0) + benefits.commissionBonus;
    }
}

function makePlayerBase(ship, credits, character, platformPackage, employerLane, properties = []) {
    return {
        credits,
        currentSector: STARTER_PLAYER.CURRENT_SECTOR,
        time: { day: 1, minuteOfDay: BALANCE.DEFAULT_WAKE, wakeMinute: BALANCE.DEFAULT_WAKE, sleepMinute: BALANCE.DEFAULT_SLEEP },
        ship,
        properties,
        cargo: { ...STARTER_PLAYER.CARGO },
        contrabandHold: [],
        fighters: ship ? Math.min(STARTER_PLAYER.FIGHTERS, ship.maxFighters) : 0,
        shields: ship ? ship.maxShields : 0,
        hull: ship ? ship.maxHull : 0,
        reputation: STARTER_PLAYER.REPUTATION,
        seed: Date.now(),
        factionRelations: JSON.parse(JSON.stringify(DEFAULT_FACTION_RELATIONS)),
        factions: createFactionState(),
        character,
        employment: employerLane ? {
            laneId: employerLane.id,
            factionId: employerLane.factionId,
            rank: employerLane.rank,
            access: employerLane.access.slice(),
            runtimeType: platformPackage.runtimeType,
            ...(platformPackage.employment || {})
        } : platformPackage.employment ? { runtimeType: platformPackage.runtimeType, ...platformPackage.employment } : null
    };
}

export function createPlayerFromBuild(buildSpec = DEFAULT_BUILD_SPEC) {
    const validation = validateBuild(buildSpec);
    if (!validation.valid) {
        throw new Error(`Invalid character build: ${validation.reason}`);
    }
    const { character, leftoverPoints } = buildCharacterFromSpec(buildSpec);
    const platformType = character.platform.type;
    const platformPackage = PLATFORM_PACKAGES[platformType] || PLATFORM_PACKAGES[DEFAULT_BUILD_SPEC.platform.type];
    const isEmployed = isPlatformEmployed(platformType);
    const laneId = isEmployed
        ? character.platform.employerLaneId || DEFAULT_EMPLOYER_LANE_ID
        : null;
    const employerLane = laneId ? EMPLOYER_LANES.find(lane => lane.id === laneId) || null : null;
    if (isEmployed) character.platform.employerLaneId = laneId;
    const builtCharacter = createCharacter(character);
    const startBenefits = collectStartBenefits(builtCharacter);
    const ship = createStarterShipFromPlatform(platformPackage);
    const properties = createStartingProperties(platformType, { roles: state.world?.roles, siteId: STARTER_PLAYER.CURRENT_SECTOR }).map(property => ({
        ...property,
        chargenAsset: true
    }));
    const credits = getStarterCredits(leftoverPoints, platformPackage, startBenefits);
    const player = makePlayerBase(ship, credits, builtCharacter, platformPackage, employerLane, properties);
    if (player.employment) {
        player.employment = getEmploymentTerms(player.character, player.employment);
    }
    applyStartBenefitsToPlayer(player, startBenefits);
    return player;
}

export function createPlayer() {
    return createPlayerFromBuild(DEFAULT_BUILD_SPEC);
}
