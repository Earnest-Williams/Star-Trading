// Smoke tests for core/time.js — time advancement and hook firing.
import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Stub browser globals used by transitively-imported modules (log, Notifications).
// All relevant functions guard against a null DOM element, so these are safe no-ops.
globalThis.document = { getElementById: () => null };

import { state } from '../js/state.js';
import {
    advanceTime,
    spendTime,
    canSpendTime,
    registerDailyHook,
    registerHourlyHook,
    getAbsoluteMinute,
    setTimeFromAbsoluteMinute,
} from '../js/core/time.js';

// Track hook firing across tests using module-level counters.
// registerDailyHook / registerHourlyHook accumulate; we reset counts per test.
let dailyFired = 0;
let hourlyFired = 0;

before(() => {
    registerDailyHook(() => { dailyFired++; });
    registerHourlyHook(() => { hourlyFired++; });
});

function resetPlayer(minuteOfDay = 480) {
    state.player = {
        time: {
            day: 1,
            minuteOfDay,
            wakeMinute: 480,  // 08:00
            sleepMinute: 1320 // 22:00
        }
    };
    dailyFired = 0;
    hourlyFired = 0;
}

describe('getAbsoluteMinute / setTimeFromAbsoluteMinute', () => {
    it('round-trips correctly', () => {
        resetPlayer(480);
        const abs = getAbsoluteMinute();
        assert.equal(abs, 480, 'day 1, minute 480 → absolute 480');
        setTimeFromAbsoluteMinute(1500);
        assert.equal(state.player.time.day, 2);
        assert.equal(state.player.time.minuteOfDay, 60);
    });
});

describe('canSpendTime', () => {
    it('returns true when within waking hours', () => {
        resetPlayer(480);
        assert.equal(canSpendTime(60), true);
    });

    it('returns false when before wake time', () => {
        resetPlayer(100);
        assert.equal(canSpendTime(30), false);
    });

    it('returns false when at or past sleep time', () => {
        resetPlayer(1320);
        assert.equal(canSpendTime(30), false);
    });

    it('returns false when action would exceed sleep time', () => {
        resetPlayer(1300);
        assert.equal(canSpendTime(60), false);
    });
});

describe('advanceTime — hourly hooks', () => {
    it('fires one hourly hook when crossing a single hour boundary', () => {
        resetPlayer(480); // 08:00 — already on the boundary
        advanceTime(60);  // advance exactly one hour
        // boundary at 540 fires the hourly hook; end at 540 doesn't re-fire
        assert.equal(hourlyFired, 1);
        assert.equal(dailyFired, 0);
    });

    it('fires two hourly hooks when crossing two boundaries', () => {
        resetPlayer(490);  // 08:10
        advanceTime(130);  // crosses 09:00 and 10:00
        assert.equal(hourlyFired, 2);
    });
});

describe('advanceTime — daily hook', () => {
    it('fires the daily hook on midnight crossing', () => {
        resetPlayer(1380); // 23:00
        advanceTime(60);   // crosses 00:00 (midnight = daily tick)
        assert.equal(dailyFired, 1);
    });

    it('advances day counter after midnight', () => {
        resetPlayer(1380);
        advanceTime(60);
        assert.equal(state.player.time.day, 2);
    });
});

describe('spendTime', () => {
    it('advances time and returns true within waking hours', () => {
        resetPlayer(480);
        const result = spendTime(30);
        assert.equal(result, true);
        assert.equal(state.player.time.minuteOfDay, 510);
    });

    it('returns false and does not advance time outside waking hours', () => {
        resetPlayer(1320);
        const result = spendTime(30);
        assert.equal(result, false);
        assert.equal(state.player.time.minuteOfDay, 1320);
    });
});
