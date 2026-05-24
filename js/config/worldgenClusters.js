// Rhai-portable shape:
//
// ClusterBlueprint = {
//     id: string,
//     family: string,
//     tags: string[],
//     weight: number,
//     placement: ClusterPlacement,
//     sites: ClusterSiteBlueprint[],
//     connectors: ClusterConnector[],
//     validation: ClusterValidation
// }
//
// ClusterPlacement = {
//     preferredRegion: string,
//     preferredRadius: number
// }
//
// ClusterSiteBlueprint = {
//     localId: string,
//     offset: { x: number, y: number, z: number },
//     siteType: string,
//     richness: string,
//     region: string,
//     roleHint?: string,
//     factionBias?: { [factionId: string]: number },
//     portHint?: string,
//     planetHint?: string,
//     asteroidHint?: boolean,
//     stationHint?: string,
//     stockBias?: { [commodityId: string]: "surplus" | "normal" | "shortage" | "empty" }
// }
//
// ClusterConnector = {
//     localId: string,
//     kind: string
// }
//
// ClusterValidation = {
//     minEconomicSites: number,
//     requiresExtractionSite: boolean,
//     starterCompatible: boolean
// }

import { MARKET_COMMODITIES } from './economy.js';
import { PORT_TYPES } from './ports.js';
import { PLANET_TYPES } from './entities.js';

const VALID_STOCK_BIAS_VALUES = new Set(['surplus', 'normal', 'shortage', 'empty']);
const MARKET_COMMODITY_SET = new Set(MARKET_COMMODITIES);

export const CLUSTER_BLUEPRINTS = Object.freeze([
    {
        id: "starter-hub-a",
        family: "starter_hub",
        tags: ["starter", "core", "safe"],
        weight: 1.0,
        placement: {
            preferredRegion: "Core",
            preferredRadius: 14.0
        },
        sites: [
            {
                localId: "hub",
                offset: { x: 0, y: 0, z: 0 },
                siteType: "stellar_system",
                richness: "hub",
                region: "Core",
                roleHint: "home_candidate",
                factionBias: { sda: 14, fu: 6 },
                portHint: "stardock",
                stockBias: {}
            },
            {
                localId: "mine",
                offset: { x: 4, y: -1, z: 0 },
                siteType: "brown_dwarf_system",
                richness: "developing",
                region: "Frontier",
                factionBias: { hc: 12, fu: 4 },
                asteroidHint: true,
                portHint: "mining",
                stockBias: {
                    ore: "surplus",
                    repair_parts: "shortage"
                }
            },
            {
                localId: "farm",
                offset: { x: -3, y: 3, z: 1 },
                siteType: "stellar_system",
                richness: "settled",
                region: "Frontier",
                factionBias: { fu: 12 },
                planetHint: "terran",
                portHint: "agricultural",
                stockBias: {
                    org: "surplus",
                    machinery: "shortage"
                }
            }
        ],
        connectors: [
            { localId: "mine", kind: "trade_seam" },
            { localId: "farm", kind: "starter_expansion" }
        ],
        validation: {
            minEconomicSites: 3,
            requiresExtractionSite: true,
            starterCompatible: true
        }
    },
    {
        id: "frontier-extraction-a",
        family: "frontier_extraction",
        tags: ["frontier", "resources"],
        weight: 1.0,
        placement: {
            preferredRegion: "Frontier",
            preferredRadius: 22.0
        },
        sites: [
            {
                localId: "outpost",
                offset: { x: 0, y: 0, z: 0 },
                siteType: "stellar_system",
                richness: "developing",
                region: "Frontier",
                factionBias: { hc: 15 },
                portHint: "industrial",
                stockBias: {
                    machinery: "surplus",
                    ore: "shortage"
                }
            },
            {
                localId: "extraction_ore",
                offset: { x: 2, y: 2, z: -1 },
                siteType: "brown_dwarf_system",
                richness: "sparse",
                region: "Frontier",
                factionBias: { hc: 10, fu: 5 },
                asteroidHint: true,
                portHint: "mining",
                stockBias: {
                    ore: "surplus",
                    repair_parts: "shortage"
                }
            },
            {
                localId: "refinery_hub",
                offset: { x: -2, y: -2, z: 1 },
                siteType: "stellar_system",
                richness: "developing",
                region: "Frontier",
                factionBias: { hc: 8, sda: 4 },
                portHint: "refinery",
                stockBias: {
                    refined_metals: "surplus",
                    ore: "shortage"
                }
            }
        ],
        connectors: [
            { localId: "outpost", kind: "trade_seam" }
        ],
        validation: {
            minEconomicSites: 2,
            requiresExtractionSite: true,
            starterCompatible: false
        }
    },
    {
        id: "badlands-risk-a",
        family: "badlands_risk",
        tags: ["badlands", "risk", "cartel"],
        weight: 1.0,
        placement: {
            preferredRegion: "Badlands",
            preferredRadius: 35.0
        },
        sites: [
            {
                localId: "hideout",
                offset: { x: 0, y: 0, z: 0 },
                siteType: "rogue_system",
                richness: "sparse",
                region: "Badlands",
                factionBias: { vc: 18 },
                portHint: "consumer",
                stockBias: {
                    electronics: "shortage",
                    polymers: "surplus"
                }
            },
            {
                localId: "pirate_dock",
                offset: { x: -3, y: 1, z: -2 },
                siteType: "stellar_system",
                richness: "barren",
                region: "Badlands",
                factionBias: { vc: 20 },
                portHint: "refinery",
                stockBias: {
                    refined_metals: "surplus",
                    machinery: "shortage"
                }
            },
            {
                localId: "void_stash",
                offset: { x: 2, y: -2, z: 2 },
                siteType: "exotic_remnant",
                richness: "barren",
                region: "Badlands",
                factionBias: { vc: 12 },
                stockBias: {}
            }
        ],
        connectors: [
            { localId: "hideout", kind: "trade_seam" }
        ],
        validation: {
            minEconomicSites: 1,
            requiresExtractionSite: false,
            starterCompatible: false
        }
    }
]);

export function validateClusterBlueprint(blueprint) {
    const errors = [];

    if (!blueprint || typeof blueprint !== 'object') {
        errors.push('blueprint must be an object');
        return errors;
    }

    if (typeof blueprint.id !== 'string' || blueprint.id.length === 0) {
        errors.push('blueprint.id must be a non-empty string');
    }

    if (typeof blueprint.family !== 'string' || blueprint.family.length === 0) {
        errors.push('blueprint.family must be a non-empty string');
    }

    if (!Number.isFinite(blueprint.weight) || blueprint.weight <= 0) {
        errors.push(`${blueprint.id || 'blueprint'}: weight must be a positive finite number`);
    }

    if (!blueprint.placement || typeof blueprint.placement !== 'object') {
        errors.push(`${blueprint.id || 'blueprint'}: placement must be an object`);
    } else {
        if (typeof blueprint.placement.preferredRegion !== 'string' || blueprint.placement.preferredRegion.length === 0) {
            errors.push(`${blueprint.id || 'blueprint'}: placement.preferredRegion must be a non-empty string`);
        }
        if (!Number.isFinite(blueprint.placement.preferredRadius)) {
            errors.push(`${blueprint.id || 'blueprint'}: placement.preferredRadius must be a finite number`);
        }
    }

    if (!Array.isArray(blueprint.sites) || blueprint.sites.length === 0) {
        errors.push(`${blueprint.id || 'blueprint'}: sites must be a non-empty array`);
        return errors;
    }

    const siteLocalIds = new Set();
    for (const site of blueprint.sites) {
        if (typeof site.localId !== 'string' || site.localId.length === 0) {
            errors.push(`${blueprint.id}: site.localId must be a non-empty string`);
        } else {
            if (siteLocalIds.has(site.localId)) {
                errors.push(`${blueprint.id}: duplicate site.localId '${site.localId}'`);
            }
            siteLocalIds.add(site.localId);
        }

        if (!site.offset || !Number.isFinite(site.offset.x) || !Number.isFinite(site.offset.y) || !Number.isFinite(site.offset.z)) {
            errors.push(`${blueprint.id}/${site.localId}: offset must have finite x, y, z numbers`);
        }

        if (site.portHint && !PORT_TYPES[site.portHint]) {
            errors.push(`${blueprint.id}/${site.localId}: unknown portHint '${site.portHint}'`);
        }

        if (site.planetHint && !PLANET_TYPES[site.planetHint]) {
            errors.push(`${blueprint.id}/${site.localId}: unknown planetHint '${site.planetHint}'`);
        }

        if (site.stockBias && typeof site.stockBias === 'object') {
            for (const [commodityId, bias] of Object.entries(site.stockBias)) {
                if (!MARKET_COMMODITY_SET.has(commodityId)) {
                    errors.push(`${blueprint.id}/${site.localId}: unknown stockBias commodity '${commodityId}'`);
                }
                if (!VALID_STOCK_BIAS_VALUES.has(bias)) {
                    errors.push(`${blueprint.id}/${site.localId}: invalid stockBias value '${bias}' for '${commodityId}'`);
                }
            }
        }
    }

    for (const connector of blueprint.connectors || []) {
        if (!siteLocalIds.has(connector.localId)) {
            errors.push(`${blueprint.id}: connector references unknown localId '${connector.localId}'`);
        }
    }

    return errors;
}

export function selectClusterByFamily(blueprints, family, rng) {
    const candidates = blueprints.filter((blueprint) => blueprint.family === family);
    if (candidates.length === 0) {
        return null;
    }
    const totalWeight = candidates.reduce((sum, blueprint) => sum + blueprint.weight, 0);
    let roll = rng() * totalWeight;

    for (const blueprint of candidates) {
        roll -= blueprint.weight;
        if (roll <= 0) {
            return blueprint;
        }
    }

    return candidates[candidates.length - 1] || null;
}
