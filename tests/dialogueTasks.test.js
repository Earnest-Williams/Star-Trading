import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../js/constants.js';
import { buildLoadedState, buildSaveData } from '../js/core/persistence.js';
import { advanceTime, resetTimeHooks } from '../js/core/time.js';
import { registerSimulationTickHooks } from '../js/core/worldTick.js';
import { resetState, state } from '../js/state.js';
import {
    DIALOGUE_CONVERSATION_STATUSES,
    DIALOGUE_CONVERSATION_TYPES,
    DIALOGUE_EVENT_TYPES,
    DIALOGUE_MEMORY_TYPES,
    DIALOGUE_TASK_STATUSES,
    addDialogueEvent,
    askNpcToFindPart,
    createLocateItemDialogueTask,
    getDialogueEventsByTaskId,
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
            [
                'player_utterance',
                'intent',
                'npc_utterance',
                'proposal',
                'effect',
                'proposal',
                'effect'
            ]
        );
        assert.equal(result.effectPart.payload.taskId, result.task.id);
        assert.equal(state.dialogueMemories.length, 1);
        assert.equal(result.memory.memoryType, DIALOGUE_MEMORY_TYPES.CUSTOMER_REQUEST);
        assert.equal(result.memory.data.requestedItem, 'fujiwattit');
        assert.equal(state.dialogueConversations.length, 1);
        assert.equal(state.dialogueConversations[0].conversationId, result.conversationId);
        assert.equal(state.dialogueConversations[0].conversationType, DIALOGUE_CONVERSATION_TYPES.LOCATE_ITEM);
        assert.equal(state.dialogueConversations[0].ownerPersonId, 'person-1');
        assert.equal(state.dialogueConversations[0].subjectId, 'player');
        assert.equal(state.dialogueConversations[0].topic.itemId, 'fujiwattit');
        assert.equal(state.dialogueConversations[0].status, DIALOGUE_CONVERSATION_STATUSES.WAITING);
        assert.equal(state.dialogueConversations[0].latestPartId, result.effectPart.id);
        assert.deepEqual(state.dialogueConversations[0].relatedTaskIds, [result.task.id]);
        assert.deepEqual(state.dialogueConversations[0].relatedMemoryIds, [result.memory.id]);
        assert.equal(getDialogueEventsByTaskId(result.task.id)[0].eventType, DIALOGUE_EVENT_TYPES.DIALOGUE_TASK_CREATED);
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
        assert.equal(state.dialogueOffers.length, 1);
        assert.equal(task.result.offerId, state.dialogueOffers[0].id);
        assert.equal(state.dialogueOffers[0].price, 725);
        assert.equal(state.dialogueMessages[0].payload.offerId, state.dialogueOffers[0].id);
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
        assert.equal(state.dialogueMemories.length, 1);
        assert.equal(second.memory.id, first.memory.id);
        assert.equal(second.memory.reinforcementCount, 2);
        assert.equal(second.memoryEffectPart.payload.duplicateMemory, true);
    });

    it('normalizes task records before duplicate detection and resolution', () => {
        state.dialogueTasks.push({
            id: 12,
            taskType: 'locate_item',
            ownerPersonId: 'person-1',
            requesterId: 'player',
            itemId: 'fujiwattit',
            conversationId: 'legacy-task',
            status: 'unknown-status',
            createdAt: { day: 2, minuteOfDay: 480, absoluteMinute: dueMinute() },
            nextCheckAtAbsoluteMinute: String(dueMinute()),
            resolutionAttempts: -4,
            result: null,
            resolutionPolicy: { forceResult: 'success' }
        });

        const action = askNpcToFindPart('person-1', 'fujiwattit');
        const resolved = resolveDueDialogueTasks('test normalized legacy task');

        assert.equal(state.dialogueTasks.length, 1);
        assert.equal(action.task.id, 12);
        assert.equal(action.effectPart.payload.duplicateActiveTask, true);
        assert.equal(resolved.length, 1);
        assert.equal(action.task.status, DIALOGUE_TASK_STATUSES.RESOLVED);
        assert.equal(action.task.resolutionAttempts, 1);
        assert.equal(action.task.result.outcome, 'success');
    });

    it('normalizes invalid event types and keeps event log ordering on inserts', () => {
        const newest = addDialogueEvent({
            eventType: DIALOGUE_EVENT_TYPES.DIALOGUE_TASK_CREATED,
            timestamp: { day: 2, minuteOfDay: 500 }
        });
        const older = addDialogueEvent({
            eventType: 'invalid_event_type',
            timestamp: { day: 2, minuteOfDay: 450 }
        });

        assert.equal(older.eventType, DIALOGUE_EVENT_TYPES.DIALOGUE_TASK_CREATED);
        assert.deepEqual(state.dialogueEventLog.map(event => event.id), [older.id, newest.id]);
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
        assert.equal(loaded.dialogueOffers.length, 1);
        assert.equal(loaded.dialogueProposals.length, 2);
        assert.equal(loaded.dialogueConversationParts.length, 7);
        assert.equal(loaded.dialogueMemories.length, 1);
        assert.equal(loaded.dialogueMemories[0].data.requestedItem, 'fujiwattit');
        assert.equal(loaded.dialogueConversations.length, 1);
        assert.equal(loaded.dialogueConversations[0].conversationType, DIALOGUE_CONVERSATION_TYPES.LOCATE_ITEM);
        assert.equal(loaded.dialogueConversations[0].status, DIALOGUE_CONVERSATION_STATUSES.RESOLVED);
        assert.deepEqual(loaded.dialogueConversations[0].relatedMessageIds, [loaded.dialogueMessages[0].id]);
        assert.deepEqual(loaded.dialogueConversations[0].relatedOfferIds, [loaded.dialogueOffers[0].id]);
        assert.ok(loaded.dialogueEventLog.some(event => event.conversationId === action.conversationId));
        assert.ok(loaded.dialogueEventLog.some(event => event.taskId === action.task.id));
        assert.ok(loaded.nextDialogueTaskId > loaded.dialogueTasks[0].id);
    });
});
