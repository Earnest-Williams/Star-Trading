import { state } from '../state.js';
import { COMPANY_ARCHETYPES, COMPANY_NAME_PARTS } from '../config/companies.js';
import { PORT_TYPES } from '../constants.js';
import { getDominantInfluence } from '../core/influence.js';
import { createGeneratedPerson, resetPeopleState } from './people.js';
import { hasEconomicActivity } from '../utils.js';

function pick(list, rng) {
    return list[Math.floor(rng() * list.length)];
}

function chooseCompanyType(sectorId) {
    const sector = state.universe[sectorId];
    const port = state.ports[sectorId];
    if (sector?.front || port?.hiddenFactionId === 'vc') return 'black_market_front';
    if (sector?.asteroids) return 'mining_contractor';
    if (port?.typeKey === 'refinery') return 'refinery_operator';
    if (port?.typeKey === 'agricultural') return 'agri_collective';
    if (port?.typeKey === 'industrial' || port?.typeKey === 'consumer') return 'industrial_supplier';
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
        orderProfile: {
            exports: archetype.exports.slice(),
            imports: archetype.imports.slice(),
            missionTypes: archetype.missionTypes.slice()
        },
        reputation: 0,
        trust: 0,
        heat: type === 'black_market_front' ? 10 : 0
    };
    state.companies[id] = company;
    if (!state.companyIdsBySector[sectorId]) state.companyIdsBySector[sectorId] = [];
    state.companyIdsBySector[sectorId].push(id);
    const role = type === 'haulage' ? 'freight_manager'
        : type === 'black_market_front' ? 'fixer'
            : type === 'security_contractor' ? 'factor' : 'sales_director';
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
        const isHub = port && (PORT_TYPES[port.typeKey]?.sells?.length > 0 || port.typeKey === 'stardock');
        if (isHub) createCompany(sectorId, type === 'import_export' ? 'haulage' : 'import_export', rng);
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
