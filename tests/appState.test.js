import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
    APP_MODES,
    createInitialState,
    isValidAppMode,
    resetState,
    setAppMode,
    state
} from '../js/state.js';
import { buildSaveData } from '../js/core/persistence.js';

describe('app shell state', () => {
    afterEach(() => {
        resetState();
    });

    it('starts with shell defaults', () => {
        const initial = createInitialState();
        assert.equal(initial.appMode, APP_MODES.MAIN_MENU);
        assert.equal(initial.shellMessage, null);
        assert.equal(initial.settingsOpenTab, 'general');
        assert.equal(initial.isTransitioning, false);
        assert.deepEqual(initial.economy, {
            version: 1,
            profilesBySector: {},
            pressureBySector: {},
            recentVolumeBySector: {},
            contracts: [],
            nextContractId: 1,
            dailySummary: null,
            lastProfileBuildDay: null,
            lastPressureDay: null,
            generatedByVersion: 1,
            universeBasePrices: {},
            priceDiagnostics: {},
            nodeMidPrices: {},
            spatialPriceDiagnostics: {},
            lastPriceCalibrationDay: null,
            lastSpatialPriceDay: null
        });
    });

    it('resetState restores shell defaults', () => {
        state.appMode = APP_MODES.SETTINGS;
        state.shellMessage = 'Hello shell';
        state.settingsOpenTab = 'audio';
        state.isTransitioning = true;

        resetState();

        assert.equal(state.appMode, APP_MODES.MAIN_MENU);
        assert.equal(state.shellMessage, null);
        assert.equal(state.settingsOpenTab, 'general');
        assert.equal(state.isTransitioning, false);
    });

    it('rejects unknown app modes', () => {
        assert.equal(isValidAppMode('bad-mode'), false);
        assert.throws(() => setAppMode('bad-mode'), /Invalid app mode/);
    });

    it('keeps shell-only fields out of save serialization', () => {
        state.appMode = APP_MODES.SETTINGS;
        state.shellMessage = 'Shell notification';
        state.settingsOpenTab = 'display';
        state.isTransitioning = true;

        const save = buildSaveData();
        assert.equal(Object.hasOwn(save, 'appMode'), false);
        assert.equal(Object.hasOwn(save, 'shellMessage'), false);
        assert.equal(Object.hasOwn(save, 'settingsOpenTab'), false);
        assert.equal(Object.hasOwn(save, 'isTransitioning'), false);
    });
});
