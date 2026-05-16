import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../js/constants.js';
import { resetState, state } from '../js/state.js';
import { askNpcToFindPart } from '../js/systems/people.js';

function seed() {
    resetState();
    state.player = { credits: 1000, currentSector: 1, cargo: {}, time: { day: 1, minuteOfDay: 600 } };
    state.people = { 'person-1': { id: 'person-1', name: 'Nara', sectorId: 1 } };
}

describe('dialogue proposals', () => {
    beforeEach(seed);

    it('request creates committed memory and task proposal rows with events', () => {
        askNpcToFindPart('person-1', 'fujiwattit');

        assert.equal(state.dialogueProposals.length, 2);
        assert.deepEqual(state.dialogueProposals.map(proposal => proposal.status), ['committed', 'committed']);
        assert.ok(state.dialogueEventLog.some(event => event.eventType === 'dialogue_proposal_emitted'));
        assert.ok(state.dialogueEventLog.some(event => event.eventType === 'dialogue_proposal_committed'));
    });

    it('normalises proposal and event timestamps when minuteOfDay overflows a day', () => {
        state.player.time.minuteOfDay = BALANCE.DAY_MINUTES + 30;

        askNpcToFindPart('person-1', 'fujiwattit');

        assert.equal(state.dialogueProposals[0].createdAt.day, 2);
        assert.equal(state.dialogueProposals[0].createdAt.minuteOfDay, 30);
        assert.equal(state.dialogueEventLog[0].day, 2);
        assert.equal(state.dialogueEventLog[0].minute, 30);
    });
});
