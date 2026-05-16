import { BALANCE } from '../../constants.js';
import { state } from '../../state.js';
import { addDialogueEvent, DIALOGUE_EVENT_TYPES } from './dialogueEvents.js';
import { normaliseRelationshipAffect } from './dialogueVoice.js';

function asInteger(value, fallback) {
    if (value === null || typeof value === 'undefined') return fallback;
    const number = Number(value);
    return Number.isInteger(number) ? number : fallback;
}

function asString(value, fallback = '') {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function currentDialogueTimestamp() {
    const absoluteMinute = ((asInteger(state.player?.time?.day, 1) - 1) * BALANCE.DAY_MINUTES)
        + asInteger(state.player?.time?.minuteOfDay, 0);
    return {
        day: Math.floor(absoluteMinute / BALANCE.DAY_MINUTES) + 1,
        minuteOfDay: absoluteMinute % BALANCE.DAY_MINUTES,
        absoluteMinute
    };
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
}

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function normaliseDialogueRelationship(relationship = {}) {
    const source = isObject(relationship) ? relationship : {};
    const tags = Array.isArray(source.tags)
        ? [...new Set(source.tags.filter(tag => typeof tag === 'string' && tag.length > 0))]
        : [];
    return {
        trust: clamp(source.trust, -100, 100),
        familiarity: Math.max(0, Number(source.familiarity) || 0),
        lastInteractionAt: source.lastInteractionAt || null,
        tags,
        affect: normaliseRelationshipAffect(source.affect)
    };
}

export function getDialogueRelationship(personId) {
    const safePersonId = asString(personId, '');
    const person = safePersonId.length > 0 ? state.people?.[safePersonId] : null;
    if (!person) return null;
    if (!person.relationships || typeof person.relationships !== 'object') person.relationships = {};
    person.relationships.player = normaliseDialogueRelationship(person.relationships.player || {});
    return person.relationships.player;
}

export function applyDialogueRelationshipDelta(personId, { trust = 0, familiarity = 0, tags = [], affect = {}, reason = 'dialogue' } = {}) {
    const relationship = getDialogueRelationship(personId);
    if (!relationship) return false;
    relationship.trust = clamp(relationship.trust + Number(trust || 0), -100, 100);
    relationship.familiarity = Math.max(0, relationship.familiarity + Number(familiarity || 0));
    const safeTags = Array.isArray(tags) ? tags : [];
    safeTags.filter(tag => typeof tag === 'string' && tag.length > 0).forEach(tag => {
        if (!relationship.tags.includes(tag)) relationship.tags.push(tag);
    });
    const affectDelta = normaliseRelationshipAffect(affect);
    relationship.affect = normaliseRelationshipAffect({
        warmth: relationship.affect.warmth + affectDelta.warmth,
        irritation: relationship.affect.irritation + affectDelta.irritation,
        respect: relationship.affect.respect + affectDelta.respect,
        suspicion: relationship.affect.suspicion + affectDelta.suspicion
    });
    relationship.lastInteractionAt = currentDialogueTimestamp();
    addDialogueEvent({
        eventType: DIALOGUE_EVENT_TYPES.DIALOGUE_RELATIONSHIP_CHANGED,
        sourceSystem: 'relationship',
        actor: personId,
        subject: 'player',
        summary: { personId, trust: relationship.trust, familiarity: relationship.familiarity, affect: relationship.affect, reason },
        payload: { personId, trustDelta: trust, familiarityDelta: familiarity, affect: affectDelta, tags: safeTags, reason },
        timestamp: relationship.lastInteractionAt
    });
    return relationship;
}
