import { PERSON_ROLES } from '../../config/people.js';

export const DIALOGUE_REGISTERS = Object.freeze({
    FORMAL: 'formal',
    PROFESSIONAL: 'professional',
    PLAIN: 'plain',
    CASUAL: 'casual',
    UNDERWORLD: 'underworld'
});

export const DIALOGUE_TONES = Object.freeze({
    NEUTRAL: 'neutral',
    WARM: 'warm',
    WARY: 'wary',
    HOSTILE: 'hostile',
    BRISK: 'brisk'
});

export const DIALOGUE_LEXICON_IDS = Object.freeze({
    STANDARD: 'standard',
    BROKER: 'broker',
    DOCK: 'dock',
    BUREAUCRATIC: 'bureaucratic',
    UNDERWORLD: 'underworld'
});

const REGISTER_VALUES = Object.freeze(Object.values(DIALOGUE_REGISTERS));
const TONE_VALUES = Object.freeze(Object.values(DIALOGUE_TONES));
const LEXICON_VALUES = Object.freeze(Object.values(DIALOGUE_LEXICON_IDS));

export const DEFAULT_DIALOGUE_PROFILE = Object.freeze({
    register: DIALOGUE_REGISTERS.PROFESSIONAL,
    fallbackRegister: DIALOGUE_REGISTERS.PLAIN,
    toneBias: DIALOGUE_TONES.NEUTRAL,
    lexiconIds: Object.freeze([DIALOGUE_LEXICON_IDS.STANDARD]),
    stableSeed: 'default'
});

export const DEFAULT_RELATIONSHIP_AFFECT = Object.freeze({
    warmth: 0,
    irritation: 0,
    respect: 0,
    suspicion: 0
});

const ROLE_DIALOGUE_PROFILES = Object.freeze({
    sales_director: Object.freeze({
        register: DIALOGUE_REGISTERS.PROFESSIONAL,
        fallbackRegister: DIALOGUE_REGISTERS.FORMAL,
        lexiconIds: Object.freeze([DIALOGUE_LEXICON_IDS.BROKER, DIALOGUE_LEXICON_IDS.STANDARD])
    }),
    freight_manager: Object.freeze({
        register: DIALOGUE_REGISTERS.PLAIN,
        fallbackRegister: DIALOGUE_REGISTERS.PROFESSIONAL,
        lexiconIds: Object.freeze([DIALOGUE_LEXICON_IDS.DOCK, DIALOGUE_LEXICON_IDS.STANDARD])
    }),
    dockmaster: Object.freeze({
        register: DIALOGUE_REGISTERS.PLAIN,
        fallbackRegister: DIALOGUE_REGISTERS.PROFESSIONAL,
        lexiconIds: Object.freeze([DIALOGUE_LEXICON_IDS.DOCK, DIALOGUE_LEXICON_IDS.STANDARD])
    }),
    customs_officer: Object.freeze({
        register: DIALOGUE_REGISTERS.FORMAL,
        fallbackRegister: DIALOGUE_REGISTERS.PROFESSIONAL,
        lexiconIds: Object.freeze([DIALOGUE_LEXICON_IDS.BUREAUCRATIC, DIALOGUE_LEXICON_IDS.STANDARD])
    }),
    polity_envoy: Object.freeze({
        register: DIALOGUE_REGISTERS.FORMAL,
        fallbackRegister: DIALOGUE_REGISTERS.PROFESSIONAL,
        lexiconIds: Object.freeze([DIALOGUE_LEXICON_IDS.BUREAUCRATIC, DIALOGUE_LEXICON_IDS.STANDARD])
    }),
    local_councillor: Object.freeze({
        register: DIALOGUE_REGISTERS.CASUAL,
        fallbackRegister: DIALOGUE_REGISTERS.PLAIN,
        lexiconIds: Object.freeze([DIALOGUE_LEXICON_IDS.STANDARD])
    }),
    union_rep: Object.freeze({
        register: DIALOGUE_REGISTERS.PLAIN,
        fallbackRegister: DIALOGUE_REGISTERS.CASUAL,
        lexiconIds: Object.freeze([DIALOGUE_LEXICON_IDS.DOCK, DIALOGUE_LEXICON_IDS.STANDARD])
    }),
    factor: Object.freeze({
        register: DIALOGUE_REGISTERS.PROFESSIONAL,
        fallbackRegister: DIALOGUE_REGISTERS.PLAIN,
        lexiconIds: Object.freeze([DIALOGUE_LEXICON_IDS.BROKER, DIALOGUE_LEXICON_IDS.STANDARD])
    }),
    fixer: Object.freeze({
        register: DIALOGUE_REGISTERS.UNDERWORLD,
        fallbackRegister: DIALOGUE_REGISTERS.PLAIN,
        lexiconIds: Object.freeze([DIALOGUE_LEXICON_IDS.UNDERWORLD, DIALOGUE_LEXICON_IDS.STANDARD])
    })
});

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value, fallback = '') {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function clamp(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(min, Math.min(max, number));
}

function normalizeRegister(value, fallback) {
    const register = asString(value, fallback);
    return REGISTER_VALUES.includes(register) ? register : fallback;
}

function normalizeTone(value, fallback) {
    const tone = asString(value, fallback);
    return TONE_VALUES.includes(tone) ? tone : fallback;
}

function normalizeLexiconIds(value) {
    const source = Array.isArray(value) ? value : DEFAULT_DIALOGUE_PROFILE.lexiconIds;
    const lexiconIds = source.filter(lexiconId => LEXICON_VALUES.includes(lexiconId));
    return lexiconIds.length > 0
        ? [...new Set(lexiconIds)]
        : [...DEFAULT_DIALOGUE_PROFILE.lexiconIds];
}

function hasNormalisedDialogueProfile(profile) {
    return isObject(profile)
        && REGISTER_VALUES.includes(profile.register)
        && REGISTER_VALUES.includes(profile.fallbackRegister)
        && TONE_VALUES.includes(profile.toneBias)
        && typeof profile.stableSeed === 'string'
        && profile.stableSeed.trim().length > 0
        && Array.isArray(profile.lexiconIds)
        && profile.lexiconIds.length > 0
        && profile.lexiconIds.every(lexiconId => LEXICON_VALUES.includes(lexiconId));
}

export function dialogueProfileForRole(role, overrides = {}) {
    const safeRole = PERSON_ROLES.includes(role) ? role : 'factor';
    const source = isObject(overrides) ? overrides : {};
    return normaliseDialogueProfile({
        ...ROLE_DIALOGUE_PROFILES[safeRole],
        ...source,
        stableSeed: asString(source.stableSeed, safeRole)
    });
}

export function normaliseDialogueProfile(profile = {}) {
    const source = isObject(profile) ? profile : {};
    const register = normalizeRegister(source.register, DEFAULT_DIALOGUE_PROFILE.register);
    const fallbackRegister = normalizeRegister(
        source.fallbackRegister,
        DEFAULT_DIALOGUE_PROFILE.fallbackRegister
    );
    return {
        register,
        fallbackRegister,
        toneBias: normalizeTone(source.toneBias, DEFAULT_DIALOGUE_PROFILE.toneBias),
        lexiconIds: normalizeLexiconIds(source.lexiconIds),
        stableSeed: asString(source.stableSeed, DEFAULT_DIALOGUE_PROFILE.stableSeed)
    };
}

export function normaliseRelationshipAffect(affect = {}) {
    const source = isObject(affect) ? affect : {};
    return {
        warmth: clamp(source.warmth, -100, 100),
        irritation: clamp(source.irritation, -100, 100),
        respect: clamp(source.respect, -100, 100),
        suspicion: clamp(source.suspicion, -100, 100)
    };
}

export function ensurePersonDialogueProfile(person) {
    if (!isObject(person)) return null;
    if (hasNormalisedDialogueProfile(person.dialogueProfile)) {
        return person.dialogueProfile;
    }
    person.dialogueProfile = normaliseDialogueProfile({
        ...dialogueProfileForRole(person.role),
        ...(isObject(person.dialogueProfile) ? person.dialogueProfile : {}),
        stableSeed: asString(person.dialogueProfile?.stableSeed, person.id || person.name || person.role || 'person')
    });
    return person.dialogueProfile;
}
