import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE, SAVE_KEY } from '../js/constants.js';
import {
    PREFERENCES_KEY,
    getDefaultPreferences,
    normalisePreferences,
    loadPreferences,
    savePreferences
} from '../js/core/preferences.js';

describe('preferences', () => {
    it('returns safe defaults', () => {
        assert.deepEqual(getDefaultPreferences(), {
            reducedMotion: false,
            compactUi: false,
            showBootTips: true,
            defaultWorldgenArchetype: BALANCE.WORLDGEN.DEFAULT_ARCHETYPE,
            defaultOccupiedSites: BALANCE.WORLDGEN.DEFAULT_OCCUPIED_SITES
        });
    });

    it('normalises malformed values to defaults', () => {
        const defaults = getDefaultPreferences();
        assert.deepEqual(normalisePreferences(null), defaults);
        assert.deepEqual(normalisePreferences([]), defaults);
        assert.deepEqual(normalisePreferences('bad'), defaults);
    });

    it('clamps invalid enum/numeric values and defaults invalid booleans', () => {
        const normalised = normalisePreferences({
            reducedMotion: true,
            compactUi: 'yes',
            showBootTips: 0,
            defaultWorldgenArchetype: 'not-a-real-archetype',
            defaultOccupiedSites: 999999
        });

        assert.equal(normalised.reducedMotion, true);
        assert.equal(normalised.compactUi, false);
        assert.equal(normalised.showBootTips, true);
        assert.equal(normalised.defaultWorldgenArchetype, BALANCE.WORLDGEN.DEFAULT_ARCHETYPE);
        assert.equal(normalised.defaultOccupiedSites, BALANCE.WORLDGEN.MAX_OCCUPIED_SITES);
    });

    it('falls back cleanly when storage is unavailable', () => {
        assert.deepEqual(loadPreferences(null), getDefaultPreferences());
    });

    it('falls back to defaults when stored JSON is malformed', () => {
        const storage = {
            getItem(key) {
                if (key === PREFERENCES_KEY) return '{';
                return null;
            }
        };
        assert.deepEqual(loadPreferences(storage), getDefaultPreferences());
    });

    it('saves preferences independently from game saves', () => {
        const writes = new Map();
        writes.set(SAVE_KEY, '{"version":17}');
        const storage = {
            getItem(key) {
                return writes.get(key) || null;
            },
            setItem(key, value) {
                writes.set(key, value);
            }
        };

        const saved = savePreferences(storage, {
            reducedMotion: true,
            compactUi: true,
            showBootTips: false,
            defaultWorldgenArchetype: 'dwarf_irregular',
            defaultOccupiedSites: 215
        });

        assert.equal(saved.reducedMotion, true);
        assert.equal(saved.compactUi, true);
        assert.equal(saved.showBootTips, false);
        assert.equal(saved.defaultWorldgenArchetype, 'dwarf_irregular');
        assert.equal(saved.defaultOccupiedSites, 215);
        assert.equal(writes.get(SAVE_KEY), '{"version":17}');
        assert.deepEqual(JSON.parse(writes.get(PREFERENCES_KEY)), saved);
    });
});
