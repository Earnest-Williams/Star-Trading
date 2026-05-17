import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE } from '../js/constants.js';
import { buildLoadedState, buildSaveData } from '../js/core/persistence.js';
import { resetState, state } from '../js/state.js';
import {
    CONTACT_SERVICE_TYPES,
    DIALOGUE_OFFER_TYPES,
    DIALOGUE_TASK_STATUSES,
    DIALOGUE_TASK_TYPES,
    acceptDialogueOffer,
    requestContactService,
    resolveDueDialogueTasks
} from '../js/systems/people.js';

function seedContactState() {
    resetState();
    state.player = {
        credits: 5000,
        currentSector: 7,
        cargo: { ore: 0, org: 0, eq: 0 },
        time: { day: 3, minuteOfDay: 540, wakeMinute: 480, sleepMinute: 1320 },
        factions: { contacts: {}, intel: [], asks: [], nextIntelId: 1 },
        factionRelations: {}
    };
    state.universe = { 7: { id: 7, name: 'Permit Yard', jumpGates: [], coord: { x: 0, y: 0, z: 0 } } };
    state.sitesById = state.universe;
    state.people = {
        'person-1': {
            id: 'person-1',
            name: 'Sera Vale',
            role: 'fixer',
            sectorId: 7,
            services: ['parts', 'orders', 'permits', 'intel']
        }
    };
    state.peopleBySector = { 7: ['person-1'] };
}

function dueMinute() {
    return (state.player.time.day - 1) * BALANCE.DAY_MINUTES + state.player.time.minuteOfDay;
}

function makeDue(task) {
    task.nextCheckAtAbsoluteMinute = dueMinute();
    return task;
}

describe('contact service requests', () => {
    beforeEach(seedContactState);

    it('prevents duplicate active service tasks with stable payload keys', () => {
        const first = requestContactService('person-1', CONTACT_SERVICE_TYPES.PERMITS, {
            permitType: 'salvage',
            sectorId: 7
        });
        const second = requestContactService('person-1', CONTACT_SERVICE_TYPES.PERMITS, {
            permitType: 'salvage',
            sectorId: 7
        });

        assert.equal(state.dialogueTasks.length, 1);
        assert.equal(first.task.taskType, DIALOGUE_TASK_TYPES.ARRANGE_PERMIT);
        assert.equal(second.task.id, first.task.id);
        assert.equal(second.effectPart.payload.duplicateActiveTask, true);
        assert.equal(first.task.payloadKey, 'permit:salvage:sector:7');
    });

    it('resolves order service tasks into priced offers and messages', () => {
        const action = requestContactService('person-1', CONTACT_SERVICE_TYPES.ORDERS, {
            commodityId: 'eq',
            quantity: 12
        });
        makeDue(action.task);

        const resolved = resolveDueDialogueTasks('test order service');

        assert.equal(resolved.length, 1);
        assert.equal(action.task.status, DIALOGUE_TASK_STATUSES.RESOLVED);
        assert.equal(state.dialogueOffers.length, 1);
        assert.equal(state.dialogueOffers[0].offerType, DIALOGUE_OFFER_TYPES.SOURCED_ORDER);
        assert.equal(state.dialogueOffers[0].serviceType, CONTACT_SERVICE_TYPES.ORDERS);
        assert.equal(state.dialogueOffers[0].payload.quantity, 12);
        assert.equal(state.dialogueMessages.length, 1);
        assert.equal(state.dialogueMessages[0].payload.offerId, state.dialogueOffers[0].id);

        const accepted = acceptDialogueOffer(state.dialogueOffers[0].id);

        assert.equal(accepted.status, 'accepted');
        assert.equal(state.player.cargo.eq, 12);
    });

    it('resolves permit service tasks into time-limited authorization offers', () => {
        const action = requestContactService('person-1', CONTACT_SERVICE_TYPES.PERMITS, {
            permitType: 'salvage',
            sectorId: 7
        });
        makeDue(action.task);

        resolveDueDialogueTasks('test permit service');

        assert.equal(state.dialogueOffers.length, 1);
        assert.equal(state.dialogueOffers[0].offerType, DIALOGUE_OFFER_TYPES.PERMIT);
        assert.equal(state.dialogueOffers[0].payload.authorization.permitType, 'salvage');
        assert.equal(state.dialogueOffers[0].payload.authorization.sectorId, 7);
        assert.ok(state.dialogueOffers[0].payload.authorization.expiresAtAbsoluteMinute > dueMinute());
        assert.equal(state.dialogueMessages[0].payload.serviceType, CONTACT_SERVICE_TYPES.PERMITS);

        const accepted = acceptDialogueOffer(state.dialogueOffers[0].id);

        assert.equal(accepted.status, 'accepted');
        assert.equal(state.player.contactAuthorizations.length, 1);
        assert.equal(state.player.contactAuthorizations[0].permitType, 'salvage');
    });

    it('hands intel resolution to the canonical intel store', () => {
        const action = requestContactService('person-1', CONTACT_SERVICE_TYPES.INTEL, {
            topic: 'pirate_routes',
            sectorId: 7
        });
        makeDue(action.task);

        resolveDueDialogueTasks('test intel service');

        assert.equal(state.dialogueOffers.length, 0);
        assert.equal(state.player.factions.intel.length, 1);
        assert.equal(state.player.factions.intel[0].type, 'pirate_routes');
        assert.equal(state.player.factions.intel[0].sectorId, 7);
        assert.equal(action.task.result.intelId, state.player.factions.intel[0].id);
        assert.equal(state.dialogueMessages[0].payload.intelId, state.player.factions.intel[0].id);
    });

    it('preserves generic service task payloads through save and load', () => {
        const action = requestContactService('person-1', CONTACT_SERVICE_TYPES.ORDERS, {
            commodityId: 'org',
            quantity: 6
        });
        makeDue(action.task);
        resolveDueDialogueTasks('test service save-load');
        const saveData = buildSaveData();

        const loaded = buildLoadedState(saveData);

        assert.equal(loaded.dialogueTasks.length, 1);
        assert.equal(loaded.dialogueTasks[0].serviceType, CONTACT_SERVICE_TYPES.ORDERS);
        assert.equal(loaded.dialogueTasks[0].payload.commodityId, 'org');
        assert.equal(loaded.dialogueTasks[0].payload.quantity, 6);
        assert.equal(loaded.dialogueOffers[0].serviceType, CONTACT_SERVICE_TYPES.ORDERS);
        assert.equal(loaded.dialogueMessages[0].payload.serviceType, CONTACT_SERVICE_TYPES.ORDERS);
    });
});
