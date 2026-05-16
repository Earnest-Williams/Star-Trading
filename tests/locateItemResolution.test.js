import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { BALANCE, NPC_FINDABLE_PART_DEFS, NPC_FINDABLE_PARTS } from '../js/constants.js';
import { buildLoadedState, buildSaveData } from '../js/core/persistence.js';
import { resetState, state } from '../js/state.js';
import {
    DIALOGUE_TASK_STATUSES,
    buildLocateItemResolutionContext,
    createLocateItemDialogueTask,
    resolveDueDialogueTasks,
    scoreLocateItemResolution
} from '../js/systems/people.js';
import { renderDialogueOffersPanel } from '../js/ui/renderComms.js';
import { initSessionRng } from '../js/utils.js';

function seedLocateItemState({
    portType = 'stardock',
    region = 'Core',
    richness = 'hub',
    pirateThreat = 0,
    trust = 0,
    familiarity = 0,
    services = ['parts', 'discounts', 'intel'],
    role = 'factor'
} = {}) {
    resetState();
    initSessionRng(7);
    state.player = {
        credits: 5000,
        currentSector: 1,
        ship: { maxHolds: 20, travelMinutesPerCorridor: 45 },
        cargo: { ore: 0, org: 0, eq: 0 },
        time: { day: 2, minuteOfDay: 480, wakeMinute: 480, sleepMinute: 1320 },
        seed: 7,
        factions: { contacts: {} },
        factionRelations: {}
    };
    state.universe = {
        1: { id: 1, name: 'Resolver Test', jumpGates: [], region, richness, pirateThreat }
    };
    state.sitesById = state.universe;
    state.ports = portType ? { 1: { typeKey: portType, factionId: 'sda' } } : {};
    state.planets = {};
    state.people = {
        'person-1': {
            id: 'person-1',
            name: 'Nara Keel',
            role,
            sectorId: 1,
            services,
            relationships: { player: { trust, familiarity, tags: [] } }
        }
    };
    state.peopleBySector = { 1: ['person-1'] };
}

function dueMinute() {
    return (state.player.time.day - 1) * BALANCE.DAY_MINUTES + state.player.time.minuteOfDay;
}

function makeTask(itemId = 'nav_chip', resolutionPolicy = {}) {
    const task = createLocateItemDialogueTask({
        ownerPersonId: 'person-1',
        requesterId: 'player',
        itemId,
        conversationId: `test-${itemId}`,
        causedByPartId: null,
        resolutionPolicy
    });
    task.nextCheckAtAbsoluteMinute = dueMinute();
    return task;
}

describe('locate-item resolution', () => {
    beforeEach(() => seedLocateItemState());

    it('has metadata for every public findable part', () => {
        assert.deepEqual(NPC_FINDABLE_PARTS, Object.keys(NPC_FINDABLE_PART_DEFS));
        NPC_FINDABLE_PARTS.forEach(partId => {
            const def = NPC_FINDABLE_PART_DEFS[partId];
            assert.equal(def.id, partId);
            assert.equal(typeof def.label, 'string');
            assert.ok(def.basePrice >= 50);
            assert.ok(def.rarity >= 0 && def.rarity <= 1);
            assert.ok(Array.isArray(def.favoredPortTypes));
            assert.ok(Array.isArray(def.favoredRegions));
        });
    });

    it('force success and failure policies still control outcomes', () => {
        const successTask = makeTask('nav_chip', { forceResult: 'success', successChance: 0 });
        resolveDueDialogueTasks('forced success');
        assert.equal(successTask.status, DIALOGUE_TASK_STATUSES.RESOLVED);

        seedLocateItemState();
        const failureTask = makeTask('nav_chip', { forceResult: 'failure', successChance: 1 });
        resolveDueDialogueTasks('forced failure');
        assert.equal(failureTask.status, DIALOGUE_TASK_STATUSES.FAILED);
    });

    it('explicit policy price overrides computed price', () => {
        makeTask('nav_chip', { forceResult: 'success', price: 725 });
        resolveDueDialogueTasks('price override');

        assert.equal(state.dialogueOffers[0].price, 725);
        assert.ok(state.dialogueOffers[0].payload.explanationTags.includes('policy_price_override'));
    });

    it('computed price never drops below the located-item minimum', () => {
        seedLocateItemState({ portType: null, region: 'Core', richness: 'hub', trust: 100 });
        const task = makeTask('unknown_discount_part');
        const score = scoreLocateItemResolution(task, buildLocateItemResolutionContext(task));

        assert.ok(score.price >= 50);
    });

    it('favored port and region improve success chance', () => {
        const favoredTask = makeTask('nav_chip');
        const favoredScore = scoreLocateItemResolution(
            favoredTask,
            buildLocateItemResolutionContext(favoredTask)
        );

        seedLocateItemState({ portType: 'mining', region: 'Badlands', richness: 'hub' });
        const unfavoredTask = makeTask('nav_chip');
        const unfavoredScore = scoreLocateItemResolution(
            unfavoredTask,
            buildLocateItemResolutionContext(unfavoredTask)
        );

        assert.ok(favoredScore.successChance > unfavoredScore.successChance);
    });

    it('high pirate threat reduces success chance', () => {
        const lowThreatTask = makeTask('fuel_injector');
        const lowThreatScore = scoreLocateItemResolution(
            lowThreatTask,
            buildLocateItemResolutionContext(lowThreatTask)
        );

        seedLocateItemState({ pirateThreat: 6 });
        const highThreatTask = makeTask('fuel_injector');
        const highThreatScore = scoreLocateItemResolution(
            highThreatTask,
            buildLocateItemResolutionContext(highThreatTask)
        );

        assert.ok(highThreatScore.successChance < lowThreatScore.successChance);
        assert.equal(highThreatScore.riskLevel, 'high');
    });

    it('relationship trust improves chance or price', () => {
        const neutralTask = makeTask('fuel_injector');
        const neutralScore = scoreLocateItemResolution(
            neutralTask,
            buildLocateItemResolutionContext(neutralTask)
        );

        seedLocateItemState({ trust: 50, familiarity: 20 });
        const trustedTask = makeTask('fuel_injector');
        const trustedScore = scoreLocateItemResolution(
            trustedTask,
            buildLocateItemResolutionContext(trustedTask)
        );

        assert.ok(
            trustedScore.successChance > neutralScore.successChance
                || trustedScore.price < neutralScore.price
        );
    });

    it('successful resolution writes offer payload with condition source and risk', () => {
        const task = makeTask('nav_chip', { forceResult: 'success' });
        resolveDueDialogueTasks('payload success');

        const offer = state.dialogueOffers[0];
        assert.ok(offer.payload.condition);
        assert.ok(offer.payload.sourceFlavor);
        assert.ok(offer.payload.riskLevel);
        assert.equal(task.result.resolution.condition, offer.payload.condition);
        assert.equal(task.result.resolution.sourceFlavor, offer.payload.sourceFlavor);
    });

    it('failure writes resolution metadata into task result', () => {
        const task = makeTask('nav_chip', { forceResult: 'failure' });
        resolveDueDialogueTasks('payload failure');

        assert.equal(task.status, DIALOGUE_TASK_STATUSES.FAILED);
        assert.equal(task.result.resolution.riskLevel, 'low');
        assert.ok(Array.isArray(task.result.resolution.explanationTags));
        assert.equal(typeof task.result.resolution.successChance, 'number');
    });

    it('communications offer card displays compact payload details', () => {
        makeTask('nav_chip', { forceResult: 'success' });
        resolveDueDialogueTasks('render offer payload');

        const html = renderDialogueOffersPanel();

        assert.match(html, /risk/);
        assert.match(html, /from/);
        assert.match(html, /serviceable|refurbished|pristine|worn/);
    });

    it('save and load preserves richer task result and offer payload', () => {
        const task = makeTask('nav_chip', { forceResult: 'success' });
        resolveDueDialogueTasks('save rich payload');
        const saveData = buildSaveData();

        const loaded = buildLoadedState(saveData);

        assert.equal(loaded.dialogueTasks[0].result.resolution.condition, task.result.resolution.condition);
        assert.equal(loaded.dialogueOffers[0].payload.sourceFlavor, state.dialogueOffers[0].payload.sourceFlavor);
        assert.equal(loaded.dialogueOffers[0].payload.riskLevel, state.dialogueOffers[0].payload.riskLevel);
    });
});
