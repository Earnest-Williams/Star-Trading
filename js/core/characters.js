// Core character factory and helpers for player + captains.
import { CHAR_STATS, CHAR_DEFAULTS, DEFAULT_PLATFORM_TYPE } from '../config/characters.js';

export const CHARACTER_SCHEMA_FIELDS = Object.freeze([
    "stats",
    "traits",
    "originTraitId",
    "careerTraitIds",
    "platform",
    "contacts",
    "packageIds",
    "equipment"
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
    const legacyTypes = {
        ship_owned: DEFAULT_PLATFORM_TYPE,
        ship_rented: "rental_cutter_no_ship",
        employed_salary: "employer_salary_no_ship",
        employed_commission: "employer_commission_no_ship"
    };
    const rawType = platform?.type || DEFAULT_PLATFORM_TYPE;
    return {
        type: legacyTypes[rawType] || rawType,
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
    contacts: value => Array.isArray(value) ? value : [],
    packageIds: value => Array.isArray(value) ? value : [],
    equipment: value => Array.isArray(value) ? value : []
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
        packageIds: [],
        equipment: [],
        ...overrides
    });
}

export { calcStatGain, calcPointsForStatValue, validateBuild, buildCharacterFromSpec } from './characterBuild.js';
