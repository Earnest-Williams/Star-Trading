// Smoke tests for systems/tradeRoutes.js — path-finding, normalisation,
// setup cost, and profit estimation.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { state } from '../js/state.js';
import {
    findShortestCorridorPath,
    getRouteDistance,
    getRouteSetupCost,
    deriveRouteMetrics,
    estimateRouteProfit,
    normaliseTradeRoutes,
    hydrateTradeRoute,
    createTradeRoute,
    createCaptainTradeRoute,
    runTradeRoute,
    closeTradeRoute,
    toggleTradeRoute,
} from '../js/systems/tradeRoutes.js';
import { BALANCE } from '../js/constants.js';
import { addJumpGateCorridor } from '../js/core/universe.js';
import { initSessionRng } from '../js/utils.js';

// Minimal universe: 1 — 2 — 4 (direct path length 3, distance 2)
//                       \— 3
function buildUniverse() {
    state.universe = {
        1: { id: 1, jumpGates: [], pirateThreat: 0, region: 'Core',
             influence: { sda: 60, fu: 20, hc: 10, vc: 5 } },
        2: { id: 2, jumpGates: [], pirateThreat: 0, region: 'Core',
             influence: { sda: 50, fu: 25, hc: 15, vc: 5 } },
        3: { id: 3, jumpGates: [], pirateThreat: 0, region: 'Core',
             influence: { sda: 55, fu: 20, hc: 15, vc: 5 } },
        4: { id: 4, jumpGates: [], pirateThreat: 0, region: 'Core',
             influence: { sda: 40, fu: 30, hc: 20, vc: 5 } },
    };
    addJumpGateCorridor(1, 2);
    addJumpGateCorridor(1, 3);
    addJumpGateCorridor(2, 4);
    // Two compatible ports: mining now exposes raw industrial feedstocks and sector 4 buys them.
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
    state.player = { time: { day: 1, minuteOfDay: 480, wakeMinute: 480, sleepMinute: 1320 }, seed: 1 };
    initSessionRng(1);
    state.tradeRoutes = [];
    state.nextTradeRouteId = 1;
}

describe('findShortestCorridorPath', () => {
    beforeEach(buildUniverse);

    it('returns no corridor segments when start equals goal', () => {
        const path = findShortestCorridorPath(1, 1);
        assert.deepEqual(path, []);
    });

    it('finds the direct neighbour path', () => {
        const path = findShortestCorridorPath(1, 2);
        assert.ok(path);
        assert.deepEqual(path.map(segment => segment.toSectorId), [2]);
        assert.equal(path[0].fromSectorId, 1);
        assert.ok(path[0].gateId);
        assert.ok(path[0].corridorId);
        assert.ok(path[0].destinationGateId);
    });

    it('finds the two-hop path 1 → 2 → 4', () => {
        const path = findShortestCorridorPath(1, 4);
        assert.ok(path);
        assert.deepEqual(path.map(segment => segment.toSectorId), [2, 4]);
    });

    it('returns null for disconnected or missing sectors', () => {
        assert.equal(findShortestCorridorPath(1, 5), null);
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


describe('deriveRouteMetrics', () => {
    beforeEach(buildUniverse);

    it('centralises weighted path, physical span, risk, setup cost, and profit bands', () => {
        const metrics = deriveRouteMetrics(1, 4);
        assert.deepEqual(metrics.path, [1, 2, 4]);
        assert.equal(metrics.hopCount, 2);
        assert.equal(metrics.distance, 2);
        assert.ok(metrics.totalEffectiveSpan > 0);
        assert.equal(metrics.risk, 0);
        assert.equal(metrics.setupCost, getRouteSetupCost(1, 4));
        assert.deepEqual(metrics.viableCommodities, ['ore', 'heavy_metals', 'rare_earths']);
        assert.equal(metrics.profitBands[0].commodity, 'ore');
        assert.equal(metrics.profitBands[0].estimatedProfit, estimateRouteProfit(1, 4, 'ore'));
    });

    it('refreshes market-derived profit bands when the market revision changes without changing the cached path data', () => {
        const before = deriveRouteMetrics(1, 4);
        state.ports[1].stock.ore = 0;
        state.marketRevision = (Number(state.marketRevision) || 0) + 1;
        const after = deriveRouteMetrics(1, 4);
        assert.deepEqual(after.path, before.path);
        assert.equal(after.totalEffectiveSpan, before.totalEffectiveSpan);
        assert.notEqual(after.profitBands[0].estimatedProfit, before.profitBands[0].estimatedProfit);
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
        assert.equal(route.ownerType, 'player');
        assert.equal(route.ownerId, null);
    });

    it('does not overwrite existing id', () => {
        state.tradeRoutes = [{ id: 42, originSector: 1, destinationSector: 4, commodity: 'ore' }];
        state.nextTradeRouteId = 1;
        normaliseTradeRoutes();
        assert.equal(state.tradeRoutes[0].id, 42);
    });

    it('pauses when an active route has no real path', () => {
        state.tradeRoutes = [{ id: 42, originSector: 1, destinationSector: 5, commodity: 'ore' }];
        state.nextTradeRouteId = 1;
        normaliseTradeRoutes();
        assert.equal(state.tradeRoutes[0].status, 'paused');
    });


    it('normalises numeric route fields and pauses invalid endpoints', () => {
        const route = hydrateTradeRoute({
            id: '12',
            originSector: 'missing',
            destinationSector: '4x',
            amount: -5,
            intervalDays: 0,
            nextRunDay: '9.7',
            runs: -2,
            failures: '3',
            starvedDays: '2',
            profit: '15.5',
            heat: -4,
            reliability: 140,
        });

        assert.equal(route.id, 12);
        assert.equal(route.originSector, 0);
        assert.equal(route.destinationSector, 0);
        assert.equal(route.amount, BALANCE.TRADE_ROUTE_BASE_AMOUNT);
        assert.equal(route.intervalDays, BALANCE.TRADE_ROUTE_INTERVAL_DAYS);
        assert.equal(route.nextRunDay, 9);
        assert.equal(route.runs, 0);
        assert.equal(route.failures, 3);
        assert.equal(route.starvedDays, 2);
        assert.equal(route.profit, 15.5);
        assert.equal(route.heat, 0);
        assert.equal(route.reliability, 100);
        assert.equal(route.status, 'paused');
    });

    it('normalises string route ids without corrupting the next id counter', () => {
        state.tradeRoutes = [{ id: '12', originSector: 1, destinationSector: 4, commodity: 'ore' }];
        state.nextTradeRouteId = 1;
        normaliseTradeRoutes();

        assert.equal(state.tradeRoutes[0].id, 12);
        assert.equal(state.nextTradeRouteId, 13);
    });

    it('ignores malformed route action ids instead of partially parsing them', () => {
        state.tradeRoutes = [{ id: 1, originSector: 1, destinationSector: 4, commodity: 'ore', status: 'active' }];
        toggleTradeRoute('1x');

        assert.equal(state.tradeRoutes[0].status, 'active');
    });
});

describe('explicit trade route execution', () => {
    beforeEach(buildUniverse);

    it('player-created routes are marked player-owned', () => {
        state.player.currentSector = 1;
        state.player.credits = 100000;
        state.player.ship = { travelMinutesPerCorridor: 45 };
        createTradeRoute(4, 'ore');
        assert.equal(state.tradeRoutes[0].ownerType, 'player');
        assert.equal(state.tradeRoutes[0].ownerId, null);
    });

    it('captain-created routes are marked captain-owned', () => {
        const captain = { id: 'cap', name: 'Cap', callsign: 'CAP', ship: { cargoCapacity: 80 }, preferredFaction: 'traders' };
        const route = createCaptainTradeRoute(captain, 1, 4, 'ore');
        assert.equal(route.ownerType, 'captain');
        assert.equal(route.ownerId, 'cap');
    });

    it('direct economy tick via route run bumps market revision', () => {
        state.player.currentSector = 1;
        state.player.credits = 100000;
        state.player.ship = { travelMinutesPerCorridor: 45 };
        createTradeRoute(4, 'ore');
        const route = state.tradeRoutes[0];
        route.nextRunDay = state.player.time.day;
        const beforeRevision = Number(state.marketRevision) || 0;
        runTradeRoute(route);
        const afterRevision = Number(state.marketRevision) || 0;
        assert.equal(afterRevision > beforeRevision, true);
    });

    it('allows player and captain routes on the same commodity flow', () => {
        state.player.currentSector = 1;
        state.player.credits = 100000;
        state.player.ship = { travelMinutesPerCorridor: 45 };
        createTradeRoute(4, 'ore');
        const captain = { id: 'cap', name: 'Cap', callsign: 'CAP', ship: { cargoCapacity: 80 }, preferredFaction: 'traders' };
        const route = createCaptainTradeRoute(captain, 1, 4, 'ore');
        assert.ok(route);
        assert.equal(state.tradeRoutes.length, 2);
        assert.deepEqual(state.tradeRoutes.map(r => r.ownerType).sort(), ['captain', 'player']);
    });

    it('explicit route execution changes stock as expected', () => {
        const route = { id: 1, name: 'Ore line', originSector: 1, destinationSector: 4, commodity: 'ore', amount: 12, ownerType: 'player', ownerId: null, status: 'active', heat: 0, reliability: 50, runs: 0, failures: 0 };
        state.tradeRoutes = [route];
        state.player.credits = 0;
        const originBefore = state.ports[1].stock.ore;
        const destinationBefore = state.ports[4].stock.ore;
        runTradeRoute(route);
        assert.equal(state.ports[1].stock.ore, originBefore - 12);
        assert.equal(state.ports[4].stock.ore, destinationBefore + 12);
        assert.equal(state.tradeRoutes[0].runs, 1);
    });

    it('accepted economy contracts progress from explicit route delivery', () => {
        state.economy.contracts = [{
            id: 'econ-21',
            type: 'pulse_tender',
            status: 'accepted',
            destinationSector: 4,
            commodity: 'ore',
            amount: 12,
            remaining: 12,
            rewardCredits: 500
        }];
        const route = { id: 2, name: 'Ore line', originSector: 1, destinationSector: 4, commodity: 'ore', amount: 12, ownerType: 'player', ownerId: null, status: 'active', heat: 0, reliability: 50, runs: 0, failures: 0 };
        state.tradeRoutes = [route];
        for (let attempt = 0; attempt < 8 && state.economy.contracts[0].remaining >= 12; attempt += 1) {
            runTradeRoute(route);
        }
        assert.equal(state.economy.contracts[0].remaining < 12, true);
    });

    it('closing a route does not mutate corridor infrastructure', () => {
        state.tradeRoutes = [{ id: 3, originSector: 1, destinationSector: 4, commodity: 'ore', status: 'active' }];
        const before = JSON.stringify(state.universe);
        closeTradeRoute(3);
        assert.equal(JSON.stringify(state.universe), before);
        assert.equal(state.tradeRoutes[0].status, 'closed');
    });

    it('removing connectivity pauses affected routes', () => {
        state.tradeRoutes = [{ id: 9, originSector: 1, destinationSector: 4, commodity: 'ore', status: 'active' }];
        state.universe[2].jumpGates = [];
        normaliseTradeRoutes();
        assert.equal(state.tradeRoutes[0].status, 'paused');
    });
});
