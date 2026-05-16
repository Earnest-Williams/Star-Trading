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
    DEFAULT_RELATIONSHIP_AFFECT,
    DIALOGUE_LEXICON_IDS,
    DIALOGUE_REGISTERS,
    DIALOGUE_TONES,
    ensurePersonDialogueProfile,
    normaliseDialogueProfile,
    normaliseRelationshipAffect
} from './dialogueVoice.js';
import { normaliseDialogueRelationship } from './relationships.js';

const DIALOGUE_INTENT_VALUES = Object.values(DIALOGUE_INTENTS);
const DIALOGUE_STATE_VALUES = Object.values(DIALOGUE_FRAME_STATES);
const REGISTER_VALUES = Object.values(DIALOGUE_REGISTERS);
const TONE_VALUES = Object.values(DIALOGUE_TONES);

export const DIALOGUE_LEXICONS = Object.freeze({
    [DIALOGUE_LEXICON_IDS.STANDARD]: Object.freeze({
        contactChannel: Object.freeze(['Communications']),
        acknowledgement: Object.freeze(['understood']),
        signoff: Object.freeze(['I will send word'])
    }),
    [DIALOGUE_LEXICON_IDS.BROKER]: Object.freeze({
        contactChannel: Object.freeze(['Communications']),
        acknowledgement: Object.freeze(['noted']),
        signoff: Object.freeze(['I will send word'])
    }),
    [DIALOGUE_LEXICON_IDS.DOCK]: Object.freeze({
        contactChannel: Object.freeze(['Communications']),
        acknowledgement: Object.freeze(['heard']),
        signoff: Object.freeze(['I will ping you'])
    }),
    [DIALOGUE_LEXICON_IDS.BUREAUCRATIC]: Object.freeze({
        contactChannel: Object.freeze(['Communications']),
        acknowledgement: Object.freeze(['recorded']),
        signoff: Object.freeze(['I will file an update'])
    }),
    [DIALOGUE_LEXICON_IDS.UNDERWORLD]: Object.freeze({
        contactChannel: Object.freeze(['Communications']),
        acknowledgement: Object.freeze(['clocked']),
        signoff: Object.freeze(['I will pass word'])
    })
});

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

function normalizeRegister(register, fallback = DIALOGUE_REGISTERS.PROFESSIONAL) {
    const safeRegister = asString(register, fallback);
    return REGISTER_VALUES.includes(safeRegister) ? safeRegister : fallback;
}

function normalizeTone(tone, fallback = DIALOGUE_TONES.NEUTRAL) {
    const safeTone = asString(tone, fallback);
    return TONE_VALUES.includes(safeTone) ? safeTone : fallback;
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

function stableHash(value) {
    const text = asString(value, 'dialogue');
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

export function chooseStable(options, key) {
    if (!Array.isArray(options) || options.length === 0) return null;
    return options[stableHash(key) % options.length];
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

export function selectDialogueRegister(frame, person = null) {
    const frameRegister = normalizeRegister(frame?.register, '');
    if (frameRegister) return frameRegister;
    const profile = person ? ensurePersonDialogueProfile(person) : normaliseDialogueProfile();
    return normalizeRegister(profile?.register, DIALOGUE_REGISTERS.PROFESSIONAL);
}

export function deriveDialogueTone(frame, relationship = null, person = null) {
    const explicitTone = normalizeTone(frame?.tone, '');
    if (explicitTone) return explicitTone;
    const safeRelationship = normaliseDialogueRelationship(relationship || {});
    const affect = normaliseRelationshipAffect(safeRelationship.affect || DEFAULT_RELATIONSHIP_AFFECT);
    if (safeRelationship.trust <= -40 || affect.irritation >= 60 || affect.suspicion >= 60) {
        return DIALOGUE_TONES.HOSTILE;
    }
    if (safeRelationship.trust < -10 || affect.suspicion >= 25) return DIALOGUE_TONES.WARY;
    if (safeRelationship.trust >= 35 || affect.warmth >= 35) return DIALOGUE_TONES.WARM;
    const profile = person ? ensurePersonDialogueProfile(person) : null;
    return normalizeTone(profile?.toneBias, DIALOGUE_TONES.NEUTRAL);
}

export function resolveLexiconSlots(frame, person = null) {
    const profile = person ? ensurePersonDialogueProfile(person) : normaliseDialogueProfile();
    const keyBase = [
        frame?.intent,
        frame?.state,
        frame?.ownerPersonId,
        frame?.itemId,
        profile?.stableSeed
    ].map(value => asString(value, '')).join('|');
    return (profile?.lexiconIds || [DIALOGUE_LEXICON_IDS.STANDARD]).reduce((slots, lexiconId) => {
        const lexicon = DIALOGUE_LEXICONS[lexiconId] || {};
        Object.entries(lexicon).forEach(([slot, options]) => {
            if (typeof slots[slot] === 'undefined') {
                slots[slot] = chooseStable(options, `${keyBase}|${lexiconId}|${slot}`) || '';
            }
        });
        return slots;
    }, {});
}

export function selectNestedTemplate(bank, frame, register, tone) {
    const stateBank = bank?.[frame.intent]?.[frame.state];
    if (!isObject(stateBank)) return null;
    const registers = [
        normalizeRegister(register, DIALOGUE_REGISTERS.PROFESSIONAL),
        normalizeRegister(frame.fallbackRegister, ''),
        DIALOGUE_REGISTERS.PROFESSIONAL,
        DIALOGUE_REGISTERS.PLAIN
    ].filter(Boolean);
    const tones = [
        normalizeTone(tone, DIALOGUE_TONES.NEUTRAL),
        DIALOGUE_TONES.NEUTRAL,
        DIALOGUE_TONES.BRISK
    ];
    for (const candidateRegister of [...new Set(registers)]) {
        const registerBank = stateBank[candidateRegister];
        if (!isObject(registerBank)) continue;
        for (const candidateTone of [...new Set(tones)]) {
            const templates = registerBank[candidateTone];
            const template = chooseStable(
                templates,
                `${frame.intent}|${frame.state}|${frame.ownerPersonId}|${frame.itemId}|${candidateRegister}|${candidateTone}`
            );
            if (template) return template;
        }
    }
    return null;
}

function enrichFrameForRealization(frame) {
    const normalizedFrame = buildDialogueFrame(frame?.intent, frame);
    const person = getFramePerson(normalizedFrame);
    const relationship = getFrameRelationship(person);
    const profile = person ? ensurePersonDialogueProfile(person) : normaliseDialogueProfile();
    const register = selectDialogueRegister(normalizedFrame, person);
    const tone = deriveDialogueTone(normalizedFrame, relationship, person);
    return {
        ...normalizedFrame,
        register,
        fallbackRegister: normalizedFrame.fallbackRegister || profile.fallbackRegister,
        tone,
        slots: {
            ...resolveLexiconSlots(normalizedFrame, person),
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
        register: normalizeRegister(source.register, ''),
        fallbackRegister: normalizeRegister(source.fallbackRegister, ''),
        tone: normalizeTone(source.tone, ''),
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
    return {
        valid: errors.length === 0 && missingSlots.length === 0,
        missingSlots,
        errors
    };
}

export function realizeDialogueLine(frame) {
    const realizedFrame = enrichFrameForRealization(frame);
    const validation = validateDialogueFrame(realizedFrame);
    if (!validation.valid) return DIALOGUE_FALLBACK_LINE;
    const template = selectNestedTemplate(
        DIALOGUE_TEMPLATE_BANKS,
        realizedFrame,
        realizedFrame.register,
        realizedFrame.tone
    );
    if (!template) return DIALOGUE_FALLBACK_LINE;
    return fillTemplate(template, realizedFrame.slots || {});
}

export function realizeDialoguePrompt(frame) {
    const realizedFrame = enrichFrameForRealization(frame);
    const template = selectNestedTemplate(
        DIALOGUE_PROMPT_TEMPLATE_BANKS,
        realizedFrame,
        realizedFrame.register,
        realizedFrame.tone
    );
    if (!template) return DIALOGUE_FALLBACK_LINE;
    return fillTemplate(template, realizedFrame.slots || {});
}
