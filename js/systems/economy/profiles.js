import { state } from '../../state.js';
import { MARKET_COMMODITIES, PORT_TYPES, PLANET_TYPES } from '../../constants.js';
import { hasEconomicActivity } from '../../utils.js';

const MARKET_COMMODITY_SET = new Set(MARKET_COMMODITIES);

function toFiniteNumber(value) {
    return Number.isFinite(value) ? Number(value) : 0;
}

function getSectorWeight(sectorId) {
    const sector = state.universe?.[sectorId];
    if (!sector) return 0;
    if (sector.richness === 'strategic') return 1.5;
    if (sector.richness === 'hub') return 1.25;
    if (sector.richness === 'settled') return 1.1;
    if (sector.richness === 'developing') return 0.9;
    return 0.75;
}

function estimatePopulationDemand(sectorId) {
    const planet = state.planets?.[sectorId];
    if (!planet) return 0;
    const colonists = toFiniteNumber(planet.colonists);
    return Math.max(0, colonists / 1000);
}

function estimateExtractionCapacity(sectorId) {
    const sector = state.universe?.[sectorId];
    if (!sector?.asteroids) return 0;
    const ore = toFiniteNumber(sector.asteroids.ore);
    const richness = toFiniteNumber(sector.asteroids.richness);
    const hazard = toFiniteNumber(sector.asteroids.hazard);
    const hazardPenalty = Math.max(0.4, 1 - hazard * 0.15);
    return Math.max(0, ore * (1 + richness) * hazardPenalty);
}

function toKnownCommodityList(commodities) {
    if (!Array.isArray(commodities)) return [];
    const result = [];
    const seen = new Set();
    commodities.forEach((commodity) => {
        if (typeof commodity !== 'string') return;
        if (!MARKET_COMMODITY_SET.has(commodity) || seen.has(commodity)) return;
        seen.add(commodity);
        result.push(commodity);
    });
    return result;
}

export function buildEconomicProfileForSector(sectorId) {
    const sector = state.universe?.[sectorId];
    if (!sector || !hasEconomicActivity(sectorId)) return null;

    const port = state.ports?.[sectorId] || null;
    const planet = state.planets?.[sectorId] || null;
    const portType = port ? PORT_TYPES[port.typeKey] : null;
    const planetType = planet ? PLANET_TYPES[planet.typeKey] : null;

    const profile = {
        sectorId: Number(sectorId),
        generatedDay: state.player?.time?.day ?? 1,
        roleTags: [],
        supplyWeight: getSectorWeight(sectorId),
        demandWeight: getSectorWeight(sectorId),
        extractionCapacity: estimateExtractionCapacity(sectorId),
        populationDemand: estimatePopulationDemand(sectorId),
        likelyExports: [],
        likelyImports: []
    };

    if (portType) {
        profile.roleTags.push(`port:${port.typeKey}`);
        profile.likelyExports = toKnownCommodityList(portType.sells);
        profile.likelyImports = toKnownCommodityList(portType.buys);
    }
    if (planetType) profile.roleTags.push(`planet:${planet.typeKey}`);
    if (sector.siteType === 'way_station') profile.roleTags.push('way_station');
    if (profile.extractionCapacity > 0) profile.roleTags.push('extractive');

    const importSet = new Set(profile.likelyImports);
    const exportSet = new Set(profile.likelyExports);
    if (profile.populationDemand > 0) {
        MARKET_COMMODITIES.forEach((commodity) => {
            if (!exportSet.has(commodity)) importSet.add(commodity);
        });
    }

    profile.likelyImports = toKnownCommodityList([...importSet]);
    profile.likelyExports = toKnownCommodityList([...exportSet]);
    return profile;
}

export function rebuildEconomicProfiles() {
    const profilesBySector = {};
    Object.keys(state.universe || {}).forEach((sectorId) => {
        const profile = buildEconomicProfileForSector(sectorId);
        if (profile) profilesBySector[sectorId] = profile;
    });
    if (!state.economy) return profilesBySector;
    state.economy.profilesBySector = profilesBySector;
    state.economy.lastProfileBuildDay = state.player?.time?.day ?? 1;
    return profilesBySector;
}
