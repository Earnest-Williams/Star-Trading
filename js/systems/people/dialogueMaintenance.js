import { BALANCE } from '../../config/economy.js';
import { state } from '../../state.js';
import { DIALOGUE_CONVERSATION_STATUSES, touchDialogueConversation } from './conversations.js';
import { addDialogueEvent, DIALOGUE_EVENT_TYPES } from './dialogueEvents.js';
import { DIALOGUE_MESSAGE_STATUSES } from './messages.js';
import { DIALOGUE_OFFER_STATUSES } from './offers.js';
import { DIALOGUE_TASK_STATUSES } from './dialogueTasks.js';

const RESOLVED_CONVERSATION_ARCHIVE_DELAY_DAYS = 1;
const EVENT_LOG_RETENTION_DAYS = 60;
const MESSAGE_RETENTION_DAYS = 30;

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

function toAbsoluteMinute(day, minuteOfDay) {
    return (asInteger(day, 1) - 1) * BALANCE.DAY_MINUTES + asInteger(minuteOfDay, 0);
}

function currentDialogueTimestamp() {
    const absoluteMinute = currentAbsoluteMinute();
    return { day: Math.floor(absoluteMinute / BALANCE.DAY_MINUTES) + 1, minuteOfDay: absoluteMinute % BALANCE.DAY_MINUTES, absoluteMinute };
}

function hasActiveOffer(conversation) {
    return (state.dialogueOffers || []).some(offer => offer.conversationId === conversation.conversationId
        && offer.status === DIALOGUE_OFFER_STATUSES.ACTIVE);
}

function hasUnresolvedTask(conversation) {
    return (state.dialogueTasks || []).some(task => task.conversationId === conversation.conversationId
        && task.status === DIALOGUE_TASK_STATUSES.ACTIVE);
}

function hasUnreadMessage(conversation) {
    return (state.dialogueMessages || []).some(message => message.conversationId === conversation.conversationId && message.status === DIALOGUE_MESSAGE_STATUSES.UNREAD);
}

export function archiveResolvedConversations(reason = 'daily maintenance') {
    const cutoff = currentAbsoluteMinute() - (BALANCE.DAY_MINUTES * RESOLVED_CONVERSATION_ARCHIVE_DELAY_DAYS);
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
    const cutoff = currentAbsoluteMinute() - (BALANCE.DAY_MINUTES * EVENT_LOG_RETENTION_DAYS);
    const before = (state.dialogueEventLog || []).length;
    state.dialogueEventLog = (state.dialogueEventLog || []).filter(event => toAbsoluteMinute(event.day, event.minute) >= cutoff
        || (event.conversationId && (state.dialogueConversations || []).some(conversation => conversation.conversationId === event.conversationId && conversation.status !== DIALOGUE_CONVERSATION_STATUSES.ARCHIVED)));
    return before - state.dialogueEventLog.length;
}

export function expireOldDialogueMessages() {
    const cutoff = currentAbsoluteMinute() - (BALANCE.DAY_MINUTES * MESSAGE_RETENTION_DAYS);
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
