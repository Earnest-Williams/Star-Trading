import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resetState, state } from '../js/state.js';
import {
    DIALOGUE_PART_TYPES,
    DIALOGUE_SPEAKER_TYPES,
    addDialogueConversationPart,
    addPersonUtterance,
    addPlayerUtterance,
    getConversationParts,
    normaliseDialogueTables
} from '../js/systems/people/conversationParts.js';

function seedTime(day = 3, minuteOfDay = 600) {
    resetState();
    state.player = {
        time: { day, minuteOfDay, wakeMinute: 480, sleepMinute: 1320 }
    };
}

describe('conversation parts table', () => {
    beforeEach(() => seedTime());

    it('creates ordered conversation parts with stable numeric ids', () => {
        const first = addPlayerUtterance('dealer-ask-1', 'Need a fujiwattit.');
        const second = addPersonUtterance(
            'dealer-ask-1',
            'person-7',
            'No stock today, but I can ask around.'
        );

        const parts = getConversationParts('dealer-ask-1');

        assert.equal(first.id, 1);
        assert.equal(second.id, 2);
        assert.deepEqual(parts.map(part => part.id), [1, 2]);
        assert.equal(parts[0].partType, DIALOGUE_PART_TYPES.PLAYER_UTTERANCE);
        assert.equal(parts[1].speakerType, DIALOGUE_SPEAKER_TYPES.PERSON);
    });

    it('stores structured intent/proposal/effect payloads without making them authoritative', () => {
        const request = addDialogueConversationPart({
            conversationId: 'dealer-ask-2',
            partType: DIALOGUE_PART_TYPES.INTENT,
            speakerType: DIALOGUE_SPEAKER_TYPES.PLAYER,
            speakerId: 'player',
            intent: 'request_help',
            payload: { item: 'fujiwattit', urgency: 'medium' }
        });
        const proposal = addDialogueConversationPart({
            conversationId: 'dealer-ask-2',
            partType: DIALOGUE_PART_TYPES.PROPOSAL,
            speakerType: DIALOGUE_SPEAKER_TYPES.SYSTEM,
            payload: { type: 'create_dialogue_task', item: 'fujiwattit' },
            causedByPartId: request.id
        });

        assert.equal(proposal.causedByPartId, request.id);
        assert.equal(proposal.payload.type, 'create_dialogue_task');
        assert.equal(state.dialogueTasks.length, 0);
    });

    it('normalises missing dialogue tables and next id counters', () => {
        delete state.dialogueConversationParts;
        delete state.nextDialogueConversationPartId;
        state.dialogueEventLog = [{ id: 3, eventType: 'legacy' }];

        normaliseDialogueTables();

        assert.ok(Array.isArray(state.dialogueConversationParts));
        assert.equal(state.nextDialogueConversationPartId, 1);
        assert.equal(state.dialogueEventLog.length, 1);
    });

    it('advances next ids past restored records', () => {
        state.dialogueConversationParts = [{ id: 12, conversationId: 'legacy' }];
        state.nextDialogueConversationPartId = 1;

        normaliseDialogueTables();

        assert.equal(state.nextDialogueConversationPartId, 13);
    });
});
