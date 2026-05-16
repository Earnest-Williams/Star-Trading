import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resetState, state } from '../js/state.js';
import { askNpcToFindPart, getContactDialogueActionState, getConversationSummary } from '../js/systems/people.js';

function seed() {
    resetState();
    state.player = { credits: 1000, currentSector: 1, cargo: {}, time: { day: 1, minuteOfDay: 600 } };
    state.people = { 'person-1': { id: 'person-1', name: 'Nara', sectorId: 1 } };
}

describe('conversation queries', () => {
    beforeEach(seed);

    it('summarises conversations and contact action state without mutation', () => {
        const action = askNpcToFindPart('person-1', 'nav_chip');
        const before = state.dialogueConversationParts.length;

        const summary = getConversationSummary(action.conversationId);
        const actionState = getContactDialogueActionState('person-1', 'nav_chip');

        assert.equal(summary.activeTaskCount, 1);
        assert.equal(actionState.state, 'looking');
        assert.equal(state.dialogueConversationParts.length, before);
    });
});
