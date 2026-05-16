import { BALANCE } from '../../constants.js';
import { state } from '../../state.js';

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
    { table: 'dialogueTasks', nextKey: 'nextDialogueTaskId' },
    { table: 'dialogueMessages', nextKey: 'nextDialogueMessageId' },
    { table: 'dialogueConversationParts', nextKey: 'nextDialogueConversationPartId' },
    { table: 'dialogueEventLog', nextKey: 'nextDialogueEventId' }
]);

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
    const number = Number(value);
    return Number.isInteger(number) ? number : fallback;
}

function nextNumericIdForTable(records) {
    return records.reduce((maxId, record) => {
        const id = asInteger(record?.id, 0);
        return Math.max(maxId, id);
    }, 0) + 1;
}

function ensureDialogueTable(target, table, nextKey) {
    if (!Array.isArray(target[table])) target[table] = [];
    target[table] = target[table].filter(isObject);
    const nextId = nextNumericIdForTable(target[table]);
    if (!Number.isInteger(target[nextKey]) || target[nextKey] < nextId) {
        target[nextKey] = nextId;
    }
}

function currentDialogueTimestamp() {
    const day = asInteger(state.player?.time?.day, 1);
    const minuteOfDay = asInteger(state.player?.time?.minuteOfDay, 0);
    return {
        day,
        minuteOfDay,
        absoluteMinute: (day - 1) * BALANCE.DAY_MINUTES + minuteOfDay
    };
}

function takeNextId(nextKey) {
    if (!Number.isInteger(state[nextKey]) || state[nextKey] < 1) state[nextKey] = 1;
    const id = state[nextKey];
    state[nextKey] += 1;
    return id;
}

function normalisePartType(value) {
    const candidate = asString(value, DIALOGUE_PART_TYPES.SYSTEM_NOTE);
    return Object.values(DIALOGUE_PART_TYPES).includes(candidate)
        ? candidate
        : DIALOGUE_PART_TYPES.SYSTEM_NOTE;
}

function normaliseSpeakerType(value) {
    const candidate = asString(value, DIALOGUE_SPEAKER_TYPES.SYSTEM);
    return Object.values(DIALOGUE_SPEAKER_TYPES).includes(candidate)
        ? candidate
        : DIALOGUE_SPEAKER_TYPES.SYSTEM;
}

export function normaliseDialogueConversationPart(part, fallbackId = 1) {
    const timestamp = isObject(part.timestamp) ? part.timestamp : {};
    return {
        id: asInteger(part.id, fallbackId),
        conversationId: asString(part.conversationId, 'default'),
        partType: normalisePartType(part.partType),
        speakerType: normaliseSpeakerType(part.speakerType),
        speakerId: asNullableString(part.speakerId),
        subjectId: asNullableString(part.subjectId),
        text: asString(part.text, ''),
        intent: asNullableString(part.intent),
        payload: isObject(part.payload) ? part.payload : {},
        causedByPartId: Number.isInteger(part.causedByPartId) ? part.causedByPartId : null,
        timestamp: {
            day: asInteger(timestamp.day, 1),
            minuteOfDay: asInteger(timestamp.minuteOfDay, 0),
            absoluteMinute: asInteger(timestamp.absoluteMinute, 0)
        }
    };
}

export function normaliseDialogueTables(target = state) {
    DIALOGUE_TABLE_SPECS.forEach(spec => ensureDialogueTable(target, spec.table, spec.nextKey));
    target.dialogueConversationParts = target.dialogueConversationParts
        .map((part, index) => normaliseDialogueConversationPart(part, index + 1))
        .sort((a, b) => a.timestamp.absoluteMinute - b.timestamp.absoluteMinute || a.id - b.id);
    const nextPartId = nextNumericIdForTable(target.dialogueConversationParts);
    if (!Number.isInteger(target.nextDialogueConversationPartId)
            || target.nextDialogueConversationPartId < nextPartId) {
        target.nextDialogueConversationPartId = nextPartId;
    }
}

export function addDialogueConversationPart({
    conversationId = 'default',
    partType = DIALOGUE_PART_TYPES.SYSTEM_NOTE,
    speakerType = DIALOGUE_SPEAKER_TYPES.SYSTEM,
    speakerId = null,
    subjectId = null,
    text = '',
    intent = null,
    payload = {},
    causedByPartId = null
} = {}) {
    normaliseDialogueTables();
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
    return part;
}

export function getConversationParts(conversationId = 'default') {
    normaliseDialogueTables();
    return state.dialogueConversationParts
        .filter(part => part.conversationId === conversationId)
        .sort((a, b) => a.timestamp.absoluteMinute - b.timestamp.absoluteMinute || a.id - b.id);
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
