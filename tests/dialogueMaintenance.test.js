import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resetState, state } from '../js/state.js';
import { archiveResolvedConversations, touchDialogueConversation } from '../js/systems/people.js';

function seed() {
    resetState();
    state.player = { time: { day: 3, minuteOfDay: 600 } };
}

describe('dialogue maintenance', () => {
    beforeEach(seed);

    it('archives old resolved conversations when safe', () => {
        touchDialogueConversation('c1', { status: 'resolved', updatedAt: { day: 1, minuteOfDay: 1, absoluteMinute: 1 } });
        const archived = archiveResolvedConversations('test');
        assert.equal(archived.length, 1);
        assert.equal(state.dialogueConversations[0].status, 'archived');
    });
});
