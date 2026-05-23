import test from 'node:test';
import assert from 'node:assert/strict';

import { state, createInitialState } from '../js/state.js';
import { getRouteMarketValue } from '../js/systems/tradeRoutes/implementation.js';
import { getExpectedRouteValue, getSpotPrice, getSpotPriceForSector, getBidAskForSector } from '../js/systems/economy/pricing.js';
import { calibrateInitialUniversePrices } from '../js/systems/economy/initialPrices.js';
import { recomputeSpatialPrices } from '../js/systems/economy/spatialPrices.js';

function resetRuntimeState() {
    const fresh = createInitialState();
    Object.keys(state).forEach((key) => delete state[key]);
    Object.assign(state, fresh);
    state.player = { credits: 1000, ship: { cargo: {}, maxCargo: 20 }, character: {}, time: { day: 1, hour: 8 }, currentSector: 1 };
}

function seedPort(sectorId, commodity, stockRatio) {
    const maxStock = 100;
    const stock = Math.round(maxStock * stockRatio);
    state.ports[sectorId] = { sectorId, typeKey: 'market_hub', stock: { [commodity]: stock }, maxStock: { [commodity]: maxStock }, factionId: 'traders' };
    state.universe[sectorId] = { id: sectorId, links: [] };
    state.economy.profilesBySector[sectorId] = { sectorId, likelyImports: [commodity], likelyExports: [commodity], supplyWeight: 1, demandWeight: 1, targetStock: { [commodity]: 40 }, strategicReserve: { [commodity]: 10 }, baselineConsumption: { [commodity]: 1 }, industrialConsumption: { [commodity]: 1 }, roleTags: [] };
}

test('spot and route market value share the same pricing substrate', () => {
    resetRuntimeState();
    const commodity = 'ore';
    seedPort(1, commodity, 0.2);
    calibrateInitialUniversePrices();
    recomputeSpatialPrices();
    const spot = getSpotPriceForSector(1, commodity, 'buy');
    const routeSpot = getRouteMarketValue(1, commodity, 'buy');
    assert.equal(routeSpot, spot);
});

test('bid is always <= ask in same market', () => {
    resetRuntimeState();
    state.economy.universeBasePrices = { ore: 100 };
    state.economy.nodeMidPrices = { 2: { ore: 120 } };
    state.economy.pressureBySector = { 2: { ore: { shortageSeverity: 0.5, confidence: 0.8 } } };
    state.economy.spatialPriceDiagnostics = { 2: { ore: { routeFriction: 1, confidence: 0.8 } } };
    const quote = getBidAskForSector(2, 'ore');
    const { spread, ...rest } = quote;

    assert.deepEqual(rest, {
        midpoint: 120,
        ask: 135,
        bid: 105,
        confidence: 0.8,
        risk: 1
    });
    assert.ok(Math.abs(spread - 0.2396) < 0.0001);
});

test('route estimate can be negative and is not floored', () => {
    resetRuntimeState();
    state.economy.nodeMidPrices = { 3: { ore: 120 }, 4: { ore: 100 } };
    state.economy.pressureBySector = {
        3: { ore: { shortageSeverity: 0, confidence: 0.9 } },
        4: { ore: { shortageSeverity: 0, confidence: 0.9 } }
    };
    state.economy.spatialPriceDiagnostics = {
        3: { ore: { routeFriction: 2, confidence: 0.9 } },
        4: { ore: { routeFriction: 2, confidence: 0.9 } }
    };
    const expected = getExpectedRouteValue(3, 4, 'ore', 10);
    assert.equal(expected.spread, -39);
    assert.equal(expected.estimatedGross, -390);
    assert.equal(expected.transportCost, 6);
    assert.equal(expected.estimatedNet, -396);
    assert.equal(expected.expectedProfit, 25);
});

test('spot price falls back to base price for null sector id', () => {
    resetRuntimeState();
    state.economy.universeBasePrices = { ore: 120 };
    state.economy.nodeMidPrices = { 0: { ore: 900 } };
    const spot = getSpotPrice(null, null, 'ore', 'buy');
    assert.equal(spot, 120);
});

test('spatial diagnostics preserve pre-relaxation midpoint', () => {
    resetRuntimeState();
    seedPort(7, 'ore', 0.5);
    state.economy.nodeMidPrices = { 7: { ore: 40 } };
    state.economy.pressureBySector = { 7: { ore: { shortageSeverity: 1, surplusSeverity: 0, dailyConsumption: 30, dailyProduction: 0, targetStock: 10, confidence: 0.8 } } };
    state.economy.universeBasePrices = { ore: 120 };
    recomputeSpatialPrices();
    const diag = state.economy.spatialPriceDiagnostics?.[7]?.ore;
    assert.equal(diag.midpointBefore, 40);
    assert.ok(Math.abs(diag.midpointAfter - 284.6612) < 0.0001);
});

test('route value captures unprofitable and high-risk buckets deterministically', () => {
    resetRuntimeState();
    seedPort(10, 'ore', 0.5);
    seedPort(11, 'ore', 0.5);
    state.universe[10].jumpGates = [{ to: 11 }];
    state.universe[11].jumpGates = [{ to: 10 }];
    state.economy.nodeMidPrices = { 10: { ore: 120 }, 11: { ore: 120 } };
    state.economy.pressureBySector = {
        10: { ore: { shortageSeverity: 0, surplusSeverity: 0, confidence: 1 } },
        11: { ore: { shortageSeverity: 0, surplusSeverity: 0, confidence: 0.2 } }
    };
    state.economy.spatialPriceDiagnostics = {
        10: { ore: { routeFriction: 0, confidence: 1 } },
        11: { ore: { routeFriction: 2, confidence: 0.2 } }
    };
    const value = getExpectedRouteValue(10, 11, 'ore', 5);
    assert.equal(value.estimatedNet, -102);
    assert.equal(value.transportCost, 2);
    assert.equal(value.risk, 2);
    assert.equal(value.expectedProfit, 25);
});
