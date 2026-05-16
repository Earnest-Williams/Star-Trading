import { BALANCE } from '../../constants.js';
import { state } from '../../state.js';
import { normaliseDialogueTables } from './conversationParts.js';

export const DIALOGUE_MEMORY_TYPES = Object.freeze({
    CUSTOMER_REQUEST: 'customer_request'
});

export const DIALOGUE_MEMORY_SALIENCE = Object.freeze({
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high'
});

const MEMORY_TYPE_VALUES = Object.values(DIALOGUE_MEMORY_TYPES);
const MEMORY_SALIENCE_VALUES = Object.values(DIALOGUE_MEMORY_SALIENCE);
const SALIENCE_RANK = Object.freeze({ low: 1, medium: 2, high: 3 });

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

function currentDialogueTimestamp() {
    const day = asInteger(state.player?.time?.day, 1);
    const minuteOfDay = asInteger(state.player?.time?.minuteOfDay, 0);
    return {
        day,
        minuteOfDay,
        absoluteMinute: (day - 1) * BALANCE.DAY_MINUTES + minuteOfDay
    };
}

function takeNextId() {
    if (!Number.isInteger(state.nextDialogueMemoryId) || state.nextDialogueMemoryId < 1) {
        state.nextDialogueMemoryId = 1;
    }
    const id = state.nextDialogueMemoryId;
    state.nextDialogueMemoryId += 1;
    return id;
}

function normaliseMemoryType(value) {
    const memoryType = asString(value, DIALOGUE_MEMORY_TYPES.CUSTOMER_REQUEST);
    return MEMORY_TYPE_VALUES.includes(memoryType)
        ? memoryType
        : DIALOGUE_MEMORY_TYPES.CUSTOMER_REQUEST;
}

function normaliseSalience(value) {
    const salience = asString(value, DIALOGUE_MEMORY_SALIENCE.MEDIUM);
    return MEMORY_SALIENCE_VALUES.includes(salience)
        ? salience
        : DIALOGUE_MEMORY_SALIENCE.MEDIUM;
}

function chooseHigherSalience(left, right) {
    const safeLeft = normaliseSalience(left);
    const safeRight = normaliseSalience(right);
    return SALIENCE_RANK[safeRight] > SALIENCE_RANK[safeLeft] ? safeRight : safeLeft;
}

function inferMergeKey(data, fallback = null) {
    if (!isObject(data)) return fallback;
    return asNullableString(data.mergeKey)
        || asNullableString(data.itemId)
        || asNullableString(data.requestedItem)
        || asNullableString(data.requested_item)
        || fallback;
}

function emitDialogueMemoryEvent(memory, eventType) {
    const ts = currentDialogueTimestamp();
    state.dialogueEventLog.push({
        id: state.nextDialogueEventId++,
        eventType,
        sourceSystem: 'memory',
        day: ts.day,
        minute: ts.minuteOfDay,
        actor: memory.ownerPersonId,
        subject: memory.subjectId,
        causedBy: { conversationId: memory.conversationId, partId: memory.causedByPartId },
        summary: {
            memoryId: memory.id,
            memoryType: memory.memoryType,
            salience: memory.salience,
            mergeKey: memory.mergeKey
        }
    });
}

export function normaliseDialogueMemory(memory, fallbackId = 1) {
    const createdAt = isObject(memory?.createdAt) ? memory.createdAt : {};
    const lastReinforcedAt = isObject(memory?.lastReinforcedAt)
        ? memory.lastReinforcedAt
        : createdAt;
    const data = isObject(memory?.data) ? memory.data : {};
    return {
        id: asInteger(memory?.id, fallbackId),
        memoryType: normaliseMemoryType(memory?.memoryType ?? memory?.type),
        ownerPersonId: asString(memory?.ownerPersonId ?? memory?.owner, 'unknown-person'),
        subjectId: asString(memory?.subjectId ?? memory?.subject, 'player'),
        conversationId: asString(memory?.conversationId, 'default'),
        causedByPartId: Number.isInteger(memory?.causedByPartId) ? memory.causedByPartId : null,
        text: asString(memory?.text, ''),
        data,
        mergeKey: inferMergeKey(data, asNullableString(memory?.mergeKey)),
        salience: normaliseSalience(memory?.salience),
        reinforcementCount: Math.max(1, asInteger(memory?.reinforcementCount, 1)),
        createdAt: {
            day: asInteger(createdAt.day ?? memory?.created_at_day, 1),
            minuteOfDay: asInteger(createdAt.minuteOfDay, 0),
            absoluteMinute: asInteger(createdAt.absoluteMinute, 0)
        },
        lastReinforcedAt: {
            day: asInteger(lastReinforcedAt.day ?? memory?.last_reinforced_at_day, 1),
            minuteOfDay: asInteger(lastReinforcedAt.minuteOfDay, 0),
            absoluteMinute: asInteger(lastReinforcedAt.absoluteMinute, 0)
        },
        active: typeof memory?.active === 'boolean' ? memory.active : true
    };
}

export function normaliseDialogueMemories(target = state) {
    normaliseDialogueTables(target);
    target.dialogueMemories = target.dialogueMemories
        .map((memory, index) => {
            const normalised = normaliseDialogueMemory(memory, index + 1);
            if (isObject(memory)) {
                Object.keys(memory).forEach(key => delete memory[key]);
                Object.assign(memory, normalised);
                return memory;
            }
            return normalised;
        })
        .sort((a, b) => a.createdAt.absoluteMinute - b.createdAt.absoluteMinute || a.id - b.id);
    const nextId = target.dialogueMemories.reduce((maxId, memory) => Math.max(maxId, memory.id), 0) + 1;
    if (!Number.isInteger(target.nextDialogueMemoryId) || target.nextDialogueMemoryId < nextId) {
        target.nextDialogueMemoryId = nextId;
    }
}

export function createOrReinforceDialogueMemory({
    ownerPersonId,
    subjectId = 'player',
    memoryType = DIALOGUE_MEMORY_TYPES.CUSTOMER_REQUEST,
    conversationId = 'default',
    causedByPartId = null,
    text = '',
    data = {},
    mergeKey = null,
    salience = DIALOGUE_MEMORY_SALIENCE.MEDIUM
} = {}) {
    normaliseDialogueMemories();
    const safeData = isObject(data) ? data : {};
    const safeMemoryType = normaliseMemoryType(memoryType);
    const safeOwnerPersonId = asString(ownerPersonId, 'unknown-person');
    const safeSubjectId = asString(subjectId, 'player');
    const safeMergeKey = inferMergeKey(safeData, asNullableString(mergeKey));
    const existing = safeMergeKey === null ? null : state.dialogueMemories.find(memory => memory.active
        && memory.memoryType === safeMemoryType
        && memory.ownerPersonId === safeOwnerPersonId
        && memory.subjectId === safeSubjectId
        && memory.mergeKey === safeMergeKey) || null;

    if (existing) {
        existing.data = { ...existing.data, ...safeData };
        existing.text = asString(text, existing.text);
        existing.salience = chooseHigherSalience(existing.salience, salience);
        existing.lastReinforcedAt = currentDialogueTimestamp();
        existing.reinforcementCount += 1;
        emitDialogueMemoryEvent(existing, 'dialogue_memory_reinforced');
        return existing;
    }

    const timestamp = currentDialogueTimestamp();
    const memory = normaliseDialogueMemory({
        id: takeNextId(),
        memoryType: safeMemoryType,
        ownerPersonId: safeOwnerPersonId,
        subjectId: safeSubjectId,
        conversationId,
        causedByPartId: Number.isInteger(causedByPartId) ? causedByPartId : null,
        text,
        data: safeData,
        mergeKey: safeMergeKey,
        salience,
        reinforcementCount: 1,
        createdAt: timestamp,
        lastReinforcedAt: timestamp,
        active: true
    });
    state.dialogueMemories.push(memory);
    emitDialogueMemoryEvent(memory, 'dialogue_memory_recorded');
    return memory;
}
