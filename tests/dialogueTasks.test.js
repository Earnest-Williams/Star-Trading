import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../js/constants.js';
import { buildLoadedState, buildSaveData } from '../js/core/persistence.js';
import { advanceTime, resetTimeHooks } from '../js/core/time.js';
import { registerSimulationTickHooks } from '../js/core/worldTick.js';
import { resetState, state } from '../js/state.js';
import {
    DIALOGUE_TASK_STATUSES,
    askNpcToFindPart,
    createLocateItemDialogueTask,
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

describe('dialogue locate-item tasks', () => {
    beforeEach(() => seedDialogueState());

    it('request creates one deferred task with the expected conversation parts', () => {
        const result = askNpcToFindPart('person-1', 'fujiwattit');

        assert.equal(state.dialogueTasks.length, 1);
        assert.equal(result.task.status, DIALOGUE_TASK_STATUSES.ACTIVE);
        assert.equal(result.task.itemId, 'fujiwattit');
        assert.equal(result.task.nextCheckAtAbsoluteMinute, dueMinute() + 360);
        assert.deepEqual(
            state.dialogueConversationParts.map(part => part.partType),
            ['player_utterance', 'intent', 'npc_utterance', 'proposal', 'effect']
        );
        assert.equal(result.effectPart.payload.taskId, result.task.id);
    });

    it('missed-time simulation resolves due tasks through the hourly tick', () => {
        registerSimulationTickHooks();
        const task = createLocateItemDialogueTask({
            ownerPersonId: 'person-1',
            requesterId: 'player',
            itemId: 'fujiwattit',
            conversationId: 'test-success',
            causedByPartId: null,
            resolutionPolicy: { forceResult: 'success' }
        });

        advanceTime(6 * 60, 'test missed-time simulation');

        assert.equal(task.status, DIALOGUE_TASK_STATUSES.RESOLVED);
        assert.equal(state.dialogueMessages.length, 1);
        assert.equal(state.dialogueMessages[0].payload.outcome, 'success');
    });

    it('success creates a message and makes the found item tradable', () => {
        const task = createLocateItemDialogueTask({
            ownerPersonId: 'person-1',
            requesterId: 'player',
            itemId: 'fujiwattit',
            conversationId: 'test-success',
            causedByPartId: null,
            resolutionPolicy: { forceResult: 'success', price: 725 }
        });
        task.nextCheckAtAbsoluteMinute = dueMinute();

        const resolved = resolveDueDialogueTasks('test success');

        assert.equal(resolved.length, 1);
        assert.equal(task.status, DIALOGUE_TASK_STATUSES.RESOLVED);
        assert.equal(task.result.offer.status, 'available_for_trade');
        assert.equal(task.result.offer.price, 725);
        assert.equal(state.dialogueMessages[0].payload.offer.itemId, 'fujiwattit');
    });

    it('failure creates a follow-up without granting inventory', () => {
        const task = createLocateItemDialogueTask({
            ownerPersonId: 'person-1',
            requesterId: 'player',
            itemId: 'fujiwattit',
            conversationId: 'test-failure',
            causedByPartId: null,
            resolutionPolicy: { forceResult: 'failure' }
        });
        task.nextCheckAtAbsoluteMinute = dueMinute();

        resolveDueDialogueTasks('test failure');

        assert.equal(task.status, DIALOGUE_TASK_STATUSES.FAILED);
        assert.equal(state.dialogueMessages.length, 1);
        assert.equal(state.dialogueMessages[0].payload.outcome, 'failure');
        assert.equal(state.player.cargo.fujiwattit, undefined);
        assert.equal(state.player.inventory?.fujiwattit, undefined);
    });

    it('duplicates do not create duplicate active tasks', () => {
        const first = askNpcToFindPart('person-1', 'fujiwattit');
        const second = askNpcToFindPart('person-1', 'fujiwattit');

        assert.equal(state.dialogueTasks.length, 1);
        assert.equal(second.task.id, first.task.id);
        assert.equal(second.effectPart.payload.duplicateActiveTask, true);
    });

    it('save and load preserve dialogue state', () => {
        const action = askNpcToFindPart('person-1', 'fujiwattit');
        action.task.nextCheckAtAbsoluteMinute = dueMinute();
        action.task.resolutionPolicy = { forceResult: 'success' };
        resolveDueDialogueTasks('test save-load');
        const saveData = buildSaveData();

        const loaded = buildLoadedState(saveData);

        assert.equal(loaded.dialogueTasks.length, 1);
        assert.equal(loaded.dialogueTasks[0].status, DIALOGUE_TASK_STATUSES.RESOLVED);
        assert.equal(loaded.dialogueMessages.length, 1);
        assert.equal(loaded.dialogueConversationParts.length, 5);
        assert.ok(loaded.nextDialogueTaskId > loaded.dialogueTasks[0].id);
    });
});
