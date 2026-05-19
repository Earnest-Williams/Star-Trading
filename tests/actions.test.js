// Action-level tests for high-impact player simulation mutations.
import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../js/constants.js';
import { state } from '../js/state.js';
import { fightPirates } from '../js/systems/combat.js';
import { getPortPrice, tradeCommodity } from '../js/systems/market.js';
import { assertInRange } from './helpers/assertions.js';
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

describe('player actions — trading', () => {
    beforeEach(seedGame);

    const tradeCases = [
        {
            mode: 'buy',
            expectedCargo: BALANCE.TRADE_BATCH,
            creditDirection: -1,
            stockDirection: -1
        },
        {
            mode: 'sell',
            startingCargo: BALANCE.TRADE_BATCH,
            expectedCargo: 0,
            creditDirection: 1,
            stockDirection: 1
        }
    ];

    tradeCases.forEach(testCase => {
        it(`${testCase.mode}ing at a port updates cargo, credits, stock, and time`, () => {
            const { sectorId, port } = findPortForCommodity('ore', testCase.mode);
            state.player.currentSector = sectorId;
            state.selectedSectorId = sectorId;

            if (testCase.startingCargo) {
                state.player.cargo.ore = testCase.startingCargo;
            }

            const price = getPortPrice(port, 'ore', testCase.mode);
            const startingCredits = state.player.credits;
            const startingStock = port.stock.ore;
            const startingMinute = state.player.time.minuteOfDay;

            tradeCommodity('ore', testCase.mode);

            const creditDelta = price * BALANCE.TRADE_BATCH * testCase.creditDirection;
            const stockDelta = BALANCE.TRADE_BATCH * testCase.stockDirection;
            assert.equal(state.player.cargo.ore, testCase.expectedCargo);
            assert.equal(state.player.credits, startingCredits + creditDelta);
            assert.equal(port.stock.ore, startingStock + stockDelta);
            assert.equal(
                state.player.time.minuteOfDay,
                startingMinute + BALANCE.TRADE_TIME_MINUTES
            );
        });
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

        assertInRange(sector.pirateThreat, 0, 6, 'pirateThreat');
        assertInRange(state.player.fighters, 0, state.player.ship.maxFighters, 'fighters');
        assertInRange(state.player.shields, 0, state.player.ship.maxShields, 'shields');
        assertInRange(state.player.hull, 1, state.player.ship.maxHull, 'hull');
    });
});

describe('domain command layer', () => {
    it('executes registered actions with positional args and notifies observers', async () => {
        const { executeAction, onActionExecuted, registerAction } = await import('../js/core/commands.js');
        const observed = [];
        const unsubscribe = onActionExecuted(entry => observed.push(entry));
        registerAction('test:add', (a, b) => Number(a) + Number(b));

        const result = executeAction({ type: 'test:add', args: ['2', '3'] });

        unsubscribe();
        assert.equal(result.ok, true);
        assert.equal(result.invalidateAll, true);
        assert.deepEqual(observed, [{ type: 'test:add', args: ['2', '3'], result }]);
    });

    it('rejects unknown actions without mutating state', async () => {
        const { executeAction } = await import('../js/core/commands.js');
        const result = executeAction({ type: 'test:missing', args: [] });
        assert.equal(result.ok, false);
    });

    it('rejects empty integer arguments during command coercion', async () => {
        const { executeAction, registerAction, parseIntegerArg } = await import('../js/core/commands.js');
        registerAction('test:coerced', value => value, {
            argCount: 1,
            coercers: [value => parseIntegerArg(value, { min: 0, max: 10 })]
        });
        const result = executeAction({ type: 'test:coerced', args: ['   '] });
        assert.equal(result.ok, false);
        assert.match(result.message, /must not be empty/);
    });
});
