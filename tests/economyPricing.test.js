import test from 'node:test';
import assert from 'node:assert/strict';

import { state, createInitialState } from '../js/state.js';
import { estimateRouteProfit, getRouteMarketValue } from '../js/systems/tradeRoutes/implementation.js';
import { getExpectedRouteValue, getSpotPriceForSector, getBidAskForSector } from '../js/systems/economy/pricing.js';
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
