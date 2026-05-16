import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { normaliseLoadedGame } from '../js/core/persistence.js';
import { resetState, state } from '../js/state.js';
import {
    DIALOGUE_LEXICON_IDS,
    DIALOGUE_REGISTERS,
    DIALOGUE_TONES,
    applyDialogueRelationshipDelta,
    createGeneratedPerson,
    buildDialogueFrame,
    deriveDialogueTone,
    normaliseDialogueProfile,
    normaliseRelationshipAffect,
    resolveLexiconSlots,
    selectDialogueRegister
} from '../js/systems/people.js';

describe('dialogue voice model', () => {
    it('normalizes dialogue profiles with safe defaults', () => {
        const profile = normaliseDialogueProfile({
            register: 'bad-register',
            fallbackRegister: DIALOGUE_REGISTERS.CASUAL,
            toneBias: DIALOGUE_TONES.BRISK,
            lexiconIds: ['missing', DIALOGUE_LEXICON_IDS.DOCK, DIALOGUE_LEXICON_IDS.DOCK],
            stableSeed: '  person-7  '
        });

        assert.equal(profile.register, DIALOGUE_REGISTERS.PROFESSIONAL);
        assert.equal(profile.fallbackRegister, DIALOGUE_REGISTERS.CASUAL);
        assert.equal(profile.toneBias, DIALOGUE_TONES.BRISK);
        assert.deepEqual(profile.lexiconIds, [DIALOGUE_LEXICON_IDS.DOCK]);
        assert.equal(profile.stableSeed, 'person-7');
    });

    it('normalizes affect values into bounded numeric fields', () => {
        const affect = normaliseRelationshipAffect({
            warmth: 150,
            irritation: '-20',
            respect: 'bad',
            suspicion: -150
        });

        assert.deepEqual(affect, { warmth: 100, irritation: -20, respect: 0, suspicion: -100 });
    });

    it('selects a personal register from the NPC profile', () => {
        const person = {
            id: 'person-1',
            dialogueProfile: { register: DIALOGUE_REGISTERS.UNDERWORLD }
        };
        const frame = buildDialogueFrame('request_locate_item', { ownerPersonId: 'person-1' });

        assert.equal(selectDialogueRegister(frame, person), DIALOGUE_REGISTERS.UNDERWORLD);
    });

    it('derives hostile tone from relationship affect', () => {
        const tone = deriveDialogueTone(
            buildDialogueFrame('request_locate_item'),
            { trust: 0, familiarity: 1, affect: { irritation: 75 }, tags: [] }
        );

        assert.equal(tone, DIALOGUE_TONES.HOSTILE);
    });

    it('resolves lexicon slots deterministically', () => {
        const person = {
            id: 'person-1',
            dialogueProfile: {
                lexiconIds: [DIALOGUE_LEXICON_IDS.DOCK],
                stableSeed: 'dock-seed'
            }
        };
        const frame = buildDialogueFrame('request_locate_item', {
            ownerPersonId: 'person-1',
            itemId: 'nav_chip'
        });

        assert.deepEqual(resolveLexiconSlots(frame, person), resolveLexiconSlots(frame, person));
        assert.equal(resolveLexiconSlots(frame, person).contactChannel, 'Communications');
    });



    it('assigns normalized dialogue profiles to generated NPCs', () => {
        resetState();
        state.nextPersonId = 1;
        state.people = {};
        state.peopleBySector = {};
        state.peopleByCompany = {};

        const person = createGeneratedPerson({ role: 'fixer', sectorId: 1 }, () => 0);

        assert.equal(person.dialogueProfile.register, DIALOGUE_REGISTERS.UNDERWORLD);
        assert.deepEqual(person.dialogueProfile.lexiconIds, [
            DIALOGUE_LEXICON_IDS.UNDERWORLD,
            DIALOGUE_LEXICON_IDS.STANDARD
        ]);
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

        assert.equal(state.people['person-1'].dialogueProfile.register, DIALOGUE_REGISTERS.FORMAL);
        assert.deepEqual(state.people['person-1'].relationships.player.affect, {
            warmth: 0,
            irritation: 0,
            respect: 0,
            suspicion: 0
        });
    });

    it('relationship deltas safely mutate affect values', () => {
        resetState();
        state.player = { time: { day: 1, minuteOfDay: 600 } };
        state.people = { 'person-1': { id: 'person-1', name: 'Nara' } };

        const relationship = applyDialogueRelationshipDelta('person-1', {
            affect: { warmth: 12, irritation: 250 },
            reason: 'test'
        });

        assert.equal(relationship.affect.warmth, 12);
        assert.equal(relationship.affect.irritation, 100);
    });
});
