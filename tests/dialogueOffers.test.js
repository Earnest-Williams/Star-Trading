import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../js/constants.js';
import { resetState, state } from '../js/state.js';
import {
    DIALOGUE_OFFER_STATUSES,
    acceptDialogueOffer,
    createLocateItemDialogueTask,
    rejectDialogueOffer,
    resolveDueDialogueTasks
} from '../js/systems/people.js';

function seed() {
    resetState();
    state.player = {
        credits: 1000,
        currentSector: 1,
        ship: {},
        cargo: {},
        time: { day: 1, minuteOfDay: 600, wakeMinute: 480, sleepMinute: 1320 }
    };
    state.people = { 'person-1': { id: 'person-1', name: 'Nara' } };
}

function now() {
    return (state.player.time.day - 1) * BALANCE.DAY_MINUTES + state.player.time.minuteOfDay;
}

describe('dialogue offers', () => {
    beforeEach(seed);

    it('accepting a located item offer debits credits and grants a part', () => {
        const task = createLocateItemDialogueTask({
            ownerPersonId: 'person-1', requesterId: 'player', itemId: 'fujiwattit',
            conversationId: 'c1', resolutionPolicy: { forceResult: 'success', price: 300 }
        });
        task.nextCheckAtAbsoluteMinute = now();
        resolveDueDialogueTasks('test');

        const accepted = acceptDialogueOffer(state.dialogueOffers[0].id);

        assert.equal(accepted.status, DIALOGUE_OFFER_STATUSES.ACCEPTED);
        assert.equal(state.player.credits, 700);
        assert.equal(state.player.partsInventory.fujiwattit, 1);
        assert.ok(state.dialogueEventLog.some(event => event.eventType === 'dialogue_offer_accepted'));
    });

    it('rejecting a located item offer does not grant a part', () => {
        const task = createLocateItemDialogueTask({
            ownerPersonId: 'person-1', requesterId: 'player', itemId: 'nav_chip',
            conversationId: 'c2', resolutionPolicy: { forceResult: 'success', price: 200 }
        });
        task.nextCheckAtAbsoluteMinute = now();
        resolveDueDialogueTasks('test');

        const rejected = rejectDialogueOffer(state.dialogueOffers[0].id);

        assert.equal(rejected.status, DIALOGUE_OFFER_STATUSES.REJECTED);
        assert.equal(state.player.credits, 1000);
        assert.equal(state.player.partsInventory, undefined);
        assert.ok(state.dialogueEventLog.some(event => event.eventType === 'dialogue_offer_rejected'));
    });
});
