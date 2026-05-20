import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resetState, state } from '../js/state.js';
import { applyDailyConsumption } from '../js/systems/economy/consumption.js';
import { applyDailyProduction } from '../js/systems/economy/production.js';

describe('economy daily systems', () => {
    beforeEach(() => {
        resetState();
    });

    it('consumption tolerates null player and missing port stock', () => {
        state.player = null;
        state.economy.profilesBySector = {
            1: { roleTags: [] }
        };
        state.ports[1] = { sectorId: 1 };

        assert.doesNotThrow(() => applyDailyConsumption());
        assert.deepEqual(state.ports[1].stock, {
            water_ice: 0,
            org: 0,
            medical_supplies: 0,
            repair_parts: 0
        });
        assert.equal(state.economy.dailySummary?.day, null);
    });

    it('production tolerates null player and missing port stock', () => {
        state.player = null;
        state.economy.profilesBySector = {
            2: { roleTags: [] }
        };
        state.universe[2] = { id: 2 };
        state.ports[2] = {
            sectorId: 2,
            maxStock: { ore: 100, heavy_metals: 100, rare_earths: 100, water_ice: 100, electronics: 100, eq: 100, pulse_canister: 100 }
        };

        assert.doesNotThrow(() => applyDailyProduction());
        assert.equal(state.ports[2].stock.ore, 0);
        assert.equal(state.economy.dailySummary?.day, null);
    });

    it('uses the way-station refinery multiplier for pulse canister production', () => {
        state.player = { time: { day: 7 } };
        state.economy.profilesBySector = {
            3: { roleTags: ['port:way_station'] }
        };
        state.universe[3] = { id: 3 };
        state.ports[3] = {
            sectorId: 3,
            stock: {
                water_ice: 10,
                pulse_canister: 0,
                ore: 0,
                heavy_metals: 0,
                rare_earths: 0,
                electronics: 0,
                eq: 0
            },
            maxStock: {
                water_ice: 100,
                pulse_canister: 100,
                ore: 100,
                heavy_metals: 100,
                rare_earths: 100,
                electronics: 100,
                eq: 100
            }
        };

        const summary = applyDailyProduction();

        assert.equal(state.ports[3].stock.water_ice, 8);
        assert.equal(state.ports[3].stock.pulse_canister, 1);
        assert.equal(summary.produced.pulse_canister, 1);
    });
});
