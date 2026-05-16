import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetState, state } from '../js/state.js';
import {
    DAILY_WORLD_TICK_PHASES,
    HOURLY_WORLD_TICK_PHASES,
    expireFactionIntel,
    runWorldTickPhases
} from '../js/core/worldTick.js';

describe('world tick phase order', () => {
    it('keeps the daily simulation contract explicit and ordered', () => {
        assert.deepEqual(
            DAILY_WORLD_TICK_PHASES.map(phase => phase.id),
            [
                'colony_production',
                'explicit_trade_route_runs',
                'ambient_trade_response',
                'ambient_data_propagation',
                'data_cargo_culling',
                'colony_needs',
                'port_markets',
                'sector_threats',
                'faction_politics',
                'mission_expiry',
                'secure_courier_contracts',
                'secure_payload_expiry',
                'captain_daily_actions',
                'social_entanglements',
                'daily_world_event'
            ]
        );
    });

    it('keeps the hourly simulation contract explicit and ordered', () => {
        assert.deepEqual(
            HOURLY_WORLD_TICK_PHASES.map(phase => phase.id),
            [
                'captain_hourly_actions',
                'mission_opportunities',
                'intel_expiry',
                'private_payload_expiry',
                'dialogue_task_resolution'
            ]
        );
    });

    it('runs phases in order and forwards the tick reason', () => {
        const calls = [];
        const phases = [
            { id: 'first', run: reason => calls.push(`first:${reason}`) },
            { id: 'second', run: reason => calls.push(`second:${reason}`) }
        ];

        runWorldTickPhases(phases, 'test tick');

        assert.deepEqual(calls, ['first:test tick', 'second:test tick']);
    });
});

describe('expireFactionIntel', () => {
    beforeEach(() => {
        resetState();
    });

    it('removes faction intel whose expiry day has passed', () => {
        state.player = {
            time: { day: 4 },
            factions: {
                intel: [
                    { id: 'expired', expiresDay: 3 },
                    { id: 'today', expiresDay: 4 },
                    { id: 'future', expiresDay: 5 }
                ]
            }
        };

        expireFactionIntel();

        assert.deepEqual(
            state.player.factions.intel.map(item => item.id),
            ['today', 'future']
        );
    });

    it('leaves players without faction intel unchanged', () => {
        state.player = { time: { day: 4 }, factions: {} };

        assert.doesNotThrow(() => expireFactionIntel());
        assert.deepEqual(state.player.factions, {});
    });
});
