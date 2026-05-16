import { BALANCE } from '../../constants.js';
import { state } from '../../state.js';
import { touchDialogueConversation } from './conversations.js';
import { addDialogueEvent, DIALOGUE_EVENT_TYPES } from './dialogueEvents.js';
import { resolveDialogueMemory } from './memory.js';
import { applyDialogueRelationshipDelta } from './relationships.js';

export const DIALOGUE_OFFER_TYPES = Object.freeze({ LOCATED_ITEM: 'located_item' });
export const DIALOGUE_OFFER_STATUSES = Object.freeze({
    ACTIVE: 'active',
    ACCEPTED: 'accepted',
    REJECTED: 'rejected',
    EXPIRED: 'expired'
});

const OFFER_TYPE_VALUES = Object.values(DIALOGUE_OFFER_TYPES);
const OFFER_STATUS_VALUES = Object.values(DIALOGUE_OFFER_STATUSES);

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value, fallback = '') {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

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

function normaliseTimestamp(value, fallback = null) {
    const source = isObject(value) ? value : {};
    const fallbackSource = isObject(fallback) ? fallback : {};
    return {
        day: asInteger(source.day, asInteger(fallbackSource.day, 1)),
        minuteOfDay: asInteger(source.minuteOfDay, asInteger(fallbackSource.minuteOfDay, 0)),
        absoluteMinute: asInteger(source.absoluteMinute, asInteger(fallbackSource.absoluteMinute, 0))
    };
}

function takeNextId() {
    if (!Number.isInteger(state.nextDialogueOfferId) || state.nextDialogueOfferId < 1) state.nextDialogueOfferId = 1;
    const id = state.nextDialogueOfferId;
    state.nextDialogueOfferId += 1;
    return id;
}

function ensureStorage(target = state) {
    if (!Array.isArray(target.dialogueOffers)) target.dialogueOffers = [];
    if (!Number.isInteger(target.nextDialogueOfferId) || target.nextDialogueOfferId < 1) target.nextDialogueOfferId = 1;
}

function normaliseOfferType(value) {
    const type = asString(value, DIALOGUE_OFFER_TYPES.LOCATED_ITEM);
    return OFFER_TYPE_VALUES.includes(type) ? type : DIALOGUE_OFFER_TYPES.LOCATED_ITEM;
}

function normaliseStatus(value) {
    const status = asString(value, DIALOGUE_OFFER_STATUSES.ACTIVE);
    return OFFER_STATUS_VALUES.includes(status) ? status : DIALOGUE_OFFER_STATUSES.ACTIVE;
}

function nextNumericIdForTable(records) {
    return records.reduce((maxId, record) => Math.max(maxId, asInteger(record?.id, 0)), 0) + 1;
}

function emitOfferEvent(offer, eventType, extra = {}) {
    const ts = currentDialogueTimestamp();
    touchDialogueConversation(offer.conversationId, { relatedOfferIds: [offer.id], updatedAt: ts });
    addDialogueEvent({
        eventType,
        sourceSystem: 'dialogue_offer',
        actor: offer.ownerPersonId,
        subject: offer.recipientId,
        conversationId: offer.conversationId,
        taskId: offer.taskId,
        causedBy: { conversationId: offer.conversationId, taskId: offer.taskId, offerId: offer.id },
        summary: { offerId: offer.id, itemId: offer.itemId, price: offer.price, status: offer.status, ...extra },
        payload: { offerId: offer.id, ...extra },
        timestamp: ts
    });
}

export function normaliseDialogueOffer(offer, fallbackId = 1) {
    const createdAt = normaliseTimestamp(offer?.createdAt, currentDialogueTimestamp());
    return {
        id: asInteger(offer?.id, fallbackId),
        offerType: normaliseOfferType(offer?.offerType),
        conversationId: asString(offer?.conversationId, 'default'),
        taskId: asInteger(offer?.taskId, null),
        ownerPersonId: asString(offer?.ownerPersonId, 'unknown-person'),
        recipientId: asString(offer?.recipientId, 'player'),
        itemId: asString(offer?.itemId, 'unknown_part'),
        price: Math.max(0, asInteger(offer?.price, 0)),
        status: normaliseStatus(offer?.status),
        createdAt,
        expiresAtAbsoluteMinute: asInteger(offer?.expiresAtAbsoluteMinute, createdAt.absoluteMinute + BALANCE.DAY_MINUTES),
        resolvedAt: isObject(offer?.resolvedAt) ? normaliseTimestamp(offer.resolvedAt, createdAt) : null,
        payload: isObject(offer?.payload) ? offer.payload : {}
    };
}

export function normaliseDialogueOffers(target = state) {
    ensureStorage(target);
    target.dialogueOffers = target.dialogueOffers.filter(isObject).map((offer, index) => {
        const normalised = normaliseDialogueOffer(offer, index + 1);
        Object.keys(offer).forEach(key => delete offer[key]);
        Object.assign(offer, normalised);
        return offer;
    }).sort((a, b) => a.createdAt.absoluteMinute - b.createdAt.absoluteMinute || a.id - b.id);
    const nextId = nextNumericIdForTable(target.dialogueOffers);
    if (!Number.isInteger(target.nextDialogueOfferId) || target.nextDialogueOfferId < nextId) target.nextDialogueOfferId = nextId;
}

export function createDialogueOffer({
    conversationId = 'default', taskId = null, ownerPersonId = 'unknown-person', recipientId = 'player',
    itemId = 'unknown_part', price = 0, payload = {}, expiresAtAbsoluteMinute = null
} = {}) {
    ensureStorage();
    const timestamp = currentDialogueTimestamp();
    const offer = normaliseDialogueOffer({
        id: takeNextId(), offerType: DIALOGUE_OFFER_TYPES.LOCATED_ITEM, conversationId, taskId, ownerPersonId,
        recipientId, itemId, price, status: DIALOGUE_OFFER_STATUSES.ACTIVE, createdAt: timestamp,
        expiresAtAbsoluteMinute: asInteger(expiresAtAbsoluteMinute, timestamp.absoluteMinute + BALANCE.DAY_MINUTES), payload
    });
    state.dialogueOffers.push(offer);
    emitOfferEvent(offer, DIALOGUE_EVENT_TYPES.DIALOGUE_OFFER_CREATED);
    return offer;
}

export function getDialogueOffer(offerId) {
    ensureStorage();
    const id = asInteger(offerId, null);
    return state.dialogueOffers.find(offer => offer.id === id) || null;
}

export function getDialogueOffersByConversationId(conversationId) {
    const safeConversationId = asString(conversationId, '');
    if (safeConversationId.length === 0) return [];
    return (state.dialogueOffers || []).filter(offer => offer.conversationId === safeConversationId);
}

export function getActiveDialogueOffersForPlayer() {
    return (state.dialogueOffers || []).filter(offer => offer.recipientId === 'player' && offer.status === DIALOGUE_OFFER_STATUSES.ACTIVE);
}

export function acceptDialogueOffer(offerId) {
    return acceptLocatedItemOffer(offerId);
}

export function rejectDialogueOffer(offerId, reason = 'player rejected') {
    const offer = getDialogueOffer(offerId);
    if (!offer || offer.status !== DIALOGUE_OFFER_STATUSES.ACTIVE) return false;
    offer.status = DIALOGUE_OFFER_STATUSES.REJECTED;
    offer.resolvedAt = currentDialogueTimestamp();
    offer.payload = { ...offer.payload, rejectionReason: asString(reason, 'player rejected') };
    applyDialogueRelationshipDelta(offer.ownerPersonId, { trust: -1, familiarity: 1, tags: ['offer_rejected'], reason: 'offer_rejected' });
    emitOfferEvent(offer, DIALOGUE_EVENT_TYPES.DIALOGUE_OFFER_REJECTED, { reason: offer.payload.rejectionReason });
    return offer;
}

export function expireDialogueOffers(reason = 'hourly tick') {
    const now = currentAbsoluteMinute();
    const expired = [];
    (state.dialogueOffers || []).filter(offer => offer.status === DIALOGUE_OFFER_STATUSES.ACTIVE)
        .filter(offer => offer.expiresAtAbsoluteMinute <= now)
        .forEach(offer => {
            offer.status = DIALOGUE_OFFER_STATUSES.EXPIRED;
            offer.resolvedAt = currentDialogueTimestamp();
            expired.push(offer);
            emitOfferEvent(offer, DIALOGUE_EVENT_TYPES.DIALOGUE_OFFER_EXPIRED, { reason });
        });
    return expired;
}

export function acceptLocatedItemOffer(offerId) {
    const offer = getDialogueOffer(offerId);
    if (!offer || offer.status !== DIALOGUE_OFFER_STATUSES.ACTIVE) return false;
    if (offer.offerType !== DIALOGUE_OFFER_TYPES.LOCATED_ITEM || offer.recipientId !== 'player') return false;
    if (offer.expiresAtAbsoluteMinute <= currentAbsoluteMinute()) {
        expireDialogueOffers('accept expired offer');
        return false;
    }
    const task = (state.dialogueTasks || []).find(item => item.id === offer.taskId) || null;
    if (!task || task.status !== 'resolved') return false;
    if (offer.itemId === 'unknown_part') return false;
    if (Number(state.player?.credits || 0) < offer.price) return false;
    state.player.credits -= offer.price;
    if (!state.player.partsInventory || typeof state.player.partsInventory !== 'object') state.player.partsInventory = {};
    state.player.partsInventory[offer.itemId] = (Number(state.player.partsInventory[offer.itemId]) || 0) + 1;
    offer.status = DIALOGUE_OFFER_STATUSES.ACCEPTED;
    offer.resolvedAt = currentDialogueTimestamp();
    resolveDialogueMemory({ ownerPersonId: offer.ownerPersonId, subjectId: offer.recipientId, itemId: offer.itemId, conversationId: offer.conversationId });
    applyDialogueRelationshipDelta(offer.ownerPersonId, { trust: 2, familiarity: 1, tags: ['fulfilled_locate_item'], reason: 'offer_accepted' });
    emitOfferEvent(offer, DIALOGUE_EVENT_TYPES.DIALOGUE_OFFER_ACCEPTED);
    return offer;
}
