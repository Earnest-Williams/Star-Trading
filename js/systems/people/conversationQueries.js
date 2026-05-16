import { state } from '../../state.js';

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
        unreadCount: messages.filter(message => message.status === 'unread').length,
        activeOfferCount: offers.filter(offer => offer.status === 'active').length,
        activeTaskCount: tasks.filter(task => task.status === 'active').length,
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
        ...(state.dialogueEventLog || []).filter(event => event.conversationId === safeConversationId).map(event => ({ kind: 'event', timestamp: { day: event.day, minuteOfDay: event.minute, absoluteMinute: ((event.day || 1) - 1) * 1440 + (event.minute || 0) }, ...event }))
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
        tasks: (state.dialogueTasks || []).filter(task => task.requesterId === 'player' && task.status === 'active'),
        offers: (state.dialogueOffers || []).filter(offer => offer.recipientId === 'player' && offer.status === 'active'),
        memories: (state.dialogueMemories || []).filter(memory => memory.subjectId === 'player' && memory.status === 'active')
    };
}

export function getPersonConversationHistory(personId) {
    const safePersonId = asString(personId, '');
    if (safePersonId.length === 0) return [];
    return (state.dialogueConversations || []).filter(conversation => conversation.ownerPersonId === safePersonId || conversation.subjectId === safePersonId)
        .sort((a, b) => asInteger(b.updatedAt?.absoluteMinute, 0) - asInteger(a.updatedAt?.absoluteMinute, 0));
}

export function getUnreadDialogueMessageCountByConversation() {
    return (state.dialogueMessages || []).filter(message => message.status === 'unread').reduce((counts, message) => {
        counts[message.conversationId] = (counts[message.conversationId] || 0) + 1;
        return counts;
    }, {});
}

export function getContactDialogueActionState(personId, itemId) {
    const safePersonId = asString(personId, '');
    const safeItemId = asString(itemId, 'unknown_part');
    const activeTask = (state.dialogueTasks || []).find(task => task.ownerPersonId === safePersonId && task.requesterId === 'player' && task.taskType === 'locate_item' && task.itemId === safeItemId && task.status === 'active');
    if (activeTask) return { state: 'looking', label: `Looking for ${safeItemId.replaceAll('_', ' ')}`, disabled: true, taskId: activeTask.id };
    const activeOffer = (state.dialogueOffers || []).find(offer => offer.ownerPersonId === safePersonId && offer.recipientId === 'player' && offer.itemId === safeItemId && offer.status === 'active');
    if (activeOffer) return { state: 'offer_ready', label: 'Offer ready', disabled: false, offerId: activeOffer.id };
    const acceptedOffer = (state.dialogueOffers || []).find(offer => offer.ownerPersonId === safePersonId && offer.recipientId === 'player' && offer.itemId === safeItemId && offer.status === 'accepted');
    if (acceptedOffer) return { state: 'found_already', label: 'Found already', disabled: false, offerId: acceptedOffer.id };
    const failedTask = (state.dialogueTasks || []).find(task => task.ownerPersonId === safePersonId && task.requesterId === 'player' && task.taskType === 'locate_item' && task.itemId === safeItemId && task.status === 'failed');
    if (failedTask) return { state: 'ask_again', label: 'Ask again', disabled: false, taskId: failedTask.id };
    return { state: 'find', label: `Find ${safeItemId.replaceAll('_', ' ')}`, disabled: false };
}
