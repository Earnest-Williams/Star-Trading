import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetState, state } from '../js/state.js';
import {
    DAILY_WORLD_TICK_PHASES,
    HOURLY_WORLD_TICK_PHASES,
    expireFactionIntel,
    runWorldTickPhases
} from '../js/core/worldTick.js';
import { runAmbientTradeDaily } from '../js/systems/ambientTrade.js';
import { recomputeEconomyPressure } from '../js/systems/economy/pressure.js';

describe('world tick phase order', () => {
    it('keeps the daily simulation contract explicit and ordered', () => {
        assert.deepEqual(
            DAILY_WORLD_TICK_PHASES.map(phase => phase.id),
            [
                'colony_production',
                'economy_daily_consumption',
                'economy_daily_production',
                'economy_pressure_recompute',
                'explicit_trade_route_runs',
                'player_property_economics',
                'ambient_trade_response',
                'economy_pressure_post_ambient',
                'economy_contracts',
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
                'logistics_objectives',
                'dialogue_memory_decay',
                'dialogue_maintenance',
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
                'dialogue_task_resolution',
                'dialogue_offer_expiry'
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

describe('economy post-ambient integration seam', () => {
    beforeEach(() => {
        resetState();
        state.player = { time: { day: 5 } };
        state.universe = {
            1: { id: 1, jumpGates: [2], pirateThreat: 0 },
            2: { id: 2, jumpGates: [1], pirateThreat: 0 }
        };
        state.ports = {
            1: { stock: { ore: 180 }, maxStock: { ore: 200 }, basePrices: { ore: 80 } },
            2: { stock: { ore: 0 }, maxStock: { ore: 200 }, basePrices: { ore: 80 } }
        };
        state.planets = {};
        state.economy.profilesBySector = {
            1: { roleTags: ['port:mining'], supplyWeight: 1, demandWeight: 1 },
            2: { roleTags: ['port:industrial'], supplyWeight: 1, demandWeight: 1 }
        };
        recomputeEconomyPressure();
    });

    it('ambient trade flow is followed by a pressure recompute update', () => {
        const before = state.economy.pressureBySector?.['2']?.ore?.shortageSeverity ?? 0;
        runAmbientTradeDaily();
        recomputeEconomyPressure();
        const signal = state.economy.pressureBySector?.['2']?.ore || {};
        const after = signal.shortageSeverity ?? 0;
        assert.equal(after <= before, true);
        assert.equal(signal.confidence >= 0 && signal.confidence <= 1, true);
    });
});

describe('recomputeEconomyPressure / explainPressure — primaryCause', () => {
    beforeEach(() => {
        resetState();
        state.player = { time: { day: 10 } };
        state.planets = {};
    });

    it('reports unmet demand when consumption exceeds current stock', () => {
        state.ports = {
            1: { stock: { ore: 5 }, maxStock: { ore: 200 } }
        };
        state.economy.profilesBySector = {
            1: { baselineConsumption: { ore: 20 }, targetStock: { ore: 80 } }
        };
        recomputeEconomyPressure();
        const signal = state.economy.pressureBySector?.['1']?.ore;
        assert.ok(signal, 'pressure record exists');
        assert.equal(typeof signal.primaryCause, 'string');
        assert.match(signal.primaryCause, /ore demand is not fully met/);
    });

    it('reports below-target shortage when stock is low and consumption is positive', () => {
        // Stock is 20/200 (10%), well below TARGET_STOCK_RATIO (~45%), but > dailyConsumption
        state.ports = {
            1: { stock: { ore: 20 }, maxStock: { ore: 200 } }
        };
        state.economy.profilesBySector = {
            1: { baselineConsumption: { ore: 3 }, targetStock: { ore: 90 } }
        };
        recomputeEconomyPressure();
        const signal = state.economy.pressureBySector?.['1']?.ore;
        assert.ok(signal, 'pressure record exists');
        assert.match(signal.primaryCause, /below target and local demand is persistent/);
    });

    it('reports export pressure when stock exceeds target', () => {
        // Stock is 170/200 (85%), well above TARGET_STOCK_RATIO (~45%)
        state.ports = {
            1: { stock: { ore: 170 }, maxStock: { ore: 200 } }
        };
        state.economy.profilesBySector = {
            1: { baselineConsumption: { ore: 2 }, targetStock: { ore: 90 } }
        };
        recomputeEconomyPressure();
        const signal = state.economy.pressureBySector?.['1']?.ore;
        assert.ok(signal, 'pressure record exists');
        assert.match(signal.primaryCause, /above local target; export pressure is likely/);
    });

    it('reports near target when stock is at target and no consumption', () => {
        // Stock is exactly at TARGET_STOCK_RATIO (45%) with no consumption
        state.ports = {
            1: { stock: { ore: 90 }, maxStock: { ore: 200 } }
        };
        state.economy.profilesBySector = {
            1: { baselineConsumption: { ore: 0 }, targetStock: { ore: 90 } }
        };
        recomputeEconomyPressure();
        const signal = state.economy.pressureBySector?.['1']?.ore;
        assert.ok(signal, 'pressure record exists');
        assert.match(signal.primaryCause, /near local target/);
    });

    it('exposes primaryCause as a string on every commodity record', () => {
        state.ports = {
            1: { stock: { ore: 100 }, maxStock: { ore: 200 } }
        };
        state.economy.profilesBySector = {
            1: { roleTags: [] }
        };
        recomputeEconomyPressure();
        const sectorPressure = state.economy.pressureBySector?.['1'];
        assert.ok(sectorPressure, 'sector pressure exists');
        Object.values(sectorPressure).forEach(record => {
            assert.equal(typeof record.primaryCause, 'string', 'primaryCause is a string');
            assert.ok(record.primaryCause.length > 0, 'primaryCause is non-empty');
        });
    });
});
