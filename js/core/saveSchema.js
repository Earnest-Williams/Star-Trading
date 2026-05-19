import { SAVE_VERSION } from '../constants.js';

// Persisted state manifest: this is the only list buildSaveData() may serialize.
// Persisted fields below are durable game data needed to resume a run.
// Derived/transient fields intentionally excluded include sitesById, starField,
// selectedSectorId, currentScreen, reputationTab, selectedCaptainId,
// mapNodeCache, mapLayers, mapLayersOpen, mapHelpOpen, mapInspectorCompact, and worldGraphRevision.
// Add new save fields here first so tests catch accidental cache/UI leakage or serializer drift.
export const SAVE_STATE_FIELDS = Object.freeze([
    'player',
    'universe',
    'siteIdByCoord',
    'world',
    'worldgenSettings',
    'ports',
    'planets',
    'companies',
    'companyIdsBySector',
    'nextCompanyId',
    'people',
    'peopleBySector',
    'peopleByCompany',
    'nextPersonId',
    'polities',
    'polityIdsBySector',
    'missions',
    'captains',
    'captainEventLog',
    'nextCaptainEventId',
    'worldEvents',
    'nextWorldEventId',
    'simulationTrace',
    'nextSimulationTraceId',
    'dialogueMemories',
    'dialogueProposals',
    'dialogueTasks',
    'dialogueOffers',
    'dialogueMessages',
    'dialogueConversationParts',
    'dialogueConversations',
    'dialogueEventLog',
    'nextDialogueMemoryId',
    'nextDialogueProposalId',
    'nextDialogueTaskId',
    'nextDialogueOfferId',
    'nextDialogueMessageId',
    'nextDialogueConversationPartId',
    'nextDialogueConversationId',
    'nextDialogueEventId',
    'entanglements',
    'nextEntanglementId',
    'tradeRoutes',
    'nextTradeRouteId',
    'logisticsObjectives',
    'nextLogisticsObjectiveId',
    'nextMissionId',
    'ambientTrade',
    'priorityBriefing',
    'dataCargo',
    'rng'
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

const LEGACY_SAVE_FIELDS = Object.freeze(['sitesById', 'factionRelations', 'sectorKnowledge', 'properties']);
const SAVE_TOP_LEVEL_FIELDS = new Set(['version', ...SAVE_STATE_FIELDS, ...LEGACY_SAVE_FIELDS]);
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const MAX_ARRAY_ENTRIES = 50_000;
const MAX_NESTED_OBJECT_KEYS = 1000;
const MAX_NESTING_DEPTH = 10;

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
        if (!SAVE_TOP_LEVEL_FIELDS.has(field)) throw new Error(`Unknown save field: ${field}`);
        if (field === 'version') continue;
        validateObjectTree(field, value, 0);
    }
}

function validateObjectTree(field, value, depth) {
    if (depth > MAX_NESTING_DEPTH) throw new Error(`Save field ${field} exceeds max nesting depth.`);
    if (Array.isArray(value)) {
        if (value.length > MAX_ARRAY_ENTRIES) throw new Error(`Save field ${field} exceeds size limit.`);
        value.forEach((entry) => validateObjectTree(field, entry, depth + 1));
        return;
    }
    if (!isObject(value)) return;

    const keys = Object.keys(value);
    const maxKeys = depth === 0 ? MAX_OBJECT_KEYS[field] : MAX_NESTED_OBJECT_KEYS;
    if (typeof maxKeys === 'number' && keys.length > maxKeys) throw new Error(`${field} exceeds max key count.`);
    for (const key of keys) {
        if (FORBIDDEN_KEYS.has(key) || key.includes('\u0000')) throw new Error(`Forbidden key in ${field}: ${key}`);
        validateObjectTree(field, value[key], depth + 1);
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
