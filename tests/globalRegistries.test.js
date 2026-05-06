import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { EventBus } from '../js/events.js';
import { Renderer } from '../js/ui/renderer.js';
import {
    clearDailyHooks,
    clearHourlyHooks,
    registerDailyHook,
    registerHourlyHook,
    runDailyWorldTick,
    runHourlyWorldTick,
    unregisterDailyHook,
    unregisterHourlyHook
} from '../js/core/time.js';

describe('EventBus lifecycle', () => {
    it('unregisters and resets listeners', () => {
        let count = 0;
        const listener = () => { count += 1; };
        const unsubscribe = EventBus.on('test:event', listener);
        EventBus.emit('test:event');
        unsubscribe();
        EventBus.emit('test:event');
        EventBus.on('test:event', listener);
        EventBus.reset('test:event');
        EventBus.emit('test:event');
        assert.equal(count, 1);
    });
});

describe('Renderer lifecycle', () => {
    it('unregisters and clears render handlers', () => {
        let count = 0;
        const handler = () => { count += 1; };
        const unregister = Renderer.register('test-panel', handler);
        assert.equal(Renderer.unregister('test-panel', () => {}), false);
        unregister();
        Renderer.invalidate('test-panel');
        Renderer.register('test-panel', handler);
        assert.equal(Renderer.unregister('test-panel', handler), true);
        Renderer.register('test-panel', handler);
        Renderer.clear();
        Renderer.invalidateAll();
        assert.equal(count, 0);
    });
});

describe('time hook lifecycle', () => {
    it('unregisters daily and hourly hooks', () => {
        clearDailyHooks();
        clearHourlyHooks();
        let daily = 0;
        let hourly = 0;
        const dailyHook = () => { daily += 1; };
        const hourlyHook = () => { hourly += 1; };
        const unregisterReturnedDaily = registerDailyHook(dailyHook);
        registerHourlyHook(hourlyHook);
        runDailyWorldTick('test');
        runHourlyWorldTick('test');
        unregisterReturnedDaily();
        unregisterHourlyHook(hourlyHook);
        runDailyWorldTick('test');
        runHourlyWorldTick('test');
        assert.equal(daily, 1);
        assert.equal(hourly, 1);
        registerDailyHook(dailyHook);
        unregisterDailyHook(dailyHook);
        clearDailyHooks();
        clearHourlyHooks();
    });
});
