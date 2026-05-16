import { BALANCE } from '../../constants.js';
import { state } from '../../state.js';
import { random } from '../../utils.js';
import { ensureDialogueRuntimeStorage } from './conversationParts.js';
import { touchDialogueConversation } from './conversations.js';
import { addDialogueEvent, DIALOGUE_EVENT_TYPES } from './dialogueEvents.js';
import { createDialogueMessage } from './messages.js';
import { createDialogueOffer } from './offers.js';
import { applyDialogueRelationshipDelta } from './relationships.js';

export const DIALOGUE_TASK_STATUSES = Object.freeze({
    ACTIVE: 'active',
    RESOLVED: 'resolved',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
});

export const DIALOGUE_TASK_TYPES = Object.freeze({
    LOCATE_ITEM: 'locate_item'
});

const TASK_STATUS_VALUES = Object.values(DIALOGUE_TASK_STATUSES);
const LOCATE_ITEM_CHECK_INTERVAL_MINUTES = 6 * 60;
const DEFAULT_LOCATE_ITEM_SUCCESS_CHANCE = 0.65;
const MIN_LOCATED_ITEM_PRICE = 50;
const DEFAULT_LOCATED_ITEM_PRICE = 450;

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
    if (!Number.isInteger(state.nextDialogueTaskId) || state.nextDialogueTaskId < 1) {
        state.nextDialogueTaskId = 1;
    }
    const id = state.nextDialogueTaskId;
    state.nextDialogueTaskId += 1;
    return id;
}

function normaliseStatus(value) {
    const status = asString(value, DIALOGUE_TASK_STATUSES.ACTIVE);
    return TASK_STATUS_VALUES.includes(status) ? status : DIALOGUE_TASK_STATUSES.ACTIVE;
}

function itemLabel(itemId) {
    return asString(itemId, 'part').replaceAll('_', ' ');
}

function findActiveLocateItemTask(ownerPersonId, requesterId, itemId) {
    return state.dialogueTasks.find(task => task.taskType === DIALOGUE_TASK_TYPES.LOCATE_ITEM
        && task.status === DIALOGUE_TASK_STATUSES.ACTIVE
        && task.ownerPersonId === ownerPersonId
        && task.requesterId === requesterId
        && task.itemId === itemId) || null;
}

export function normaliseDialogueTask(task, fallbackId = 1) {
    const createdAt = isObject(task?.createdAt) ? task.createdAt : {};
    const result = isObject(task?.result) ? task.result : {};
    const taskType = asString(task?.taskType, DIALOGUE_TASK_TYPES.LOCATE_ITEM);
    return {
        id: asInteger(task?.id, fallbackId),
        taskType: Object.values(DIALOGUE_TASK_TYPES).includes(taskType)
            ? taskType : DIALOGUE_TASK_TYPES.LOCATE_ITEM,
        ownerPersonId: asString(task?.ownerPersonId, 'unknown-person'),
        requesterId: asString(task?.requesterId, 'player'),
        itemId: asString(task?.itemId, 'unknown_part'),
        conversationId: asString(task?.conversationId, 'default'),
        causedByPartId: Number.isInteger(task?.causedByPartId) ? task.causedByPartId : null,
        status: normaliseStatus(task?.status),
        createdAt: {
            day: asInteger(createdAt.day, 1),
            minuteOfDay: asInteger(createdAt.minuteOfDay, 0),
            absoluteMinute: asInteger(createdAt.absoluteMinute, 0)
        },
        nextCheckAtAbsoluteMinute: asInteger(
            task?.nextCheckAtAbsoluteMinute,
            currentAbsoluteMinute() + LOCATE_ITEM_CHECK_INTERVAL_MINUTES
        ),
        resolutionAttempts: Math.max(0, asInteger(task?.resolutionAttempts, 0)),
        result,
        intervalMinutes: Math.max(60, asInteger(task?.intervalMinutes, LOCATE_ITEM_CHECK_INTERVAL_MINUTES)),
        resolutionPolicy: isObject(task?.resolutionPolicy) ? task.resolutionPolicy : {}
    };
}

export function normaliseDialogueTasks(target = state) {
    ensureDialogueRuntimeStorage(target);
    target.dialogueTasks = target.dialogueTasks
        .map((task, index) => normaliseDialogueTask(task, index + 1))
        .sort((a, b) => a.createdAt.absoluteMinute - b.createdAt.absoluteMinute || a.id - b.id);
    const nextId = target.dialogueTasks.reduce((maxId, task) => Math.max(maxId, asInteger(task?.id, 0)), 0) + 1;
    if (!Number.isInteger(target.nextDialogueTaskId) || target.nextDialogueTaskId < nextId) {
        target.nextDialogueTaskId = nextId;
    }
}

export function createLocateItemDialogueTask({
    ownerPersonId,
    requesterId,
    itemId,
    conversationId,
    causedByPartId,
    resolutionPolicy = {}
} = {}) {
    normaliseDialogueTasks();
    const safeOwnerPersonId = asString(ownerPersonId, 'unknown-person');
    const safeRequesterId = asString(requesterId, 'player');
    const safeItemId = asString(itemId, 'unknown_part');
    const duplicate = findActiveLocateItemTask(safeOwnerPersonId, safeRequesterId, safeItemId);
    if (duplicate) return duplicate;
    const task = normaliseDialogueTask({
        id: takeNextId(),
        taskType: DIALOGUE_TASK_TYPES.LOCATE_ITEM,
        ownerPersonId: safeOwnerPersonId,
        requesterId: safeRequesterId,
        itemId: safeItemId,
        conversationId: asString(conversationId, `${safeOwnerPersonId}-${safeRequesterId}`),
        causedByPartId: Number.isInteger(causedByPartId) ? causedByPartId : null,
        status: DIALOGUE_TASK_STATUSES.ACTIVE,
        createdAt: currentDialogueTimestamp(),
        nextCheckAtAbsoluteMinute: currentAbsoluteMinute() + LOCATE_ITEM_CHECK_INTERVAL_MINUTES,
        resolutionAttempts: 0,
        result: {},
        intervalMinutes: LOCATE_ITEM_CHECK_INTERVAL_MINUTES,
        resolutionPolicy
    });
    state.dialogueTasks.push(task);
    touchDialogueConversation(task.conversationId, {
        ownerPersonId: task.ownerPersonId,
        subjectId: task.requesterId,
        relatedTaskIds: [task.id],
        updatedAt: task.createdAt
    });
    addDialogueEvent({
        eventType: DIALOGUE_EVENT_TYPES.DIALOGUE_TASK_CREATED,
        sourceSystem: 'dialogue_task',
        actor: task.ownerPersonId,
        subject: task.requesterId,
        conversationId: task.conversationId,
        partId: task.causedByPartId,
        taskId: task.id,
        causedBy: { conversationId: task.conversationId, partId: task.causedByPartId },
        summary: { taskId: task.id, itemId: task.itemId, status: task.status },
        timestamp: task.createdAt
    });
    return task;
}

function resolveLocateItemTask(task, reason) {
    task.resolutionAttempts += 1;
    const forced = asNullableString(task.resolutionPolicy.forceResult);
    const succeeded = forced === 'success'
        || (forced !== 'failure' && random() < Number(task.resolutionPolicy.successChance ?? DEFAULT_LOCATE_ITEM_SUCCESS_CHANCE));
    if (succeeded) {
        task.status = DIALOGUE_TASK_STATUSES.RESOLVED;
        const price = Math.max(MIN_LOCATED_ITEM_PRICE, Math.round(Number(task.resolutionPolicy.price ?? DEFAULT_LOCATED_ITEM_PRICE)));
        const offer = createDialogueOffer({
            conversationId: task.conversationId,
            taskId: task.id,
            ownerPersonId: task.ownerPersonId,
            recipientId: task.requesterId,
            itemId: task.itemId,
            price
        });
        task.result = {
            outcome: 'success',
            itemId: task.itemId,
            offerId: offer.id,
            resolvedAt: currentDialogueTimestamp(),
            reason: asString(reason, 'hourly tick')
        };
        createDialogueMessage({
            conversationId: task.conversationId,
            senderId: task.ownerPersonId,
            recipientId: task.requesterId,
            taskId: task.id,
            subject: `Found: ${itemLabel(task.itemId)}`,
            text: `I found a used ${itemLabel(task.itemId)}. It is available for trade when you are ready.`,
            payload: { taskId: task.id, itemId: task.itemId, outcome: 'success', offerId: offer.id }
        });
        touchDialogueConversation(task.conversationId, { relatedOfferIds: [offer.id] });
        applyDialogueRelationshipDelta(task.ownerPersonId, { trust: 1, familiarity: 1, tags: ['found_part'], reason: 'task_resolved_success' });
    } else {
        task.status = DIALOGUE_TASK_STATUSES.FAILED;
        task.result = {
            outcome: 'failure',
            itemId: task.itemId,
            resolvedAt: currentDialogueTimestamp(),
            reason: asString(reason, 'hourly tick')
        };
        applyDialogueRelationshipDelta(task.ownerPersonId, { trust: -1, familiarity: 1, tags: ['search_failed'], reason: 'task_resolved_failure' });
        createDialogueMessage({
            conversationId: task.conversationId,
            senderId: task.ownerPersonId,
            recipientId: task.requesterId,
            taskId: task.id,
            subject: `No luck: ${itemLabel(task.itemId)}`,
            text: `No luck yet finding a ${itemLabel(task.itemId)}. I did not put anything aside.`,
            payload: { taskId: task.id, itemId: task.itemId, outcome: 'failure' }
        });
    }
    const ts = currentDialogueTimestamp();
    touchDialogueConversation(task.conversationId, {
        status: task.status === DIALOGUE_TASK_STATUSES.RESOLVED ? 'resolved' : 'failed',
        relatedTaskIds: [task.id],
        updatedAt: ts
    });
    addDialogueEvent({
        eventType: DIALOGUE_EVENT_TYPES.DIALOGUE_TASK_RESOLVED,
        sourceSystem: 'dialogue_task',
        actor: task.ownerPersonId,
        subject: task.requesterId,
        conversationId: task.conversationId,
        taskId: task.id,
        causedBy: { conversationId: task.conversationId, taskId: task.id },
        summary: { itemId: task.itemId, status: task.status, outcome: task.result.outcome, offerId: task.result.offerId },
        timestamp: ts
    });
    return task;
}

export function resolveDueDialogueTasks(reason = 'hourly tick') {
    const now = currentAbsoluteMinute();
    const resolved = [];
    state.dialogueTasks
        .filter(task => task.status === DIALOGUE_TASK_STATUSES.ACTIVE)
        .filter(task => task.nextCheckAtAbsoluteMinute <= now)
        .forEach(task => {
            resolved.push(resolveLocateItemTask(task, reason));
        });
    return resolved;
}
