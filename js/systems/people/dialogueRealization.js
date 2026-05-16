import {
    DIALOGUE_FALLBACK_LINE,
    DIALOGUE_FRAME_STATES,
    DIALOGUE_INTENTS,
    DIALOGUE_TEMPLATE_BANKS,
    LOCATE_ITEM_REQUIRED_SLOTS
} from './dialogueTemplates.js';

const DIALOGUE_INTENT_VALUES = Object.values(DIALOGUE_INTENTS);
const DIALOGUE_STATE_VALUES = Object.values(DIALOGUE_FRAME_STATES);

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

function normalizeState(state) {
    const safeState = asString(state, DIALOGUE_FRAME_STATES.FRESH_REQUEST);
    return DIALOGUE_STATE_VALUES.includes(safeState)
        ? safeState
        : DIALOGUE_FRAME_STATES.FRESH_REQUEST;
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
    return template
        .replaceAll('{itemLabel}', asString(slots.itemLabel, 'part'))
        .replaceAll('{personName}', asString(slots.personName, 'contact'));
}

export function buildDialogueFrame(intent, context = {}) {
    const source = isObject(context) ? context : {};
    const slots = isObject(source.slots) ? source.slots : {};
    return {
        intent: normalizeIntent(intent),
        actorId: asString(source.actorId, 'player'),
        ownerPersonId: asNullableString(source.ownerPersonId),
        subjectId: asString(source.subjectId, 'player'),
        itemId: asString(source.itemId, 'unknown_part'),
        state: normalizeState(source.state),
        tone: asString(source.tone, 'neutral'),
        slots: {
            itemLabel: asString(slots.itemLabel, ''),
            personName: asString(slots.personName, '')
        }
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
    const validation = validateDialogueFrame(frame);
    if (!validation.valid) return DIALOGUE_FALLBACK_LINE;
    const templates = DIALOGUE_TEMPLATE_BANKS[frame.intent] || {};
    const template = templates[frame.state];
    if (!template) return DIALOGUE_FALLBACK_LINE;
    return fillTemplate(template, frame.slots || {});
}
