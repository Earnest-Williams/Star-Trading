import test from 'node:test';
import assert from 'node:assert/strict';

import { MARKET_COMMODITIES } from '../js/constants.js';
import { makeAmbientTradeSummary, makeCommodityMap } from './helpers/economyTestState.js';

test('makeCommodityMap creates all market commodity keys', () => {
    const map = makeCommodityMap((commodity) => `${commodity}-value`);
    assert.deepEqual(Object.keys(map), MARKET_COMMODITIES);
    MARKET_COMMODITIES.forEach((commodity) => {
        assert.equal(map[commodity], `${commodity}-value`);
    });
});

test('makeAmbientTradeSummary fills all commodity keys and blocked reason maps', () => {
    const summary = makeAmbientTradeSummary();
    const commodityMaps = [
        summary.moved,
        summary.residualDemand,
        summary.blockedUnits,
        summary.attemptedDemand,
        summary.blockedByReason.disconnected,
        summary.blockedByReason.unprofitable,
        summary.blockedByReason.highRisk
    ];
    commodityMaps.forEach((map) => {
        assert.deepEqual(Object.keys(map), MARKET_COMMODITIES);
        MARKET_COMMODITIES.forEach((commodity) => assert.equal(map[commodity], 0));
    });
});

test('makeAmbientTradeSummary deeply merges overrides without deleting untouched keys', () => {
    const summary = makeAmbientTradeSummary({
        moved: { ore: 9 },
        blockedByReason: {
            disconnected: { org: 3 }
        }
    });
    assert.equal(summary.moved.ore, 9);
    assert.equal(summary.moved.org, 0);
    assert.equal(summary.moved.eq, 0);
    assert.equal(summary.blockedByReason.disconnected.org, 3);
    assert.equal(summary.blockedByReason.disconnected.ore, 0);
    assert.equal(summary.blockedByReason.disconnected.eq, 0);
    assert.equal(summary.blockedByReason.unprofitable.ore, 0);
    assert.equal(summary.blockedByReason.highRisk.ore, 0);
});
