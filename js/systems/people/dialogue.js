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
import { createLocateItemDialogueTask } from './dialogueTasks.js';
import { getActiveDialogueOffersForPlayer } from './offers.js';
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

export function askNpcToFindPart(personId, itemId) {
    const person = ensurePerson(personId);
    const safeItemId = asString(itemId, 'unknown_part');
    if (!person) return false;
    const conversationId = `locate-item:${person.id}:${safeItemId}`;
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
    const activeOffer = getActiveDialogueOffersForPlayer()
        .find(offer => offer.ownerPersonId === person.id && offer.itemId === safeItemId);
    const acceptedOffer = (state.dialogueOffers || [])
        .find(offer => offer.ownerPersonId === person.id && offer.itemId === safeItemId && offer.status === 'accepted');
    const activeTask = (state.dialogueTasks || [])
        .find(task => task.ownerPersonId === person.id && task.itemId === safeItemId && task.status === 'active');
    const failedTask = (state.dialogueTasks || [])
        .find(task => task.ownerPersonId === person.id && task.itemId === safeItemId && task.status === 'failed');
    const remembered = getActiveCustomerRequests({ ownerPersonId: person.id, subjectId: 'player', itemId: safeItemId }).length > 0;
    let responseText = `No stock today, but I can ask around for a ${label}.`;
    if (activeOffer) responseText = `I already found a ${label}; check Communications when you are ready.`;
    else if (acceptedOffer) responseText = `You already picked up that ${label}. Ask again if you need another.`;
    else if (activeTask || remembered) responseText = `I am still looking for that ${label}. I will send word when I have news.`;
    else if (failedTask) responseText = `I struck out last time, but I can ask around for a ${label} again.`;
    const responsePart = addPersonUtterance(
        conversationId,
        person.id,
        responseText,
        { itemId: safeItemId, intentPartId: intentPart.id }
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
            taskType: 'locate_item',
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
