import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resetState, state } from '../js/state.js';
import {
    DIALOGUE_FALLBACK_LINE,
    DIALOGUE_LEXICON_IDS,
    DIALOGUE_REGISTERS,
    buildDialogueFrame,
    realizeDialogueLine
} from '../js/systems/people.js';

function seedPeople() {
    resetState();
    state.people = {
        'person-1': {
            id: 'person-1',
            name: 'Vela Kade',
            role: 'fixer',
            dialogueProfile: {
                voiceId: 'scrapyard_plain',
                lexiconId: DIALOGUE_LEXICON_IDS.SCRAPYARD_PLAIN,
                defaultRegister: DIALOGUE_REGISTERS.NEUTRAL,
                personalRegisterFamiliarity: 20,
                personalRegisterTrust: 15
            },
            relationships: {
                player: { trust: 30, familiarity: 25, affect: { warmth: 25 }, tags: [] }
            }
        }
    };
}

describe('dialogue realization voice integration', () => {
    beforeEach(seedPeople);

    it('uses real state.people profile and relationship to realize NPC voice', () => {
        const frame = buildDialogueFrame('request_locate_item', {
            ownerPersonId: 'person-1',
            itemId: 'nav_chip',
            state: 'fresh_request',
            slots: { itemLabel: 'nav chip', personName: 'Vela Kade' }
        });
        const line = realizeDialogueLine(frame);

        assert.match(line, /nav chip/);
        assert.notEqual(line, DIALOGUE_FALLBACK_LINE);
    });
});
