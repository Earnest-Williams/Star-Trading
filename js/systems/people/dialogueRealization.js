import { state } from '../../state.js';
import {
    DIALOGUE_FALLBACK_LINE,
    DIALOGUE_FRAME_STATES,
    DIALOGUE_INTENTS,
    DIALOGUE_PROMPT_TEMPLATE_BANKS,
    DIALOGUE_TEMPLATE_BANKS,
    LOCATE_ITEM_REQUIRED_SLOTS
} from './dialogueTemplates.js';
import {
    DEFAULT_DIALOGUE_PROFILE,
    DIALOGUE_REGISTERS,
    DIALOGUE_TONES,
    deriveDialogueTone,
    ensurePersonDialogueProfile,
    resolveLexiconSlots,
    selectDialogueRegister,
    selectNestedTemplate
} from './dialogueVoice.js';
import { normaliseDialogueRelationship } from './relationships.js';

const DIALOGUE_INTENT_VALUES = Object.values(DIALOGUE_INTENTS);
const DIALOGUE_STATE_VALUES = Object.values(DIALOGUE_FRAME_STATES);
const DIALOGUE_REGISTER_VALUES = Object.values(DIALOGUE_REGISTERS);
const DIALOGUE_TONE_VALUES = Object.values(DIALOGUE_TONES);

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

function normalizeIntent(intent) {
    const safeIntent = asString(intent, DIALOGUE_INTENTS.REQUEST_LOCATE_ITEM);
    return DIALOGUE_INTENT_VALUES.includes(safeIntent)
        ? safeIntent
        : DIALOGUE_INTENTS.REQUEST_LOCATE_ITEM;
}

function normalizeState(dialogueState) {
    const safeState = asString(dialogueState, DIALOGUE_FRAME_STATES.FRESH_REQUEST);
    return DIALOGUE_STATE_VALUES.includes(safeState)
        ? safeState
        : DIALOGUE_FRAME_STATES.FRESH_REQUEST;
}

function normalizeRegister(register, fallback = DIALOGUE_REGISTERS.NEUTRAL) {
    const safeRegister = asString(register, fallback);
    return DIALOGUE_REGISTER_VALUES.includes(safeRegister) ? safeRegister : fallback;
}

function normalizeTone(tone, fallback = DIALOGUE_TONES.NEUTRAL) {
    const safeTone = asString(tone, fallback);
    return DIALOGUE_TONE_VALUES.includes(safeTone) ? safeTone : fallback;
}

function requiredSlotsForFrame(frame) {
    if (
        frame.intent === DIALOGUE_INTENTS.REQUEST_LOCATE_ITEM
        || frame.intent === DIALOGUE_INTENTS.CHECK_BACK_LOCATE_ITEM
    ) {
        return LOCATE_ITEM_REQUIRED_SLOTS;
    }
    return [];
}

function fillTemplate(template, slots) {
    return Object.entries(isObject(slots) ? slots : {})
        .reduce((line, [key, value]) => line.replaceAll(`{${key}}`, asString(value, '')), template);
}

function getFramePerson(frame) {
    const personId = asString(frame?.ownerPersonId, '');
    if (personId.length === 0) return null;
    const person = state.people?.[personId] || null;
    if (person) ensurePersonDialogueProfile(person);
    return person;
}

function getFrameRelationship(person) {
    const relationship = person?.relationships?.player;
    return normaliseDialogueRelationship(relationship || {});
}

function prepareFrameForRealization(frame) {
    const normalizedFrame = buildDialogueFrame(frame?.intent, frame);
    const person = getFramePerson(normalizedFrame);
    const relationship = getFrameRelationship(person);
    const profile = person ? ensurePersonDialogueProfile(person) : DEFAULT_DIALOGUE_PROFILE;
    const register = selectDialogueRegister(normalizedFrame, profile, relationship);
    const tone = deriveDialogueTone(normalizedFrame, relationship);
    const enrichedFrame = { ...normalizedFrame, register, tone };
    const lexiconSlots = resolveLexiconSlots(enrichedFrame, profile);
    return {
        ...enrichedFrame,
        slots: {
            ...lexiconSlots,
            ...normalizedFrame.slots
        }
    };
}

export function buildDialogueFrame(intent, context = {}) {
    const source = isObject(context) ? context : {};
    const slots = isObject(source.slots) ? source.slots : {};
    const normalizedSlots = Object.fromEntries(
        Object.entries(slots).map(([key, value]) => [key, asString(value, '')])
    );
    return {
        intent: normalizeIntent(intent),
        actorId: asString(source.actorId, 'player'),
        ownerPersonId: asNullableString(source.ownerPersonId),
        subjectId: asString(source.subjectId, 'player'),
        itemId: asString(source.itemId, 'unknown_part'),
        state: normalizeState(source.state),
        register: normalizeRegister(source.register),
        tone: normalizeTone(source.tone),
        slots: { itemLabel: '', personName: '', ...normalizedSlots }
    };
}

export function validateDialogueFrame(frame) {
    if (!isObject(frame)) {
        return { valid: false, missingSlots: [], errors: ['frame must be an object'] };
    }
    const missingSlots = requiredSlotsForFrame(frame)
        .filter(slot => asString(frame.slots?.[slot], '').length === 0);
    const errors = [];
    if (!DIALOGUE_INTENT_VALUES.includes(frame.intent)) errors.push('unknown intent');
    if (!DIALOGUE_STATE_VALUES.includes(frame.state)) errors.push('unknown state');
    if (!DIALOGUE_REGISTER_VALUES.includes(frame.register)) errors.push('unknown register');
    if (!DIALOGUE_TONE_VALUES.includes(frame.tone)) errors.push('unknown tone');
    return {
        valid: errors.length === 0 && missingSlots.length === 0,
        missingSlots,
        errors
    };
}

export function realizeDialogueLine(frame) {
    const realizedFrame = prepareFrameForRealization(frame);
    const validation = validateDialogueFrame(realizedFrame);
    if (!validation.valid) return DIALOGUE_FALLBACK_LINE;
    const intentBank = DIALOGUE_TEMPLATE_BANKS[realizedFrame.intent];
    const template = selectNestedTemplate(intentBank, realizedFrame);
    if (!template) return DIALOGUE_FALLBACK_LINE;
    return fillTemplate(template, realizedFrame.slots || {});
}

export function realizeDialoguePrompt(frame) {
    const realizedFrame = prepareFrameForRealization(frame);
    const intentBank = DIALOGUE_PROMPT_TEMPLATE_BANKS[realizedFrame.intent];
    const template = selectNestedTemplate(intentBank, realizedFrame);
    if (!template) return DIALOGUE_FALLBACK_LINE;
    return fillTemplate(template, realizedFrame.slots || {});
}
