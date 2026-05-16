import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resetState, state } from '../js/state.js';
import {
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
            dialogueProfile: { register: DIALOGUE_REGISTERS.UNDERWORLD, stableSeed: 'voice-test' },
            relationships: {
                player: { trust: -70, familiarity: 2, affect: { irritation: 80 }, tags: [] }
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
        assert.match(line, /regret|shake loose/);
    });
});
