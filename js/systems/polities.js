import { state } from '../state.js';
import { FACTIONS } from '../config/factions.js';
import { POLITY_DEFS, LOCAL_AUTHORITY_TYPES, POLITY_SETTINGS } from '../config/polities.js';
import { getSectorNeighbors } from '../core/navigation.js';
import { getDominantInfluence } from '../core/influence.js';
import { hasEconomicActivity } from '../utils.js';

function sectorValue(sectorId) {
    const sector = state.universe[sectorId];
    let value = 0;
    if (state.ports[sectorId]) value += 50;
    if (state.planets[sectorId]) value += 35;
    if (sector?.asteroids) value += 25;
    if (sector?.station) value += 20;
    if (sector?.richness === 'hub') value += 40;
    if (sector?.richness === 'settled') value += 25;
    return value - sectorId * 0.001;
}

function createPolity(def, capitalSectorId = null) {
    return {
        id: def.id,
        name: def.name,
        type: def.type,
        capitalSectorId,
        sectorIds: capitalSectorId ? [capitalSectorId] : [],
        dominantFactionId: def.dominantFactionId,
        laws: { ...def.laws },
        relations: {}
    };
}

function removeSectorFromCurrentPolity(sectorId) {
    const currentPolityId = state.polityIdsBySector[sectorId];
    const currentPolity = currentPolityId ? state.polities[currentPolityId] : null;
    if (!currentPolity) return;
    currentPolity.sectorIds = currentPolity.sectorIds.filter(id => id !== sectorId);
}

function addSectorToPolity(sectorId, polity) {
    removeSectorFromCurrentPolity(sectorId);
    if (!polity.sectorIds.includes(sectorId)) polity.sectorIds.push(sectorId);
    state.polityIdsBySector[sectorId] = polity.id;
}

function pickAuthorityType(sectorId, polityId) {
    const sector = state.universe[sectorId];
    const polity = state.polities[polityId];
    if (sector?.front || polity?.dominantFactionId === 'vc') return 'cartel_cell';
    if (polity?.dominantFactionId === 'hc') return 'corporate_prefecture';
    if (state.planets[sectorId]) return 'colonial_administration';
    if (state.ports[sectorId]) return 'freeport_board';
    return 'station_council';
}

function assignLocalAuthority(sectorId) {
    const sector = state.universe[sectorId];
    if (!sector || !hasEconomicActivity(sectorId)) return;
    const polityId = state.polityIdsBySector[sectorId] || 'independent_worlds';
    const polity = state.polities[polityId] || state.polities.independent_worlds;
    const factionId = getDominantInfluence(sectorId) || polity?.dominantFactionId || 'fu';
    const type = pickAuthorityType(sectorId, polityId);
    sector.localAuthority = {
        id: `authority-${sectorId}`,
        name: `${sector.name} ${type.split('_').map(part => part[0].toUpperCase() + part.slice(1)).join(' ')}`,
        type: LOCAL_AUTHORITY_TYPES.includes(type) ? type : 'station_council',
        polityId,
        factionId,
        legitimacy: factionId === 'vc' ? 35 : 55 + Math.min(30, sectorValue(sectorId)),
        corruption: factionId === 'vc' ? 70 : Math.max(5, 35 - Math.floor(sectorValue(sectorId) / 4)),
        stability: Math.max(15, 65 - (sector.pirateThreat || 0) * 8)
    };
}

export function isPolityContiguous(polityId) {
    const polity = state.polities?.[polityId];
    if (!polity || polity.sectorIds.length <= 1) return true;
    const allowed = new Set(polity.sectorIds.map(Number));
    const seen = new Set();
    const queue = [polity.sectorIds[0]];
    seen.add(polity.sectorIds[0]);
    while (queue.length > 0) {
        const id = queue.shift();
        getSectorNeighbors(id).forEach(next => {
            if (!allowed.has(next) || seen.has(next)) return;
            seen.add(next);
            queue.push(next);
        });
    }
    return seen.size === allowed.size;
}


function keepCapitalComponent(polity) {
    if (!polity || polity.type === 'independent' || polity.sectorIds.length <= 1) return;
    const allowed = new Set(polity.sectorIds);
    const start = polity.capitalSectorId || polity.sectorIds[0];
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length > 0) {
        const id = queue.shift();
        getSectorNeighbors(id).forEach(next => {
            if (!allowed.has(next) || seen.has(next)) return;
            seen.add(next);
            queue.push(next);
        });
    }
    const detached = polity.sectorIds.filter(id => !seen.has(id));
    if (detached.length === 0) return;
    polity.sectorIds = polity.sectorIds.filter(id => seen.has(id));
    detached.forEach(id => addSectorToPolity(id, state.polities.independent_worlds));
}

export function assignSectorPolities() {
    state.polities = {};
    state.polityIdsBySector = {};
    const activeIds = Object.keys(state.universe).map(Number).filter(hasEconomicActivity);
    if (activeIds.length === 0) return;
    const majorDefs = [
        POLITY_DEFS.stardock_federation,
        POLITY_DEFS.helion_imperial_compact,
        POLITY_DEFS.frontier_free_leagues,
        POLITY_DEFS.void_protectorates
    ];
    const capitals = activeIds.slice()
        .sort((a, b) => sectorValue(b) - sectorValue(a))
        .slice(0, Math.min(POLITY_SETTINGS.CAPITAL_COUNT, activeIds.length));
    const seededDefs = majorDefs.slice(0, capitals.length);
    seededDefs.forEach((def, index) => {
        const capital = capitals[index];
        state.polities[def.id] = createPolity(def, capital);
        state.polityIdsBySector[capital] = def.id;
    });
    state.polities.independent_worlds = createPolity(POLITY_DEFS.independent_worlds, null);

    const queues = seededDefs.map(def => ({ polity: state.polities[def.id], frontier: [state.polities[def.id].capitalSectorId] }));
    while (activeIds.some(id => !state.polityIdsBySector[id])) {
        let progressed = false;
        queues.forEach(entry => {
            const origin = entry.frontier.shift();
            if (!origin) return;
            getSectorNeighbors(origin).forEach(next => {
                if (!hasEconomicActivity(next) || state.polityIdsBySector[next]) return;
                addSectorToPolity(next, entry.polity);
                entry.frontier.push(next);
                progressed = true;
            });
        });
        if (!progressed) {
            const orphan = activeIds.find(id => !state.polityIdsBySector[id]);
            if (!orphan) break;
            addSectorToPolity(orphan, state.polities.independent_worlds);
        }
    }

    const targetIndependent = Math.floor(activeIds.length * POLITY_SETTINGS.INDEPENDENT_FRACTION);
    activeIds.slice().sort((a, b) => sectorValue(a) - sectorValue(b)).some(sectorId => {
        if (state.polities.independent_worlds.sectorIds.length >= targetIndependent) return true;
        const polity = state.polities[state.polityIdsBySector[sectorId]];
        if (!polity || polity.type === 'independent' || polity.capitalSectorId === sectorId || polity.sectorIds.length <= 2) return false;
        polity.sectorIds = polity.sectorIds.filter(id => id !== sectorId);
        delete state.polityIdsBySector[sectorId];
        if (!isPolityContiguous(polity.id)) {
            addSectorToPolity(sectorId, polity);
            polity.sectorIds.sort((a, b) => a - b);
            return false;
        }
        addSectorToPolity(sectorId, state.polities.independent_worlds);
        return false;
    });

    Object.values(state.polities).forEach(keepCapitalComponent);
    Object.values(state.polities).forEach(polity => polity.sectorIds.sort((a, b) => a - b));
    activeIds.forEach(assignLocalAuthority);
    const majorFactionIds = Object.keys(FACTIONS).filter(id => FACTIONS[id].type === 'major');
    Object.values(state.polities).forEach(polity => {
        if (polity.type === 'independent') return;
        polity.relations = Object.fromEntries(majorFactionIds.map(id => [id, id === polity.dominantFactionId ? 25 : 0]));
    });
}
