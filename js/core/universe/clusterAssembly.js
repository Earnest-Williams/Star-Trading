import { CLUSTER_BLUEPRINTS, selectClusterByFamily, validateClusterBlueprint } from '../../config/worldgenClusters.js';
import { BALANCE } from '../../config/economy.js';
import { WORLDGEN_GEOMETRY, WORLDGEN_ANCHORS } from '../../config/worldgen.js';
import { createBaseInfluence } from '../influence.js';
import {
    metricShearAtCoord,
    generateClusterCenters,
    generateSiteCoordinate,
    coordKey,
    getSiteTypeLabel
} from './worldgenGeometry.js';

let hasValidatedClusterBlueprints = false;

export function ensureClusterBlueprintsValid() {
    if (hasValidatedClusterBlueprints) {
        return;
    }
    const validationErrors = [];
    for (const blueprint of CLUSTER_BLUEPRINTS) {
        validationErrors.push(...validateClusterBlueprint(blueprint));
    }
    if (validationErrors.length > 0) {
        throw new Error(`Cluster blueprint validation failed: ${validationErrors.join('; ')}`);
    }
    hasValidatedClusterBlueprints = true;
}

function getCenterRegion(index, totalCenters) {
    if (index < Math.ceil(totalCenters * WORLDGEN_GEOMETRY.REGIONS.CORE_FRACTION)) return "Core";
    if (index < Math.ceil(totalCenters * WORLDGEN_GEOMETRY.REGIONS.FRONTIER_FRACTION)) return "Frontier";
    return "Badlands";
}

function transformOffset(offset, rotationIndex, mirrorX, mirrorY) {
    let tx = offset.x;
    let ty = offset.y;
    let tz = offset.z;

    // Apply rotation
    if (rotationIndex === 1) { // 90 deg
        const tmp = tx;
        tx = -ty;
        ty = tmp;
    } else if (rotationIndex === 2) { // 180 deg
        tx = -tx;
        ty = -ty;
    } else if (rotationIndex === 3) { // 270 deg
        const tmp = tx;
        tx = ty;
        ty = -tmp;
    }

    // Apply mirroring
    if (mirrorX) tx = -tx;
    if (mirrorY) ty = -ty;

    return { x: tx, y: ty, z: tz };
}

function pickWeighted(weights, rng) {
    const entries = Object.entries(weights);
    const total = entries.reduce((sum, entry) => sum + entry[1], 0);
    let roll = rng() * total;
    for (const [key, weight] of entries) {
        roll -= weight;
        if (roll <= 0) return key;
    }
    return entries[entries.length - 1][0];
}

export function validateClusterAssemblyResult(result, config) {
    const errors = [];
    const siteEntries = Object.entries(result?.sites || {});
    if (siteEntries.length !== config.occupiedSites) {
        errors.push(`expected ${config.occupiedSites} occupied sites, got ${siteEntries.length}`);
    }
    const seenCoordKeys = new Set();
    const blockedFields = ["roleHint", "clusterId", "family", "localId", "connectorKinds", "stockBias", "portHint", "planetHint", "asteroidHint", "stationHint", "riskHint"];
    let hasHomeCandidate = false;
    let hasNonStarterConnector = false;
    for (const [siteIdStr, site] of siteEntries) {
        if (!/^\d+$/.test(siteIdStr)) {
            errors.push(`site map key '${siteIdStr}' is not a numeric site id`);
        }
        const siteId = Number(siteIdStr);
        if (!Number.isFinite(site?.coord?.x) || !Number.isFinite(site?.coord?.y) || !Number.isFinite(site?.coord?.z)) {
            errors.push(`site ${siteId} has invalid coordinate`);
            continue;
        }
        const expectedCoordKey = coordKey(site.coord);
        if (site.coordKey !== expectedCoordKey) {
            errors.push(`site ${siteId} coordKey mismatch`);
        }
        if (seenCoordKeys.has(site.coordKey)) {
            errors.push(`duplicate coordKey '${site.coordKey}'`);
        }
        seenCoordKeys.add(site.coordKey);
        if (result.siteIdByCoord?.[site.coordKey] !== siteId) {
            errors.push(`siteIdByCoord mismatch for ${site.coordKey}`);
        }
        for (const field of blockedFields) {
            if (Object.hasOwn(site, field)) errors.push(`site ${siteId} unexpectedly contains '${field}'`);
        }
    }
    for (const hint of Object.values(result?.clusterHintsBySiteId || {})) {
        if (hint?.roleHint === "home_candidate") hasHomeCandidate = true;
        if (hint?.family !== "starter_hub" && Array.isArray(hint?.connectorKinds) && hint.connectorKinds.length > 0) {
            hasNonStarterConnector = true;
        }
    }
    if (!hasHomeCandidate) errors.push("missing home_candidate transient hint");
    if (!hasNonStarterConnector) errors.push("missing non-starter connector transient hint");
    return errors;
}

export function createSparseSitesFromClusterBlueprints(config, rng) {
    ensureClusterBlueprintsValid();
    const archetype = BALANCE.WORLDGEN.ARCHETYPES[config.archetypeKey]
        || BALANCE.WORLDGEN.ARCHETYPES[BALANCE.WORLDGEN.DEFAULT_ARCHETYPE];

    // Select blueprints
    const selectedBlueprints = [
        selectClusterByFamily(CLUSTER_BLUEPRINTS, "starter_hub", rng),
        selectClusterByFamily(CLUSTER_BLUEPRINTS, "frontier_extraction", rng),
        selectClusterByFamily(CLUSTER_BLUEPRINTS, "badlands_risk", rng)
    ].filter(Boolean);

    // Generate centers
    const centers = generateClusterCenters(
        archetype,
        Math.max(WORLDGEN_ANCHORS.CENTER_COUNT_MIN, Math.ceil(config.occupiedSites / WORLDGEN_ANCHORS.SITES_PER_CLUSTER_CENTER)),
        rng
    );

    // Sort centers by distance
    const sortedCenters = centers.map((c, index) => {
        const r = Math.sqrt(c.x * c.x + c.y * c.y);
        return { x: c.x, y: c.y, z: c.z, r, index };
    }).sort((a, b) => a.r - b.r);

    // Assign centers
    const assignedCenterIndices = new Set();
    const clusterAssignments = [];

    for (const blueprint of selectedBlueprints) {
        let assignedIdx = -1;
        const prefRegion = blueprint.placement.preferredRegion;
        for (let i = 0; i < sortedCenters.length; i++) {
            if (assignedCenterIndices.has(i)) continue;
            const region = getCenterRegion(i, sortedCenters.length);
            if (region === prefRegion) {
                assignedIdx = i;
                break;
            }
        }
        if (assignedIdx === -1) {
            for (let i = 0; i < sortedCenters.length; i++) {
                if (!assignedCenterIndices.has(i)) {
                    assignedIdx = i;
                    break;
                }
            }
        }
        if (assignedIdx === -1) {
            assignedIdx = 0;
        }
        assignedCenterIndices.add(assignedIdx);
        clusterAssignments.push({ blueprint, center: sortedCenters[assignedIdx] });
    }

    const sites = {};
    const siteIdByCoord = {};
    const clusterHintsBySiteId = {};
    const occupiedCoords = new Set();
    let nextSiteId = 1;

    // Place cluster sites
    for (const { blueprint, center } of clusterAssignments) {
        const connectorKindsByLocalId = {};
        for (const connector of blueprint.connectors || []) {
            if (!connectorKindsByLocalId[connector.localId]) {
                connectorKindsByLocalId[connector.localId] = [];
            }
            connectorKindsByLocalId[connector.localId].push(connector.kind);
        }
        const rotationIndex = Math.floor(rng() * 4);
        const mirrorX = rng() < 0.5;
        const mirrorY = rng() < 0.5;

        for (const siteBlueprint of blueprint.sites) {
            if (nextSiteId > config.occupiedSites) break; // Keep budget in check

            const transformed = transformOffset(siteBlueprint.offset, rotationIndex, mirrorX, mirrorY);
            const jitterX = Math.floor(rng() * 3) - 1;
            const jitterY = Math.floor(rng() * 3) - 1;
            const jitterZ = Math.floor(rng() * 3) - 1;

            let coord = {
                x: center.x + transformed.x + jitterX,
                y: center.y + transformed.y + jitterY,
                z: center.z + transformed.z + jitterZ
            };

            // Resolve duplicate coordinates
            while (occupiedCoords.has(coordKey(coord))) {
                coord.x += 1;
            }
            occupiedCoords.add(coordKey(coord));

            const id = nextSiteId;
            nextSiteId++;

            const region = siteBlueprint.region || "Frontier";
            const siteType = siteBlueprint.siteType || "stellar_system";
            const richness = siteBlueprint.richness || "developing";

            const influence = createBaseInfluence(region);
            if (siteBlueprint.factionBias) {
                for (const [factionId, amount] of Object.entries(siteBlueprint.factionBias)) {
                    influence[factionId] = Math.max(0, Math.min(100, (influence[factionId] || 0) + amount));
                }
            }

            const riskHint = siteBlueprint.riskHint
                || (blueprint.family === "badlands_risk" ? "badlands_risk" : null);
            const pirateThreatCap = WORLDGEN_GEOMETRY.REGIONS.PIRATE_THREAT_CAPS[region] || 0;
            const pirateThreat = id <= WORLDGEN_GEOMETRY.REGIONS.PIRATE_SAFE_SITE_LIMIT
                ? 0 : Math.floor(rng() * pirateThreatCap);
            const elevatedThreat = riskHint === "badlands_risk" && pirateThreatCap > 0
                ? Math.max(pirateThreat, 1 + Math.floor(rng() * pirateThreatCap))
                : pirateThreat;

            sites[id] = {
                id,
                siteId: `site-${id}`,
                coord,
                coordKey: coordKey(coord),
                name: siteBlueprint.nameHint ? `${siteBlueprint.nameHint} ${id}` : `${getSiteTypeLabel(siteType)} ${id}`,
                region,
                siteType,
                richness,
                charted: false,
                reachable: false,
                surveyed: false,
                jumpGates: [],
                pirateThreat: elevatedThreat,
                asteroids: null,
                influence,
                front: null,
                metricShear: metricShearAtCoord(coord)
            };

            siteIdByCoord[coordKey(coord)] = id;
            clusterHintsBySiteId[id] = {
                clusterId: blueprint.id || null,
                family: blueprint.family || null,
                localId: siteBlueprint.localId || null,
                connectorKinds: connectorKindsByLocalId[siteBlueprint.localId] || [],
                roleHint: siteBlueprint.roleHint || null,
                portHint: siteBlueprint.portHint || null,
                planetHint: siteBlueprint.planetHint || null,
                asteroidHint: siteBlueprint.asteroidHint || false,
                stationHint: siteBlueprint.stationHint || null,
                stockBias: siteBlueprint.stockBias || null,
                riskHint
            };
        }
    }

    // Place remaining procedural sites
    while (nextSiteId <= config.occupiedSites) {
        const id = nextSiteId;
        nextSiteId++;

        let coord = generateSiteCoordinate(archetype, centers, id - 1, rng);
        while (occupiedCoords.has(coordKey(coord))) {
            coord = { ...coord, x: coord.x + 1 };
        }
        occupiedCoords.add(coordKey(coord));

        let siteType = pickWeighted(BALANCE.WORLDGEN.SITE_TYPE_MIX, rng);
        let richness = pickWeighted(BALANCE.WORLDGEN.RICHNESS_MIX, rng);
        if (siteType === "way_station") {
            richness = rng() < WORLDGEN_ANCHORS.WAY_STATION_SPARSE_CHANCE ? "sparse" : "strategic";
        }

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

    const result = {
        sites,
        siteIdByCoord,
        archetypeName: archetype.name,
        clusterHintsBySiteId
    };
    const qualityErrors = validateClusterAssemblyResult(result, config);
    if (qualityErrors.length > 0) {
        throw new Error(`Cluster assembly quality gate failed: ${qualityErrors.join('; ')}`);
    }
    return result;
}
