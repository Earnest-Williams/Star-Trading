import { BALANCE } from '../../constants.js';
import { state } from '../../state.js';
import { DIALOGUE_MEMORY_STATUSES, DIALOGUE_MEMORY_TYPES } from './memory.js';
import { DIALOGUE_MESSAGE_STATUSES } from './messages.js';
import { DIALOGUE_OFFER_STATUSES } from './offers.js';
import { DIALOGUE_TASK_STATUSES, DIALOGUE_TASK_TYPES } from './dialogueTasks.js';

function asString(value, fallback = '') {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function asInteger(value, fallback) {
    if (value === null || typeof value === 'undefined') return fallback;
    const number = Number(value);
    return Number.isInteger(number) ? number : fallback;
}

function byMinuteThenId(a, b) {
    const minuteDiff = asInteger(a.timestamp?.absoluteMinute ?? a.createdAt?.absoluteMinute, 0)
        - asInteger(b.timestamp?.absoluteMinute ?? b.createdAt?.absoluteMinute, 0);
    if (minuteDiff !== 0) return minuteDiff;
    return asInteger(a.id, 0) - asInteger(b.id, 0);
}

function toAbsoluteMinute(day, minuteOfDay) {
    return (asInteger(day, 1) - 1) * BALANCE.DAY_MINUTES + asInteger(minuteOfDay, 0);
}

export function getConversationSummary(conversationId) {
    const safeConversationId = asString(conversationId, '');
    const conversation = (state.dialogueConversations || []).find(item => item.conversationId === safeConversationId) || null;
    if (!conversation) return null;
    const parts = (state.dialogueConversationParts || []).filter(part => part.conversationId === safeConversationId);
    const messages = (state.dialogueMessages || []).filter(message => message.conversationId === safeConversationId);
    const offers = (state.dialogueOffers || []).filter(offer => offer.conversationId === safeConversationId);
    const tasks = (state.dialogueTasks || []).filter(task => task.conversationId === safeConversationId);
    const proposals = (state.dialogueProposals || []).filter(proposal => proposal.conversationId === safeConversationId);
    return {
        conversation,
        partCount: parts.length,
        unreadCount: messages.filter(message => message.status === DIALOGUE_MESSAGE_STATUSES.UNREAD).length,
        activeOfferCount: offers.filter(offer => offer.status === DIALOGUE_OFFER_STATUSES.ACTIVE).length,
        activeTaskCount: tasks.filter(task => task.status === DIALOGUE_TASK_STATUSES.ACTIVE).length,
        proposalCount: proposals.length,
        latestPart: parts.slice().sort(byMinuteThenId).at(-1) || null
    };
}

export function getConversationTimeline(conversationId) {
    const safeConversationId = asString(conversationId, '');
    return [
        ...(state.dialogueConversationParts || []).filter(part => part.conversationId === safeConversationId).map(part => ({ kind: 'part', ...part })),
        ...(state.dialogueMessages || []).filter(message => message.conversationId === safeConversationId).map(message => ({ kind: 'message', timestamp: message.createdAt, ...message })),
        ...(state.dialogueOffers || []).filter(offer => offer.conversationId === safeConversationId).map(offer => ({ kind: 'offer', timestamp: offer.createdAt, ...offer })),
        ...(state.dialogueEventLog || []).filter(event => event.conversationId === safeConversationId).map(event => ({
            kind: 'event',
            timestamp: {
                day: asInteger(event.day, 1),
                minuteOfDay: asInteger(event.minute, 0),
                absoluteMinute: toAbsoluteMinute(event.day, event.minute)
            },
            ...event
        }))
    ].sort(byMinuteThenId);
}

export function getDialogueDebugTrace(conversationId) {
    const safeConversationId = asString(conversationId, '');
    return {
        summary: getConversationSummary(safeConversationId),
        parts: (state.dialogueConversationParts || []).filter(part => part.conversationId === safeConversationId),
        proposals: (state.dialogueProposals || []).filter(proposal => proposal.conversationId === safeConversationId),
        tasks: (state.dialogueTasks || []).filter(task => task.conversationId === safeConversationId),
        memories: (state.dialogueMemories || []).filter(memory => memory.conversationId === safeConversationId),
        messages: (state.dialogueMessages || []).filter(message => message.conversationId === safeConversationId),
        offers: (state.dialogueOffers || []).filter(offer => offer.conversationId === safeConversationId),
        events: (state.dialogueEventLog || []).filter(event => event.conversationId === safeConversationId)
    };
}

export function getActiveDialoguePromisesForPlayer() {
    return {
        tasks: (state.dialogueTasks || []).filter(task => task.requesterId === 'player' && task.status === DIALOGUE_TASK_STATUSES.ACTIVE),
        offers: (state.dialogueOffers || []).filter(offer => offer.recipientId === 'player' && offer.status === DIALOGUE_OFFER_STATUSES.ACTIVE),
        memories: (state.dialogueMemories || []).filter(memory => memory.subjectId === 'player' && memory.status === DIALOGUE_MEMORY_STATUSES.ACTIVE)
    };
}

export function getPersonConversationHistory(personId) {
    const safePersonId = asString(personId, '');
    if (safePersonId.length === 0) return [];
    return (state.dialogueConversations || []).filter(conversation => conversation.ownerPersonId === safePersonId || conversation.subjectId === safePersonId)
        .sort((a, b) => asInteger(b.updatedAt?.absoluteMinute, 0) - asInteger(a.updatedAt?.absoluteMinute, 0));
}

export function getUnreadDialogueMessageCountByConversation() {
    return (state.dialogueMessages || []).filter(message => message.status === DIALOGUE_MESSAGE_STATUSES.UNREAD).reduce((counts, message) => {
        counts[message.conversationId] = (counts[message.conversationId] || 0) + 1;
        return counts;
    }, {});
}

export function getContactDialogueActionState(personId, itemId) {
    const safePersonId = asString(personId, '');
    const safeItemId = asString(itemId, 'unknown_part');
    const label = safeItemId.replaceAll('_', ' ');
    const activeTask = (state.dialogueTasks || []).find(task => task.ownerPersonId === safePersonId
        && task.requesterId === 'player'
        && task.taskType === DIALOGUE_TASK_TYPES.LOCATE_ITEM
        && task.itemId === safeItemId
        && task.status === DIALOGUE_TASK_STATUSES.ACTIVE);
    if (activeTask) {
        return {
            state: 'looking',
            label: `Check status: ${label}`,
            disabled: false,
            action: 'checkBackWithNpc',
            taskId: activeTask.id
        };
    }
    const activeOffer = (state.dialogueOffers || []).find(offer => offer.ownerPersonId === safePersonId
        && offer.recipientId === 'player'
        && offer.itemId === safeItemId
        && offer.status === DIALOGUE_OFFER_STATUSES.ACTIVE);
    if (activeOffer) {
        return {
            state: 'offer_ready',
            label: 'Review offer',
            disabled: false,
            action: 'checkBackWithNpc',
            offerId: activeOffer.id
        };
    }
    const acceptedOffer = (state.dialogueOffers || []).find(offer => offer.ownerPersonId === safePersonId
        && offer.recipientId === 'player'
        && offer.itemId === safeItemId
        && offer.status === DIALOGUE_OFFER_STATUSES.ACCEPTED);
    if (acceptedOffer) {
        return {
            state: 'found_already',
            label: 'Found already',
            disabled: false,
            action: 'checkBackWithNpc',
            offerId: acceptedOffer.id
        };
    }
    const failedTask = (state.dialogueTasks || []).find(task => task.ownerPersonId === safePersonId
        && task.requesterId === 'player'
        && task.taskType === DIALOGUE_TASK_TYPES.LOCATE_ITEM
        && task.itemId === safeItemId
        && task.status === DIALOGUE_TASK_STATUSES.FAILED);
    if (failedTask) {
        return {
            state: 'ask_again',
            label: 'Ask again',
            disabled: false,
            action: 'askNpcToFindPart',
            taskId: failedTask.id
        };
    }
    const activeMemory = (state.dialogueMemories || []).find(memory => memory.ownerPersonId === safePersonId
        && memory.subjectId === 'player'
        && memory.memoryType === DIALOGUE_MEMORY_TYPES.CUSTOMER_REQUEST
        && (memory.data?.itemId === safeItemId || memory.data?.requestedItem === safeItemId)
        && memory.status === DIALOGUE_MEMORY_STATUSES.ACTIVE);
    if (activeMemory) {
        return {
            state: 'remembered_request',
            label: `Check status: ${label}`,
            disabled: false,
            action: 'checkBackWithNpc',
            memoryId: activeMemory.id
        };
    }
    return { state: 'find', label: `Find ${label}`, disabled: false, action: 'askNpcToFindPart' };
}
