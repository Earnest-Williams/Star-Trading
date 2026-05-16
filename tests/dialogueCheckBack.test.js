import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../js/constants.js';
import { resetTimeHooks } from '../js/core/time.js';
import { resetState, state } from '../js/state.js';
import {
    DIALOGUE_FRAME_STATES,
    DIALOGUE_INTENTS,
    DIALOGUE_OFFER_STATUSES,
    DIALOGUE_TASK_STATUSES,
    askNpcToFindPart,
    checkBackWithNpc,
    createDialogueOffer,
    resolveDueDialogueTasks
} from '../js/systems/people.js';

function seedDialogueState() {
    resetState();
    resetTimeHooks();
    state.player = {
        credits: 5000,
        currentSector: 1,
        ship: { maxHolds: 20, travelMinutesPerCorridor: 45 },
        cargo: { ore: 0, org: 0, eq: 0 },
        time: { day: 2, minuteOfDay: 480, wakeMinute: 480, sleepMinute: 1320 },
        seed: 1234,
        factions: { contacts: {} },
        factionRelations: {}
    };
    state.universe = { 1: { id: 1, name: 'Test Site', jumpGates: [], coord: { x: 0, y: 0, z: 0 } } };
    state.sitesById = state.universe;
    state.ports = {};
    state.planets = {};
    state.people = {
        'person-1': {
            id: 'person-1',
            name: 'Nara Keel',
            role: 'factor',
            sectorId: 1,
            services: ['parts']
        }
    };
    state.peopleBySector = { 1: ['person-1'] };
}

function dueMinute() {
    return (state.player.time.day - 1) * BALANCE.DAY_MINUTES + state.player.time.minuteOfDay;
}

describe('dialogue check-back intent', () => {
    beforeEach(() => seedDialogueState());

    it('creates transcript parts for an active task without duplicating the task', () => {
        askNpcToFindPart('person-1', 'fujiwattit');
        const taskCount = state.dialogueTasks.length;
        const result = checkBackWithNpc('person-1', 'fujiwattit');

        assert.equal(state.dialogueTasks.length, taskCount);
        assert.equal(result.dialogueState, DIALOGUE_FRAME_STATES.ACTIVE_TASK);
        assert.equal(result.intentPart.intent, DIALOGUE_INTENTS.CHECK_BACK_LOCATE_ITEM);
        assert.match(result.responsePart.text, /still looking/);
    });

    it('points check-back on an active offer to the offer state', () => {
        createDialogueOffer({
            conversationId: 'locate-item:person-1:fujiwattit',
            taskId: 1,
            ownerPersonId: 'person-1',
            recipientId: 'player',
            itemId: 'fujiwattit',
            price: 725
        });
        const result = checkBackWithNpc('person-1', 'fujiwattit');

        assert.equal(result.dialogueState, DIALOGUE_FRAME_STATES.OFFER_READY);
        assert.match(result.responsePart.text, /check Communications/);
        assert.equal(state.dialogueTasks.length, 0);
    });

    it('leaves failed requests ready for an explicit ask-again action', () => {
        const initial = askNpcToFindPart('person-1', 'fujiwattit');
        initial.task.resolutionPolicy = { forceResult: 'failure' };
        initial.task.nextCheckAtAbsoluteMinute = dueMinute();
        resolveDueDialogueTasks('test failure');

        const checkBack = checkBackWithNpc('person-1', 'fujiwattit');
        const askAgain = askNpcToFindPart('person-1', 'fujiwattit');

        assert.equal(checkBack.dialogueState, DIALOGUE_FRAME_STATES.FAILED_PREVIOUS);
        assert.match(checkBack.responsePart.text, /Ask again/);
        assert.equal(state.dialogueTasks.length, 2);
        assert.equal(askAgain.task.status, DIALOGUE_TASK_STATUSES.ACTIVE);
    });

    it('responds with an already-picked-up line after an accepted offer', () => {
        const offer = createDialogueOffer({
            conversationId: 'locate-item:person-1:fujiwattit',
            taskId: 1,
            ownerPersonId: 'person-1',
            recipientId: 'player',
            itemId: 'fujiwattit',
            price: 725
        });
        offer.status = DIALOGUE_OFFER_STATUSES.ACCEPTED;

        const result = checkBackWithNpc('person-1', 'fujiwattit');

        assert.equal(result.dialogueState, DIALOGUE_FRAME_STATES.FOUND_ALREADY);
        assert.match(result.responsePart.text, /already picked up/);
        assert.equal(state.dialogueTasks.length, 0);
    });
});
