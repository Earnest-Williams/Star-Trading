import { BALANCE } from '../../constants.js';
import { state } from '../../state.js';

export const DIALOGUE_EVENT_TYPES = Object.freeze({
    DIALOGUE_MEMORY_RECORDED: 'dialogue_memory_recorded',
    DIALOGUE_MEMORY_REINFORCED: 'dialogue_memory_reinforced',
    DIALOGUE_TASK_CREATED: 'dialogue_task_created',
    DIALOGUE_TASK_RESOLVED: 'dialogue_task_resolved'
});

const EVENT_TYPE_VALUES = Object.values(DIALOGUE_EVENT_TYPES);

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

function currentDialogueTimestamp() {
    const day = asInteger(state.player?.time?.day, 1);
    const minuteOfDay = asInteger(state.player?.time?.minuteOfDay, 0);
    return {
        day,
        minuteOfDay,
        absoluteMinute: (day - 1) * BALANCE.DAY_MINUTES + minuteOfDay
    };
}

function normaliseEventType(value) {
    const eventType = asString(value, DIALOGUE_EVENT_TYPES.DIALOGUE_TASK_CREATED);
    return EVENT_TYPE_VALUES.includes(eventType) ? eventType : DIALOGUE_EVENT_TYPES.DIALOGUE_TASK_CREATED;
}

function takeNextId() {
    if (!Number.isInteger(state.nextDialogueEventId) || state.nextDialogueEventId < 1) {
        state.nextDialogueEventId = 1;
    }
    const id = state.nextDialogueEventId;
    state.nextDialogueEventId += 1;
    return id;
}

function nextNumericIdForTable(records) {
    return records.reduce((maxId, record) => {
        const id = asInteger(record?.id, 0);
        return Math.max(maxId, id);
    }, 0) + 1;
}

function eventAbsoluteMinute(event) {
    const day = asInteger(event?.day ?? event?.timestamp?.day, 1);
    const minute = asInteger(
        event?.minute ?? event?.minuteOfDay ?? event?.timestamp?.minuteOfDay,
        0
    );
    return ((day - 1) * BALANCE.DAY_MINUTES) + minute;
}

function compareDialogueEvents(a, b) {
    const minuteDiff = eventAbsoluteMinute(a) - eventAbsoluteMinute(b);
    if (minuteDiff !== 0) return minuteDiff;
    return asInteger(a?.id, 0) - asInteger(b?.id, 0);
}

function ensureDialogueEventStorage(target = state) {
    if (!Array.isArray(target.dialogueEventLog)) target.dialogueEventLog = [];
    if (!Number.isInteger(target.nextDialogueEventId) || target.nextDialogueEventId < 1) {
        target.nextDialogueEventId = nextNumericIdForTable(target.dialogueEventLog);
    }
}

function legacyConversationId(event) {
    return asNullableString(event?.conversationId)
        || asNullableString(event?.causedBy?.conversationId)
        || asNullableString(event?.summary?.conversationId)
        || asNullableString(event?.payload?.conversationId);
}

function legacyPartId(event) {
    const explicit = asInteger(event?.partId, null);
    if (Number.isInteger(explicit)) return explicit;
    const causedBy = asInteger(event?.causedBy?.partId, null);
    if (Number.isInteger(causedBy)) return causedBy;
    return asInteger(event?.summary?.partId, null);
}

function legacyTaskId(event) {
    const explicit = asInteger(event?.taskId, null);
    if (Number.isInteger(explicit)) return explicit;
    const causedBy = asInteger(event?.causedBy?.taskId, null);
    if (Number.isInteger(causedBy)) return causedBy;
    return asInteger(event?.summary?.taskId, null);
}

function legacyMemoryId(event) {
    const explicit = asInteger(event?.memoryId, null);
    if (Number.isInteger(explicit)) return explicit;
    return asInteger(event?.summary?.memoryId, null);
}

function legacyMessageId(event) {
    const explicit = asInteger(event?.messageId, null);
    if (Number.isInteger(explicit)) return explicit;
    return asInteger(event?.summary?.messageId, null);
}

export function normaliseDialogueEvent(event, fallbackId = 1) {
    const timestamp = isObject(event?.timestamp) ? event.timestamp : {};
    return {
        id: asInteger(event?.id, fallbackId),
        eventType: normaliseEventType(event?.eventType ?? event?.type),
        sourceSystem: asString(event?.sourceSystem, 'dialogue'),
        day: asInteger(event?.day ?? timestamp.day, 1),
        minute: asInteger(event?.minute ?? event?.minuteOfDay ?? timestamp.minuteOfDay, 0),
        actor: asNullableString(event?.actor),
        subject: asNullableString(event?.subject),
        conversationId: legacyConversationId(event),
        partId: legacyPartId(event),
        taskId: legacyTaskId(event),
        memoryId: legacyMemoryId(event),
        messageId: legacyMessageId(event),
        causedBy: isObject(event?.causedBy) ? event.causedBy : {},
        summary: isObject(event?.summary) ? event.summary : {},
        payload: isObject(event?.payload) ? event.payload : {}
    };
}

export function normaliseDialogueEvents(target = state) {
    if (!Array.isArray(target.dialogueEventLog)) target.dialogueEventLog = [];
    target.dialogueEventLog = target.dialogueEventLog
        .filter(isObject)
        .map((event, index) => {
            const normalised = normaliseDialogueEvent(event, index + 1);
            Object.keys(event).forEach(key => delete event[key]);
            Object.assign(event, normalised);
            return event;
        })
        .sort(compareDialogueEvents);
    const nextId = nextNumericIdForTable(target.dialogueEventLog);
    if (!Number.isInteger(target.nextDialogueEventId) || target.nextDialogueEventId < nextId) {
        target.nextDialogueEventId = nextId;
    }
}

export function addDialogueEvent({
    eventType,
    sourceSystem = 'dialogue',
    actor = null,
    subject = null,
    conversationId = null,
    partId = null,
    taskId = null,
    memoryId = null,
    messageId = null,
    causedBy = {},
    summary = {},
    payload = {},
    timestamp = null
} = {}) {
    ensureDialogueEventStorage();
    const ts = isObject(timestamp) ? timestamp : currentDialogueTimestamp();
    const event = normaliseDialogueEvent({
        id: takeNextId(),
        eventType,
        sourceSystem,
        day: ts.day,
        minute: ts.minuteOfDay,
        actor,
        subject,
        conversationId,
        partId,
        taskId,
        memoryId,
        messageId,
        causedBy,
        summary,
        payload
    });
    const lastEvent = state.dialogueEventLog[state.dialogueEventLog.length - 1];
    if (!lastEvent) {
        state.dialogueEventLog.push(event);
        return event;
    }
    if (compareDialogueEvents(event, lastEvent) >= 0) {
        state.dialogueEventLog.push(event);
    } else {
        const insertIndex = state.dialogueEventLog.findIndex(existingEvent => {
            return compareDialogueEvents(event, existingEvent) < 0;
        });
        if (insertIndex === -1) {
            state.dialogueEventLog.push(event);
        } else {
            state.dialogueEventLog.splice(insertIndex, 0, event);
        }
    }
    return event;
}

export function getDialogueEventsByConversationId(conversationId) {
    const safeConversationId = asString(conversationId, '');
    if (safeConversationId.length === 0) return [];
    normaliseDialogueEvents();
    return state.dialogueEventLog.filter(event => event.conversationId === safeConversationId);
}

export function getDialogueEventsByPartId(partId) {
    const safePartId = asInteger(partId, null);
    if (!Number.isInteger(safePartId)) return [];
    normaliseDialogueEvents();
    return state.dialogueEventLog.filter(event => event.partId === safePartId);
}

export function getDialogueEventsByTaskId(taskId) {
    const safeTaskId = asInteger(taskId, null);
    if (!Number.isInteger(safeTaskId)) return [];
    normaliseDialogueEvents();
    return state.dialogueEventLog.filter(event => event.taskId === safeTaskId);
}

export function getDialogueEventsByMemoryId(memoryId) {
    const safeMemoryId = asInteger(memoryId, null);
    if (!Number.isInteger(safeMemoryId)) return [];
    normaliseDialogueEvents();
    return state.dialogueEventLog.filter(event => event.memoryId === safeMemoryId);
}
