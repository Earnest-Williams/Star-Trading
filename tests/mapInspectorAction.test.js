import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { executeAction } from '../js/core/commands.js';
import { PREFERENCES_KEY } from '../js/core/preferences.js';
import { resetState, state } from '../js/state.js';
import { StateSlice } from '../js/ui/stateSlices.js';
import { disposeUI, registerUIActions } from '../js/ui/ui.js';

function createStorage() {
    const values = new Map();
    return {
        getItem(key) {
            return values.get(key) ?? null;
        },
        setItem(key, value) {
            values.set(key, value);
        },
        removeItem(key) {
            values.delete(key);
        }
    };
}

describe('map inspector compact action registration', () => {
    beforeEach(() => {
        disposeUI();
        resetState();
        globalThis.localStorage = createStorage();
        registerUIActions();
    });

    afterEach(() => {
        delete globalThis.localStorage;
        disposeUI();
    });

    it('executes toggleMapInspectorCompact through the action registry', () => {
        assert.equal(state.mapInspectorCompact, false);

        const result = executeAction({ type: 'toggleMapInspectorCompact', args: [] });

        assert.equal(result.ok, true);
        assert.deepEqual(result.slices, [StateSlice.UI_RUNTIME]);
        assert.equal(state.mapInspectorCompact, true);

        const persisted = globalThis.localStorage.getItem(PREFERENCES_KEY);
        assert.notEqual(persisted, null);
        assert.equal(JSON.parse(persisted).mapInspectorCompact, true);
    });
});
