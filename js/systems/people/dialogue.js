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
import { DIALOGUE_TASK_STATUSES, DIALOGUE_TASK_TYPES, createLocateItemDialogueTask } from './dialogueTasks.js';
import { buildDialogueFrame, realizeDialogueLine } from './dialogueRealization.js';
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
        tone: 'neutral',
        slots: { itemLabel: itemLabel(itemId), personName: asString(person.name, person.id) }
    });
    return { frame, text: realizeDialogueLine(frame) };
}

export function askNpcToFindPart(personId, itemId) {
    const person = ensurePerson(personId);
    const safeItemId = asString(itemId, 'unknown_part');
    if (!person) return false;
    const conversationId = locateItemConversationId(person.id, safeItemId);
    const label = itemLabel(safeItemId);
    ensureDialogueConversation({
        conversationId,
        conversationType: DIALOGUE_CONVERSATION_TYPES.LOCATE_ITEM,
        ownerPersonId: person.id,
        subjectId: 'player',
        topic: { itemId: safeItemId }
    });
    const playerPart = addPlayerUtterance(
        conversationId,
        `Can you find a ${label} for me?`,
        { action: 'askNpcToFindPart', itemId: safeItemId }
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
    const currentDialogueState = getLocateItemDialogueState(person.id, safeItemId);
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


export function checkBackWithNpc(personId, itemId) {
    const person = ensurePerson(personId);
    const safeItemId = asString(itemId, 'unknown_part');
    if (!person) return false;
    const conversationId = locateItemConversationId(person.id, safeItemId);
    const label = itemLabel(safeItemId);
    ensureDialogueConversation({
        conversationId,
        conversationType: DIALOGUE_CONVERSATION_TYPES.LOCATE_ITEM,
        ownerPersonId: person.id,
        subjectId: 'player',
        topic: { itemId: safeItemId }
    });
    const playerPart = addPlayerUtterance(
        conversationId,
        `Any news on that ${label}?`,
        { action: 'checkBackWithNpc', itemId: safeItemId }
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
    const currentDialogueState = getLocateItemDialogueState(person.id, safeItemId);
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
