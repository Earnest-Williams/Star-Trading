import { BALANCE } from '../../constants.js';
import { state } from '../../state.js';
import { DIALOGUE_CONVERSATION_STATUSES, touchDialogueConversation } from './conversations.js';
import { addDialogueEvent, DIALOGUE_EVENT_TYPES } from './dialogueEvents.js';
import { DIALOGUE_MESSAGE_STATUSES } from './messages.js';

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
    return { day: Math.floor(absoluteMinute / BALANCE.DAY_MINUTES) + 1, minuteOfDay: absoluteMinute % BALANCE.DAY_MINUTES, absoluteMinute };
}

function hasActiveOffer(conversation) {
    return (state.dialogueOffers || []).some(offer => offer.conversationId === conversation.conversationId && offer.status === 'active');
}

function hasUnresolvedTask(conversation) {
    return (state.dialogueTasks || []).some(task => task.conversationId === conversation.conversationId && task.status === 'active');
}

function hasUnreadMessage(conversation) {
    return (state.dialogueMessages || []).some(message => message.conversationId === conversation.conversationId && message.status === DIALOGUE_MESSAGE_STATUSES.UNREAD);
}

export function archiveResolvedConversations(reason = 'daily maintenance') {
    const cutoff = currentAbsoluteMinute() - BALANCE.DAY_MINUTES;
    const archived = [];
    (state.dialogueConversations || []).filter(conversation => [
        DIALOGUE_CONVERSATION_STATUSES.RESOLVED,
        DIALOGUE_CONVERSATION_STATUSES.FAILED,
        DIALOGUE_CONVERSATION_STATUSES.CANCELLED
    ].includes(conversation.status))
        .filter(conversation => asInteger(conversation.updatedAt?.absoluteMinute, 0) <= cutoff)
        .filter(conversation => !hasActiveOffer(conversation) && !hasUnresolvedTask(conversation) && !hasUnreadMessage(conversation))
        .forEach(conversation => {
            touchDialogueConversation(conversation.conversationId, { status: DIALOGUE_CONVERSATION_STATUSES.ARCHIVED });
            archived.push(conversation);
            addDialogueEvent({
                eventType: DIALOGUE_EVENT_TYPES.DIALOGUE_CONVERSATION_ARCHIVED,
                sourceSystem: 'dialogue_maintenance',
                conversationId: conversation.conversationId,
                summary: { conversationId: conversation.conversationId, reason },
                timestamp: currentDialogueTimestamp()
            });
        });
    return archived;
}

export function pruneOldDialogueEvents() {
    const cutoff = currentAbsoluteMinute() - (BALANCE.DAY_MINUTES * 60);
    const before = (state.dialogueEventLog || []).length;
    state.dialogueEventLog = (state.dialogueEventLog || []).filter(event => asInteger(event.day, 1) * BALANCE.DAY_MINUTES + asInteger(event.minute, 0) >= cutoff
        || (event.conversationId && (state.dialogueConversations || []).some(conversation => conversation.conversationId === event.conversationId && conversation.status !== DIALOGUE_CONVERSATION_STATUSES.ARCHIVED)));
    return before - state.dialogueEventLog.length;
}

export function expireOldDialogueMessages() {
    const cutoff = currentAbsoluteMinute() - (BALANCE.DAY_MINUTES * 30);
    const expired = [];
    (state.dialogueMessages || []).filter(message => message.status === DIALOGUE_MESSAGE_STATUSES.READ)
        .filter(message => asInteger(message.createdAt?.absoluteMinute, 0) <= cutoff)
        .forEach(message => {
            message.status = DIALOGUE_MESSAGE_STATUSES.ARCHIVED;
            expired.push(message);
        });
    return expired;
}

export function runDialogueMaintenanceDaily(reason = 'daily tick') {
    const archived = archiveResolvedConversations(reason);
    const messages = expireOldDialogueMessages();
    const prunedEvents = pruneOldDialogueEvents();
    addDialogueEvent({
        eventType: DIALOGUE_EVENT_TYPES.DIALOGUE_MAINTENANCE_RUN,
        sourceSystem: 'dialogue_maintenance',
        summary: { archived: archived.length, messages: messages.length, prunedEvents, reason },
        timestamp: currentDialogueTimestamp()
    });
    return { archived, messages, prunedEvents };
}
