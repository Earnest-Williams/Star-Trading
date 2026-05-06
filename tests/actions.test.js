// Action-level tests for high-impact player simulation mutations.
import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../js/constants.js';
import { createPlayer, generateUniverse } from '../js/core/universe.js';
import { state, resetState } from '../js/state.js';
import { fightPirates } from '../js/systems/combat.js';
import { getPortPrice, tradeCommodity } from '../js/systems/market.js';
import { initSessionRng } from '../js/utils.js';

const FIXED_SEED = 4242;

function seedGame() {
    resetState();
    state.player = createPlayer();
    state.player.seed = FIXED_SEED;
    initSessionRng(FIXED_SEED);
    generateUniverse();
    state.selectedSectorId = state.player.currentSector;
}

describe('player actions — trading', () => {
    beforeEach(seedGame);

    it('buying from a port debits credits, fills cargo, reduces stock, and advances time', () => {
        state.player.currentSector = 2;
        state.selectedSectorId = 2;
        const port = state.ports[2];
        const price = getPortPrice(port, 'ore', 'buy');
        const startingCredits = state.player.credits;
        const startingStock = port.stock.ore;
        const startingMinute = state.player.time.minuteOfDay;

        tradeCommodity('ore', 'buy');

        assert.equal(state.player.cargo.ore, BALANCE.TRADE_BATCH);
        assert.equal(state.player.credits, startingCredits - price * BALANCE.TRADE_BATCH);
        assert.equal(port.stock.ore, startingStock - BALANCE.TRADE_BATCH);
        assert.equal(state.player.time.minuteOfDay, startingMinute + BALANCE.TRADE_TIME_MINUTES);
    });

    it('selling to a port credits the player, empties cargo, increases stock, and advances time', () => {
        state.player.currentSector = 3;
        state.selectedSectorId = 3;
        state.player.cargo.ore = BALANCE.TRADE_BATCH;
        const port = state.ports[3];
        const price = getPortPrice(port, 'ore', 'sell');
        const startingCredits = state.player.credits;
        const startingStock = port.stock.ore;
        const startingMinute = state.player.time.minuteOfDay;

        tradeCommodity('ore', 'sell');

        assert.equal(state.player.cargo.ore, 0);
        assert.equal(state.player.credits, startingCredits + price * BALANCE.TRADE_BATCH);
        assert.equal(port.stock.ore, startingStock + BALANCE.TRADE_BATCH);
        assert.equal(state.player.time.minuteOfDay, startingMinute + BALANCE.TRADE_TIME_MINUTES);
    });
});

describe('player actions — combat', () => {
    beforeEach(seedGame);

    it('fighting pirates clamps threat and keeps ship state possible', () => {
        state.player.currentSector = 12;
        state.selectedSectorId = 12;
        const sector = state.universe[12];
        sector.pirateThreat = 4;

        fightPirates();

        assert.ok(sector.pirateThreat >= 0 && sector.pirateThreat <= 6);
        assert.ok(state.player.fighters >= 0);
        assert.ok(state.player.fighters <= state.player.ship.maxFighters);
        assert.ok(state.player.shields >= 0);
        assert.ok(state.player.shields <= state.player.ship.maxShields);
        assert.ok(state.player.hull >= 1);
        assert.ok(state.player.hull <= state.player.ship.maxHull);
    });
});
