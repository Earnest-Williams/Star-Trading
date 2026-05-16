import { BALANCE } from '../../constants.js';
import { state } from '../../state.js';

export const DIALOGUE_CONVERSATION_TYPES = Object.freeze({
    GENERAL: 'general',
    LOCATE_ITEM: 'locate_item'
});

export const DIALOGUE_CONVERSATION_STATUSES = Object.freeze({
    OPEN: 'open',
    WAITING: 'waiting',
    RESOLVED: 'resolved',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    ARCHIVED: 'archived'
});

const CONVERSATION_TYPE_VALUES = Object.values(DIALOGUE_CONVERSATION_TYPES);
const CONVERSATION_STATUS_VALUES = Object.values(DIALOGUE_CONVERSATION_STATUSES);
const DEFAULT_DAY = 1;
const DEFAULT_MINUTE_OF_DAY = 0;
const DEFAULT_ABSOLUTE_MINUTE = 0;
const DEFAULT_CONVERSATION_ID = 'default';
const PERSON_SPEAKER_TYPE = 'person';
const UNKNOWN_ITEM_ID = 'unknown_part';
const TASK_STATUS_TO_CONVERSATION_STATUS = Object.freeze({
    active: DIALOGUE_CONVERSATION_STATUSES.WAITING,
    resolved: DIALOGUE_CONVERSATION_STATUSES.RESOLVED,
    failed: DIALOGUE_CONVERSATION_STATUSES.FAILED,
    cancelled: DIALOGUE_CONVERSATION_STATUSES.CANCELLED
});

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

function asIdString(value, fallbackId) {
    const stringValue = asNullableString(value);
    if (stringValue !== null) return stringValue;
    return String(asInteger(fallbackId, DEFAULT_DAY));
}

function normaliseType(value) {
    const type = asString(value, DIALOGUE_CONVERSATION_TYPES.GENERAL);
    return CONVERSATION_TYPE_VALUES.includes(type) ? type : DIALOGUE_CONVERSATION_TYPES.GENERAL;
}

function normaliseStatus(value) {
    const status = asString(value, DIALOGUE_CONVERSATION_STATUSES.OPEN);
    return CONVERSATION_STATUS_VALUES.includes(status) ? status : DIALOGUE_CONVERSATION_STATUSES.OPEN;
}

function normaliseTimestamp(value, fallback = null) {
    const source = isObject(value) ? value : {};
    const fallbackSource = isObject(fallback) ? fallback : {};
    return {
        day: asInteger(source.day, asInteger(fallbackSource.day, DEFAULT_DAY)),
        minuteOfDay: asInteger(
            source.minuteOfDay,
            asInteger(fallbackSource.minuteOfDay, DEFAULT_MINUTE_OF_DAY)
        ),
        absoluteMinute: asInteger(
            source.absoluteMinute,
            asInteger(fallbackSource.absoluteMinute, DEFAULT_ABSOLUTE_MINUTE)
        )
    };
}

function currentDialogueTimestamp() {
    const day = asInteger(state.player?.time?.day, DEFAULT_DAY);
    const minuteOfDay = asInteger(state.player?.time?.minuteOfDay, DEFAULT_MINUTE_OF_DAY);
    return {
        day,
        minuteOfDay,
        absoluteMinute: (day - 1) * BALANCE.DAY_MINUTES + minuteOfDay
    };
}

function normaliseIdList(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value
        .map(item => asInteger(item, null))
        .filter(item => Number.isInteger(item)))]
        .sort((a, b) => a - b);
}

function addRelatedId(conversation, field, id) {
    const safeId = asInteger(id, null);
    if (!Number.isInteger(safeId)) return;
    if (!Array.isArray(conversation[field])) conversation[field] = [];
    if (conversation[field].includes(safeId)) return;
    const ids = conversation[field];
    const lastId = ids[ids.length - 1];
    if (!Number.isInteger(lastId) || safeId > lastId) {
        ids.push(safeId);
        return;
    }
    const insertAt = ids.findIndex(existingId => safeId < existingId);
    if (insertAt === -1) ids.push(safeId);
    else ids.splice(insertAt, 0, safeId);
}

function takeNextId() {
    if (!Number.isInteger(state.nextDialogueConversationId) || state.nextDialogueConversationId < 1) {
        state.nextDialogueConversationId = 1;
    }
    const id = state.nextDialogueConversationId;
    state.nextDialogueConversationId += 1;
    return id;
}

function nextNumericIdForTable(records) {
    return records.reduce((maxId, record) => {
        const id = asInteger(record?.id, 0);
        return Math.max(maxId, id);
    }, 0) + 1;
}

function updateNextConversationId(target) {
    const nextId = nextNumericIdForTable(target.dialogueConversations);
    if (!Number.isInteger(target.nextDialogueConversationId) || target.nextDialogueConversationId < nextId) {
        target.nextDialogueConversationId = nextId;
    }
}

function sortDialogueConversations(target) {
    target.dialogueConversations = target.dialogueConversations
        .sort((a, b) => {
            const minuteDiff = a.startedAt.absoluteMinute - b.startedAt.absoluteMinute;
            if (minuteDiff !== 0) return minuteDiff;
            return String(a.conversationId).localeCompare(String(b.conversationId));
        });
}

function ensureDialogueConversationRows(target = state) {
    if (!Array.isArray(target.dialogueConversations)) target.dialogueConversations = [];
    target.dialogueConversations = target.dialogueConversations
        .filter(isObject)
        .map((conversation, index) => {
            const normalised = normaliseDialogueConversation(conversation, index + 1);
            Object.keys(conversation).forEach(key => delete conversation[key]);
            Object.assign(conversation, normalised);
            return conversation;
        });
    sortDialogueConversations(target);
    updateNextConversationId(target);
}

function mapDialogueConversations(target) {
    const lookup = new Map();
    target.dialogueConversations.forEach(conversation => {
        lookup.set(conversation.conversationId, conversation);
        lookup.set(conversation.id, conversation);
    });
    return lookup;
}

function findDialogueConversationById(conversationId) {
    return state.dialogueConversations.find(conversation => (
        conversation.conversationId === conversationId || conversation.id === conversationId
    )) || null;
}

export function normaliseDialogueConversation(conversation, fallbackId = 1) {
    const startedAt = normaliseTimestamp(conversation?.startedAt);
    const id = asIdString(
        conversation?.id ?? conversation?.conversationId,
        fallbackId
    );
    return {
        id,
        conversationId: asString(conversation?.conversationId, id),
        conversationType: normaliseType(conversation?.conversationType ?? conversation?.type),
        ownerPersonId: asNullableString(conversation?.ownerPersonId ?? conversation?.ownerId),
        subjectId: asNullableString(conversation?.subjectId ?? conversation?.subject),
        status: normaliseStatus(conversation?.status),
        topic: isObject(conversation?.topic) ? conversation.topic : {},
        startedAt,
        updatedAt: normaliseTimestamp(conversation?.updatedAt, startedAt),
        latestPartId: Number.isInteger(conversation?.latestPartId) ? conversation.latestPartId : null,
        relatedTaskIds: normaliseIdList(conversation?.relatedTaskIds),
        relatedMemoryIds: normaliseIdList(conversation?.relatedMemoryIds),
        relatedMessageIds: normaliseIdList(conversation?.relatedMessageIds),
        payload: isObject(conversation?.payload) ? conversation.payload : {}
    };
}

export function normaliseDialogueConversations(target = state) {
    ensureDialogueConversationRows(target);
    const conversationsById = mapDialogueConversations(target);
    let nextGeneratedId = nextNumericIdForTable(target.dialogueConversations);
    function getConversationById(conversationId) {
        return conversationsById.get(conversationId) || null;
    }
    function registerConversation(conversation) {
        conversationsById.set(conversation.conversationId, conversation);
        conversationsById.set(conversation.id, conversation);
    }
    function ensureConversation(conversationId, seed = {}) {
        const existing = getConversationById(conversationId);
        if (existing) return existing;
        const conversation = normaliseDialogueConversation({
            id: nextGeneratedId,
            conversationId,
            ...seed
        });
        nextGeneratedId += 1;
        target.dialogueConversations.push(conversation);
        registerConversation(conversation);
        return conversation;
    }
    if (Array.isArray(target.dialogueConversationParts)) {
        target.dialogueConversationParts.filter(isObject).forEach(part => {
            const conversationId = asString(part.conversationId, DEFAULT_CONVERSATION_ID);
            const timestamp = normaliseTimestamp(part.timestamp);
            const conversation = ensureConversation(conversationId, {
                startedAt: timestamp,
                updatedAt: timestamp,
                latestPartId: asInteger(part.id, null),
                ownerPersonId: part.speakerType === PERSON_SPEAKER_TYPE ? part.speakerId : null,
                subjectId: part.subjectId
            });
            if (timestamp.absoluteMinute >= conversation.updatedAt.absoluteMinute) {
                conversation.updatedAt = timestamp;
                if (Number.isInteger(part.id)) conversation.latestPartId = part.id;
            }
            if (conversation.ownerPersonId === null && part.speakerType === PERSON_SPEAKER_TYPE) {
                conversation.ownerPersonId = asNullableString(part.speakerId);
            }
            if (conversation.subjectId === null) {
                conversation.subjectId = asNullableString(part.subjectId);
            }
        });
    }
    if (Array.isArray(target.dialogueTasks)) {
        target.dialogueTasks.filter(isObject).forEach(task => {
            const conversationId = asString(task.conversationId, DEFAULT_CONVERSATION_ID);
            const conversation = getConversationById(conversationId);
            if (!conversation) return;
            addRelatedId(conversation, 'relatedTaskIds', task.id);
            if (task.taskType === DIALOGUE_CONVERSATION_TYPES.LOCATE_ITEM) {
                conversation.conversationType = DIALOGUE_CONVERSATION_TYPES.LOCATE_ITEM;
                conversation.topic = { ...conversation.topic, itemId: asString(task.itemId, UNKNOWN_ITEM_ID) };
                const mappedStatus = TASK_STATUS_TO_CONVERSATION_STATUS[task.status];
                if (mappedStatus) conversation.status = mappedStatus;
            }
            if (conversation.ownerPersonId === null) conversation.ownerPersonId = asNullableString(task.ownerPersonId);
            if (conversation.subjectId === null) conversation.subjectId = asNullableString(task.requesterId);
        });
    }
    if (Array.isArray(target.dialogueMemories)) {
        target.dialogueMemories.filter(isObject).forEach(memory => {
            const conversationId = asString(memory.conversationId, DEFAULT_CONVERSATION_ID);
            const conversation = getConversationById(conversationId);
            if (!conversation) return;
            addRelatedId(conversation, 'relatedMemoryIds', memory.id);
        });
    }
    if (Array.isArray(target.dialogueMessages)) {
        target.dialogueMessages.filter(isObject).forEach(message => {
            const conversationId = asString(message.conversationId, DEFAULT_CONVERSATION_ID);
            const conversation = getConversationById(conversationId);
            if (!conversation) return;
            addRelatedId(conversation, 'relatedMessageIds', message.id);
        });
    }
    sortDialogueConversations(target);
    updateNextConversationId(target);
}

export function getDialogueConversation(conversationId) {
    ensureDialogueConversationRows();
    const safeConversationId = asString(conversationId, DEFAULT_CONVERSATION_ID);
    return findDialogueConversationById(safeConversationId);
}

export function ensureDialogueConversation({
    conversationId = null,
    conversationType = DIALOGUE_CONVERSATION_TYPES.GENERAL,
    ownerPersonId = null,
    subjectId = null,
    status = DIALOGUE_CONVERSATION_STATUSES.OPEN,
    topic = {},
    startedAt = null,
    updatedAt = null,
    latestPartId = null,
    relatedTaskIds = [],
    relatedMemoryIds = [],
    relatedMessageIds = [],
    payload = {}
} = {}) {
    ensureDialogueConversationRows();
    const safeConversationId = asString(conversationId, DEFAULT_CONVERSATION_ID);
    const existing = findDialogueConversationById(safeConversationId);
    if (existing) {
        return touchDialogueConversation(safeConversationId, {
            conversationType,
            ownerPersonId,
            subjectId,
            status,
            topic,
            updatedAt,
            latestPartId,
            relatedTaskIds,
            relatedMemoryIds,
            relatedMessageIds,
            payload
        });
    }
    const timestamp = normaliseTimestamp(startedAt, currentDialogueTimestamp());
    const conversation = normaliseDialogueConversation({
        id: takeNextId(),
        conversationId: safeConversationId,
        conversationType,
        ownerPersonId,
        subjectId,
        status,
        topic,
        startedAt: timestamp,
        updatedAt: updatedAt || timestamp,
        latestPartId,
        relatedTaskIds,
        relatedMemoryIds,
        relatedMessageIds,
        payload
    });
    state.dialogueConversations.push(conversation);
    return conversation;
}

export function touchDialogueConversation(conversationId, updates = {}) {
    ensureDialogueConversationRows();
    const safeConversationId = asString(conversationId, DEFAULT_CONVERSATION_ID);
    let conversation = findDialogueConversationById(safeConversationId);
    if (!conversation) {
        conversation = ensureDialogueConversation({ conversationId: safeConversationId });
    }
    if (typeof updates.conversationType !== 'undefined') {
        conversation.conversationType = normaliseType(updates.conversationType);
    }
    if (typeof updates.ownerPersonId !== 'undefined') {
        const ownerPersonId = asNullableString(updates.ownerPersonId);
        if (ownerPersonId !== null && conversation.ownerPersonId === null) {
            conversation.ownerPersonId = ownerPersonId;
        }
    }
    if (typeof updates.subjectId !== 'undefined') {
        const subjectId = asNullableString(updates.subjectId);
        if (subjectId !== null && conversation.subjectId === null) {
            conversation.subjectId = subjectId;
        }
    }
    if (typeof updates.status !== 'undefined') {
        conversation.status = normaliseStatus(updates.status);
    }
    if (isObject(updates.topic)) {
        conversation.topic = { ...conversation.topic, ...updates.topic };
    }
    if (Number.isInteger(updates.latestPartId)) conversation.latestPartId = updates.latestPartId;
    normaliseIdList(updates.relatedTaskIds).forEach(id => addRelatedId(conversation, 'relatedTaskIds', id));
    normaliseIdList(updates.relatedMemoryIds).forEach(id => addRelatedId(conversation, 'relatedMemoryIds', id));
    normaliseIdList(updates.relatedMessageIds).forEach(id => addRelatedId(conversation, 'relatedMessageIds', id));
    if (isObject(updates.payload)) {
        conversation.payload = { ...conversation.payload, ...updates.payload };
    }
    conversation.updatedAt = normaliseTimestamp(updates.updatedAt, currentDialogueTimestamp());
    return conversation;
}

export function getDialogueConversationsForPerson(personId) {
    const safePersonId = asString(personId, '');
    if (safePersonId.length === 0) return [];
    ensureDialogueConversationRows();
    return state.dialogueConversations
        .filter(conversation => conversation.ownerPersonId === safePersonId
            || conversation.subjectId === safePersonId)
        .sort((a, b) => b.updatedAt.absoluteMinute - a.updatedAt.absoluteMinute
            || String(a.conversationId).localeCompare(String(b.conversationId)));
}
