import { BALANCE } from '../constants.js';

export const PREFERENCES_KEY = 'starTradingPreferencesV1';

export function getDefaultPreferences() {
    return {
        reducedMotion: false,
        compactUi: false,
        showBootTips: true,
        defaultWorldgenArchetype: BALANCE.WORLDGEN.DEFAULT_ARCHETYPE,
        defaultOccupiedSites: BALANCE.WORLDGEN.DEFAULT_OCCUPIED_SITES
    };
}

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function pickBoolean(value, fallback) {
    return typeof value === 'boolean' ? value : fallback;
}

function normaliseArchetype(value, fallback) {
    if (typeof value !== 'string') return fallback;
    return Object.hasOwn(BALANCE.WORLDGEN.ARCHETYPES, value) ? value : fallback;
}

function normaliseOccupiedSites(value, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    const rounded = Math.round(numeric);
    return Math.max(1, Math.min(BALANCE.WORLDGEN.MAX_OCCUPIED_SITES, rounded));
}

export function normalisePreferences(raw) {
    const defaults = getDefaultPreferences();
    if (!isObject(raw)) return defaults;

    return {
        reducedMotion: pickBoolean(raw.reducedMotion, defaults.reducedMotion),
        compactUi: pickBoolean(raw.compactUi, defaults.compactUi),
        showBootTips: pickBoolean(raw.showBootTips, defaults.showBootTips),
        defaultWorldgenArchetype: normaliseArchetype(raw.defaultWorldgenArchetype, defaults.defaultWorldgenArchetype),
        defaultOccupiedSites: normaliseOccupiedSites(raw.defaultOccupiedSites, defaults.defaultOccupiedSites)
    };
}

function resolveStorage(storage) {
    if (storage) return storage;
    return globalThis.localStorage || null;
}

export function loadPreferences(storage = null) {
    const targetStorage = resolveStorage(storage);
    if (!targetStorage || typeof targetStorage.getItem !== 'function') {
        return getDefaultPreferences();
    }
    const raw = targetStorage.getItem(PREFERENCES_KEY);
    if (!raw) return getDefaultPreferences();
    try {
        return normalisePreferences(JSON.parse(raw));
    } catch (err) {
        return getDefaultPreferences();
    }
}

export function savePreferences(storage = null, prefs) {
    const targetStorage = resolveStorage(storage);
    const normalised = normalisePreferences(prefs);
    if (!targetStorage || typeof targetStorage.setItem !== 'function') {
        return normalised;
    }
    try {
        targetStorage.setItem(PREFERENCES_KEY, JSON.stringify(normalised));
    } catch (err) {
        return normalised;
    }
    return normalised;
}
