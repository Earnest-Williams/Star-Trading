import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { executeAction, registerAction, resetActions, commandOk } from '../js/core/commands.js';
import { applyCommandResult } from '../js/ui/ui.js';
import { Renderer } from '../js/ui/renderer.js';
import { resetState } from '../js/state.js';
import { registerUIActions, markUIActionsUnregistered } from '../js/ui/ui.js';

beforeEach(() => {
    resetActions();
    resetState();
    markUIActionsUnregistered();
});

describe('command result hardening', () => {
    it('unknown actions return ok false', () => {
        const result = executeAction({ type: 'missing:action', args: [] });
        assert.equal(result.ok, false);
    });

    it('failed save returns ok false and message', () => {
        registerUIActions();
        const result = executeAction({ type: 'saveGame' });
        assert.equal(result.ok, false);
        assert.equal(result.message, 'Save failed.');
    });

    it('failed load returns ok false and message', () => {
        registerUIActions();
        const result = executeAction({ type: 'loadGame' });
        assert.equal(result.ok, false);
        assert.equal(result.message, 'Load failed.');
    });

    it('slice-returning results trigger slice renderer updates', () => {
        const seen = [];
        const original = Renderer.sliceChanged;
        Renderer.sliceChanged = (...slices) => seen.push(...slices);
        registerAction('slices', () => commandOk('map', 'header'));
        applyCommandResult(executeAction({ type: 'slices' }));
        Renderer.sliceChanged = original;
        assert.deepEqual(seen, ['map', 'header']);
    });

    it('successful no-slice actions set invalidateAll true', () => {
        registerAction('noSlices', () => commandOk());
        const result = executeAction({ type: 'noSlices' });
        assert.equal(result.ok, true);
        assert.equal(result.invalidateAll, true);
    });

    it('applyCommandResult handles slices and invalidateAll in the same result', () => {
        const seenSlices = [];
        let invalidateAllCount = 0;
        const originalSliceChanged = Renderer.sliceChanged;
        const originalInvalidateAll = Renderer.invalidateAll;
        Renderer.sliceChanged = (...slices) => seenSlices.push(...slices);
        Renderer.invalidateAll = () => { invalidateAllCount += 1; };

        applyCommandResult({
            ok: true,
            slices: ['map'],
            invalidateAll: true
        });

        Renderer.sliceChanged = originalSliceChanged;
        Renderer.invalidateAll = originalInvalidateAll;
        assert.deepEqual(seenSlices, ['map']);
        assert.equal(invalidateAllCount, 1);
    });
});
