import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { BALANCE } from '../js/constants.js';
import { getPersistenceStorage, hasSavedGame } from '../js/core/persistence.js';
import { loadPreferences } from '../js/core/preferences.js';

function withThrowingLocalStorage(fn) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        get() {
            throw new Error('storage blocked');
        }
    });
    try {
        fn();
    } finally {
        if (descriptor) {
            Object.defineProperty(globalThis, 'localStorage', descriptor);
        } else {
            delete globalThis.localStorage;
        }
    }
}

describe('shell entry integration guardrails', () => {
    afterEach(() => {
        delete globalThis.localStorage;
    });

    it('keeps new-game occupied-site options aligned with balance presets', () => {
        const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
        const start = html.indexOf('<select id="worldgen-sites">');
        const end = html.indexOf('</select>', start);
        assert.notEqual(start, -1);
        assert.notEqual(end, -1);
        const selectHtml = html.slice(start, end);
        const optionValues = Array.from(selectHtml.matchAll(/<option value="(\d+)"/g), match => Number(match[1]));

        assert.deepEqual(optionValues, BALANCE.WORLDGEN.SITE_COUNT_PRESETS);
        assert.match(selectHtml, new RegExp(`value="${BALANCE.WORLDGEN.DEFAULT_OCCUPIED_SITES}" selected`));
    });

    it('treats blocked browser storage as unavailable for saves', () => {
        withThrowingLocalStorage(() => {
            assert.equal(getPersistenceStorage(), null);
            assert.equal(hasSavedGame(), false);
        });
    });

    it('treats blocked browser storage as unavailable for preferences', () => {
        withThrowingLocalStorage(() => {
            assert.deepEqual(loadPreferences(), {
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
                mapHelpOpen: false,
                mapInspectorCompact: false
            });
        });
    });
});
