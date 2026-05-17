import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { createPlayer } from '../js/core/universe.js';
import { getMarketRecommendation } from '../js/systems/market.js';
import { resetState, state } from '../js/state.js';

function character(stats = {}, skillNodeIds = []) {
    return {
        stats: {
            nerve: 50,
            tradecraft: 50,
            fieldcraft: 50,
            command: 50,
            acumen: 50,
            ...stats
        },
        traits: [],
        skillNodeIds
    };
}

function miningPort(stock = 5500) {
    return {
        typeKey: 'mining',
        factionId: 'hc',
        stock: { ore: stock, org: 0, eq: 0 },
        maxStock: { ore: 6000, org: 5000, eq: 4000 },
        basePrices: { ore: 80, org: 150, eq: 300 }
    };
}

describe('market recommendations', () => {
    beforeEach(() => {
        resetState();
        state.player = createPlayer();
    });

    it('varies price guidance by character acumen and tradecraft', () => {
        const port = miningPort();
        const low = getMarketRecommendation(port, 'ore', character());
        const high = getMarketRecommendation(port, 'ore', character({ acumen: 95, tradecraft: 85 }));

        assert.equal(low.quality, 'low');
        assert.equal(low.actionId, 'gather_intel');
        assert.equal(high.quality, 'high');
        assert.equal(high.actionId, 'buy');
        assert.ok(high.estimateAccuracy > low.estimateAccuracy);
        assert.ok(high.message.includes('Ore'));
    });

    it('uses relevant skill nodes to make routine market choices obvious', () => {
        const port = miningPort();
        const skilled = character(
            { acumen: 92, tradecraft: 88 },
            ['margin_habit', 'source_confidence_index']
        );
        const recommendation = getMarketRecommendation(port, 'ore', skilled);

        assert.equal(recommendation.quality, 'max');
        assert.equal(recommendation.actionId, 'buy');
        assert.ok(recommendation.confidence > 0.9);
        assert.ok(recommendation.price > 0);
    });
});
