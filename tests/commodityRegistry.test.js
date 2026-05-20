import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    CARGO_COMMODITIES,
    COMMODITY_NAMES,
    COMMODITY_REGISTRY,
    MANUFACTURED_COMMODITIES,
    MARKET_COMMODITIES,
    PROCESSED_COMMODITIES,
    PULSE_COMMODITIES,
    RAW_COMMODITIES
} from '../js/config/economy/commodities.js';
import {
    MANUFACTURED_COMMODITIES as MANUFACTURED_FROM_CONSTANTS,
    MARKET_COMMODITIES as MARKET_FROM_CONSTANTS,
    PROCESSED_COMMODITIES as PROCESSED_FROM_CONSTANTS,
    PULSE_COMMODITIES as PULSE_FROM_CONSTANTS,
    RAW_COMMODITIES as RAW_FROM_CONSTANTS
} from '../js/constants.js';

describe('commodity registry exports', () => {
    it('derives market commodities directly from the registry', () => {
        const registryCommodityIds = Object.values(COMMODITY_REGISTRY).map(
            (commodity) => commodity.id
        );

        assert.deepEqual(MARKET_COMMODITIES, registryCommodityIds);
    });

    it('keeps cargo commodities aliased to the market commodity list', () => {
        assert.strictEqual(CARGO_COMMODITIES, MARKET_COMMODITIES);
    });

    it('keeps phase 1 compatibility exports aligned with constants', () => {
        assert.deepEqual(RAW_COMMODITIES, RAW_FROM_CONSTANTS);
        assert.deepEqual(PROCESSED_COMMODITIES, PROCESSED_FROM_CONSTANTS);
        assert.deepEqual(MANUFACTURED_COMMODITIES, MANUFACTURED_FROM_CONSTANTS);
        assert.deepEqual(PULSE_COMMODITIES, PULSE_FROM_CONSTANTS);
        assert.deepEqual(MARKET_COMMODITIES, MARKET_FROM_CONSTANTS);
    });

    it('keeps every registry entry named', () => {
        MARKET_COMMODITIES.forEach((commodity) => {
            assert.equal(typeof COMMODITY_NAMES[commodity], 'string');
            assert.ok(COMMODITY_NAMES[commodity].length > 0);
        });
    });
});
