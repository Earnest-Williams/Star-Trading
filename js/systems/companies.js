import { state } from '../state.js';
import {
    COMPANY_ARCHETYPES,
    COMPANY_CAPACITY_SELECTION_RULES,
    COMPANY_NAME_PARTS,
    COMPANY_SPAWN_RULES
} from '../config/companies.js';
import { getPortType, normalisePortTypeKey } from '../core/ports.js';
import { getDominantInfluence } from '../core/influence.js';
import { createGeneratedPerson, resetPeopleState } from './people.js';
import { hasEconomicActivity } from '../utils.js';
import { MARKET_COMMODITIES } from '../constants.js';
import { deriveRouteMetrics } from './tradeRoutes.js';
import { chooseCapacityBasedCompanyTypes } from './economy/companyScoring.js';

function pick(list, rng) {
    return list[Math.floor(rng() * list.length)];
}

function uniqueCommodityList(commodities) {
    return Array.from(new Set(commodities.filter(commodity => MARKET_COMMODITIES.includes(commodity))));
}

function chooseImportExportSpecialtyGoods(sectorId, rng) {
    const port = state.ports[sectorId];
    const portType = port ? getPortType(port) : null;
    const localGoods = portType
        ? uniqueCommodityList(portType.sells.concat(portType.buys))
        : [];
    const pool = localGoods.length > 0 ? localGoods : MARKET_COMMODITIES;
    const specialties = [];
    const desiredCount = Math.min(3, pool.length);
    let offset = Math.floor(rng() * pool.length);
    while (specialties.length < desiredCount) {
        const commodity = pool[offset % pool.length];
        if (!specialties.includes(commodity)) specialties.push(commodity);
        offset += 1 + Math.floor(rng() * Math.max(1, pool.length - 1));
    }
    return specialties;
}

function chooseImportExportRouteFocus(sectorId, rng) {
    const gates = Array.isArray(state.universe[sectorId]?.jumpGates)
        ? state.universe[sectorId].jumpGates
        : [];
    const activeGates = gates.filter(gate => gate.status !== "closed" && state.universe[gate.destinationSectorId]);
    if (activeGates.length === 0) return null;
    const gate = pick(activeGates, rng);
    const destination = state.universe[gate.destinationSectorId];
    return {
        originSector: sectorId,
        destinationSector: gate.destinationSectorId,
        destinationRegion: destination.region || null
    };
}

function createProductionProfile(archetype) {
    return {
        inputs: archetype.imports.slice(),
        outputs: archetype.exports.slice()
    };
}

function createOrderProfile(sectorId, type, archetype, rng) {
    const orderProfile = {
        exports: archetype.exports.slice(),
        imports: archetype.imports.slice(),
        missionTypes: archetype.missionTypes.slice(),
        productionProfile: createProductionProfile(archetype)
    };
    if (type !== 'import_export') return orderProfile;
    orderProfile.specialtyGoods = chooseImportExportSpecialtyGoods(sectorId, rng);
    orderProfile.routeFocus = chooseImportExportRouteFocus(sectorId, rng);
    return orderProfile;
}


function getCompanyAnchor(sectorId) {
    const port = state.ports[sectorId];
    const portType = port ? normalisePortTypeKey(port) : null;
    if (portType === 'stardock') return 'stardock';
    if (state.universe[sectorId]?.station || state.universe[sectorId]?.siteType === 'way_station') return 'station';
    if (portType === 'industrial') return 'industrial';
    if (portType === 'refinery') return 'refinery';
    if (portType === 'consumer') return 'consumer';
    if (state.planets[sectorId]) return 'planet';
    return null;
}

function shouldSeedShipRefitter(sectorId, rng) {
    const anchor = getCompanyAnchor(sectorId);
    if (!anchor) return false;
    const chance = COMPANY_SPAWN_RULES.SHIP_REFITTER_CHANCE_BY_ANCHOR[anchor] || 0;
    return rng() < chance;
}

function getDockyardCount(sectorId, rng) {
    const anchor = getCompanyAnchor(sectorId);
    const rules = COMPANY_SPAWN_RULES.DOCKYARD;
    if (anchor === 'stardock') {
        return Math.min(
            rules.STATION_MAX,
            rules.STARDOCK_BASE_COUNT + (rng() < rules.STARDOCK_SECOND_CHANCE ? 1 : 0)
        );
    }
    if (anchor === 'station') {
        let count = rng() < rules.STATION_FIRST_CHANCE ? 1 : 0;
        if (count > 0 && rng() < rules.STATION_SECOND_CHANCE) count += 1;
        return Math.min(rules.STATION_MAX, count);
    }
    if (state.planets[sectorId]) {
        let count = rng() < rules.PLANET_FIRST_CHANCE ? 1 : 0;
        if (count > 0 && rng() < rules.PLANET_SECOND_CHANCE) count += 1;
        if (count > 1 && rng() < rules.PLANET_THIRD_CHANCE) count += 1;
        return Math.min(rules.PLANET_MAX, count);
    }
    if (anchor === 'industrial' && rng() < rules.INDUSTRIAL_FIRST_CHANCE) {
        return rules.PORT_MAX;
    }
    return 0;
}

function chooseCompanyType(sectorId, options = {}) {
    const includeFrontOverride = options.includeFrontOverride !== false;
    const sector = state.universe[sectorId];
    const port = state.ports[sectorId];
    if (includeFrontOverride && (sector?.front || port?.hiddenFactionId === 'vc')) return 'black_market_front';
    if (sector?.asteroids) return 'mining_contractor';
    const typeKey = port ? normalisePortTypeKey(port) : null;
    if (typeKey === 'mining') return 'mining_contractor';
    if (typeKey === 'refinery') return 'refinery_operator';
    if (typeKey === 'agricultural') return 'agri_collective';
    if (typeKey === 'industrial' || typeKey === 'consumer') return 'industrial_supplier';
    if (port) return 'import_export';
    return state.planets[sectorId] ? 'haulage' : 'security_contractor';
}

function chooseCapacityDrivenPrimaryType(sectorId, connectivityScore) {
    const sector = state.universe[sectorId];
    const port = state.ports[sectorId];
    const profile = getEconomicProfile(sectorId);
    if (sector?.front || port?.hiddenFactionId === 'vc') return 'black_market_front';
    const extractionCapacity = Number(profile?.extractionCapacity) || 0;
    const processingScore = scoreProcessingPresence(sectorId, connectivityScore);
    const populationDemand = Number(profile?.demandWeight) || 0;
    if (extractionCapacity >= COMPANY_CAPACITY_SELECTION_RULES.PRIMARY_MINING_EXTRACTION_CAPACITY) return 'mining_contractor';
    if (processingScore >= COMPANY_CAPACITY_SELECTION_RULES.PRIMARY_REFINERY_PROCESSING_SCORE) return 'refinery_operator';
    if (
        populationDemand >= COMPANY_CAPACITY_SELECTION_RULES.PRIMARY_INDUSTRIAL_DEMAND_WEIGHT
        && connectivityScore >= COMPANY_CAPACITY_SELECTION_RULES.PRIMARY_INDUSTRIAL_CONNECTIVITY
    ) return 'industrial_supplier';
    if (connectivityScore >= COMPANY_CAPACITY_SELECTION_RULES.PRIMARY_IMPORT_EXPORT_CONNECTIVITY) return 'import_export';
    return chooseCompanyType(sectorId, { includeFrontOverride: false });
}

function getEconomicProfile(sectorId) {
    return state.economy?.profilesBySector?.[sectorId] || null;
}

function getRouteConnectivityScore(sectorId) {
    const gates = Array.isArray(state.universe?.[sectorId]?.jumpGates)
        ? state.universe[sectorId].jumpGates
        : [];
    const activeDestinations = gates
        .filter(gate => gate.status !== 'closed' && state.universe[gate.destinationSectorId])
        .map(gate => gate.destinationSectorId);
    if (activeDestinations.length === 0) return 0;
    let score = 0;
    activeDestinations.forEach((destinationSectorId) => {
        const metrics = deriveRouteMetrics(sectorId, destinationSectorId);
        if (!metrics.path || typeof metrics.risk !== 'number') return;
        const hopScore = Math.max(0.2, 1 / Math.max(1, metrics.hopCount || 1));
        const riskScore = Math.max(0.2, 1 - Math.max(0, metrics.risk) * 0.1);
        score += hopScore * riskScore;
    });
    return score;
}

function computeExtractionCompanyCount(sectorId) {
    const profile = getEconomicProfile(sectorId);
    const extractionCapacity = Number(profile?.extractionCapacity) || 0;
    if (extractionCapacity >= 12000) return 3;
    if (extractionCapacity >= 5000) return 2;
    if (extractionCapacity > 800) return 1;
    const sector = state.universe?.[sectorId];
    if (sector?.asteroids) return 1;
    return 0;
}

function scoreProcessingPresence(sectorId, connectivityScore = getRouteConnectivityScore(sectorId)) {
    const profile = getEconomicProfile(sectorId);
    const extraction = Number(profile?.extractionCapacity) || 0;
    const localExtraction = Math.min(2, extraction / 4000);
    const connectivity = Math.min(2, connectivityScore);
    const roleTags = Array.isArray(profile?.roleTags) ? profile.roleTags : [];
    const industrialBias = roleTags.some(tag => tag === 'port:industrial' || tag === 'port:refinery')
        ? 1
        : 0;
    return localExtraction + connectivity + industrialBias;
}

function computeTradeScaling(sectorId, connectivityScore = getRouteConnectivityScore(sectorId)) {
    const profile = getEconomicProfile(sectorId);
    const importPressure = Array.isArray(profile?.likelyImports) ? profile.likelyImports.length : 0;
    const exportPressure = Array.isArray(profile?.likelyExports) ? profile.likelyExports.length : 0;
    const throughput = importPressure + exportPressure + connectivityScore;
    return {
        haulageCount: throughput >= 7 ? 2 : throughput >= 3 ? 1 : 0,
        importExportCount: throughput >= 8 ? 2 : throughput >= 4 ? 1 : 0
    };
}

function chooseFaction(sectorId, type) {
    const port = state.ports[sectorId];
    if (type === 'black_market_front') return 'vc';
    if (type === 'mining_contractor' || type === 'refinery_operator') return 'hc';
    if (port?.factionId) return port.factionId;
    return getDominantInfluence(sectorId) || 'fu';
}

function createCompany(sectorId, type, rng) {
    const archetype = COMPANY_ARCHETYPES[type] || COMPANY_ARCHETYPES.haulage;
    const id = `company-${state.nextCompanyId++}`;
    const factionId = chooseFaction(sectorId, type);
    const polityId = state.polityIdsBySector?.[sectorId] || null;
    const company = {
        id,
        name: `${pick(COMPANY_NAME_PARTS.prefixes, rng)} ${pick(COMPANY_NAME_PARTS.suffixes, rng)}`,
        type,
        sectorId,
        factionId,
        parentPolityId: polityId,
        contactPersonIds: [],
        orderProfile: createOrderProfile(sectorId, type, archetype, rng),
        reputation: 0,
        trust: 0,
        heat: type === 'black_market_front' ? 10 : 0
    };
    state.companies[id] = company;
    if (!state.companyIdsBySector[sectorId]) state.companyIdsBySector[sectorId] = [];
    state.companyIdsBySector[sectorId].push(id);
    const role = type === 'haulage' ? 'freight_manager'
        : type === 'black_market_front' ? 'fixer'
            : type === 'security_contractor' ? 'factor'
                : type === 'ship_refitter' || type === 'dockyard' ? 'dockmaster'
                    : 'sales_director';
    const person = createGeneratedPerson({ role, sectorId, companyId: id, polityId, factionId }, rng);
    company.contactPersonIds.push(person.id);
    return company;
}

export function seedCompaniesAndPeople(rng) {
    state.companies = {};
    state.companyIdsBySector = {};
    state.nextCompanyId = 1;
    resetPeopleState();
    Object.keys(state.universe).map(Number).forEach(sectorId => {
        if (!hasEconomicActivity(sectorId)) return;
        const profile = state.economy?.profilesBySector?.[sectorId];
        const chosenTypes = profile ? chooseCapacityBasedCompanyTypes(sectorId, rng) : [chooseCompanyType(sectorId)];
        chosenTypes.forEach((type) => createCompany(sectorId, type, rng));
    });
}

export function getMissionIssuerCompany(originSector, missionType = null) {
    const ids = state.companyIdsBySector?.[originSector] || [];
    if (ids.length === 0) return null;
    const preferred = missionType
        ? ids.map(id => state.companies[id]).filter(company => company?.orderProfile?.missionTypes?.includes(missionType))
        : [];
    return preferred[0] || state.companies[ids[0]] || null;
}
