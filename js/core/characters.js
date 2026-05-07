// Core character factory and helpers for player + captains.
import { CHAR_STATS, CHAR_DEFAULTS, STAT_BUY_CURVE, DEFAULT_PLATFORM_TYPE } from '../config/characters.js';

export const CHARACTER_SCHEMA_FIELDS = Object.freeze([
    "stats",
    "traits",
    "originTraitId",
    "careerTraitIds",
    "platform",
    "contacts"
]);

function normaliseStats(stats) {
    const normalised = {};
    CHAR_STATS.forEach(stat => {
        normalised[stat] = typeof stats?.[stat] === "number"
            ? stats[stat]
            : CHAR_DEFAULTS.STAT_BASE;
    });
    return normalised;
}

function normalisePlatform(platform) {
    return {
        type: platform?.type || DEFAULT_PLATFORM_TYPE,
        employerLaneId: typeof platform?.employerLaneId === "undefined"
            ? null
            : platform.employerLaneId
    };
}

const CHARACTER_FIELD_NORMALIZERS = Object.freeze({
    stats: value => normaliseStats(value),
    traits: value => Array.isArray(value) ? value : [],
    originTraitId: value => value || null,
    careerTraitIds: value => Array.isArray(value) ? value : [],
    platform: value => normalisePlatform(value),
    contacts: value => Array.isArray(value) ? value : []
});
const IDENTITY_FIELD_NORMALIZER = value => value;

export function normaliseCharacter(character = {}) {
    const source = character && typeof character === "object" ? character : {};
    const normalisedSchemaFields = {};
    CHARACTER_SCHEMA_FIELDS.forEach(field => {
        // Explicit fallback keeps schema iteration resilient if a new manifest field
        // is introduced before a dedicated normalizer is added.
        const normalizeField = CHARACTER_FIELD_NORMALIZERS[field] || IDENTITY_FIELD_NORMALIZER;
        normalisedSchemaFields[field] = normalizeField(source[field]);
    });
    return {
        ...source,
        ...normalisedSchemaFields
    };
}

/**
 * Return a fresh character block with all stats at base and no traits.
 * @param {object} [overrides] - Optional partial overrides (e.g. { platform: { type: 'ship_rented' } })
 */
export function createCharacter(overrides = {}) {
    const stats = {};
    CHAR_STATS.forEach(s => { stats[s] = CHAR_DEFAULTS.STAT_BASE; });
    return normaliseCharacter({
        stats,
        traits: [],
        originTraitId: null,
        careerTraitIds: [],
        platform: { type: DEFAULT_PLATFORM_TYPE, employerLaneId: null },
        contacts: [],
        ...overrides
    });
}

/**
 * Return the total stat gain for spending `points` points on a single stat,
 * starting from zero spend on that stat.
 */
export function calcStatGain(points) {
    let gain = 0;
    let spent = 0;
    for (const tier of STAT_BUY_CURVE) {
        if (spent >= points) break;
        const available = tier.to - tier.from + 1;
        const used = Math.min(available, points - spent);
        gain += used * tier.gain;
        spent += used;
    }
    return gain;
}

/**
 * Return the total chargen points required to raise a single stat from its
 * base value to `targetValue`. Returns null if `targetValue` is unreachable.
 */
export function calcPointsForStatValue(targetValue) {
    const gain = targetValue - CHAR_DEFAULTS.STAT_BASE;
    if (gain < 0) return null;
    if (gain === 0) return 0;
    // Walk curve in reverse: find how many spend-points produce this exact gain
    let remaining = gain;
    let points = 0;
    for (const tier of STAT_BUY_CURVE) {
        if (remaining <= 0) break;
        const available = tier.to - tier.from + 1;
        const maxGainFromTier = available * tier.gain;
        if (remaining >= maxGainFromTier) {
            remaining -= maxGainFromTier;
            points += available;
        } else {
            // Partial tier — may not be exact if gain-per-point > 1
            const fullSteps = Math.floor(remaining / tier.gain);
            points += fullSteps;
            remaining -= fullSteps * tier.gain;
            if (remaining > 0) return null; // gain not achievable exactly
        }
    }
    return remaining === 0 ? points : null;
}

/**
 * Validate a chargen build spec and return `{ valid: true }` or
 * `{ valid: false, reason: string }`.
 *
 * buildSpec shape:
 *   {
 *     statSpend:      { nerve: n, tradecraft: n, fieldcraft: n, command: n },
 *     originTraitId:  string | null,
 *     careerTraitIds: string[],
 *     platform:       { type: string, employerLaneId: string | null }
 *   }
 */
export function validateBuild(buildSpec) {
    if (!buildSpec || typeof buildSpec !== "object") {
        return { valid: false, reason: "buildSpec must be an object" };
    }

    const { statSpend = {}, careerTraitIds = [] } = buildSpec;

    // Stat spend validation
    let totalStatPoints = 0;
    for (const stat of CHAR_STATS) {
        const spent = Number(statSpend[stat] || 0);
        if (!Number.isInteger(spent) || spent < 0) {
            return { valid: false, reason: `Stat spend for '${stat}' must be a non-negative integer` };
        }
        if (spent > STAT_BUY_CURVE[STAT_BUY_CURVE.length - 1].to) {
            return { valid: false, reason: `Stat spend for '${stat}' exceeds the maximum of ${STAT_BUY_CURVE[STAT_BUY_CURVE.length - 1].to} points` };
        }
        const resultStat = CHAR_DEFAULTS.STAT_BASE + calcStatGain(spent);
        if (resultStat > CHAR_DEFAULTS.STAT_CAP) {
            return { valid: false, reason: `Stat '${stat}' would exceed the hard cap of ${CHAR_DEFAULTS.STAT_CAP}` };
        }
        totalStatPoints += spent;
    }

    // Career trait cost
    const careerCost = Array.isArray(careerTraitIds) ? careerTraitIds.length * CHAR_DEFAULTS.CAREER_TRAIT_COST : 0;
    const totalSpend = totalStatPoints + careerCost;

    if (totalSpend > CHAR_DEFAULTS.CHARGEN_POINTS) {
        return { valid: false, reason: `Total spend ${totalSpend} exceeds the chargen budget of ${CHAR_DEFAULTS.CHARGEN_POINTS}` };
    }

    return { valid: true };
}

/**
 * Apply a validated build spec to produce a character object and the
 * remaining cash bonus from leftover points.
 */
export function buildCharacterFromSpec(buildSpec) {
    const { statSpend = {}, originTraitId = null, careerTraitIds = [], platform = { type: DEFAULT_PLATFORM_TYPE, employerLaneId: null } } = buildSpec;

    const stats = {};
    let totalStatPoints = 0;
    CHAR_STATS.forEach(stat => {
        const spent = Number(statSpend[stat] || 0);
        stats[stat] = CHAR_DEFAULTS.STAT_BASE + calcStatGain(spent);
        totalStatPoints += spent;
    });

    const careerCost = (Array.isArray(careerTraitIds) ? careerTraitIds.length : 0) * CHAR_DEFAULTS.CAREER_TRAIT_COST;
    const leftoverPoints = CHAR_DEFAULTS.CHARGEN_POINTS - totalStatPoints - careerCost;

    return {
        character: {
            stats,
            traits: [
                ...(originTraitId ? [originTraitId] : []),
                ...(Array.isArray(careerTraitIds) ? careerTraitIds : [])
            ],
            originTraitId: originTraitId || null,
            careerTraitIds: Array.isArray(careerTraitIds) ? [...careerTraitIds] : [],
            platform: { ...platform },
            contacts: []
        },
        leftoverPoints
    };
}
