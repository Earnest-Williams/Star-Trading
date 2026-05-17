import {
    DIALOGUE_PART_TYPES,
    DIALOGUE_SPEAKER_TYPES,
    addDialogueConversationPart,
    addPersonUtterance,
    addPlayerUtterance
} from './conversationParts.js';
import {
    DIALOGUE_CONVERSATION_STATUSES,
    DIALOGUE_CONVERSATION_TYPES,
    ensureDialogueConversation,
    touchDialogueConversation
} from './conversations.js';
import {
    CONTACT_SERVICE_TYPES,
    DIALOGUE_TASK_STATUSES,
    DIALOGUE_TASK_TYPES,
    createContactServiceDialogueTask,
    createLocateItemDialogueTask,
    taskTypeForServiceType
} from './dialogueTasks.js';
import { buildDialogueFrame, realizeDialogueLine, realizeDialoguePrompt } from './dialogueRealization.js';
import { DIALOGUE_FRAME_STATES, DIALOGUE_INTENTS } from './dialogueTemplates.js';
import { DIALOGUE_OFFER_STATUSES, getActiveDialogueOffersForPlayer } from './offers.js';
import {
    DIALOGUE_PROPOSAL_AUTHORITIES,
    acceptDialogueProposal,
    commitDialogueProposal,
    createDialogueProposal,
    rejectDialogueProposal
} from './proposals.js';
import { applyDialogueRelationshipDelta } from './relationships.js';
import {
    DIALOGUE_MEMORY_SALIENCE,
    DIALOGUE_MEMORY_TYPES,
    createOrReinforceDialogueMemory,
    getActiveCustomerRequests
} from './memory.js';
import { isObject } from './common.js';
import { state } from '../../state.js';

function asString(value, fallback = '') {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function itemLabel(itemId) {
    return asString(itemId, 'part').replaceAll('_', ' ');
}

function ensurePerson(personId) {
    const id = asString(personId, '');
    return id.length > 0 ? state.people?.[id] || null : null;
}

function locateItemConversationId(personId, itemId) {
    return `locate-item:${personId}:${itemId}`;
}

function getLocateItemDialogueState(personId, itemId) {
    const activeOffer = getActiveDialogueOffersForPlayer()
        .find(offer => offer.ownerPersonId === personId && offer.itemId === itemId);
    const acceptedOffer = (state.dialogueOffers || [])
        .find(offer => offer.ownerPersonId === personId
            && offer.itemId === itemId
            && offer.status === DIALOGUE_OFFER_STATUSES.ACCEPTED);
    const activeTask = (state.dialogueTasks || [])
        .find(task => task.ownerPersonId === personId
            && task.itemId === itemId
            && task.status === DIALOGUE_TASK_STATUSES.ACTIVE);
    const failedTask = (state.dialogueTasks || [])
        .find(task => task.ownerPersonId === personId
            && task.itemId === itemId
            && task.status === DIALOGUE_TASK_STATUSES.FAILED);
    const remembered = getActiveCustomerRequests({ ownerPersonId: personId, subjectId: 'player', itemId }).length > 0;
    if (activeOffer) return { state: DIALOGUE_FRAME_STATES.OFFER_READY, activeOffer, acceptedOffer, activeTask, failedTask, remembered };
    if (acceptedOffer) return { state: DIALOGUE_FRAME_STATES.FOUND_ALREADY, activeOffer, acceptedOffer, activeTask, failedTask, remembered };
    if (activeTask) return { state: DIALOGUE_FRAME_STATES.ACTIVE_TASK, activeOffer, acceptedOffer, activeTask, failedTask, remembered };
    if (failedTask) return { state: DIALOGUE_FRAME_STATES.FAILED_PREVIOUS, activeOffer, acceptedOffer, activeTask, failedTask, remembered };
    if (remembered) return { state: DIALOGUE_FRAME_STATES.REMEMBERED_REQUEST, activeOffer, acceptedOffer, activeTask, failedTask, remembered };
    return { state: DIALOGUE_FRAME_STATES.FRESH_REQUEST, activeOffer, acceptedOffer, activeTask, failedTask, remembered };
}

function buildLocateItemResponse({ intent, person, itemId, dialogueState }) {
    const frame = buildDialogueFrame(intent, {
        actorId: 'player',
        ownerPersonId: person.id,
        subjectId: 'player',
        itemId,
        state: dialogueState,
        slots: { itemLabel: itemLabel(itemId), personName: asString(person.name, person.id) }
    });
    return { frame, text: realizeDialogueLine(frame) };
}


const CONTACT_SERVICE_LABELS = Object.freeze({
    parts: 'part',
    orders: 'order',
    permits: 'permit',
    intel: 'intel'
});

function servicePayload(serviceType, payload) {
    const source = isObject(payload) ? payload : {};
    if (serviceType === CONTACT_SERVICE_TYPES.ORDERS) {
        return {
            commodityId: asString(source.commodityId, 'eq'),
            quantity: Number.isInteger(Number(source.quantity)) ? Number(source.quantity) : 10
        };
    }
    if (serviceType === CONTACT_SERVICE_TYPES.PERMITS) {
        return {
            permitType: asString(source.permitType, 'local_access'),
            sectorId: Number.isInteger(Number(source.sectorId)) ? Number(source.sectorId) : state.player?.currentSector
        };
    }
    if (serviceType === CONTACT_SERVICE_TYPES.INTEL) {
        return {
            topic: asString(source.topic, 'local_activity'),
            sectorId: Number.isInteger(Number(source.sectorId)) ? Number(source.sectorId) : state.player?.currentSector
        };
    }
    return { itemId: asString(source.itemId, asString(payload, 'unknown_part')) };
}

function contactServiceConversationId(personId, serviceType, payload) {
    if (serviceType === CONTACT_SERVICE_TYPES.PARTS) {
        return locateItemConversationId(personId, payload.itemId);
    }
    if (serviceType === CONTACT_SERVICE_TYPES.PERMITS) {
        return `contact-service:${personId}:permits:${payload.permitType}:${payload.sectorId || 'local'}`;
    }
    if (serviceType === CONTACT_SERVICE_TYPES.INTEL) {
        return `contact-service:${personId}:intel:${payload.topic}:${payload.sectorId || 'local'}`;
    }
    return `contact-service:${personId}:orders:${payload.commodityId}:${payload.quantity}`;
}

function serviceRequestLabel(serviceType, payload) {
    if (serviceType === CONTACT_SERVICE_TYPES.ORDERS) return `${payload.quantity} ${itemLabel(payload.commodityId)}`;
    if (serviceType === CONTACT_SERVICE_TYPES.PERMITS) return `${itemLabel(payload.permitType)} for sector ${payload.sectorId || 'local'}`;
    if (serviceType === CONTACT_SERVICE_TYPES.INTEL) return `${itemLabel(payload.topic)} in sector ${payload.sectorId || 'local'}`;
    return itemLabel(payload.itemId);
}

function ensureServiceAvailable(person, serviceType) {
    if (!Array.isArray(person?.services)) return serviceType === CONTACT_SERVICE_TYPES.PARTS;
    return person.services.includes(serviceType);
}

function requestGenericContactService(person, serviceType, payload) {
    const conversationId = contactServiceConversationId(person.id, serviceType, payload);
    const label = serviceRequestLabel(serviceType, payload);
    ensureDialogueConversation({
        conversationId,
        conversationType: DIALOGUE_CONVERSATION_TYPES.GENERAL,
        ownerPersonId: person.id,
        subjectId: 'player',
        topic: { serviceType, payload }
    });
    const playerPart = addPlayerUtterance(
        conversationId,
        `Can you help with ${label}?`,
        { action: 'requestContactService', serviceType, payload }
    );
    const intentPart = addDialogueConversationPart({
        conversationId,
        partType: DIALOGUE_PART_TYPES.INTENT,
        speakerType: DIALOGUE_SPEAKER_TYPES.PLAYER,
        speakerId: 'player',
        subjectId: person.id,
        intent: 'request_contact_service',
        payload: {
            command: 'requestContactService',
            ownerPersonId: person.id,
            requesterId: 'player',
            serviceType,
            payload
        },
        causedByPartId: playerPart.id
    });
    const serviceLabel = CONTACT_SERVICE_LABELS[serviceType] || 'service';
    const responsePart = addPersonUtterance(
        conversationId,
        person.id,
        `I can work on that ${serviceLabel}. Check back after I make some calls.`,
        { serviceType, payload, intentPartId: intentPart.id }
    );
    applyDialogueRelationshipDelta(person.id, {
        trust: 0,
        familiarity: 1,
        tags: [`requested_${serviceType}`],
        reason: 'contact_service_request'
    });
    const memoryProposalPart = addDialogueConversationPart({
        conversationId,
        partType: DIALOGUE_PART_TYPES.PROPOSAL,
        speakerType: DIALOGUE_SPEAKER_TYPES.SYSTEM,
        speakerId: 'dialogue',
        subjectId: person.id,
        intent: 'remember_customer_request',
        payload: {
            type: 'remember_customer_request',
            authority: 'memory',
            memoryType: DIALOGUE_MEMORY_TYPES.CUSTOMER_REQUEST,
            ownerPersonId: person.id,
            subjectId: 'player',
            serviceType,
            payload,
            salience: DIALOGUE_MEMORY_SALIENCE.HIGH
        },
        causedByPartId: responsePart.id
    });
    const memoryProposal = createDialogueProposal({
        conversationId,
        proposalPartId: memoryProposalPart.id,
        authority: DIALOGUE_PROPOSAL_AUTHORITIES.MEMORY,
        proposalType: 'remember_customer_request',
        payload: memoryProposalPart.payload
    });
    const memory = createOrReinforceDialogueMemory({
        ownerPersonId: person.id,
        subjectId: 'player',
        memoryType: DIALOGUE_MEMORY_TYPES.CUSTOMER_REQUEST,
        conversationId,
        causedByPartId: memoryProposalPart.id,
        text: `Player asked me to handle ${serviceType}: ${label}.`,
        data: { serviceType, payload },
        salience: DIALOGUE_MEMORY_SALIENCE.HIGH
    });
    if (memory) acceptDialogueProposal(memoryProposal.id);
    else rejectDialogueProposal(memoryProposal.id, 'memory authority rejected');
    const memoryEffectPart = addDialogueConversationPart({
        conversationId,
        partType: DIALOGUE_PART_TYPES.EFFECT,
        speakerType: DIALOGUE_SPEAKER_TYPES.SYSTEM,
        speakerId: 'memory',
        subjectId: person.id,
        intent: 'dialogue_memory_recorded',
        payload: {
            proposalPartId: memoryProposalPart.id,
            proposalId: memoryProposal.id,
            memoryId: memory.id,
            memoryType: memory.memoryType,
            duplicateMemory: memory.reinforcementCount > 1
        },
        causedByPartId: memoryProposalPart.id
    });
    commitDialogueProposal(memoryProposal.id, { effectPartId: memoryEffectPart.id, payload: { memoryId: memory.id } });
    const proposalPart = addDialogueConversationPart({
        conversationId,
        partType: DIALOGUE_PART_TYPES.PROPOSAL,
        speakerType: DIALOGUE_SPEAKER_TYPES.SYSTEM,
        speakerId: 'dialogue',
        subjectId: person.id,
        intent: 'create_dialogue_task',
        payload: {
            type: 'create_dialogue_task',
            authority: 'dialogue_task',
            taskType: taskTypeForServiceType(serviceType),
            serviceType,
            payload,
            ownerPersonId: person.id,
            requesterId: 'player',
            intervalHours: 6
        },
        causedByPartId: responsePart.id
    });
    const taskProposal = createDialogueProposal({
        conversationId,
        proposalPartId: proposalPart.id,
        authority: DIALOGUE_PROPOSAL_AUTHORITIES.DIALOGUE_TASK,
        proposalType: 'create_dialogue_task',
        payload: proposalPart.payload
    });
    const task = createContactServiceDialogueTask({
        ownerPersonId: person.id,
        requesterId: 'player',
        serviceType,
        payload,
        conversationId,
        causedByPartId: proposalPart.id
    });
    if (task) acceptDialogueProposal(taskProposal.id);
    else rejectDialogueProposal(taskProposal.id, 'task authority rejected');
    touchDialogueConversation(conversationId, {
        conversationType: DIALOGUE_CONVERSATION_TYPES.GENERAL,
        ownerPersonId: person.id,
        subjectId: 'player',
        status: DIALOGUE_CONVERSATION_STATUSES.WAITING,
        topic: { serviceType, payload },
        relatedTaskIds: [task.id],
        relatedMemoryIds: [memory.id]
    });
    const effectPart = addDialogueConversationPart({
        conversationId,
        partType: DIALOGUE_PART_TYPES.EFFECT,
        speakerType: DIALOGUE_SPEAKER_TYPES.SYSTEM,
        speakerId: 'dialogue_task',
        subjectId: person.id,
        intent: 'dialogue_task_created',
        payload: {
            proposalPartId: proposalPart.id,
            proposalId: taskProposal.id,
            taskId: task.id,
            serviceType,
            status: task.status,
            duplicateActiveTask: task.causedByPartId !== proposalPart.id
        },
        causedByPartId: proposalPart.id
    });
    commitDialogueProposal(taskProposal.id, { effectPartId: effectPart.id, payload: { taskId: task.id } });
    return {
        conversationId,
        playerPart,
        intentPart,
        responsePart,
        memoryProposalPart,
        memoryProposal,
        memory,
        memoryEffectPart,
        proposalPart,
        taskProposal,
        task,
        effectPart
    };
}

export function requestContactService(personId, serviceType, payload = {}) {
    const person = ensurePerson(personId);
    if (!person) return false;
    const safeServiceType = asString(serviceType, CONTACT_SERVICE_TYPES.PARTS);
    if (!Object.values(CONTACT_SERVICE_TYPES).includes(safeServiceType)) return false;
    if (!ensureServiceAvailable(person, safeServiceType)) return false;
    const safePayload = servicePayload(safeServiceType, payload);
    if (safeServiceType === CONTACT_SERVICE_TYPES.PARTS) {
        return requestLocatePartService(person, safePayload.itemId);
    }
    return requestGenericContactService(person, safeServiceType, safePayload);
}

function buildLocateItemPlayerPrompt({ intent, person, itemId, dialogueState }) {
    const frame = buildDialogueFrame(intent, {
        actorId: 'player',
        ownerPersonId: person.id,
        subjectId: person.id,
        itemId,
        state: dialogueState,
        slots: { itemLabel: itemLabel(itemId), personName: asString(person.name, person.id) }
    });
    return { frame, text: realizeDialoguePrompt(frame) };
}

function requestLocatePartService(person, itemId) {
    const safeItemId = asString(itemId, 'unknown_part');
    const conversationId = locateItemConversationId(person.id, safeItemId);
    const label = itemLabel(safeItemId);
    ensureDialogueConversation({
        conversationId,
        conversationType: DIALOGUE_CONVERSATION_TYPES.LOCATE_ITEM,
        ownerPersonId: person.id,
        subjectId: 'player',
        topic: { itemId: safeItemId }
    });
    const currentDialogueState = getLocateItemDialogueState(person.id, safeItemId);
    const playerPrompt = buildLocateItemPlayerPrompt({
        intent: DIALOGUE_INTENTS.REQUEST_LOCATE_ITEM,
        person,
        itemId: safeItemId,
        dialogueState: currentDialogueState.state
    });
    const playerPart = addPlayerUtterance(
        conversationId,
        playerPrompt.text,
        { action: 'askNpcToFindPart', itemId: safeItemId, dialogueFrame: playerPrompt.frame }
    );
    const intentPart = addDialogueConversationPart({
        conversationId,
        partType: DIALOGUE_PART_TYPES.INTENT,
        speakerType: DIALOGUE_SPEAKER_TYPES.PLAYER,
        speakerId: 'player',
        subjectId: person.id,
        intent: 'request_locate_item',
        payload: {
            command: 'askNpcToFindPart',
            ownerPersonId: person.id,
            requesterId: 'player',
            itemId: safeItemId
        },
        causedByPartId: playerPart.id
    });
    const realized = buildLocateItemResponse({
        intent: DIALOGUE_INTENTS.REQUEST_LOCATE_ITEM,
        person,
        itemId: safeItemId,
        dialogueState: currentDialogueState.state
    });
    const responseText = realized.text;
    const responsePart = addPersonUtterance(
        conversationId,
        person.id,
        responseText,
        { itemId: safeItemId, intentPartId: intentPart.id, dialogueFrame: realized.frame }
    );
    applyDialogueRelationshipDelta(person.id, { trust: 0, familiarity: 1, tags: ['asked_to_find_part'], reason: 'locate_item_request' });
    const memoryProposalPart = addDialogueConversationPart({
        conversationId,
        partType: DIALOGUE_PART_TYPES.PROPOSAL,
        speakerType: DIALOGUE_SPEAKER_TYPES.SYSTEM,
        speakerId: 'dialogue',
        subjectId: person.id,
        intent: 'remember_customer_request',
        payload: {
            type: 'remember_customer_request',
            authority: 'memory',
            memoryType: DIALOGUE_MEMORY_TYPES.CUSTOMER_REQUEST,
            ownerPersonId: person.id,
            subjectId: 'player',
            itemId: safeItemId,
            salience: DIALOGUE_MEMORY_SALIENCE.HIGH
        },
        causedByPartId: responsePart.id
    });
    const memoryProposal = createDialogueProposal({
        conversationId,
        proposalPartId: memoryProposalPart.id,
        authority: DIALOGUE_PROPOSAL_AUTHORITIES.MEMORY,
        proposalType: 'remember_customer_request',
        payload: memoryProposalPart.payload
    });
    const memory = createOrReinforceDialogueMemory({
        ownerPersonId: person.id,
        subjectId: 'player',
        memoryType: DIALOGUE_MEMORY_TYPES.CUSTOMER_REQUEST,
        conversationId,
        causedByPartId: memoryProposalPart.id,
        text: `Player asked me to find a ${label}.`,
        data: { requestedItem: safeItemId, itemId: safeItemId },
        salience: DIALOGUE_MEMORY_SALIENCE.HIGH
    });
    if (memory) acceptDialogueProposal(memoryProposal.id);
    else rejectDialogueProposal(memoryProposal.id, 'memory authority rejected');
    const memoryEffectPart = addDialogueConversationPart({
        conversationId,
        partType: DIALOGUE_PART_TYPES.EFFECT,
        speakerType: DIALOGUE_SPEAKER_TYPES.SYSTEM,
        speakerId: 'memory',
        subjectId: person.id,
        intent: 'dialogue_memory_recorded',
        payload: {
            proposalPartId: memoryProposalPart.id,
            proposalId: memoryProposal.id,
            memoryId: memory.id,
            memoryType: memory.memoryType,
            duplicateMemory: memory.reinforcementCount > 1
        },
        causedByPartId: memoryProposalPart.id
    });
    commitDialogueProposal(memoryProposal.id, { effectPartId: memoryEffectPart.id, payload: { memoryId: memory.id } });
    const proposalPart = addDialogueConversationPart({
        conversationId,
        partType: DIALOGUE_PART_TYPES.PROPOSAL,
        speakerType: DIALOGUE_SPEAKER_TYPES.SYSTEM,
        speakerId: 'dialogue',
        subjectId: person.id,
        intent: 'create_dialogue_task',
        payload: {
            type: 'create_dialogue_task',
            authority: 'dialogue_task',
            taskType: DIALOGUE_TASK_TYPES.LOCATE_ITEM,
            ownerPersonId: person.id,
            requesterId: 'player',
            itemId: safeItemId,
            intervalHours: 6
        },
        causedByPartId: responsePart.id
    });
    const taskProposal = createDialogueProposal({
        conversationId,
        proposalPartId: proposalPart.id,
        authority: DIALOGUE_PROPOSAL_AUTHORITIES.DIALOGUE_TASK,
        proposalType: 'create_dialogue_task',
        payload: proposalPart.payload
    });
    const task = createLocateItemDialogueTask({
        ownerPersonId: person.id,
        requesterId: 'player',
        itemId: safeItemId,
        conversationId,
        causedByPartId: proposalPart.id
    });
    if (task) acceptDialogueProposal(taskProposal.id);
    else rejectDialogueProposal(taskProposal.id, 'task authority rejected');
    touchDialogueConversation(conversationId, {
        conversationType: DIALOGUE_CONVERSATION_TYPES.LOCATE_ITEM,
        ownerPersonId: person.id,
        subjectId: 'player',
        status: DIALOGUE_CONVERSATION_STATUSES.WAITING,
        topic: { itemId: safeItemId },
        relatedTaskIds: [task.id],
        relatedMemoryIds: [memory.id]
    });
    const effectPart = addDialogueConversationPart({
        conversationId,
        partType: DIALOGUE_PART_TYPES.EFFECT,
        speakerType: DIALOGUE_SPEAKER_TYPES.SYSTEM,
        speakerId: 'dialogue_task',
        subjectId: person.id,
        intent: 'dialogue_task_created',
        payload: {
            proposalPartId: proposalPart.id,
            proposalId: taskProposal.id,
            taskId: task.id,
            status: task.status,
            duplicateActiveTask: task.causedByPartId !== proposalPart.id
        },
        causedByPartId: proposalPart.id
    });
    commitDialogueProposal(taskProposal.id, { effectPartId: effectPart.id, payload: { taskId: task.id } });
    return {
        conversationId,
        playerPart,
        intentPart,
        responsePart,
        memoryProposalPart,
        memoryProposal,
        memory,
        memoryEffectPart,
        proposalPart,
        taskProposal,
        task,
        effectPart
    };
}


export function askNpcToFindPart(personId, itemId) {
    return requestContactService(personId, CONTACT_SERVICE_TYPES.PARTS, { itemId });
}

export function checkBackWithNpc(personId, itemId) {
    const person = ensurePerson(personId);
    const safeItemId = asString(itemId, 'unknown_part');
    if (!person) return false;
    const conversationId = locateItemConversationId(person.id, safeItemId);
    ensureDialogueConversation({
        conversationId,
        conversationType: DIALOGUE_CONVERSATION_TYPES.LOCATE_ITEM,
        ownerPersonId: person.id,
        subjectId: 'player',
        topic: { itemId: safeItemId }
    });
    const currentDialogueState = getLocateItemDialogueState(person.id, safeItemId);
    const playerPrompt = buildLocateItemPlayerPrompt({
        intent: DIALOGUE_INTENTS.CHECK_BACK_LOCATE_ITEM,
        person,
        itemId: safeItemId,
        dialogueState: currentDialogueState.state
    });
    const playerPart = addPlayerUtterance(
        conversationId,
        playerPrompt.text,
        { action: 'checkBackWithNpc', itemId: safeItemId, dialogueFrame: playerPrompt.frame }
    );
    const intentPart = addDialogueConversationPart({
        conversationId,
        partType: DIALOGUE_PART_TYPES.INTENT,
        speakerType: DIALOGUE_SPEAKER_TYPES.PLAYER,
        speakerId: 'player',
        subjectId: person.id,
        intent: DIALOGUE_INTENTS.CHECK_BACK_LOCATE_ITEM,
        payload: {
            command: 'checkBackWithNpc',
            ownerPersonId: person.id,
            requesterId: 'player',
            itemId: safeItemId
        },
        causedByPartId: playerPart.id
    });
    const realized = buildLocateItemResponse({
        intent: DIALOGUE_INTENTS.CHECK_BACK_LOCATE_ITEM,
        person,
        itemId: safeItemId,
        dialogueState: currentDialogueState.state
    });
    const responsePart = addPersonUtterance(
        conversationId,
        person.id,
        realized.text,
        { itemId: safeItemId, intentPartId: intentPart.id, dialogueFrame: realized.frame }
    );
    touchDialogueConversation(conversationId, {
        conversationType: DIALOGUE_CONVERSATION_TYPES.LOCATE_ITEM,
        ownerPersonId: person.id,
        subjectId: 'player',
        topic: { itemId: safeItemId }
    });
    applyDialogueRelationshipDelta(person.id, {
        trust: 0,
        familiarity: 1,
        tags: ['checked_locate_item_status'],
        reason: 'locate_item_check_back'
    });
    return {
        conversationId,
        playerPart,
        intentPart,
        responsePart,
        dialogueState: currentDialogueState.state,
        activeOffer: currentDialogueState.activeOffer,
        acceptedOffer: currentDialogueState.acceptedOffer,
        activeTask: currentDialogueState.activeTask,
        failedTask: currentDialogueState.failedTask,
        remembered: currentDialogueState.remembered
    };
}
