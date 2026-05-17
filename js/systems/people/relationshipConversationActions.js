import { state } from '../../state.js';
import {
    DIALOGUE_PART_TYPES,
    DIALOGUE_SPEAKER_TYPES,
    addDialogueConversationPart,
    addPlayerUtterance
} from './conversationParts.js';
import {
    DIALOGUE_CONVERSATION_STATUSES,
    DIALOGUE_CONVERSATION_TYPES,
    ensureDialogueConversation,
    touchDialogueConversation
} from './conversations.js';
import { buildDialogueFrame, realizeDialogueLine, realizeDialoguePrompt } from './dialogueRealization.js';
import { DIALOGUE_FRAME_STATES, DIALOGUE_INTENTS } from './dialogueTemplates.js';
import {
    applyDialogueRelationshipDelta,
    getDialogueRelationship,
    normaliseDialogueRelationship
} from './relationships.js';

export const MIN_DEEPEN_FAMILIARITY = 2;
const TOPIC_DELTAS = Object.freeze({
    check_in: Object.freeze({ affect: { warmth: 1 }, state: DIALOGUE_FRAME_STATES.GETTING_FAMILIAR }),
    stories: Object.freeze({ affect: { respect: 1 }, state: DIALOGUE_FRAME_STATES.PERSONAL_INTEREST }),
    work: Object.freeze({ affect: { respect: 1 }, state: DIALOGUE_FRAME_STATES.GETTING_FAMILIAR }),
    comfort: Object.freeze({ affect: { warmth: 1 }, state: DIALOGUE_FRAME_STATES.REASSURANCE }),
    vulnerability: Object.freeze({ affect: { warmth: 1 }, state: DIALOGUE_FRAME_STATES.PERSONAL_INTEREST }),
    flirt: Object.freeze({ affect: { attraction: 1 }, state: DIALOGUE_FRAME_STATES.FLIRTING }),
    romance: Object.freeze({ affect: { attraction: 1 }, state: DIALOGUE_FRAME_STATES.ROMANTIC_TENSION })
});
const INTIMATE_TOPIC_REQUIREMENTS = Object.freeze({
    flirt: Object.freeze({ trust: 10, affectKey: 'attraction', affect: 5 }),
    romance: Object.freeze({ trust: 20, affectKey: 'attraction', affect: 20 }),
    vulnerability: Object.freeze({ trust: 5, affectKey: 'warmth', affect: 5 })
});
const DEFAULT_TOPIC_TAG = 'check_in';

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value, fallback = '') {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function ensurePerson(personId) {
    const id = asString(personId, '');
    return id.length > 0 ? state.people?.[id] || null : null;
}

function currentSectorId() {
    const sectorId = Number(state.player?.currentSector);
    return Number.isInteger(sectorId) ? sectorId : null;
}

function isKnownLocalContact(person) {
    if (!isObject(person)) return false;
    if (person.known === true) return true;
    const sectorId = currentSectorId();
    if (sectorId === null) return true;
    return Number(person.sectorId) === sectorId;
}

function relationshipConversationId(personId) {
    return `relationship:${personId}`;
}

function personLabel(person) {
    return asString(person?.name, asString(person?.id, 'contact'));
}

function normaliseTopicTag(topicTag) {
    const tag = asString(topicTag, DEFAULT_TOPIC_TAG);
    return Object.hasOwn(TOPIC_DELTAS, tag) ? tag : DEFAULT_TOPIC_TAG;
}

function startChatState(relationship) {
    return relationship.familiarity >= MIN_DEEPEN_FAMILIARITY
        ? DIALOGUE_FRAME_STATES.GETTING_FAMILIAR
        : DIALOGUE_FRAME_STATES.CASUAL_OPEN;
}

function topicState(topicTag) {
    return TOPIC_DELTAS[topicTag]?.state || DIALOGUE_FRAME_STATES.GETTING_FAMILIAR;
}

function hasDeepenAccess(relationship, topicTag) {
    if (relationship.familiarity < MIN_DEEPEN_FAMILIARITY) {
        return { ok: false, reason: 'needs_familiarity' };
    }
    const requirement = INTIMATE_TOPIC_REQUIREMENTS[topicTag];
    if (!requirement) return { ok: true, reason: 'available' };
    const affectValue = Number(relationship.affect?.[requirement.affectKey] || 0);
    if (relationship.trust < requirement.trust || affectValue < requirement.affect) {
        return { ok: false, reason: 'needs_trust_or_affect' };
    }
    return { ok: true, reason: 'available' };
}

function buildRelationshipFrame({ intent, person, dialogueState, topicTag = DEFAULT_TOPIC_TAG }) {
    return buildDialogueFrame(intent, {
        actorId: 'player',
        ownerPersonId: person.id,
        subjectId: 'player',
        state: dialogueState,
        slots: {
            personName: personLabel(person),
            topicTag
        }
    });
}

function affectDifference(before = {}, after = {}) {
    const keys = ['warmth', 'respect', 'resentment', 'fear', 'envy', 'jealousy', 'attraction'];
    return keys.reduce((diff, key) => {
        const delta = Number(after[key] || 0) - Number(before[key] || 0);
        if (delta !== 0) diff[key] = delta;
        return diff;
    }, {});
}

function relationshipDifference(before, after, reason, tags = []) {
    return {
        trust: Number(after.trust || 0) - Number(before.trust || 0),
        familiarity: Number(after.familiarity || 0) - Number(before.familiarity || 0),
        affect: affectDifference(before.affect, after.affect),
        tags: tags.filter(tag => !before.tags.includes(tag) && after.tags.includes(tag)),
        reason
    };
}

function failResult(personId, reason) {
    return {
        ok: false,
        personId: asString(personId, ''),
        conversationId: null,
        playerLine: '',
        npcLine: '',
        relationshipDelta: null,
        stateChanged: false,
        reason
    };
}

function runRelationshipConversation({ person, intent, dialogueState, topicTag, delta }) {
    const conversationId = relationshipConversationId(person.id);
    ensureDialogueConversation({
        conversationId,
        conversationType: DIALOGUE_CONVERSATION_TYPES.GENERAL,
        ownerPersonId: person.id,
        subjectId: 'player',
        status: DIALOGUE_CONVERSATION_STATUSES.OPEN,
        topic: { intent, topicTag }
    });
    const frame = buildRelationshipFrame({ intent, person, dialogueState, topicTag });
    const playerLine = realizeDialoguePrompt(frame);
    const playerPart = addPlayerUtterance(conversationId, playerLine, {
        action: intent,
        topicTag,
        dialogueFrame: frame
    });
    const intentPart = addDialogueConversationPart({
        conversationId,
        partType: DIALOGUE_PART_TYPES.INTENT,
        speakerType: DIALOGUE_SPEAKER_TYPES.PLAYER,
        speakerId: 'player',
        subjectId: person.id,
        intent,
        payload: {
            command: intent,
            ownerPersonId: person.id,
            requesterId: 'player',
            topicTag
        },
        causedByPartId: playerPart.id
    });
    const npcLine = realizeDialogueLine(frame);
    const responsePart = addDialogueConversationPart({
        conversationId,
        partType: DIALOGUE_PART_TYPES.NPC_UTTERANCE,
        speakerType: DIALOGUE_SPEAKER_TYPES.PERSON,
        speakerId: person.id,
        subjectId: 'player',
        text: npcLine,
        payload: {
            topicTag,
            intentPartId: intentPart.id,
            dialogueFrame: frame
        },
        causedByPartId: intentPart.id
    });
    const before = normaliseDialogueRelationship(getDialogueRelationship(person.id) || {});
    const relationship = applyDialogueRelationshipDelta(person.id, delta);
    if (!relationship) return failResult(person.id, 'relationship_mutation_failed');
    const after = normaliseDialogueRelationship(relationship);
    const relationshipDelta = relationshipDifference(before, after, delta.reason, delta.tags || []);
    const effectPart = addDialogueConversationPart({
        conversationId,
        partType: DIALOGUE_PART_TYPES.EFFECT,
        speakerType: DIALOGUE_SPEAKER_TYPES.SYSTEM,
        speakerId: 'relationship',
        subjectId: person.id,
        intent: 'dialogue_relationship_changed',
        payload: {
            relationshipDelta,
            reason: delta.reason,
            topicTag
        },
        causedByPartId: responsePart.id
    });
    touchDialogueConversation(conversationId, {
        conversationType: DIALOGUE_CONVERSATION_TYPES.GENERAL,
        ownerPersonId: person.id,
        subjectId: 'player',
        status: DIALOGUE_CONVERSATION_STATUSES.OPEN,
        topic: { intent, topicTag },
        latestPartId: effectPart.id
    });
    return {
        ok: true,
        personId: person.id,
        conversationId,
        playerLine,
        npcLine,
        relationshipDelta,
        stateChanged: true
    };
}

export function startPersonalChat(personId) {
    const person = ensurePerson(personId);
    if (!person) return failResult(personId, 'missing_person');
    if (!isKnownLocalContact(person)) return failResult(person.id, 'not_local_contact');
    const relationship = getDialogueRelationship(person.id);
    if (!relationship) return failResult(person.id, 'missing_relationship');
    return runRelationshipConversation({
        person,
        intent: DIALOGUE_INTENTS.START_PERSONAL_CHAT,
        dialogueState: startChatState(relationship),
        topicTag: DEFAULT_TOPIC_TAG,
        delta: {
            familiarity: 1,
            tags: ['personal_chat'],
            reason: 'start_personal_chat'
        }
    });
}

export function deepenRelationship(personId, topicTag) {
    const person = ensurePerson(personId);
    if (!person) return failResult(personId, 'missing_person');
    if (!isKnownLocalContact(person)) return failResult(person.id, 'not_local_contact');
    const safeTopicTag = normaliseTopicTag(topicTag);
    const relationship = getDialogueRelationship(person.id);
    if (!relationship) return failResult(person.id, 'missing_relationship');
    const access = hasDeepenAccess(relationship, safeTopicTag);
    if (!access.ok) return failResult(person.id, access.reason);
    const topicDelta = TOPIC_DELTAS[safeTopicTag];
    return runRelationshipConversation({
        person,
        intent: DIALOGUE_INTENTS.DEEPEN_RELATIONSHIP,
        dialogueState: topicState(safeTopicTag),
        topicTag: safeTopicTag,
        delta: {
            familiarity: 2,
            trust: 1,
            affect: topicDelta.affect || {},
            tags: ['relationship_deepened', `topic:${safeTopicTag}`],
            reason: 'deepen_relationship'
        }
    });
}
