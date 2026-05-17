import { BALANCE } from '../../constants.js';
import { state } from '../../state.js';
import { asInteger, asString, formatItemLabel, isObject } from './common.js';
import { ensureDialogueRuntimeStorage } from './conversationParts.js';
import { touchDialogueConversation } from './conversations.js';
import { addDialogueEvent, DIALOGUE_EVENT_TYPES } from './dialogueEvents.js';
import { createDialogueMessage } from './messages.js';
import { createDialogueOffer } from './offers.js';
import {
    buildLocateItemFailureMessage,
    buildLocateItemSuccessMessage,
    resolveLocateItemOutcome
} from './locateItemResolution.js';
import { applyDialogueRelationshipDelta } from './relationships.js';
import { finishContactServiceResolution, resolveContactServiceTask } from './contactServiceResolution.js';

export const DIALOGUE_TASK_STATUSES = Object.freeze({
    ACTIVE: 'active',
    RESOLVED: 'resolved',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
});

export const DIALOGUE_TASK_TYPES = Object.freeze({
    LOCATE_ITEM: 'locate_item',
    SOURCE_ORDER: 'source_order',
    ARRANGE_PERMIT: 'arrange_permit',
    GATHER_INTEL: 'gather_intel'
});

export const CONTACT_SERVICE_TYPES = Object.freeze({
    PARTS: 'parts',
    ORDERS: 'orders',
    PERMITS: 'permits',
    INTEL: 'intel'
});

const TASK_STATUS_VALUES = Object.values(DIALOGUE_TASK_STATUSES);
const LOCATE_ITEM_CHECK_INTERVAL_MINUTES = 6 * 60;

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
    return formatItemLabel(itemId);
}

function normalisePayload(payload) {
    return isObject(payload) ? { ...payload } : {};
}

function keyValue(value, fallback) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    if (Number.isFinite(Number(value))) return String(value);
    return fallback;
}

export function taskTypeForServiceType(serviceType) {
    const safeServiceType = asString(serviceType, CONTACT_SERVICE_TYPES.PARTS);
    if (safeServiceType === CONTACT_SERVICE_TYPES.ORDERS) return DIALOGUE_TASK_TYPES.SOURCE_ORDER;
    if (safeServiceType === CONTACT_SERVICE_TYPES.PERMITS) return DIALOGUE_TASK_TYPES.ARRANGE_PERMIT;
    if (safeServiceType === CONTACT_SERVICE_TYPES.INTEL) return DIALOGUE_TASK_TYPES.GATHER_INTEL;
    return DIALOGUE_TASK_TYPES.LOCATE_ITEM;
}

export function serviceTypeForTaskType(taskType) {
    const safeTaskType = asString(taskType, DIALOGUE_TASK_TYPES.LOCATE_ITEM);
    if (safeTaskType === DIALOGUE_TASK_TYPES.SOURCE_ORDER) return CONTACT_SERVICE_TYPES.ORDERS;
    if (safeTaskType === DIALOGUE_TASK_TYPES.ARRANGE_PERMIT) return CONTACT_SERVICE_TYPES.PERMITS;
    if (safeTaskType === DIALOGUE_TASK_TYPES.GATHER_INTEL) return CONTACT_SERVICE_TYPES.INTEL;
    return CONTACT_SERVICE_TYPES.PARTS;
}

export function stablePayloadKeyForService(serviceType, payload = {}) {
    const safePayload = normalisePayload(payload);
    const safeServiceType = asString(serviceType, CONTACT_SERVICE_TYPES.PARTS);
    if (safeServiceType === CONTACT_SERVICE_TYPES.PERMITS) {
        return `permit:${asString(safePayload.permitType, 'local_access')}:sector:${keyValue(safePayload.sectorId, 'local')}`;
    }
    if (safeServiceType === CONTACT_SERVICE_TYPES.INTEL) {
        return `intel:${asString(safePayload.topic, 'local_activity')}:sector:${keyValue(safePayload.sectorId, 'local')}`;
    }
    if (safeServiceType === CONTACT_SERVICE_TYPES.ORDERS) {
        return `order:${asString(safePayload.commodityId, 'eq')}:qty:${asInteger(safePayload.quantity, 10)}`;
    }
    return `part:${asString(safePayload.itemId, 'unknown_part')}`;
}

function itemIdForService(serviceType, payload = {}, fallback = 'unknown_part') {
    const safePayload = normalisePayload(payload);
    const safeServiceType = asString(serviceType, CONTACT_SERVICE_TYPES.PARTS);
    if (safeServiceType === CONTACT_SERVICE_TYPES.ORDERS) {
        return asString(safePayload.commodityId, fallback);
    }
    if (safeServiceType === CONTACT_SERVICE_TYPES.PERMITS) {
        return asString(safePayload.permitType, fallback);
    }
    if (safeServiceType === CONTACT_SERVICE_TYPES.INTEL) {
        return asString(safePayload.topic, fallback);
    }
    return asString(safePayload.itemId, fallback);
}

function findActiveDialogueTask(taskType, ownerPersonId, requesterId, payloadKey) {
    return state.dialogueTasks.find(task => task.taskType === taskType
        && task.status === DIALOGUE_TASK_STATUSES.ACTIVE
        && task.ownerPersonId === ownerPersonId
        && task.requesterId === requesterId
        && task.payloadKey === payloadKey) || null;
}

export function normaliseDialogueTask(task, fallbackId = 1) {
    const createdAt = isObject(task?.createdAt) ? task.createdAt : {};
    const result = isObject(task?.result) ? task.result : {};
    const taskType = asString(task?.taskType, DIALOGUE_TASK_TYPES.LOCATE_ITEM);
    const serviceType = asString(task?.serviceType, serviceTypeForTaskType(taskType));
    const payload = normalisePayload(task?.payload);
    return {
        id: asInteger(task?.id, fallbackId),
        taskType: Object.values(DIALOGUE_TASK_TYPES).includes(taskType)
            ? taskType : DIALOGUE_TASK_TYPES.LOCATE_ITEM,
        ownerPersonId: asString(task?.ownerPersonId, 'unknown-person'),
        requesterId: asString(task?.requesterId, 'player'),
        serviceType,
        payload,
        payloadKey: asString(
            task?.payloadKey,
            stablePayloadKeyForService(
                serviceType,
                isObject(task?.payload)
                    ? task.payload
                    : {
                        itemId: asString(task?.itemId, 'unknown_part'),
                        commodityId: asString(task?.commodityId, ''),
                        permitType: asString(task?.permitType, ''),
                        topic: asString(task?.topic, '')
                    }
            )
        ),
        itemId: asString(task?.itemId, itemIdForService(serviceType, payload, 'unknown_part')),
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

export function createContactServiceDialogueTask({
    ownerPersonId,
    requesterId,
    serviceType,
    payload = {},
    conversationId,
    causedByPartId,
    resolutionPolicy = {}
} = {}) {
    normaliseDialogueTasks();
    const safeOwnerPersonId = asString(ownerPersonId, 'unknown-person');
    const safeRequesterId = asString(requesterId, 'player');
    const safeServiceType = asString(serviceType, CONTACT_SERVICE_TYPES.PARTS);
    const safePayload = normalisePayload(payload);
    const taskType = taskTypeForServiceType(safeServiceType);
    const payloadKey = stablePayloadKeyForService(safeServiceType, safePayload);
    const safeItemId = itemIdForService(safeServiceType, safePayload, 'unknown_part');
    const duplicate = findActiveDialogueTask(taskType, safeOwnerPersonId, safeRequesterId, payloadKey);
    if (duplicate) return duplicate;
    const task = normaliseDialogueTask({
        id: takeNextId(),
        taskType,
        serviceType: safeServiceType,
        payload: safePayload,
        payloadKey,
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
        summary: { taskId: task.id, serviceType: task.serviceType, itemId: task.itemId, payloadKey: task.payloadKey, status: task.status },
        timestamp: task.createdAt
    });
    return task;
}

export function createLocateItemDialogueTask({
    ownerPersonId,
    requesterId,
    itemId,
    conversationId,
    causedByPartId,
    resolutionPolicy = {}
} = {}) {
    return createContactServiceDialogueTask({
        ownerPersonId,
        requesterId,
        serviceType: CONTACT_SERVICE_TYPES.PARTS,
        payload: { itemId: asString(itemId, 'unknown_part') },
        conversationId,
        causedByPartId,
        resolutionPolicy
    });
}

function resolutionSummary(outcome, includePrice = false) {
    const summary = {
        successChance: outcome.successChance,
        riskLevel: outcome.riskLevel,
        explanationTags: outcome.explanationTags
    };
    if (includePrice) {
        summary.condition = outcome.condition;
        summary.sourceFlavor = outcome.sourceFlavor;
        summary.priceMultiplier = outcome.priceMultiplier;
    }
    return summary;
}

function offerPayloadFromOutcome(outcome) {
    return {
        condition: outcome.condition,
        sourceFlavor: outcome.sourceFlavor,
        riskLevel: outcome.riskLevel,
        priceMultiplier: outcome.priceMultiplier,
        successChance: outcome.successChance,
        explanationTags: outcome.explanationTags
    };
}

function messagePayloadFromOutcome(task, outcome, offer = null) {
    return {
        taskId: task.id,
        itemId: task.itemId,
        outcome: outcome.outcome,
        ...(offer ? { offerId: offer.id } : {}),
        resolution: {
            condition: outcome.condition,
            sourceFlavor: outcome.sourceFlavor,
            riskLevel: outcome.riskLevel,
            explanationTags: outcome.explanationTags
        }
    };
}

function resolveLocateItemTask(task, reason) {
    task.resolutionAttempts += 1;
    const outcome = resolveLocateItemOutcome(task, reason);
    if (outcome.outcome === 'success') {
        task.status = DIALOGUE_TASK_STATUSES.RESOLVED;
        const offer = createDialogueOffer({
            conversationId: task.conversationId,
            taskId: task.id,
            ownerPersonId: task.ownerPersonId,
            recipientId: task.requesterId,
            itemId: task.itemId,
            price: outcome.price,
            payload: offerPayloadFromOutcome(outcome)
        });
        task.result = {
            outcome: 'success',
            itemId: task.itemId,
            offerId: offer.id,
            resolvedAt: currentDialogueTimestamp(),
            reason: asString(reason, 'hourly tick'),
            resolution: resolutionSummary(outcome, true)
        };
        createDialogueMessage({
            conversationId: task.conversationId,
            senderId: task.ownerPersonId,
            recipientId: task.requesterId,
            taskId: task.id,
            subject: `Found: ${itemLabel(task.itemId)}`,
            text: buildLocateItemSuccessMessage(task.itemId, outcome),
            payload: messagePayloadFromOutcome(task, outcome, offer)
        });
        touchDialogueConversation(task.conversationId, { relatedOfferIds: [offer.id] });
        applyDialogueRelationshipDelta(task.ownerPersonId, { trust: 1, familiarity: 1, tags: ['found_part'], reason: 'task_resolved_success' });
    } else {
        task.status = DIALOGUE_TASK_STATUSES.FAILED;
        task.result = {
            outcome: 'failure',
            itemId: task.itemId,
            resolvedAt: currentDialogueTimestamp(),
            reason: asString(reason, 'hourly tick'),
            resolution: resolutionSummary(outcome)
        };
        applyDialogueRelationshipDelta(task.ownerPersonId, { trust: -1, familiarity: 1, tags: ['search_failed'], reason: 'task_resolved_failure' });
        createDialogueMessage({
            conversationId: task.conversationId,
            senderId: task.ownerPersonId,
            recipientId: task.requesterId,
            taskId: task.id,
            subject: `No luck: ${itemLabel(task.itemId)}`,
            text: buildLocateItemFailureMessage(task.itemId, outcome),
            payload: messagePayloadFromOutcome(task, outcome)
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
            if (task.taskType === DIALOGUE_TASK_TYPES.LOCATE_ITEM) {
                resolved.push(resolveLocateItemTask(task, reason));
            } else {
                const serviceTask = resolveContactServiceTask(task, reason);
                if (serviceTask) resolved.push(finishContactServiceResolution(serviceTask));
            }
        });
    return resolved;
}
