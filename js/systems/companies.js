import { state } from '../state.js';
import { COMPANY_ARCHETYPES, COMPANY_NAME_PARTS, COMPANY_SPAWN_RULES } from '../config/companies.js';
import { getPortType, normalisePortTypeKey } from '../core/ports.js';
import { getDominantInfluence } from '../core/influence.js';
import { createGeneratedPerson, resetPeopleState } from './people.js';
import { hasEconomicActivity } from '../utils.js';
import { MARKET_COMMODITIES } from '../constants.js';

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

function chooseCompanyType(sectorId) {
    const sector = state.universe[sectorId];
    const port = state.ports[sectorId];
    if (sector?.front || port?.hiddenFactionId === 'vc') return 'black_market_front';
    if (sector?.asteroids) return 'mining_contractor';
    const typeKey = port ? normalisePortTypeKey(port) : null;
    if (typeKey === 'mining') return 'mining_contractor';
    if (typeKey === 'refinery') return 'refinery_operator';
    if (typeKey === 'agricultural') return 'agri_collective';
    if (typeKey === 'industrial' || typeKey === 'consumer') return 'industrial_supplier';
    if (port) return 'import_export';
    return state.planets[sectorId] ? 'haulage' : 'security_contractor';
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
        const type = chooseCompanyType(sectorId);
        createCompany(sectorId, type, rng);
        const port = state.ports[sectorId];
        const portType = port ? getPortType(port) : null;
        const isHub = port && (portType.sells.length > 0 || port.typeKey === 'stardock');
        if (isHub) createCompany(sectorId, type === 'import_export' ? 'haulage' : 'import_export', rng);
        if (shouldSeedShipRefitter(sectorId, rng)) createCompany(sectorId, 'ship_refitter', rng);
        for (let index = 0; index < getDockyardCount(sectorId, rng); index++) {
            createCompany(sectorId, 'dockyard', rng);
        }
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
