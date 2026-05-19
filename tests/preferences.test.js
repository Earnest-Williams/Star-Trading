import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE, SAVE_KEY } from '../js/constants.js';
import {
    PREFERENCES_KEY,
    getDefaultPreferences,
    normalisePreferences,
    loadPreferences,
    savePreferences,
    savePreferencePatch,
    saveSettingsPreferences
} from '../js/core/preferences.js';

describe('preferences', () => {
    it('returns safe defaults', () => {
        assert.deepEqual(getDefaultPreferences(), {
            reducedMotion: false,
            compactUi: false,
            showBootTips: true,
            defaultWorldgenArchetype: BALANCE.WORLDGEN.DEFAULT_ARCHETYPE,
            defaultOccupiedSites: BALANCE.WORLDGEN.DEFAULT_OCCUPIED_SITES,
            leftSidebarCollapsed: false,
            rightSidebarCollapsed: false,
            mapLayers: {
                systems: true,
                asteroids: true,
                influence: true,
                tradeRoutes: true,
                contestedZones: true,
                dataFreshness: true
            },
            mapLayersOpen: true,
            mapInspectorCompact: false
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
            defaultOccupiedSites: 999999,
            leftSidebarCollapsed: true,
            rightSidebarCollapsed: 'no',
            mapLayers: { systems: false, asteroids: 'sometimes' },
            mapLayersOpen: false,
            mapHelpOpen: true,
            mapInspectorCompact: true
        });

        assert.equal(normalised.reducedMotion, true);
        assert.equal(normalised.compactUi, false);
        assert.equal(normalised.showBootTips, true);
        assert.equal(normalised.defaultWorldgenArchetype, BALANCE.WORLDGEN.DEFAULT_ARCHETYPE);
        assert.equal(normalised.defaultOccupiedSites, BALANCE.WORLDGEN.MAX_OCCUPIED_SITES);
        assert.equal(normalised.leftSidebarCollapsed, true);
        assert.equal(normalised.rightSidebarCollapsed, false);
        assert.equal(normalised.mapLayers.systems, false);
        assert.equal(normalised.mapLayers.asteroids, true);
        assert.equal(normalised.mapLayers.tradeRoutes, true);
        assert.equal(normalised.mapLayersOpen, false);
        assert.equal(Object.hasOwn(normalised, 'mapHelpOpen'), false);
        assert.equal(normalised.mapInspectorCompact, true);
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
            defaultOccupiedSites: 215,
            leftSidebarCollapsed: true,
            rightSidebarCollapsed: true,
            mapLayers: { systems: false, tradeRoutes: false },
            mapLayersOpen: false,
            mapHelpOpen: true,
            mapInspectorCompact: true
        });

        assert.equal(saved.reducedMotion, true);
        assert.equal(saved.compactUi, true);
        assert.equal(saved.showBootTips, false);
        assert.equal(saved.defaultWorldgenArchetype, 'dwarf_irregular');
        assert.equal(saved.defaultOccupiedSites, 215);
        assert.equal(saved.leftSidebarCollapsed, true);
        assert.equal(saved.rightSidebarCollapsed, true);
        assert.equal(saved.mapLayers.systems, false);
        assert.equal(saved.mapLayers.tradeRoutes, false);
        assert.equal(saved.mapLayers.asteroids, true);
        assert.equal(saved.mapLayersOpen, false);
        assert.equal(Object.hasOwn(saved, 'mapHelpOpen'), false);
        assert.equal(saved.mapInspectorCompact, true);
        assert.equal(writes.get(SAVE_KEY), '{"version":17}');
        assert.deepEqual(JSON.parse(writes.get(PREFERENCES_KEY)), saved);
    });

    it('merges partial preference patches without resetting unrelated UI fields', () => {
        const writes = new Map();
        const storage = {
            getItem(key) {
                return writes.get(key) || null;
            },
            setItem(key, value) {
                writes.set(key, value);
            }
        };

        savePreferences(storage, {
            leftSidebarCollapsed: true,
            rightSidebarCollapsed: true,
            mapLayers: { systems: false, asteroids: false, tradeRoutes: false },
            mapLayersOpen: false,
            mapInspectorCompact: true
        });

        const saved = savePreferencePatch(storage, { compactUi: true });

        assert.equal(saved.compactUi, true);
        assert.equal(saved.leftSidebarCollapsed, true);
        assert.equal(saved.rightSidebarCollapsed, true);
        assert.equal(saved.mapLayers.systems, false);
        assert.equal(saved.mapLayers.asteroids, false);
        assert.equal(saved.mapLayers.tradeRoutes, false);
        assert.equal(saved.mapLayers.influence, true);
        assert.equal(saved.mapLayersOpen, false);
        assert.equal(saved.mapInspectorCompact, true);
        assert.deepEqual(JSON.parse(writes.get(PREFERENCES_KEY)), saved);
    });

    it('merges Settings saves into current preferences instead of replacing layout choices', () => {
        const writes = new Map();
        const storage = {
            getItem(key) {
                return writes.get(key) || null;
            },
            setItem(key, value) {
                writes.set(key, value);
            }
        };

        savePreferences(storage, {
            reducedMotion: false,
            compactUi: false,
            showBootTips: true,
            defaultWorldgenArchetype: 'balanced',
            defaultOccupiedSites: 60,
            leftSidebarCollapsed: true,
            rightSidebarCollapsed: true,
            mapLayers: { systems: false, influence: false },
            mapLayersOpen: false,
            mapInspectorCompact: true
        });

        const saved = saveSettingsPreferences(storage, {
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
        assert.equal(saved.leftSidebarCollapsed, true);
        assert.equal(saved.rightSidebarCollapsed, true);
        assert.equal(saved.mapLayers.systems, false);
        assert.equal(saved.mapLayers.influence, false);
        assert.equal(saved.mapLayers.tradeRoutes, true);
        assert.equal(saved.mapLayersOpen, false);
        assert.equal(saved.mapInspectorCompact, true);
        assert.deepEqual(JSON.parse(writes.get(PREFERENCES_KEY)), saved);
    });

    it('repairs old partial preference payloads without reviving transient map help state', () => {
        const storage = {
            getItem(key) {
                if (key !== PREFERENCES_KEY) return null;
                return JSON.stringify({
                    mapHelpOpen: true,
                    mapLayers: { systems: false },
                    leftSidebarCollapsed: true
                });
            }
        };

        const loaded = loadPreferences(storage);

        assert.equal(loaded.leftSidebarCollapsed, true);
        assert.equal(loaded.rightSidebarCollapsed, false);
        assert.equal(loaded.mapLayers.systems, false);
        assert.equal(loaded.mapLayers.asteroids, true);
        assert.equal(Object.hasOwn(loaded, 'mapHelpOpen'), false);
        assert.equal(loaded.mapLayersOpen, true);
        assert.equal(loaded.mapInspectorCompact, false);
    });

});
