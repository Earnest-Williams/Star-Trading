import { BALANCE } from '../../constants.js';
import { addWorldEvent } from '../../core/worldEvents.js';
import { state } from '../../state.js';
import { normaliseDialogueTables } from './conversationParts.js';
import { touchDialogueConversation } from './conversations.js';

export const DIALOGUE_MESSAGE_STATUSES = Object.freeze({
    UNREAD: 'unread',
    READ: 'read',
    ARCHIVED: 'archived'
});

const MESSAGE_STATUS_VALUES = Object.values(DIALOGUE_MESSAGE_STATUSES);

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value, fallback = '') {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function asNullableString(value) {
    const text = asString(value, '');
    return text.length > 0 ? text : null;
}

function asInteger(value, fallback) {
    const number = Number(value);
    return Number.isInteger(number) ? number : fallback;
}

function currentDialogueTimestamp() {
    const day = asInteger(state.player?.time?.day, 1);
    const minuteOfDay = asInteger(state.player?.time?.minuteOfDay, 0);
    return {
        day,
        minuteOfDay,
        absoluteMinute: (day - 1) * BALANCE.DAY_MINUTES + minuteOfDay
    };
}

function takeNextId() {
    if (!Number.isInteger(state.nextDialogueMessageId) || state.nextDialogueMessageId < 1) {
        state.nextDialogueMessageId = 1;
    }
    const id = state.nextDialogueMessageId;
    state.nextDialogueMessageId += 1;
    return id;
}

function normaliseStatus(value) {
    const status = asString(value, DIALOGUE_MESSAGE_STATUSES.UNREAD);
    return MESSAGE_STATUS_VALUES.includes(status) ? status : DIALOGUE_MESSAGE_STATUSES.UNREAD;
}

export function normaliseDialogueMessage(message, fallbackId = 1) {
    const timestamp = isObject(message?.createdAt) ? message.createdAt : {};
    return {
        id: asInteger(message?.id, fallbackId),
        conversationId: asString(message?.conversationId, 'default'),
        senderId: asNullableString(message?.senderId),
        recipientId: asString(message?.recipientId, 'player'),
        taskId: Number.isInteger(message?.taskId) ? message.taskId : null,
        subject: asString(message?.subject, 'Message'),
        text: asString(message?.text, ''),
        status: normaliseStatus(message?.status),
        createdAt: {
            day: asInteger(timestamp.day, 1),
            minuteOfDay: asInteger(timestamp.minuteOfDay, 0),
            absoluteMinute: asInteger(timestamp.absoluteMinute, 0)
        },
        readAt: isObject(message?.readAt) ? {
            day: asInteger(message.readAt.day, 1),
            minuteOfDay: asInteger(message.readAt.minuteOfDay, 0),
            absoluteMinute: asInteger(message.readAt.absoluteMinute, 0)
        } : null,
        payload: isObject(message?.payload) ? message.payload : {}
    };
}

export function normaliseDialogueMessages(target = state) {
    normaliseDialogueTables(target);
    target.dialogueMessages = target.dialogueMessages
        .map((message, index) => {
            const normalised = normaliseDialogueMessage(message, index + 1);
            if (isObject(message)) {
                Object.keys(message).forEach(key => delete message[key]);
                Object.assign(message, normalised);
                return message;
            }
            return normalised;
        })
        .sort((a, b) => b.createdAt.absoluteMinute - a.createdAt.absoluteMinute || b.id - a.id);
    const nextId = target.dialogueMessages.reduce((maxId, message) => Math.max(maxId, message.id), 0) + 1;
    if (!Number.isInteger(target.nextDialogueMessageId) || target.nextDialogueMessageId < nextId) {
        target.nextDialogueMessageId = nextId;
    }
}

export function createDialogueMessage({
    conversationId = 'default',
    senderId = null,
    recipientId = 'player',
    taskId = null,
    subject = 'Message',
    text = '',
    payload = {},
    createWorldEvent = true
} = {}) {
    const message = normaliseDialogueMessage({
        id: takeNextId(),
        conversationId,
        senderId,
        recipientId,
        taskId,
        subject,
        text,
        status: DIALOGUE_MESSAGE_STATUSES.UNREAD,
        createdAt: currentDialogueTimestamp(),
        readAt: null,
        payload
    });
    state.dialogueMessages.unshift(message);
    touchDialogueConversation(message.conversationId, {
        relatedMessageIds: [message.id],
        updatedAt: message.createdAt
    });
    if (createWorldEvent) {
        addWorldEvent({
            type: 'dialogue_message',
            text: `${message.subject}: ${message.text}`,
            importance: 2,
            alert: false
        });
    }
    return message;
}

export function markDialogueMessageRead(messageId) {
    const id = asInteger(messageId, null);
    const message = state.dialogueMessages.find(item => item.id === id);
    if (!message) return false;
    if (message.status === DIALOGUE_MESSAGE_STATUSES.READ) return message;
    message.status = DIALOGUE_MESSAGE_STATUSES.READ;
    message.readAt = currentDialogueTimestamp();
    return message;
}
