import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resetState, state } from '../js/state.js';
import {
    DIALOGUE_CONVERSATION_STATUSES,
    DIALOGUE_EVENT_TYPES,
    addDialogueEvent,
    archiveResolvedConversations,
    pruneOldDialogueEvents,
    touchDialogueConversation
} from '../js/systems/people.js';

function seed() {
    resetState();
    state.player = { time: { day: 3, minuteOfDay: 600 } };
}

describe('dialogue maintenance', () => {
    beforeEach(seed);

    it('archives old resolved conversations when safe', () => {
        touchDialogueConversation('c1', {
            status: DIALOGUE_CONVERSATION_STATUSES.RESOLVED,
            updatedAt: { day: 1, minuteOfDay: 1, absoluteMinute: 1 }
        });
        const archived = archiveResolvedConversations('test');
        assert.equal(archived.length, 1);
        assert.equal(state.dialogueConversations[0].status, DIALOGUE_CONVERSATION_STATUSES.ARCHIVED);
    });

    it('prunes events using zero-based absolute-minute math', () => {
        state.player = { time: { day: 62, minuteOfDay: 0 } };
        addDialogueEvent({
            eventType: DIALOGUE_EVENT_TYPES.DIALOGUE_TASK_CREATED,
            timestamp: { day: 1, minuteOfDay: 10 }
        });

        const removed = pruneOldDialogueEvents();

        assert.equal(removed, 1);
        assert.equal(state.dialogueEventLog.length, 0);
    });
});
