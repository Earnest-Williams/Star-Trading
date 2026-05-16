import { BALANCE } from '../../constants.js';
import { state } from '../../state.js';
import { rebuildDialogueConversationsFromTables, touchDialogueConversation } from './conversations.js';

export const DIALOGUE_PART_TYPES = Object.freeze({
    PLAYER_UTTERANCE: 'player_utterance',
    NPC_UTTERANCE: 'npc_utterance',
    INTENT: 'intent',
    PROPOSAL: 'proposal',
    EFFECT: 'effect',
    SYSTEM_NOTE: 'system_note'
});

export const DIALOGUE_SPEAKER_TYPES = Object.freeze({
    PLAYER: 'player',
    PERSON: 'person',
    CAPTAIN: 'captain',
    SYSTEM: 'system'
});

const DIALOGUE_TABLE_SPECS = Object.freeze([
    { table: 'dialogueMemories', nextKey: 'nextDialogueMemoryId' },
    { table: 'dialogueProposals', nextKey: 'nextDialogueProposalId' },
    { table: 'dialogueTasks', nextKey: 'nextDialogueTaskId' },
    { table: 'dialogueOffers', nextKey: 'nextDialogueOfferId' },
    { table: 'dialogueMessages', nextKey: 'nextDialogueMessageId' },
    { table: 'dialogueConversationParts', nextKey: 'nextDialogueConversationPartId' },
    { table: 'dialogueConversations', nextKey: 'nextDialogueConversationId' },
    { table: 'dialogueEventLog', nextKey: 'nextDialogueEventId' }
]);

const DEFAULT_CONVERSATION_ID = 'default';
const FIRST_DIALOGUE_RECORD_ID = 1;
const NO_DIALOGUE_RECORD_ID = 0;
const DEFAULT_TIMESTAMP_DAY = 1;
const DEFAULT_TIMESTAMP_MINUTE = 0;
const DEFAULT_TIMESTAMP_ABSOLUTE_MINUTE = 0;

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value, fallback = '') {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function asNullableString(value) {
    const text = asString(value, '');
    return text.length > 0 ? text : null;
}

function asInteger(value, fallback) {
    if (value === null || typeof value === 'undefined') return fallback;
    const number = Number(value);
    return Number.isInteger(number) ? number : fallback;
}

function asRecordIdFallback(value) {
    if (value === null || typeof value === 'undefined') return null;
    if (typeof value === 'string' && value.trim().length === 0) return null;
    return asInteger(value, null);
}

function asRecordId(value, fallback = null) {
    const safeFallback = asRecordIdFallback(fallback);
    const id = asInteger(value, safeFallback);
    return Number.isInteger(id) && id >= FIRST_DIALOGUE_RECORD_ID ? id : safeFallback;
}

function nextNumericIdForTable(records) {
    return records.reduce((maxId, record) => {
        const id = asRecordId(record?.id, NO_DIALOGUE_RECORD_ID);
        return Math.max(maxId, id);
    }, NO_DIALOGUE_RECORD_ID) + FIRST_DIALOGUE_RECORD_ID;
}

function ensureDialogueTable(target, table, nextKey) {
    if (!Array.isArray(target[table])) target[table] = [];
    target[table] = target[table].filter(isObject);
    const nextId = nextNumericIdForTable(target[table]);
    if (!Number.isInteger(target[nextKey]) || target[nextKey] < nextId) {
        target[nextKey] = nextId;
    }
}

function compareDialogueConversationParts(a, b) {
    const minuteDiff = asInteger(a.timestamp?.absoluteMinute, DEFAULT_TIMESTAMP_ABSOLUTE_MINUTE)
        - asInteger(b.timestamp?.absoluteMinute, DEFAULT_TIMESTAMP_ABSOLUTE_MINUTE);
    if (minuteDiff !== 0) return minuteDiff;
    const leftId = asRecordId(a.id, NO_DIALOGUE_RECORD_ID);
    const rightId = asRecordId(b.id, NO_DIALOGUE_RECORD_ID);
    return leftId - rightId;
}

function currentDialogueTimestamp() {
    const absoluteMinute = ((asInteger(state.player?.time?.day, DEFAULT_TIMESTAMP_DAY)
        - DEFAULT_TIMESTAMP_DAY) * BALANCE.DAY_MINUTES)
        + asInteger(state.player?.time?.minuteOfDay, DEFAULT_TIMESTAMP_MINUTE);
    return {
        day: Math.floor(absoluteMinute / BALANCE.DAY_MINUTES) + DEFAULT_TIMESTAMP_DAY,
        minuteOfDay: absoluteMinute % BALANCE.DAY_MINUTES,
        absoluteMinute
    };
}

function takeNextId(nextKey) {
    if (!Number.isInteger(state[nextKey]) || state[nextKey] < FIRST_DIALOGUE_RECORD_ID) {
        state[nextKey] = FIRST_DIALOGUE_RECORD_ID;
    }
    const id = state[nextKey];
    state[nextKey] += 1;
    return id;
}

function isDialoguePartType(value) {
    return Object.values(DIALOGUE_PART_TYPES).includes(value);
}

function normalisePartType(value) {
    const candidate = asString(value, DIALOGUE_PART_TYPES.SYSTEM_NOTE);
    return isDialoguePartType(candidate)
        ? candidate
        : DIALOGUE_PART_TYPES.SYSTEM_NOTE;
}

function isDialogueSpeakerType(value) {
    return Object.values(DIALOGUE_SPEAKER_TYPES).includes(value);
}

function normaliseSpeakerType(value) {
    const candidate = asString(value, DIALOGUE_SPEAKER_TYPES.SYSTEM);
    return isDialogueSpeakerType(candidate)
        ? candidate
        : DIALOGUE_SPEAKER_TYPES.SYSTEM;
}

export function normaliseDialogueConversationPart(part, fallbackId = FIRST_DIALOGUE_RECORD_ID) {
    const source = isObject(part) ? part : {};
    const timestamp = isObject(source.timestamp) ? source.timestamp : {};
    return {
        id: asRecordId(source.id, fallbackId),
        conversationId: asString(source.conversationId, DEFAULT_CONVERSATION_ID),
        partType: normalisePartType(source.partType),
        speakerType: normaliseSpeakerType(source.speakerType),
        speakerId: asNullableString(source.speakerId),
        subjectId: asNullableString(source.subjectId),
        text: asString(source.text, ''),
        intent: asNullableString(source.intent),
        payload: isObject(source.payload) ? source.payload : {},
        causedByPartId: asRecordId(source.causedByPartId),
        timestamp: {
            day: asInteger(timestamp.day, DEFAULT_TIMESTAMP_DAY),
            minuteOfDay: asInteger(timestamp.minuteOfDay, DEFAULT_TIMESTAMP_MINUTE),
            absoluteMinute: asInteger(timestamp.absoluteMinute, DEFAULT_TIMESTAMP_ABSOLUTE_MINUTE)
        }
    };
}

export function ensureDialogueRuntimeStorage(target = state) {
    DIALOGUE_TABLE_SPECS.forEach(spec => ensureDialogueTable(target, spec.table, spec.nextKey));
}

export function normaliseDialogueConversationParts(target = state) {
    ensureDialogueRuntimeStorage(target);
    target.dialogueConversationParts = target.dialogueConversationParts
        .map((part, index) => normaliseDialogueConversationPart(
            part,
            index + FIRST_DIALOGUE_RECORD_ID
        ))
        .sort(compareDialogueConversationParts);
    const nextPartId = nextNumericIdForTable(target.dialogueConversationParts);
    if (!Number.isInteger(target.nextDialogueConversationPartId)
            || target.nextDialogueConversationPartId < nextPartId) {
        target.nextDialogueConversationPartId = nextPartId;
    }
}

export function normaliseDialogueTables(target = state) {
    normaliseDialogueConversationParts(target);
    rebuildDialogueConversationsFromTables(target);
}

export function addDialogueConversationPart({
    conversationId = DEFAULT_CONVERSATION_ID,
    partType = DIALOGUE_PART_TYPES.SYSTEM_NOTE,
    speakerType = DIALOGUE_SPEAKER_TYPES.SYSTEM,
    speakerId = null,
    subjectId = null,
    text = '',
    intent = null,
    payload = {},
    causedByPartId = null
} = {}) {
    ensureDialogueRuntimeStorage();
    const part = normaliseDialogueConversationPart({
        id: takeNextId('nextDialogueConversationPartId'),
        conversationId,
        partType,
        speakerType,
        speakerId,
        subjectId,
        text,
        intent,
        payload,
        causedByPartId,
        timestamp: currentDialogueTimestamp()
    });
    state.dialogueConversationParts.push(part);
    touchDialogueConversation(part.conversationId, {
        ownerPersonId: part.speakerType === DIALOGUE_SPEAKER_TYPES.PERSON ? part.speakerId : undefined,
        subjectId: part.subjectId,
        latestPartId: part.id,
        updatedAt: part.timestamp
    });
    return part;
}

export function getConversationPart(partId) {
    ensureDialogueRuntimeStorage();
    const id = asRecordId(partId);
    if (!Number.isInteger(id)) return null;
    return state.dialogueConversationParts.find(part => part.id === id) || null;
}

export function getConversationParts(conversationId = DEFAULT_CONVERSATION_ID) {
    ensureDialogueRuntimeStorage();
    const safeConversationId = asString(conversationId, DEFAULT_CONVERSATION_ID);
    return state.dialogueConversationParts
        .filter(part => part.conversationId === safeConversationId)
        .sort(compareDialogueConversationParts);
}

export function getLatestConversationPart(conversationId = DEFAULT_CONVERSATION_ID) {
    return getConversationParts(conversationId).at(-1) || null;
}

export function getConversationPartsByType(conversationId = DEFAULT_CONVERSATION_ID, partType = null) {
    const safePartType = asNullableString(partType);
    if (safePartType === null) return getConversationParts(conversationId);
    if (!isDialoguePartType(safePartType)) return [];
    return getConversationParts(conversationId)
        .filter(part => part.partType === safePartType);
}

export function getConversationPartsBySpeaker(speakerType, speakerId = null, conversationId = null) {
    ensureDialogueRuntimeStorage();
    const safeSpeakerType = asString(speakerType, '');
    if (!isDialogueSpeakerType(safeSpeakerType)) return [];
    const safeSpeakerId = asNullableString(speakerId);
    const safeConversationId = asNullableString(conversationId);
    return state.dialogueConversationParts
        .filter(part => part.speakerType === safeSpeakerType)
        .filter(part => safeSpeakerId === null || part.speakerId === safeSpeakerId)
        .filter(part => safeConversationId === null || part.conversationId === safeConversationId)
        .sort(compareDialogueConversationParts);
}

export function getConversationPartsCausedBy(causedByPartId, conversationId = null) {
    ensureDialogueRuntimeStorage();
    const id = asRecordId(causedByPartId);
    if (!Number.isInteger(id)) return [];
    const safeConversationId = asNullableString(conversationId);
    return state.dialogueConversationParts
        .filter(part => part.causedByPartId === id)
        .filter(part => safeConversationId === null || part.conversationId === safeConversationId)
        .sort(compareDialogueConversationParts);
}

export function getConversationPartCausalChain(partId) {
    const chain = [];
    const visited = new Set();
    let current = getConversationPart(partId);
    while (current && !visited.has(current.id)) {
        visited.add(current.id);
        chain.unshift(current);
        current = Number.isInteger(current.causedByPartId)
            ? getConversationPart(current.causedByPartId)
            : null;
    }
    return chain;
}

export function addPlayerUtterance(conversationId, text, payload = {}) {
    return addDialogueConversationPart({
        conversationId,
        partType: DIALOGUE_PART_TYPES.PLAYER_UTTERANCE,
        speakerType: DIALOGUE_SPEAKER_TYPES.PLAYER,
        speakerId: 'player',
        text,
        payload
    });
}

export function addPersonUtterance(conversationId, personId, text, payload = {}) {
    return addDialogueConversationPart({
        conversationId,
        partType: DIALOGUE_PART_TYPES.NPC_UTTERANCE,
        speakerType: DIALOGUE_SPEAKER_TYPES.PERSON,
        speakerId: personId,
        subjectId: 'player',
        text,
        payload
    });
}
