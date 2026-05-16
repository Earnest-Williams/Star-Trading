import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../js/constants.js';
import { resetState, state } from '../js/state.js';
import { askNpcToFindPart, decayDialogueMemories, resolveDialogueMemory } from '../js/systems/people.js';

function seed() {
    resetState();
    state.player = { credits: 1000, currentSector: 1, cargo: {}, time: { day: 1, minuteOfDay: 600 } };
    state.people = { 'person-1': { id: 'person-1', name: 'Nara', sectorId: 1 } };
}

describe('dialogue memory lifecycle', () => {
    beforeEach(seed);

    it('resolves and expires active customer requests', () => {
        askNpcToFindPart('person-1', 'nav_chip');
        assert.equal(resolveDialogueMemory({ ownerPersonId: 'person-1', itemId: 'nav_chip' }).status, 'resolved');
        askNpcToFindPart('person-1', 'fuel_injector');
        state.player.time.day += 15;
        state.player.time.minuteOfDay += BALANCE.DAY_MINUTES;
        const expired = decayDialogueMemories('test');
        assert.equal(expired.length, 1);
        assert.equal(expired[0].status, 'expired');
    });
});
