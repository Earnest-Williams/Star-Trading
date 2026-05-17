import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resetState, state } from '../js/state.js';
import {
    DIALOGUE_EVENT_TYPES,
    DIALOGUE_TONES,
    buildDialogueFrame,
    deepenRelationship,
    deriveDialogueTone,
    getConversationParts,
    getDialogueRelationship,
    startPersonalChat
} from '../js/systems/people.js';

function seedPerson(relationship = {}) {
    resetState();
    state.player = { currentSector: 1, time: { day: 1, minuteOfDay: 600 } };
    state.people = {
        'person-1': {
            id: 'person-1',
            name: 'Nara Vale',
            role: 'factor',
            sectorId: 1,
            known: true,
            relationships: { player: relationship }
        }
    };
    state.peopleBySector = { 1: ['person-1'] };
}

describe('relationship conversation actions', () => {
    beforeEach(() => seedPerson());

    it('basic chat increases familiarity and records conversation parts', () => {
        const result = startPersonalChat('person-1');
        const relationship = getDialogueRelationship('person-1');
        const parts = getConversationParts(result.conversationId);

        assert.equal(result.ok, true);
        assert.equal(result.personId, 'person-1');
        assert.equal(result.relationshipDelta.familiarity, 1);
        assert.equal(result.relationshipDelta.reason, 'start_personal_chat');
        assert.equal(relationship.familiarity, 1);
        assert.ok(result.playerLine.length > 0);
        assert.ok(result.npcLine.length > 0);
        assert.equal(parts.length, 4);
        assert.deepEqual(parts.map(part => part.partType), [
            'player_utterance',
            'intent',
            'npc_utterance',
            'effect'
        ]);
    });

    it('deepen increases trust and familiarity', () => {
        seedPerson({ familiarity: 2, trust: 0, tags: [], affect: {} });

        const result = deepenRelationship('person-1', 'stories');
        const relationship = getDialogueRelationship('person-1');

        assert.equal(result.ok, true);
        assert.equal(result.relationshipDelta.trust, 1);
        assert.equal(result.relationshipDelta.familiarity, 2);
        assert.equal(result.relationshipDelta.affect.respect, 1);
        assert.equal(relationship.trust, 1);
        assert.equal(relationship.familiarity, 4);
    });

    it('hostile or guarded affect changes future realization tone', () => {
        seedPerson({ familiarity: 2, trust: -1, tags: [], affect: { fear: 25 } });
        let relationship = getDialogueRelationship('person-1');
        let tone = deriveDialogueTone(
            buildDialogueFrame('start_personal_chat', { ownerPersonId: 'person-1' }),
            relationship
        );
        assert.equal(tone, DIALOGUE_TONES.GUARDED);

        relationship.affect.resentment = 40;
        tone = deriveDialogueTone(
            buildDialogueFrame('start_personal_chat', { ownerPersonId: 'person-1' }),
            relationship
        );
        assert.equal(tone, DIALOGUE_TONES.HOSTILE);
    });

    it('missing person fails without mutation', () => {
        const result = startPersonalChat('missing-person');

        assert.equal(result.ok, false);
        assert.equal(result.reason, 'missing_person');
        assert.equal(state.dialogueConversationParts.length, 0);
        assert.equal(state.dialogueEventLog.length, 0);
    });

    it('repeated calls do not exceed relationship clamps', () => {
        seedPerson({ familiarity: 2, trust: 99, tags: [], affect: { respect: 99 } });

        deepenRelationship('person-1', 'stories');
        deepenRelationship('person-1', 'stories');
        const relationship = getDialogueRelationship('person-1');

        assert.equal(relationship.trust, 100);
        assert.equal(relationship.affect.respect, 100);
    });

    it('writes a relationship event', () => {
        const result = startPersonalChat('person-1');
        const event = state.dialogueEventLog.find(item => (
            item.eventType === DIALOGUE_EVENT_TYPES.DIALOGUE_RELATIONSHIP_CHANGED
        ));

        assert.equal(result.ok, true);
        assert.ok(event);
        assert.equal(event.actor, 'person-1');
        assert.equal(event.subject, 'player');
        assert.equal(event.payload.reason, 'start_personal_chat');
    });
});
