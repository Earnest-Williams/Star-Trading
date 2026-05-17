import { BALANCE } from '../../constants.js';
import { addIntel } from '../../core/intel.js';
import { state } from '../../state.js';
import { asNumber, asString, formatItemLabel, isObject } from './common.js';
import { touchDialogueConversation } from './conversations.js';
import { addDialogueEvent, DIALOGUE_EVENT_TYPES } from './dialogueEvents.js';
import { DIALOGUE_TASK_STATUSES, DIALOGUE_TASK_TYPES } from './dialogueTasks.js';
import { createDialogueMessage } from './messages.js';
import { createDialogueOffer, DIALOGUE_OFFER_TYPES } from './offers.js';
import { applyDialogueRelationshipDelta } from './relationships.js';

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

function payloadValue(task, field, fallback = '') {
    return asString(task?.payload?.[field], asString(task?.[field], fallback));
}

function sectorIdForTask(task) {
    const payloadSectorId = asInteger(task?.payload?.sectorId, null);
    if (Number.isInteger(payloadSectorId)) return payloadSectorId;
    const person = state.people?.[task.ownerPersonId] || null;
    return asInteger(person?.sectorId, asInteger(state.player?.currentSector, 0));
}

function relationshipAdjustedPrice(basePrice, task) {
    const person = state.people?.[task.ownerPersonId] || null;
    const services = Array.isArray(person?.services) ? person.services : [];
    const discount = services.includes('discounts') ? 0.9 : 1;
    const attemptPressure = 1 + (Math.max(0, asNumber(task?.resolutionAttempts, 0)) * 0.03);
    return Math.max(25, Math.round(basePrice * discount * attemptPressure));
}

function resolveOrderTask(task, reason) {
    const commodityId = payloadValue(task, 'commodityId', 'eq');
    const quantity = Math.max(1, asInteger(task?.payload?.quantity, 10));
    const price = relationshipAdjustedPrice(120 * quantity, task);
    const offer = createDialogueOffer({
        conversationId: task.conversationId,
        taskId: task.id,
        ownerPersonId: task.ownerPersonId,
        recipientId: task.requesterId,
        itemId: commodityId,
        price,
        offerType: DIALOGUE_OFFER_TYPES.SOURCED_ORDER,
        serviceType: 'orders',
        payload: {
            serviceType: 'orders',
            commodityId,
            quantity,
            reason: asString(reason, 'hourly tick')
        }
    });
    task.status = DIALOGUE_TASK_STATUSES.RESOLVED;
    task.result = {
        outcome: 'success',
        serviceType: 'orders',
        offerId: offer.id,
        resolvedAt: currentDialogueTimestamp(),
        reason: asString(reason, 'hourly tick')
    };
    createDialogueMessage({
        conversationId: task.conversationId,
        senderId: task.ownerPersonId,
        recipientId: task.requesterId,
        taskId: task.id,
        subject: `Order sourced: ${formatItemLabel(commodityId)}`,
        text: `I found an order for ${quantity} ${formatItemLabel(commodityId)}. The offer is waiting in communications.`,
        payload: { taskId: task.id, serviceType: 'orders', outcome: 'success', offerId: offer.id, commodityId, quantity }
    });
    touchDialogueConversation(task.conversationId, { relatedOfferIds: [offer.id] });
    applyDialogueRelationshipDelta(task.ownerPersonId, { trust: 1, familiarity: 1, tags: ['sourced_order'], reason: 'service_resolved_success' });
    return task;
}

function resolvePermitTask(task, reason) {
    const permitType = payloadValue(task, 'permitType', 'local_access');
    const sectorId = sectorIdForTask(task);
    const price = relationshipAdjustedPrice(350, task);
    const now = currentAbsoluteMinute();
    const offer = createDialogueOffer({
        conversationId: task.conversationId,
        taskId: task.id,
        ownerPersonId: task.ownerPersonId,
        recipientId: task.requesterId,
        itemId: permitType,
        price,
        offerType: DIALOGUE_OFFER_TYPES.PERMIT,
        serviceType: 'permits',
        expiresAtAbsoluteMinute: now + (2 * BALANCE.DAY_MINUTES),
        payload: {
            serviceType: 'permits',
            permitType,
            sectorId,
            authorization: { permitType, sectorId, expiresAtAbsoluteMinute: now + (7 * BALANCE.DAY_MINUTES) },
            reason: asString(reason, 'hourly tick')
        }
    });
    task.status = DIALOGUE_TASK_STATUSES.RESOLVED;
    task.result = {
        outcome: 'success',
        serviceType: 'permits',
        offerId: offer.id,
        permitType,
        sectorId,
        resolvedAt: currentDialogueTimestamp(),
        reason: asString(reason, 'hourly tick')
    };
    createDialogueMessage({
        conversationId: task.conversationId,
        senderId: task.ownerPersonId,
        recipientId: task.requesterId,
        taskId: task.id,
        subject: `Permit arranged: ${formatItemLabel(permitType)}`,
        text: `I can arrange ${formatItemLabel(permitType)} authorization for sector ${sectorId}. Review the permit offer in communications.`,
        payload: { taskId: task.id, serviceType: 'permits', outcome: 'success', offerId: offer.id, permitType, sectorId }
    });
    touchDialogueConversation(task.conversationId, { relatedOfferIds: [offer.id] });
    applyDialogueRelationshipDelta(task.ownerPersonId, { trust: 1, familiarity: 1, tags: ['arranged_permit'], reason: 'service_resolved_success' });
    return task;
}

function resolveIntelTask(task, reason) {
    const topic = payloadValue(task, 'topic', 'local_activity');
    const sectorId = sectorIdForTask(task);
    const intel = addIntel({
        type: topic,
        factionId: payloadValue(task, 'factionId', null),
        sectorId,
        value: Math.max(20, asInteger(task?.payload?.value, 35)),
        expiresDay: asInteger(task?.payload?.expiresDay, asInteger(state.player?.time?.day, 1) + 8),
        text: `Contact intel on ${formatItemLabel(topic)} in sector ${sectorId}.`
    });
    task.status = DIALOGUE_TASK_STATUSES.RESOLVED;
    task.result = {
        outcome: 'success',
        serviceType: 'intel',
        intelId: intel.id,
        topic,
        sectorId,
        resolvedAt: currentDialogueTimestamp(),
        reason: asString(reason, 'hourly tick')
    };
    createDialogueMessage({
        conversationId: task.conversationId,
        senderId: task.ownerPersonId,
        recipientId: task.requesterId,
        taskId: task.id,
        subject: `Intel gathered: ${formatItemLabel(topic)}`,
        text: intel.text,
        payload: { taskId: task.id, serviceType: 'intel', outcome: 'success', intelId: intel.id, topic, sectorId }
    });
    applyDialogueRelationshipDelta(task.ownerPersonId, { trust: 1, familiarity: 1, tags: ['gathered_intel'], reason: 'service_resolved_success' });
    return task;
}

export function resolveContactServiceTask(task, reason = 'hourly tick') {
    if (!isObject(task)) return false;
    task.resolutionAttempts = Math.max(0, asInteger(task.resolutionAttempts, 0)) + 1;
    if (task.taskType === DIALOGUE_TASK_TYPES.SOURCE_ORDER) return resolveOrderTask(task, reason);
    if (task.taskType === DIALOGUE_TASK_TYPES.ARRANGE_PERMIT) return resolvePermitTask(task, reason);
    if (task.taskType === DIALOGUE_TASK_TYPES.GATHER_INTEL) return resolveIntelTask(task, reason);
    return false;
}

export function finishContactServiceResolution(task) {
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
        summary: {
            taskId: task.id,
            serviceType: task.serviceType,
            status: task.status,
            outcome: task.result?.outcome,
            offerId: task.result?.offerId,
            intelId: task.result?.intelId
        },
        timestamp: ts
    });
    return task;
}
