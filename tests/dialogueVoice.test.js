import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { normaliseLoadedGame } from '../js/core/persistence.js';
import { resetState, state } from '../js/state.js';
import {
    DIALOGUE_LEXICON_IDS,
    DIALOGUE_REGISTERS,
    DIALOGUE_TONES,
    applyDialogueRelationshipDelta,
    buildDialogueFrame,
    createGeneratedPerson,
    deriveDialogueTone,
    normaliseDialogueProfile,
    normaliseRelationshipAffect,
    resolveLexiconSlots,
    selectDialogueRegister
} from '../js/systems/people.js';

describe('dialogue voice model', () => {
    it('falls back to default lexiconId when missing or invalid', () => {
        const profile = normaliseDialogueProfile({ lexiconId: 'invalid_lexicon' });
        assert.equal(profile.lexiconId, DIALOGUE_LEXICON_IDS.DEFAULT);
    });

    it('falls back to neutral defaultRegister when missing', () => {
        const profile = normaliseDialogueProfile({});
        assert.equal(profile.defaultRegister, DIALOGUE_REGISTERS.NEUTRAL);
    });

    it('normalizes affect values that clamp to -100..100', () => {
        const affect = normaliseRelationshipAffect({
            warmth: 150,
            resentment: '-20',
            respect: 'bad',
            fear: -150,
            envy: 50,
            jealousy: -200,
            attraction: 100
        });
        assert.deepEqual(affect, {
            warmth: 100,
            respect: 0,
            resentment: -20,
            fear: -100,
            envy: 50,
            jealousy: -100,
            attraction: 100
        });
    });

    it('missing affect values become 0', () => {
        const affect = normaliseRelationshipAffect({});
        assert.deepEqual(affect, {
            warmth: 0,
            respect: 0,
            resentment: 0,
            fear: 0,
            envy: 0,
            jealousy: 0,
            attraction: 0
        });
    });

    it('selects personal register when familiarity and trust meet profile thresholds', () => {
        const profile = normaliseDialogueProfile({
            voiceId: 'plain_frontier',
            lexiconId: DIALOGUE_LEXICON_IDS.DEFAULT,
            defaultRegister: DIALOGUE_REGISTERS.NEUTRAL,
            personalRegisterFamiliarity: 20,
            personalRegisterTrust: 15
        });
        const frame = buildDialogueFrame('request_locate_item', {});
        const relationship = { trust: 20, familiarity: 25 };

        assert.equal(selectDialogueRegister(frame, profile, relationship), DIALOGUE_REGISTERS.PERSONAL);
    });

    it('derives hostile tone from low trust', () => {
        const tone = deriveDialogueTone(
            buildDialogueFrame('request_locate_item'),
            { trust: -50, familiarity: 1, affect: {}, tags: [] }
        );

        assert.equal(tone, DIALOGUE_TONES.HOSTILE);
    });

    it('resolves lexicon slots deterministically across repeated calls with non-empty strings', () => {
        const profile = normaliseDialogueProfile({
            voiceId: 'dock_direct',
            lexiconId: DIALOGUE_LEXICON_IDS.DOCK_DIRECT,
            defaultRegister: DIALOGUE_REGISTERS.WORK,
            personalRegisterFamiliarity: 20,
            personalRegisterTrust: 15
        });
        const frame = buildDialogueFrame('request_locate_item', {
            ownerPersonId: 'person-1',
            itemId: 'nav_chip'
        });

        const slotsA = resolveLexiconSlots(frame, profile);
        const slotsB = resolveLexiconSlots(frame, profile);
        assert.deepEqual(slotsA, slotsB);
        assert.ok(slotsA.askAround.length > 0);
        assert.ok(slotsA.noStock.length > 0);
        assert.ok(slotsA.supplier.length > 0);
    });

    it('assigns normalized dialogue profiles to generated NPCs based on role', () => {
        resetState();
        state.nextPersonId = 1;
        state.people = {};
        state.peopleBySector = {};
        state.peopleByCompany = {};

        const fixer = createGeneratedPerson({ role: 'fixer', sectorId: 1 }, () => 0);
        const factor = createGeneratedPerson({ role: 'factor', sectorId: 1 }, () => 0);

        assert.equal(fixer.dialogueProfile.lexiconId, DIALOGUE_LEXICON_IDS.SCRAPYARD_PLAIN);
        assert.equal(fixer.dialogueProfile.defaultRegister, DIALOGUE_REGISTERS.NEUTRAL);
        assert.equal(factor.dialogueProfile.lexiconId, DIALOGUE_LEXICON_IDS.DEFAULT);
        assert.equal(factor.dialogueProfile.defaultRegister, DIALOGUE_REGISTERS.NEUTRAL);
    });

    it('repairs missing dialogue profiles and relationship affect during load normalisation', () => {
        resetState();
        state.player = { time: { day: 1, minuteOfDay: 600 }, cargo: {}, factions: {} };
        state.world = { roles: {} };
        state.universe = {};
        state.ports = {};
        state.planets = {};
        state.missions = [];
        state.people = {
            'person-1': {
                id: 'person-1',
                role: 'customs_officer',
                relationships: { player: { trust: 5 } }
            }
        };

        normaliseLoadedGame();

        assert.equal(
            state.people['person-1'].dialogueProfile.lexiconId,
            DIALOGUE_LEXICON_IDS.CORPORATE_PRECISE
        );
        assert.deepEqual(state.people['person-1'].relationships.player.affect, {
            warmth: 0,
            respect: 0,
            resentment: 0,
            fear: 0,
            envy: 0,
            jealousy: 0,
            attraction: 0
        });
    });

    it('relationship deltas safely mutate affect values within bounds', () => {
        resetState();
        state.player = { time: { day: 1, minuteOfDay: 600 } };
        state.people = { 'person-1': { id: 'person-1', name: 'Nara' } };

        const relationship = applyDialogueRelationshipDelta('person-1', {
            affect: { warmth: 12, resentment: 250 },
            reason: 'test'
        });

        assert.equal(relationship.affect.warmth, 12);
        assert.equal(relationship.affect.resentment, 100);
    });
});
