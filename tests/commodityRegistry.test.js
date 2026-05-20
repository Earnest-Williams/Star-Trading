import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    CARGO_COMMODITIES,
    COMMODITY_REGISTRY,
    MARKET_COMMODITIES
} from '../js/config/economy/commodities.js';

describe('commodity registry exports', () => {
    it('derives market commodities directly from the registry', () => {
        const registryCommodityIds = Object.values(COMMODITY_REGISTRY).map((commodity) => commodity.id);

        assert.deepEqual(MARKET_COMMODITIES, registryCommodityIds);
        assert.equal(CARGO_COMMODITIES, MARKET_COMMODITIES);
    });
});
