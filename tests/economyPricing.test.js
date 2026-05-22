import test from 'node:test';
import assert from 'node:assert/strict';

import { state, createInitialState } from '../js/state.js';
import { estimateRouteProfit, getRouteMarketValue } from '../js/systems/tradeRoutes/implementation.js';
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
    seedPort(2, 'ore', 0.5);
    calibrateInitialUniversePrices();
    recomputeSpatialPrices();
    const quote = getBidAskForSector(2, 'ore');
    assert.ok(quote.bid <= quote.ask);
});

test('route estimate can be negative and is not floored', () => {
    resetRuntimeState();
    seedPort(3, 'ore', 0.95);
    seedPort(4, 'ore', 0.05);
    calibrateInitialUniversePrices();
    recomputeSpatialPrices();
    const expected = getExpectedRouteValue(3, 4, 'ore', 10);
    const profit = estimateRouteProfit(3, 4, 'ore', 10);
    assert.equal(expected.estimatedNet, profit);
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
    assert.notEqual(diag.midpointAfter, 40);
});
