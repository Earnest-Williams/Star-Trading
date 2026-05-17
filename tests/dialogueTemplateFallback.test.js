import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    DIALOGUE_FALLBACK_LINE,
    DIALOGUE_FRAME_STATES,
    DIALOGUE_INTENTS,
    DIALOGUE_REGISTERS,
    DIALOGUE_TONES,
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

    it('falls back from missing register and tone variants to neutral', () => {
        // bank is state → register → tone (intent-specific portion passed to selectNestedTemplate)
        const bank = {
            [DIALOGUE_FRAME_STATES.FRESH_REQUEST]: {
                [DIALOGUE_REGISTERS.NEUTRAL]: {
                    [DIALOGUE_TONES.NEUTRAL]: ['fallback {itemLabel}']
                }
            }
        };
        // frame with work register + hostile tone: should fall back to neutral.neutral
        const frame = {
            ...buildDialogueFrame(DIALOGUE_INTENTS.REQUEST_LOCATE_ITEM, {
                state: DIALOGUE_FRAME_STATES.FRESH_REQUEST,
                slots: { itemLabel: 'nav chip', personName: 'Nara' }
            }),
            register: DIALOGUE_REGISTERS.WORK,
            tone: DIALOGUE_TONES.HOSTILE
        };

        assert.equal(selectNestedTemplate(bank, frame), 'fallback {itemLabel}');
    });
});
