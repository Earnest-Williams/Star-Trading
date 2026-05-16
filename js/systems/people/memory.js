import { BALANCE } from '../../constants.js';
import { state } from '../../state.js';
import { ensureDialogueRuntimeStorage } from './conversationParts.js';
import { touchDialogueConversation } from './conversations.js';
import { addDialogueEvent, DIALOGUE_EVENT_TYPES } from './dialogueEvents.js';

export const DIALOGUE_MEMORY_TYPES = Object.freeze({
    CUSTOMER_REQUEST: 'customer_request'
});

export const DIALOGUE_MEMORY_STATUSES = Object.freeze({
    ACTIVE: 'active',
    RESOLVED: 'resolved',
    SUPERSEDED: 'superseded',
    EXPIRED: 'expired'
});

export const DIALOGUE_MEMORY_SALIENCE = Object.freeze({
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high'
});

const MEMORY_TYPE_VALUES = Object.values(DIALOGUE_MEMORY_TYPES);
const MEMORY_STATUS_VALUES = Object.values(DIALOGUE_MEMORY_STATUSES);
const MEMORY_SALIENCE_VALUES = Object.values(DIALOGUE_MEMORY_SALIENCE);
const SALIENCE_RANK = Object.freeze({ low: 1, medium: 2, high: 3 });
const MEMORY_DECAY_DAYS = 14;

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

function currentAbsoluteMinute() {
    const day = asInteger(state.player?.time?.day, 1);
    const minuteOfDay = asInteger(state.player?.time?.minuteOfDay, 0);
    return (day - 1) * BALANCE.DAY_MINUTES + minuteOfDay;
}

function currentDialogueTimestamp() {
    const absoluteMinute = currentAbsoluteMinute();
    return {
        day: Math.floor(absoluteMinute / BALANCE.DAY_MINUTES) + 1,
        minuteOfDay: absoluteMinute % BALANCE.DAY_MINUTES,
        absoluteMinute
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

function normaliseMemoryStatus(value, active = true) {
    const status = asString(value, active ? DIALOGUE_MEMORY_STATUSES.ACTIVE : DIALOGUE_MEMORY_STATUSES.EXPIRED);
    return MEMORY_STATUS_VALUES.includes(status) ? status : DIALOGUE_MEMORY_STATUSES.ACTIVE;
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
    touchDialogueConversation(memory.conversationId, {
        ownerPersonId: memory.ownerPersonId,
        subjectId: memory.subjectId,
        relatedMemoryIds: [memory.id],
        updatedAt: ts
    });
    addDialogueEvent({
        eventType,
        sourceSystem: 'memory',
        actor: memory.ownerPersonId,
        subject: memory.subjectId,
        conversationId: memory.conversationId,
        partId: memory.causedByPartId,
        memoryId: memory.id,
        causedBy: { conversationId: memory.conversationId, partId: memory.causedByPartId },
        summary: {
            memoryId: memory.id,
            memoryType: memory.memoryType,
            salience: memory.salience,
            mergeKey: memory.mergeKey
        },
        timestamp: ts
    });
}

export function normaliseDialogueMemory(memory, fallbackId = 1) {
    const createdAt = isObject(memory?.createdAt) ? memory.createdAt : {};
    const lastReinforcedAt = isObject(memory?.lastReinforcedAt)
        ? memory.lastReinforcedAt
        : createdAt;
    const data = isObject(memory?.data) ? memory.data : {};
    const status = normaliseMemoryStatus(memory?.status, typeof memory?.active === 'boolean' ? memory.active : true);
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
        status,
        resolvedAt: isObject(memory?.resolvedAt) ? {
            day: asInteger(memory.resolvedAt.day, 1),
            minuteOfDay: asInteger(memory.resolvedAt.minuteOfDay, 0),
            absoluteMinute: asInteger(memory.resolvedAt.absoluteMinute, 0)
        } : null,
        active: status === DIALOGUE_MEMORY_STATUSES.ACTIVE
    };
}

export function normaliseDialogueMemories(target = state) {
    ensureDialogueRuntimeStorage(target);
    target.dialogueMemories = target.dialogueMemories
        .map((memory, index) => normaliseDialogueMemory(memory, index + 1))
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
    ensureDialogueRuntimeStorage();
    const safeData = isObject(data) ? data : {};
    const safeMemoryType = normaliseMemoryType(memoryType);
    const safeOwnerPersonId = asString(ownerPersonId, 'unknown-person');
    const safeSubjectId = asString(subjectId, 'player');
    const safeMergeKey = inferMergeKey(safeData, asNullableString(mergeKey));
    const existing = safeMergeKey === null ? null : state.dialogueMemories.find(memory => memory.status === DIALOGUE_MEMORY_STATUSES.ACTIVE
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
        emitDialogueMemoryEvent(existing, DIALOGUE_EVENT_TYPES.DIALOGUE_MEMORY_REINFORCED);
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
        active: true,
        status: DIALOGUE_MEMORY_STATUSES.ACTIVE
    });
    state.dialogueMemories.push(memory);
    emitDialogueMemoryEvent(memory, DIALOGUE_EVENT_TYPES.DIALOGUE_MEMORY_RECORDED);
    return memory;
}


export function getDialogueMemoriesForPerson(personId) {
    const safePersonId = asString(personId, '');
    if (safePersonId.length === 0) return [];
    return (state.dialogueMemories || []).filter(memory => memory.ownerPersonId === safePersonId);
}

export function getActiveCustomerRequests({ ownerPersonId = null, subjectId = 'player', itemId = null } = {}) {
    const safeOwnerPersonId = asNullableString(ownerPersonId);
    const safeItemId = asNullableString(itemId);
    return (state.dialogueMemories || []).filter(memory => memory.memoryType === DIALOGUE_MEMORY_TYPES.CUSTOMER_REQUEST
        && memory.status === DIALOGUE_MEMORY_STATUSES.ACTIVE
        && (safeOwnerPersonId === null || memory.ownerPersonId === safeOwnerPersonId)
        && memory.subjectId === asString(subjectId, 'player')
        && (safeItemId === null || memory.mergeKey === safeItemId || memory.data?.itemId === safeItemId));
}

function resolveMemoryRow(memory, status, eventType) {
    if (!memory || memory.status !== DIALOGUE_MEMORY_STATUSES.ACTIVE) return false;
    memory.status = status;
    memory.active = false;
    memory.resolvedAt = currentDialogueTimestamp();
    emitDialogueMemoryEvent(memory, eventType);
    return memory;
}

export function resolveDialogueMemory({ memoryId = null, ownerPersonId = null, subjectId = 'player', itemId = null, conversationId = null } = {}) {
    const id = asInteger(memoryId, null);
    let memory = null;
    if (Number.isInteger(id)) {
        memory = (state.dialogueMemories || []).find(item => item.id === id) || null;
    } else {
        memory = getActiveCustomerRequests({ ownerPersonId, subjectId, itemId })
            .find(item => !conversationId || item.conversationId === conversationId) || null;
    }
    return resolveMemoryRow(memory, DIALOGUE_MEMORY_STATUSES.RESOLVED, DIALOGUE_EVENT_TYPES.DIALOGUE_MEMORY_RESOLVED);
}

export function supersedeDialogueMemory(memoryId, reason = 'superseded') {
    const id = asInteger(memoryId, null);
    const memory = (state.dialogueMemories || []).find(item => item.id === id) || null;
    if (memory) memory.data = { ...memory.data, supersededReason: asString(reason, 'superseded') };
    return resolveMemoryRow(memory, DIALOGUE_MEMORY_STATUSES.SUPERSEDED, DIALOGUE_EVENT_TYPES.DIALOGUE_MEMORY_SUPERSEDED);
}

export function decayDialogueMemories(reason = 'daily tick') {
    const now = currentAbsoluteMinute();
    const expired = [];
    (state.dialogueMemories || []).filter(memory => memory.status === DIALOGUE_MEMORY_STATUSES.ACTIVE)
        .filter(memory => now - memory.lastReinforcedAt.absoluteMinute >= BALANCE.DAY_MINUTES * MEMORY_DECAY_DAYS)
        .forEach(memory => {
            memory.data = { ...memory.data, expiredReason: asString(reason, 'daily tick') };
            const resolved = resolveMemoryRow(memory, DIALOGUE_MEMORY_STATUSES.EXPIRED, DIALOGUE_EVENT_TYPES.DIALOGUE_MEMORY_EXPIRED);
            if (resolved) expired.push(resolved);
        });
    return expired;
}
