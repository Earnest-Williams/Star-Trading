import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    DIALOGUE_FALLBACK_LINE,
    DIALOGUE_FRAME_STATES,
    DIALOGUE_INTENTS,
    buildDialogueFrame,
    realizeDialogueLine,
    selectNestedTemplate
} from '../js/systems/people.js';

describe('dialogue template fallback', () => {
    it('preserves fallback behavior for missing required slots', () => {
        const frame = buildDialogueFrame(DIALOGUE_INTENTS.REQUEST_LOCATE_ITEM, {
            ownerPersonId: 'person-1',
            state: DIALOGUE_FRAME_STATES.FRESH_REQUEST,
            slots: { itemLabel: 'nav chip' }
        });

        assert.equal(realizeDialogueLine(frame), DIALOGUE_FALLBACK_LINE);
    });

    it('falls back from missing register and tone variants', () => {
        const bank = {
            [DIALOGUE_INTENTS.REQUEST_LOCATE_ITEM]: {
                [DIALOGUE_FRAME_STATES.FRESH_REQUEST]: {
                    plain: { neutral: ['fallback {itemLabel}'] }
                }
            }
        };
        const frame = buildDialogueFrame(DIALOGUE_INTENTS.REQUEST_LOCATE_ITEM, {
            state: DIALOGUE_FRAME_STATES.FRESH_REQUEST,
            ownerPersonId: 'person-1',
            itemId: 'nav_chip',
            slots: { itemLabel: 'nav chip', personName: 'Nara' }
        });

        assert.equal(selectNestedTemplate(bank, frame, 'underworld', 'hostile'), 'fallback {itemLabel}');
    });
});
