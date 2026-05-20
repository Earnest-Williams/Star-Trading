import { state } from '../../state.js';
import { MARKET_COMMODITIES, PLANET_TYPES } from '../../constants.js';
import { hasEconomicActivity } from '../../utils.js';
import { getPortType, DEFAULT_PORT_TYPE_KEY } from '../../core/ports.js';

const STARDOCK_PORT_TYPE_KEY = 'stardock';

const MARKET_COMMODITY_SET = new Set(MARKET_COMMODITIES);

// Population tier thresholds (colonist counts) for import demand classification.
const POPULATION_TIER_LARGE = 1000;
const POPULATION_TIER_SETTLED = 350;

// Commodities demanded by population at each tier (0 = unpopulated, 5 = hub/capital).
const POPULATION_IMPORT_BY_TIER = Object.freeze([
    Object.freeze([]),
    Object.freeze(['water_ice', 'org', 'repair_parts', 'medical_supplies']),
    Object.freeze(['water_ice', 'org', 'repair_parts', 'medical_supplies', 'pulse_canister']),
    Object.freeze(['water_ice', 'org', 'repair_parts', 'medical_supplies', 'pulse_canister', 'electronics']),
    Object.freeze(['water_ice', 'org', 'repair_parts', 'medical_supplies', 'pulse_canister', 'electronics', 'eq']),
    Object.freeze(['water_ice', 'org', 'repair_parts', 'medical_supplies', 'pulse_canister', 'electronics', 'eq', 'construction_kits'])
]);

function toFiniteNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
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

function inferPopulationTier(sectorId) {
    const port = state.ports?.[sectorId];
    const planet = state.planets?.[sectorId];
    const sector = state.universe?.[sectorId];
    if (port?.typeKey === STARDOCK_PORT_TYPE_KEY) return 5;
    if (port?.typeKey === DEFAULT_PORT_TYPE_KEY) return 4;
    if (planet) {
        const colonists = toFiniteNumber(planet.colonists);
        if (colonists >= POPULATION_TIER_LARGE) return 4;
        if (colonists >= POPULATION_TIER_SETTLED) return 3;
        if (colonists > 0) return 2;
    }
    if (sector?.siteType === 'way_station' || port) return 2;
    if (sector?.asteroids) return 1;
    return 0;
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
    const portType = port ? getPortType(port) : null;
    const planetType = planet ? PLANET_TYPES[planet.typeKey] : null;

    const populationTier = inferPopulationTier(sectorId);
    const extractionCapacity = estimateExtractionCapacity(sectorId);
    const profile = {
        sectorId: Number(sectorId),
        generatedDay: state.player?.time?.day ?? 1,
        roleTags: [],
        supplyWeight: getSectorWeight(sectorId),
        demandWeight: getSectorWeight(sectorId),
        extractionCapacity,
        populationDemand: estimatePopulationDemand(sectorId),
        likelyExports: [],
        likelyImports: [],
        populationTier,
        settlementRole: sector.siteType || (port ? 'port' : 'colony'),
        baselineConsumption: {},
        industrialConsumption: {},
        targetStock: {},
        strategicReserve: {},
        companyCapacity: Math.max(1, Math.round(getSectorWeight(sectorId) * 3 + estimateExtractionCapacity(sectorId) * 0.2)),
        facilityBias: { extraction: extractionCapacity, processing: 0.5, manufacturing: 0.5 },
        marketPressure: { demandBias: getSectorWeight(sectorId), supplyBias: getSectorWeight(sectorId) },
        routeDependence: Math.max(0, 1 - Math.min(1, estimateExtractionCapacity(sectorId) / 30))
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
    // inferPopulationTier always returns 0–5; fallback to [] guards against future range changes.
    const populationImports = POPULATION_IMPORT_BY_TIER[populationTier] || [];
    populationImports.forEach((commodity) => {
        if (!exportSet.has(commodity)) importSet.add(commodity);
    });

    profile.likelyImports = toKnownCommodityList([...importSet]);
    profile.likelyExports = toKnownCommodityList([...exportSet]);
    profile.likelyImports.forEach((commodity) => { profile.baselineConsumption[commodity] = populationTier; profile.targetStock[commodity] = 16 + populationTier * 10; profile.strategicReserve[commodity] = Math.round(profile.targetStock[commodity] * 0.25); });
    profile.likelyExports.forEach((commodity) => { profile.industrialConsumption[commodity] = 0; profile.targetStock[commodity] = Math.max(profile.targetStock[commodity] || 0, 10); });
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
