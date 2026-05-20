import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { state, resetState } from '../js/state.js';
import { addJumpGateCorridor } from '../js/core/universe.js';
import { runAmbientTradeDaily } from '../js/systems/ambientTrade.js';

function buildWorld({ connected = true, badlands = false } = {}) {
    resetState();
    state.player = { time: { day: 1 }, seed: 12345 };
    state.universe = {
        1: { id: 1, jumpGates: [], region: 'Core', pirateThreat: 0, influence: { sda: 60, fu: 0, hc: 0, vc: 0 } },
        2: { id: 2, jumpGates: [], region: badlands ? 'Badlands' : 'Core', pirateThreat: badlands ? 6 : 0, influence: { sda: 20, fu: 0, hc: 0, vc: badlands ? 80 : 0 } },
        3: { id: 3, jumpGates: [], region: 'Core', pirateThreat: 0, influence: { sda: 60, fu: 0, hc: 0, vc: 0 } }
    };
    if (connected) {
        addJumpGateCorridor(1, 2);
        addJumpGateCorridor(2, 3);
    }
    state.ports = {
        1: { typeKey: 'mining', factionId: 'hc', stock: { ore: 5500, org: 0, eq: 0 }, maxStock: { ore: 6000, org: 5000, eq: 4000 }, basePrices: { ore: 80, org: 150, eq: 300 } },
        3: { typeKey: 'industrial', factionId: 'hc', stock: { ore: 100, org: 3000, eq: 3000 }, maxStock: { ore: 6000, org: 5000, eq: 4000 }, basePrices: { ore: 80, org: 150, eq: 300 } }
    };
    state.planets = {};
}

describe('ambient trade', () => {
    it('reduces shortage when profitable connected supply exists', () => {
        buildWorld();
        const before = state.ports[3].stock.ore;
        const summary = runAmbientTradeDaily();
        assert.ok(state.ports[3].stock.ore > before);
        assert.ok(summary.flows > 0);
    });

    it('does not fully eliminate large shortages in one tick', () => {
        buildWorld();
        runAmbientTradeDaily();
        assert.ok(state.ports[3].stock.ore < 6000 * 0.62);
    });

    it('high risk reduces ambient flow', () => {
        buildWorld();
        const safe = runAmbientTradeDaily().moved.ore;
        buildWorld({ badlands: true });
        const risky = runAmbientTradeDaily().moved.ore;
        assert.ok(risky < safe);
    });

    it('no ambient trade occurs without connectivity', () => {
        buildWorld({ connected: false });
        const before = state.ports[3].stock.ore;
        const summary = runAmbientTradeDaily();
        assert.equal(state.ports[3].stock.ore, before);
        assert.equal(summary.flows, 0);
    });

    it('tracks blocked units and residual demand without connectivity', () => {
        buildWorld({ connected: false });
        const summary = runAmbientTradeDaily();
        assert.ok(summary.residualDemand.ore > 0);
        assert.ok(summary.blockedUnits.ore > 0);
        assert.ok(summary.blockedUnits.ore <= summary.residualDemand.ore);
    });

});
