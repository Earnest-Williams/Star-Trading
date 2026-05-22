import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { state, resetState } from '../js/state.js';
import { addJumpGateCorridor } from '../js/core/universe.js';
import { runAmbientTradeDaily } from '../js/systems/ambientTrade.js';
import { describeAmbientFlowSummary } from '../js/systems/economy/ambientFlows.js';
import { makeAmbientTradeSummary } from './helpers/economyTestState.js';

function buildWorld({ connected = true, badlands = false } = {}) {
    resetState();
    state.player = { time: { day: 1 }, seed: 12345 };
    state.universe = {
        1: { id: 1, jumpGates: [], region: 'Core', pirateThreat: 0, influence: { sda: 60, fu: 0, hc: 0, vc: 0 } },
        2: { id: 2, jumpGates: [], region: badlands ? 'Badlands' : 'Core', pirateThreat: badlands ? 10 : 0, influence: { sda: 20, fu: 0, hc: 0, vc: badlands ? 100 : 0 } },
        3: { id: 3, jumpGates: [], region: 'Core', pirateThreat: 0, influence: { sda: 60, fu: 0, hc: 0, vc: 0 } }
    };
    if (connected) {
        addJumpGateCorridor(1, 2);
        addJumpGateCorridor(2, 3);
    }
    state.ports = {
        1: { typeKey: 'mining', factionId: 'hc', stock: { ore: 5500, org: 0, eq: 0 }, maxStock: { ore: 6000, org: 5000, eq: 4000 }, basePrices: { ore: 20, org: 90, eq: 180 } },
        3: { typeKey: 'industrial', factionId: 'hc', stock: { ore: 100, org: 3000, eq: 3000 }, maxStock: { ore: 6000, org: 5000, eq: 4000 }, basePrices: { ore: 420, org: 240, eq: 420 } }
    };
    state.planets = {};
}

describe('ambient trade', () => {
    it('reduces shortage when profitable connected supply exists', () => {
        buildWorld();
        const before = state.ports[3].stock.ore;
        const summary = runAmbientTradeDaily();
        assert.equal(summary.moved.ore, state.ports[3].stock.ore - before);
        assert.ok(summary.attemptedDemand.ore > 0);
    });

    it('does not fully eliminate large shortages in one tick', () => {
        buildWorld();
        runAmbientTradeDaily();
        assert.ok(state.ports[3].stock.ore < 6000 * 0.62);
    });

    it('high risk reduces ambient flow', () => {
        buildWorld();
        const safeSummary = runAmbientTradeDaily();
        const safe = safeSummary.moved.ore;

        buildWorld({ badlands: true });
        const riskySummary = runAmbientTradeDaily();
        const risky = riskySummary.moved.ore;

        assert.ok(risky < safe);
        assert.ok(riskySummary.blockedByReason.highRisk.ore > 0);
        assert.ok(riskySummary.blockedFlows > 0);
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

    it('formats ambient trade summary using exact commodity quantities', () => {
        const summary = makeAmbientTradeSummary({
            flows: 3,
            moved: { ore: 11, org: 7, eq: 2 },
            residualDemand: { ore: 5, org: 4, eq: 3 },
            blockedUnits: { ore: 9, org: 8, eq: 1 },
            blockedByReason: {
                disconnected: { ore: 4, org: 0, eq: 0 },
                unprofitable: { ore: 3, org: 6, eq: 1 },
                highRisk: { ore: 2, org: 2, eq: 0 }
            }
        });
        const description = describeAmbientFlowSummary(summary);
        const expected = 'Ambient trade moved 11 Common Ore / 0 Heavy Metals / 0 Rare Earths / 0 Water Ice / 7 Biomass / 0 Refined Metals / 0 Polymers / 0 Coolants / 0 Fertilizer / 2 Equipment / 0 Machinery / 0 Repair Parts / 0 Electronics / 0 Medical Supplies / 0 Construction Kits / 0 Pulse Canisters / 0 Heavy Pulse Modules / 0 Gate Coils / 0 Control Cores across 3 flows. Residual demand for routed/player trade: 5 Common Ore / 0 Heavy Metals / 0 Rare Earths / 0 Water Ice / 4 Biomass / 0 Refined Metals / 0 Polymers / 0 Coolants / 0 Fertilizer / 3 Equipment / 0 Machinery / 0 Repair Parts / 0 Electronics / 0 Medical Supplies / 0 Construction Kits / 0 Pulse Canisters / 0 Heavy Pulse Modules / 0 Gate Coils / 0 Control Cores. Blocked network pressure: 9 Common Ore / 0 Heavy Metals / 0 Rare Earths / 0 Water Ice / 8 Biomass / 0 Refined Metals / 0 Polymers / 0 Coolants / 0 Fertilizer / 1 Equipment / 0 Machinery / 0 Repair Parts / 0 Electronics / 0 Medical Supplies / 0 Construction Kits / 0 Pulse Canisters / 0 Heavy Pulse Modules / 0 Gate Coils / 0 Control Cores. Blocked by disconnection: 4 Common Ore / 0 Heavy Metals / 0 Rare Earths / 0 Water Ice / 0 Biomass / 0 Refined Metals / 0 Polymers / 0 Coolants / 0 Fertilizer / 0 Equipment / 0 Machinery / 0 Repair Parts / 0 Electronics / 0 Medical Supplies / 0 Construction Kits / 0 Pulse Canisters / 0 Heavy Pulse Modules / 0 Gate Coils / 0 Control Cores. Blocked by unprofitable margin: 3 Common Ore / 0 Heavy Metals / 0 Rare Earths / 0 Water Ice / 6 Biomass / 0 Refined Metals / 0 Polymers / 0 Coolants / 0 Fertilizer / 1 Equipment / 0 Machinery / 0 Repair Parts / 0 Electronics / 0 Medical Supplies / 0 Construction Kits / 0 Pulse Canisters / 0 Heavy Pulse Modules / 0 Gate Coils / 0 Control Cores. Blocked by high risk: 2 Common Ore / 0 Heavy Metals / 0 Rare Earths / 0 Water Ice / 2 Biomass / 0 Refined Metals / 0 Polymers / 0 Coolants / 0 Fertilizer / 0 Equipment / 0 Machinery / 0 Repair Parts / 0 Electronics / 0 Medical Supplies / 0 Construction Kits / 0 Pulse Canisters / 0 Heavy Pulse Modules / 0 Gate Coils / 0 Control Cores.';
        assert.equal(description, expected);
    });

    it('handles malformed partial ambient summary maps with zero defaults', () => {
        const description = describeAmbientFlowSummary({
            flows: 1,
            moved: { ore: 4 },
            blockedByReason: null
        });
        assert.ok(description.includes('Ambient trade moved 4 Common Ore'));
        assert.ok(description.includes('Blocked by disconnection: 0 Common Ore'));
        assert.ok(description.includes('Blocked by high risk: 0 Common Ore'));
    });

});
