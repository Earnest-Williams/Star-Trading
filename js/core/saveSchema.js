import { SAVE_VERSION } from '../constants.js';

export const SAVE_STATE_FIELDS = Object.freeze([
    'version', 'player', 'universe', 'sitesById', 'ports', 'planets', 'companies', 'people', 'captains', 'polities', 'sectorKnowledge',
    'missions', 'tradeRoutes', 'dialogueTasks', 'properties', 'worldEvents', 'siteIdByCoord', 'world', 'worldgenSettings',
    'companyIdsBySector', 'nextCompanyId', 'peopleBySector', 'peopleByCompany', 'nextPersonId', 'polityIdsBySector',
    'captainEventLog', 'nextCaptainEventId', 'nextWorldEventId', 'simulationTrace', 'nextSimulationTraceId', 'dialogueMemories',
    'dialogueProposals', 'dialogueOffers', 'dialogueMessages', 'dialogueConversationParts', 'dialogueConversations', 'dialogueEventLog',
    'nextDialogueMemoryId', 'nextDialogueProposalId', 'nextDialogueTaskId', 'nextDialogueOfferId', 'nextDialogueMessageId',
    'nextDialogueConversationPartId', 'nextDialogueConversationId', 'nextDialogueEventId', 'entanglements', 'nextEntanglementId',
    'nextTradeRouteId', 'logisticsObjectives', 'nextLogisticsObjectiveId', 'nextMissionId', 'ambientTrade', 'priorityBriefing',
    'dataCargo', 'rng'
]);

export const MAX_OBJECT_KEYS = Object.freeze({
    universe: 1000,
    ports: 1000,
    planets: 1000,
    people: 5000,
    companies: 2000,
    captains: 500,
    polities: 500,
    sectorKnowledge: 5000
});

const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export function parseJsonSave(raw) {
    if (typeof raw !== 'string') throw new Error('Save payload must be a string.');
    return JSON.parse(raw);
}

export function validateTopLevelSave(data) {
    if (!isObject(data)) throw new Error('Save payload is not an object.');
    const version = Number(data.version);
    if (!Number.isInteger(version) || version < 0 || version > SAVE_VERSION) throw new Error('Save version is invalid.');
}

export function sanitizeSaveKeys(data) {
    for (const [field, value] of Object.entries(data)) {
        if (!SAVE_STATE_FIELDS.includes(field)) throw new Error(`Unknown save field: ${field}`);
        if (isObject(value)) validateObjectKeys(field, value);
    }
}

function validateObjectKeys(field, objectValue) {
    const keys = Object.keys(objectValue);
    const maxKeys = MAX_OBJECT_KEYS[field];
    if (typeof maxKeys === 'number' && keys.length > maxKeys) throw new Error(`${field} exceeds max key count.`);
    for (const key of keys) {
        if (FORBIDDEN_KEYS.has(key) || key.includes('\u0000')) throw new Error(`Forbidden key in ${field}: ${key}`);
    }
}

export function validateSaveShape(data) {
    for (const field of ['player', 'universe', 'ports', 'planets']) {
        if (!isObject(data[field])) throw new Error(`Missing field: ${field}`);
    }
}

export function migrateSave(data) { return data; }
export function normaliseLoadedGame(loadedState, normaliser) { return normaliser(loadedState); }
export function validateLoadedInvariants(loadedState) {
    if (!loadedState.player || !loadedState.universe) return;
    const currentSector = loadedState.player.currentSector;
    if (currentSector && loadedState.universe[currentSector]) return;
    const fallbackSector = Object.keys(loadedState.universe)[0];
    if (fallbackSector) loadedState.player.currentSector = Number(fallbackSector);
}
export function commitLoadedState(loadedState, commitFn) { return commitFn(loadedState); }
