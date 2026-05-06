// Smoke tests for systems/tradeRoutes.js — path-finding, normalisation,
// setup cost, and profit estimation.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { state } from '../js/state.js';
import {
    findShortestPath,
    getRouteDistance,
    getRouteSetupCost,
    estimateRouteProfit,
    normaliseTradeRoutes,
} from '../js/systems/tradeRoutes.js';
import { BALANCE } from '../js/constants.js';

// Minimal universe: 1 — 2 — 4 (direct path length 3, distance 2)
//                       \— 3
function buildUniverse() {
    state.universe = {
        1: { id: 1, warps: [2, 3], pirateThreat: 0, region: 'Core',
             influence: { sda: 60, fu: 20, hc: 10, vc: 5 } },
        2: { id: 2, warps: [1, 4], pirateThreat: 0, region: 'Core',
             influence: { sda: 50, fu: 25, hc: 15, vc: 5 } },
        3: { id: 3, warps: [1],    pirateThreat: 0, region: 'Core',
             influence: { sda: 55, fu: 20, hc: 15, vc: 5 } },
        4: { id: 4, warps: [2],    pirateThreat: 0, region: 'Core',
             influence: { sda: 40, fu: 30, hc: 20, vc: 5 } },
    };
    // Two compatible ports: sector 1 sells ore, sector 4 buys ore.
    state.ports = {
        1: { typeKey: 'mining',    factionId: 'hc', publicFactionId: 'hc', hiddenFactionId: null,
             stock: { ore: 3000, org: 500,  eq: 200  },
             maxStock: { ore: 6000, org: 5000, eq: 4000 },
             basePrices: { ore: 80, org: 150, eq: 300 } },
        4: { typeKey: 'industrial', factionId: 'hc', publicFactionId: 'hc', hiddenFactionId: null,
             stock: { ore: 500,  org: 200,  eq: 1000 },
             maxStock: { ore: 6000, org: 5000, eq: 4000 },
             basePrices: { ore: 80, org: 150, eq: 300 } },
    };
    state.planets = {};
    state.player = { time: { day: 1, minuteOfDay: 480, wakeMinute: 480, sleepMinute: 1320 } };
    state.tradeRoutes = [];
    state.nextTradeRouteId = 1;
}

describe('findShortestPath', () => {
    beforeEach(buildUniverse);

    it('returns [start] when start equals goal', () => {
        const path = findShortestPath(1, 1);
        assert.deepEqual(path, [1]);
    });

    it('finds the direct neighbour path', () => {
        const path = findShortestPath(1, 2);
        assert.deepEqual(path, [1, 2]);
    });

    it('finds the two-hop path 1 → 2 → 4', () => {
        const path = findShortestPath(1, 4);
        assert.deepEqual(path, [1, 2, 4]);
    });

    it('returns a path with length ≥ 2 for disconnected sectors', () => {
        // sector 5 doesn't exist in universe; fallback is [start, goal]
        const path = findShortestPath(1, 5);
        assert.equal(path.length, 2);
        assert.equal(path[0], 1);
        assert.equal(path[path.length - 1], 5);
    });
});

describe('getRouteDistance', () => {
    beforeEach(buildUniverse);

    it('returns 1 for direct neighbours', () => {
        assert.equal(getRouteDistance(1, 2), 1);
    });

    it('returns 2 for a two-hop path', () => {
        assert.equal(getRouteDistance(1, 4), 2);
    });
});

describe('getRouteSetupCost', () => {
    beforeEach(buildUniverse);

    it('returns a number greater than the base cost', () => {
        const cost = getRouteSetupCost(1, 4);
        assert.ok(cost > BALANCE.TRADE_ROUTE_BASE_COST,
            `setup cost ${cost} should exceed base ${BALANCE.TRADE_ROUTE_BASE_COST}`);
    });

    it('cost increases with distance', () => {
        const short = getRouteSetupCost(1, 2); // 1 hop
        const long  = getRouteSetupCost(1, 4); // 2 hops
        assert.ok(long > short, `longer route (${long}) should cost more than shorter (${short})`);
    });
});

describe('estimateRouteProfit', () => {
    beforeEach(buildUniverse);

    it('returns a positive profit for a valid ore route', () => {
        const profit = estimateRouteProfit(1, 4, 'ore');
        assert.ok(profit > 0, `expected positive profit, got ${profit}`);
    });

    it('profit scales proportionally with amount', () => {
        const p1 = estimateRouteProfit(1, 4, 'ore', 10);
        const p2 = estimateRouteProfit(1, 4, 'ore', 20);
        assert.ok(p2 > p1, `doubled amount should yield more profit (${p2} > ${p1})`);
    });
});

describe('normaliseTradeRoutes', () => {
    beforeEach(buildUniverse);

    it('fills in missing fields with sensible defaults', () => {
        state.tradeRoutes = [{ originSector: 1, destinationSector: 4, commodity: 'ore' }];
        state.nextTradeRouteId = 1;
        normaliseTradeRoutes();
        const [route] = state.tradeRoutes;
        assert.equal(typeof route.id, 'number');
        assert.equal(route.status, 'active');
        assert.equal(route.amount, BALANCE.TRADE_ROUTE_BASE_AMOUNT);
        assert.equal(route.runs, 0);
        assert.equal(route.failures, 0);
        assert.equal(route.profit, 0);
        assert.equal(route.heat, 0);
        assert.equal(route.escortCaptainId, null);
    });

    it('does not overwrite existing id', () => {
        state.tradeRoutes = [{ id: 42, originSector: 1, destinationSector: 4, commodity: 'ore' }];
        state.nextTradeRouteId = 1;
        normaliseTradeRoutes();
        assert.equal(state.tradeRoutes[0].id, 42);
    });
});
