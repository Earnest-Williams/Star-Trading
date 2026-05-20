import test from 'node:test';
import assert from 'node:assert/strict';

import { state } from '../js/state.js';
import { executeTrade, executeTradeDetailed } from '../js/systems/marketTrade.js';
import { getPortPrice } from '../js/systems/market.js';
import { spendTime } from '../js/core/time.js';
import {
    findPortForCommodity,
    seedGeneratedUniverse,
    TEST_SEEDS
} from './helpers/gameState.js';

function seedGame() {
    seedGeneratedUniverse({
        seed: TEST_SEEDS.ACTIONS,
        initializeRng: true,
        selectCurrentSector: true
    });
}

test('executeTrade rejects invalid mode without mutation', () => {
    seedGame();
    const { sectorId } = findPortForCommodity('ore', 'buy');
    state.player.currentSector = sectorId;
    const startingCredits = state.player.credits;

    const amount = executeTrade('ore', 'invalid_mode', getPortPrice, spendTime);

    assert.equal(amount, 0);
    assert.equal(state.player.credits, startingCredits);
    assert.equal(state.player.cargo.ore || 0, 0);
});

test('executeTrade rejects empty commodity without mutation', () => {
    seedGame();
    const { sectorId } = findPortForCommodity('ore', 'buy');
    state.player.currentSector = sectorId;
    const startingCredits = state.player.credits;

    const amount = executeTrade('', 'buy', getPortPrice, spendTime);

    assert.equal(amount, 0);
    assert.equal(state.player.credits, startingCredits);
    assert.equal(state.player.cargo.ore || 0, 0);
});

test('executeTrade returns traded amount for valid buy flow', () => {
    seedGame();
    const { sectorId } = findPortForCommodity('ore', 'buy');
    state.player.currentSector = sectorId;

    const amount = executeTrade('ore', 'buy', getPortPrice, spendTime);

    assert.equal(amount > 0, true);
    assert.equal(state.player.cargo.ore, amount);
});


test('executeTradeDetailed returns time_blocked when spendTime denies', () => {
    seedGame();
    const { sectorId } = findPortForCommodity('ore', 'buy');
    state.player.currentSector = sectorId;

    const result = executeTradeDetailed('ore', 'buy', getPortPrice, () => false);

    assert.equal(result.amount, 0);
    assert.equal(result.code, 'time_blocked');
});

test('executeTradeDetailed returns result with invalid_context code when player state is missing', () => {
    seedGame();
    const originalPlayer = state.player;
    state.player = null;
    try {
        const result = executeTradeDetailed('ore', 'buy', getPortPrice, () => true);
        assert.deepEqual(result, { amount: 0, code: 'invalid_context' });
    } finally {
        state.player = originalPlayer;
    }
});
