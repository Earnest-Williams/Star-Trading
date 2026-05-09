import { state } from '../state.js';
import { PERSON_NAME_PARTS, PERSON_ROLES, PERSON_SERVICES_BY_ROLE } from '../config/people.js';

function pick(list, rng) {
    return list[Math.floor(rng() * list.length)];
}

export function resetPeopleState() {
    state.people = {};
    state.peopleBySector = {};
    state.peopleByCompany = {};
    state.nextPersonId = 1;
}

export function createGeneratedPerson({ role, sectorId, companyId = null, polityId = null, factionId }, rng) {
    const id = `person-${state.nextPersonId++}`;
    const safeRole = PERSON_ROLES.includes(role) ? role : 'factor';
    const person = {
        id,
        name: `${pick(PERSON_NAME_PARTS.given, rng)} ${pick(PERSON_NAME_PARTS.family, rng)}`,
        role: safeRole,
        sectorId,
        companyId,
        polityId,
        factionId,
        relationship: 0,
        trust: 0,
        leverage: 0,
        known: false,
        services: (PERSON_SERVICES_BY_ROLE[safeRole] || PERSON_SERVICES_BY_ROLE.factor).slice()
    };
    state.people[id] = person;
    if (!state.peopleBySector[sectorId]) state.peopleBySector[sectorId] = [];
    state.peopleBySector[sectorId].push(id);
    if (companyId) {
        if (!state.peopleByCompany[companyId]) state.peopleByCompany[companyId] = [];
        state.peopleByCompany[companyId].push(id);
    }
    return person;
}

export function getPrimaryCompanyContact(companyId) {
    const ids = state.peopleByCompany?.[companyId] || [];
    return ids.length > 0 ? state.people[ids[0]] || null : null;
}
