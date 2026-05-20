import test from 'node:test';
import assert from 'node:assert/strict';

import { state, createInitialState } from '../js/state.js';
import { getPortPrice } from '../js/systems/market.js';
import { estimateRouteProfit, getRouteMarketValue } from '../js/systems/tradeRoutes/implementation.js';
import { getFactionPriceMultiplier } from '../js/core/factions.js';
import { getExpectedRouteValue, getSpotPriceForSector } from '../js/systems/economy/pricing.js';
import { PORT_DEFAULTS } from '../js/config/worldgen.js';
import { BALANCE } from '../js/constants.js';

function resetRuntimeState() {
    const fresh = createInitialState();
    Object.keys(state).forEach((key) => delete state[key]);
    Object.assign(state, fresh);
    state.player = {
        credits: 1000,
        ship: { cargo: {}, maxCargo: 20 },
        character: {},
        time: { day: 1, hour: 8 }
    };
}

function seedPort(sectorId, commodity, stockRatio) {
    const basePrice = PORT_DEFAULTS.BASE_PRICES[commodity] || 100;
    const maxStock = 100;
    const stock = Math.round(maxStock * stockRatio);
    state.ports[sectorId] = {
        sectorId,
        typeKey: 'market_hub',
        stock: { [commodity]: stock },
        maxStock: { [commodity]: maxStock },
        basePrices: { [commodity]: basePrice },
        factionId: 'traders'
    };
    state.universe[sectorId] = { id: sectorId, links: [] };
    return state.ports[sectorId];
}

test('spot and route market value share the same pricing substrate', () => {
    resetRuntimeState();
    const commodity = 'ore';
    seedPort(1, commodity, 0.2);

    const spot = getSpotPriceForSector(1, commodity, 'buy');
    const routeSpot = getRouteMarketValue(1, commodity, 'buy');

    assert.equal(routeSpot, spot);
});

test('market getPortPrice uses fallback stock-ratio behavior when pressure is missing', () => {
    resetRuntimeState();
    const commodity = 'ore';
    const port = seedPort(2, commodity, 0.5);

    const quote = getPortPrice(port, commodity, 'buy');

    const base = port.basePrices[commodity];
    const expectedMultiplier = BALANCE.MARKET.BUY_PRICE_BASE_MULTIPLIER
        + (1 - 0.5) * BALANCE.MARKET.BUY_PRICE_SCARCITY_MULTIPLIER;
    const expected = Math.max(BALANCE.MIN_TRADE_PRICE, Math.round(base * expectedMultiplier * getFactionPriceMultiplier(port, 'buy')));
    assert.equal(quote, expected);
});

test('pressure raises spot and route expected values consistently', () => {
    resetRuntimeState();
    const commodity = 'ore';
    seedPort(3, commodity, 0.4);
    seedPort(4, commodity, 0.4);

    state.economy.pressureBySector = {
        3: {
            [commodity]: {
                shortageSeverity: 0,
                surplusSeverity: 0.9,
                pricePressure: 0.8
            }
        },
        4: {
            [commodity]: {
                shortageSeverity: 0.9,
                surplusSeverity: 0,
                pricePressure: 1.6
            }
        }
    };

    const expected = getExpectedRouteValue(3, 4, commodity, 10);
    const profit = estimateRouteProfit(3, 4, commodity, 10);

    assert.equal(expected.expectedProfit, profit);
    assert.ok(expected.sellPrice > expected.buyPrice);
});
