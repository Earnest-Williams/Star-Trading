import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { state, resetState } from '../js/state.js';
import { addJumpGateCorridor } from '../js/core/universe.js';
import { runAmbientTradeDaily } from '../js/systems/ambientTrade.js';
import { describeAmbientFlowSummary } from '../js/systems/economy/ambientFlows.js';
import { makeAmbientTradeSummary } from './helpers/economyTestState.js';
import { MARKET_COMMODITIES } from '../js/constants.js';
import { formatCommodity } from '../js/utils.js';

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
        const safe = runAmbientTradeDaily().moved.ore;
        buildWorld({ badlands: true });
        const riskySummary = runAmbientTradeDaily();
        const risky = riskySummary.moved.ore;
        assert.ok(risky <= safe);
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
        const values = (map) => MARKET_COMMODITIES.map((commodity) => `${Number(map[commodity]) || 0} ${formatCommodity(commodity)}`).join(' / ');
        const expected = `Ambient trade moved ${values(summary.moved)} across 3 flows. Residual demand for routed/player trade: ${values(summary.residualDemand)}. Blocked network pressure: ${values(summary.blockedUnits)}. Blocked by disconnection: ${values(summary.blockedByReason.disconnected)}. Blocked by unprofitable margin: ${values(summary.blockedByReason.unprofitable)}. Blocked by high risk: ${values(summary.blockedByReason.highRisk)}.`;
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
