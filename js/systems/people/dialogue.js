import {
    DIALOGUE_PART_TYPES,
    DIALOGUE_SPEAKER_TYPES,
    addDialogueConversationPart,
    addPersonUtterance,
    addPlayerUtterance
} from './conversationParts.js';
import { createLocateItemDialogueTask } from './dialogueTasks.js';
import {
    DIALOGUE_MEMORY_SALIENCE,
    DIALOGUE_MEMORY_TYPES,
    createOrReinforceDialogueMemory
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
    const responsePart = addPersonUtterance(
        conversationId,
        person.id,
        `No stock today, but I can ask around for a ${label}.`,
        { itemId: safeItemId, intentPartId: intentPart.id }
    );
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
    const memoryEffectPart = addDialogueConversationPart({
        conversationId,
        partType: DIALOGUE_PART_TYPES.EFFECT,
        speakerType: DIALOGUE_SPEAKER_TYPES.SYSTEM,
        speakerId: 'memory',
        subjectId: person.id,
        intent: 'dialogue_memory_recorded',
        payload: {
            proposalPartId: memoryProposalPart.id,
            memoryId: memory.id,
            memoryType: memory.memoryType,
            duplicateMemory: memory.reinforcementCount > 1
        },
        causedByPartId: memoryProposalPart.id
    });
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
    const task = createLocateItemDialogueTask({
        ownerPersonId: person.id,
        requesterId: 'player',
        itemId: safeItemId,
        conversationId,
        causedByPartId: proposalPart.id
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
            taskId: task.id,
            status: task.status,
            duplicateActiveTask: task.causedByPartId !== proposalPart.id
        },
        causedByPartId: proposalPart.id
    });
    return {
        conversationId,
        playerPart,
        intentPart,
        responsePart,
        memoryProposalPart,
        memory,
        memoryEffectPart,
        proposalPart,
        task,
        effectPart
    };
}
