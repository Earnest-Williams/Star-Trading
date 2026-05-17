import { PERSON_ROLES } from '../../config/people.js';
import { DIALOGUE_TEXT_LEXICON_ADDITIONS } from './dialogueTextStrings.js';
import { mergeFrozenStringTree } from './common.js';

// ─── Public vocabulary ────────────────────────────────────────────────────────

// neutral  = ordinary public speech
// work     = task-specific, transactional, professional speech
// personal = familiar, warmer, emotionally exposed speech
export const DIALOGUE_REGISTERS = Object.freeze({
    NEUTRAL: 'neutral',
    WORK: 'work',
    PERSONAL: 'personal'
});

export const DIALOGUE_TONES = Object.freeze({
    NEUTRAL: 'neutral',
    WARM: 'warm',
    GUARDED: 'guarded',
    HOSTILE: 'hostile',
    ENVIOUS: 'envious',
    JEALOUS: 'jealous',
    INTIMATE: 'intimate'
});

export const DIALOGUE_LEXICON_IDS = Object.freeze({
    DEFAULT: 'default',
    SCRAPYARD_PLAIN: 'scrapyard_plain',
    CORPORATE_PRECISE: 'corporate_precise',
    DOCK_DIRECT: 'dock_direct'
});

const REGISTER_VALUES = Object.freeze(Object.values(DIALOGUE_REGISTERS));
const TONE_VALUES = Object.freeze(Object.values(DIALOGUE_TONES));
const LEXICON_VALUES = Object.freeze(Object.values(DIALOGUE_LEXICON_IDS));

// ─── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_DIALOGUE_PROFILE = Object.freeze({
    voiceId: 'plain_frontier',
    lexiconId: DIALOGUE_LEXICON_IDS.DEFAULT,
    defaultRegister: DIALOGUE_REGISTERS.NEUTRAL,
    personalRegisterFamiliarity: 20,
    personalRegisterTrust: 15
});

export const DEFAULT_RELATIONSHIP_AFFECT = Object.freeze({
    warmth: 0,
    respect: 0,
    resentment: 0,
    fear: 0,
    envy: 0,
    jealousy: 0,
    attraction: 0
});

// ─── Lexicon banks ───────────────────────────────────────────────────────────

const BASE_DIALOGUE_LEXICONS = Object.freeze({
    [DIALOGUE_LEXICON_IDS.DEFAULT]: Object.freeze({
        goodLead: Object.freeze(['a solid lead']),
        badStock: Object.freeze(['thin stock']),
        noStock: Object.freeze(['nothing on hand']),
        askAround: Object.freeze(['ask around']),
        heldAside: Object.freeze(['set aside']),
        supplier: Object.freeze(['a supplier']),
        difficult: Object.freeze(['difficult to find']),
        risky: Object.freeze(['a risky find'])
    }),
    [DIALOGUE_LEXICON_IDS.SCRAPYARD_PLAIN]: Object.freeze({
        goodLead: Object.freeze(['a decent line']),
        badStock: Object.freeze(['dry shelves']),
        noStock: Object.freeze(['nothing clean on hand']),
        askAround: Object.freeze(['shake loose']),
        heldAside: Object.freeze(['tucked away']),
        supplier: Object.freeze(['a yard contact']),
        difficult: Object.freeze(['hard to come by']),
        risky: Object.freeze(['a sketchy find'])
    }),
    [DIALOGUE_LEXICON_IDS.CORPORATE_PRECISE]: Object.freeze({
        goodLead: Object.freeze(['a confirmed source']),
        badStock: Object.freeze(['insufficient inventory']),
        noStock: Object.freeze(['no stock on hand']),
        askAround: Object.freeze(['make inquiries']),
        heldAside: Object.freeze(['reserved']),
        supplier: Object.freeze(['a verified supplier']),
        difficult: Object.freeze(['subject to availability']),
        risky: Object.freeze(['an elevated-risk procurement'])
    }),
    [DIALOGUE_LEXICON_IDS.DOCK_DIRECT]: Object.freeze({
        goodLead: Object.freeze(['a lead']),
        badStock: Object.freeze(['nothing moving']),
        noStock: Object.freeze(['nothing on the dock']),
        askAround: Object.freeze(['check the yard']),
        heldAside: Object.freeze(['pulled aside']),
        supplier: Object.freeze(['a hauler contact']),
        difficult: Object.freeze(['tough to track']),
        risky: Object.freeze(['a risky pull'])
    })
});

export const DIALOGUE_LEXICONS = mergeFrozenStringTree(
    BASE_DIALOGUE_LEXICONS,
    DIALOGUE_TEXT_LEXICON_ADDITIONS
);

// ─── Role-to-profile mapping ──────────────────────────────────────────────────

const ROLE_DIALOGUE_PROFILES = Object.freeze({
    sales_director: Object.freeze({
        voiceId: 'corporate_precise',
        lexiconId: DIALOGUE_LEXICON_IDS.CORPORATE_PRECISE,
        defaultRegister: DIALOGUE_REGISTERS.WORK
    }),
    freight_manager: Object.freeze({
        voiceId: 'dock_direct',
        lexiconId: DIALOGUE_LEXICON_IDS.DOCK_DIRECT,
        defaultRegister: DIALOGUE_REGISTERS.WORK
    }),
    dockmaster: Object.freeze({
        voiceId: 'dock_direct',
        lexiconId: DIALOGUE_LEXICON_IDS.DOCK_DIRECT,
        defaultRegister: DIALOGUE_REGISTERS.WORK
    }),
    customs_officer: Object.freeze({
        voiceId: 'corporate_precise',
        lexiconId: DIALOGUE_LEXICON_IDS.CORPORATE_PRECISE,
        defaultRegister: DIALOGUE_REGISTERS.WORK
    }),
    factor: Object.freeze({
        voiceId: 'plain_frontier',
        lexiconId: DIALOGUE_LEXICON_IDS.DEFAULT,
        defaultRegister: DIALOGUE_REGISTERS.NEUTRAL
    }),
    fixer: Object.freeze({
        voiceId: 'scrapyard_plain',
        lexiconId: DIALOGUE_LEXICON_IDS.SCRAPYARD_PLAIN,
        defaultRegister: DIALOGUE_REGISTERS.NEUTRAL
    })
});

// ─── Private helpers ─────────────────────────────────────────────────────────

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

function isKnownValue(value, knownValues) {
    return typeof value === 'string' && knownValues.includes(value);
}

function hasValidProfile(profile) {
    return isObject(profile)
        && isKnownValue(profile.lexiconId, LEXICON_VALUES)
        && isKnownValue(profile.defaultRegister, REGISTER_VALUES)
        && typeof profile.voiceId === 'string'
        && profile.voiceId.trim().length > 0
        && Number.isFinite(profile.personalRegisterFamiliarity)
        && Number.isFinite(profile.personalRegisterTrust);
}

function normaliseDialogueProfileFromSource(source, fallback) {
    return {
        voiceId: asString(source.voiceId, fallback.voiceId),
        lexiconId: isKnownValue(source.lexiconId, LEXICON_VALUES)
            ? source.lexiconId
            : fallback.lexiconId,
        defaultRegister: isKnownValue(source.defaultRegister, REGISTER_VALUES)
            ? source.defaultRegister
            : fallback.defaultRegister,
        personalRegisterFamiliarity: Number.isFinite(source.personalRegisterFamiliarity)
            ? source.personalRegisterFamiliarity
            : fallback.personalRegisterFamiliarity,
        personalRegisterTrust: Number.isFinite(source.personalRegisterTrust)
            ? source.personalRegisterTrust
            : fallback.personalRegisterTrust
    };
}

function normaliseDialogueProfileWithFallback(profile, fallbackProfile) {
    const source = isObject(profile) ? profile : {};
    const fallback = normaliseDialogueProfile(fallbackProfile);
    return normaliseDialogueProfileFromSource(source, fallback);
}

// ─── Normalisers ─────────────────────────────────────────────────────────────

export function normaliseDialogueProfile(profile = {}) {
    const source = isObject(profile) ? profile : {};
    return normaliseDialogueProfileFromSource(source, DEFAULT_DIALOGUE_PROFILE);
}

export function normaliseRelationshipAffect(affect = {}) {
    const source = isObject(affect) ? affect : {};
    return {
        warmth: clamp(source.warmth, -100, 100),
        respect: clamp(source.respect, -100, 100),
        resentment: clamp(source.resentment, -100, 100),
        fear: clamp(source.fear, -100, 100),
        envy: clamp(source.envy, -100, 100),
        jealousy: clamp(source.jealousy, -100, 100),
        attraction: clamp(source.attraction, -100, 100)
    };
}

export function dialogueProfileForRole(role) {
    const safeRole = PERSON_ROLES.includes(role) ? role : 'factor';
    const source = ROLE_DIALOGUE_PROFILES[safeRole] || ROLE_DIALOGUE_PROFILES.factor;
    return normaliseDialogueProfile({ ...source });
}

export function ensurePersonDialogueProfile(person) {
    if (!isObject(person)) return null;
    if (hasValidProfile(person.dialogueProfile)) {
        return person.dialogueProfile;
    }
    const roleProfile = dialogueProfileForRole(person.role);
    person.dialogueProfile = normaliseDialogueProfileWithFallback(
        person.dialogueProfile,
        roleProfile
    );
    return person.dialogueProfile;
}

// ─── Stable selection ────────────────────────────────────────────────────────

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

// ─── Voice derivation ────────────────────────────────────────────────────────

// Intents that use work register by default
const WORK_INTENTS = Object.freeze(['request_locate_item', 'check_back_locate_item']);

// selectDialogueRegister resolution order:
// 1. Frame explicitly provides a known non-neutral register → use it.
// 2. Relationship familiarity + trust meet personal thresholds → personal.
// 3. Intent is a work intent → work.
// 4. Profile defaultRegister or neutral.
export function selectDialogueRegister(frame, profile = null, relationship = null) {
    const safeProfile = hasValidProfile(profile) ? profile : DEFAULT_DIALOGUE_PROFILE;
    const frameRegister = asString(frame?.register, '');
    if (isKnownValue(frameRegister, REGISTER_VALUES) && frameRegister !== DIALOGUE_REGISTERS.NEUTRAL) {
        return frameRegister;
    }
    const familiarity = typeof relationship?.familiarity === 'number' ? relationship.familiarity : 0;
    const trust = typeof relationship?.trust === 'number' ? relationship.trust : 0;
    if (familiarity >= safeProfile.personalRegisterFamiliarity
        && trust >= safeProfile.personalRegisterTrust) {
        return DIALOGUE_REGISTERS.PERSONAL;
    }
    const intent = asString(frame?.intent, '');
    if (WORK_INTENTS.includes(intent)) {
        return DIALOGUE_REGISTERS.WORK;
    }
    return isKnownValue(safeProfile.defaultRegister, REGISTER_VALUES)
        ? safeProfile.defaultRegister
        : DIALOGUE_REGISTERS.NEUTRAL;
}

// deriveDialogueTone resolution order:
// hostile  → trust <= -40 or resentment >= 40
// jealous  → jealousy >= 35
// envious  → envy >= 35
// intimate → attraction >= 45 and trust >= 20
// warm     → trust >= 20 or warmth >= 25
// guarded  → trust < 0 or fear >= 25
// neutral  → fallback
export function deriveDialogueTone(frame, relationship = null, affect = null) {
    // Only use the frame tone if it is an explicit non-neutral override;
    // buildDialogueFrame defaults to 'neutral', which is not a meaningful override.
    const frameTone = asString(frame?.tone, '');
    if (isKnownValue(frameTone, TONE_VALUES) && frameTone !== DIALOGUE_TONES.NEUTRAL) {
        return frameTone;
    }
    const trust = typeof relationship?.trust === 'number' ? relationship.trust : 0;
    const safeAffect = normaliseRelationshipAffect(
        affect || (isObject(relationship?.affect) ? relationship.affect : DEFAULT_RELATIONSHIP_AFFECT)
    );
    if (trust <= -40 || safeAffect.resentment >= 40) return DIALOGUE_TONES.HOSTILE;
    if (safeAffect.jealousy >= 35) return DIALOGUE_TONES.JEALOUS;
    if (safeAffect.envy >= 35) return DIALOGUE_TONES.ENVIOUS;
    if (safeAffect.attraction >= 45 && trust >= 20) return DIALOGUE_TONES.INTIMATE;
    if (trust >= 20 || safeAffect.warmth >= 25) return DIALOGUE_TONES.WARM;
    if (trust < 0 || safeAffect.fear >= 25) return DIALOGUE_TONES.GUARDED;
    return DIALOGUE_TONES.NEUTRAL;
}

// resolveLexiconSlots: select every slot from the NPC's lexicon deterministically.
// Seed is built from frame intent, state, register, tone, ownerPersonId, itemId.
export function resolveLexiconSlots(frame, profile = null) {
    const safeProfile = hasValidProfile(profile) ? profile : DEFAULT_DIALOGUE_PROFILE;
    const lexicon = DIALOGUE_LEXICONS[safeProfile.lexiconId]
        || DIALOGUE_LEXICONS[DIALOGUE_LEXICON_IDS.DEFAULT];
    const keyBase = [
        frame?.intent,
        frame?.state,
        frame?.register,
        frame?.tone,
        frame?.ownerPersonId,
        frame?.itemId
    ].map(value => asString(value, '')).join(':');
    return Object.entries(lexicon).reduce((slots, [slot, options]) => {
        slots[slot] = chooseStable(options, `${keyBase}:${slot}`) || '';
        return slots;
    }, {});
}

// selectNestedTemplate: select a template from a state-indexed bank.
// templateBank shape: state → register → tone → templates[]
// Fallback order:
// 1. exact register + exact tone
// 2. exact register + neutral tone
// 3. neutral register + exact tone
// 4. neutral register + neutral tone
// 5. work register + exact tone
// 6. work register + neutral tone
// 7. null (caller falls back to DIALOGUE_FALLBACK_LINE)
export function selectNestedTemplate(templateBank, frame) {
    const stateBank = templateBank?.[frame?.state];
    if (!isObject(stateBank)) return null;
    const register = isKnownValue(frame?.register, REGISTER_VALUES)
        ? frame.register
        : DIALOGUE_REGISTERS.NEUTRAL;
    const tone = isKnownValue(frame?.tone, TONE_VALUES)
        ? frame.tone
        : DIALOGUE_TONES.NEUTRAL;
    const candidates = [
        stateBank?.[register]?.[tone],
        stateBank?.[register]?.[DIALOGUE_TONES.NEUTRAL],
        stateBank?.[DIALOGUE_REGISTERS.NEUTRAL]?.[tone],
        stateBank?.[DIALOGUE_REGISTERS.NEUTRAL]?.[DIALOGUE_TONES.NEUTRAL],
        stateBank?.[DIALOGUE_REGISTERS.WORK]?.[tone],
        stateBank?.[DIALOGUE_REGISTERS.WORK]?.[DIALOGUE_TONES.NEUTRAL]
    ].filter(list => Array.isArray(list) && list.length > 0);
    if (candidates.length === 0) return null;
    const templates = candidates[0];
    return chooseStable(
        templates,
        [frame?.intent, frame?.state, register, tone, frame?.ownerPersonId, frame?.itemId]
            .filter(Boolean).join(':')
    );
}
