import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    DIALOGUE_FALLBACK_LINE,
    DIALOGUE_FRAME_STATES,
    DIALOGUE_INTENTS,
    buildDialogueFrame,
    realizeDialogueLine,
    realizeDialoguePrompt,
    validateDialogueFrame
} from '../js/systems/people.js';

function buildLocateFrame(state) {
    return buildDialogueFrame(DIALOGUE_INTENTS.REQUEST_LOCATE_ITEM, {
        actorId: 'player',
        ownerPersonId: 'person-1',
        subjectId: 'player',
        itemId: 'nav_chip',
        state,
        slots: { itemLabel: 'nav chip', personName: 'Nara Keel' }
    });
}

describe('dialogue realization', () => {
    it('validates required locate-item slots without throwing', () => {
        const frame = buildDialogueFrame(DIALOGUE_INTENTS.REQUEST_LOCATE_ITEM, {
            ownerPersonId: 'person-1',
            itemId: 'nav_chip',
            state: DIALOGUE_FRAME_STATES.FRESH_REQUEST,
            slots: { itemLabel: '', personName: 'Nara Keel' }
        });
        const validation = validateDialogueFrame(frame);

        assert.equal(validation.valid, false);
        assert.deepEqual(validation.missingSlots, ['itemLabel']);
        assert.equal(realizeDialogueLine(frame), DIALOGUE_FALLBACK_LINE);
    });

    it('maps each locate-item request state to a valid line', () => {
        const states = [
            DIALOGUE_FRAME_STATES.FRESH_REQUEST,
            DIALOGUE_FRAME_STATES.ACTIVE_TASK,
            DIALOGUE_FRAME_STATES.REMEMBERED_REQUEST,
            DIALOGUE_FRAME_STATES.OFFER_READY,
            DIALOGUE_FRAME_STATES.FOUND_ALREADY,
            DIALOGUE_FRAME_STATES.FAILED_PREVIOUS
        ];

        states.forEach(state => {
            const frame = buildLocateFrame(state);
            const line = realizeDialogueLine(frame);

            assert.equal(validateDialogueFrame(frame).valid, true);
            assert.match(line, /nav chip/);
            assert.notEqual(line, DIALOGUE_FALLBACK_LINE);
        });
    });

    it('uses a safe fallback line for missing item or person data', () => {
        const frame = buildDialogueFrame(DIALOGUE_INTENTS.CHECK_BACK_LOCATE_ITEM, {
            ownerPersonId: 'person-1',
            itemId: 'nav_chip',
            state: DIALOGUE_FRAME_STATES.ACTIVE_TASK,
            slots: { itemLabel: 'nav chip' }
        });

        assert.equal(realizeDialogueLine(frame), DIALOGUE_FALLBACK_LINE);
    });

    it('is deterministic for the same semantic frame', () => {
        const frame = buildLocateFrame(DIALOGUE_FRAME_STATES.OFFER_READY);

        assert.equal(realizeDialogueLine(frame), realizeDialogueLine(frame));
    });

    it('preserves additional normalized slots on the semantic frame', () => {
        const frame = buildDialogueFrame(DIALOGUE_INTENTS.REQUEST_LOCATE_ITEM, {
            ownerPersonId: 'person-1',
            itemId: 'nav_chip',
            state: DIALOGUE_FRAME_STATES.FRESH_REQUEST,
            slots: { itemLabel: 'nav chip', personName: 'Nara Keel', urgency: ' high ' }
        });

        assert.equal(frame.slots.urgency, 'high');
    });

    it('realizes player prompts through the template pipeline', () => {
        const frame = buildDialogueFrame(DIALOGUE_INTENTS.CHECK_BACK_LOCATE_ITEM, {
            ownerPersonId: 'person-1',
            itemId: 'nav_chip',
            state: DIALOGUE_FRAME_STATES.ACTIVE_TASK,
            slots: { itemLabel: 'nav chip', personName: 'Nara Keel' }
        });

        const prompt = realizeDialoguePrompt(frame);

        assert.match(prompt, /nav chip/);
        assert.notEqual(prompt, DIALOGUE_FALLBACK_LINE);
    });

    it('maps locate-item player prompt states to valid prompts', () => {
        const promptStates = [
            [
                DIALOGUE_INTENTS.REQUEST_LOCATE_ITEM,
                DIALOGUE_FRAME_STATES.FRESH_REQUEST
            ],
            [
                DIALOGUE_INTENTS.REQUEST_LOCATE_ITEM,
                DIALOGUE_FRAME_STATES.ACTIVE_TASK
            ],
            [
                DIALOGUE_INTENTS.REQUEST_LOCATE_ITEM,
                DIALOGUE_FRAME_STATES.REMEMBERED_REQUEST
            ],
            [
                DIALOGUE_INTENTS.REQUEST_LOCATE_ITEM,
                DIALOGUE_FRAME_STATES.OFFER_READY
            ],
            [
                DIALOGUE_INTENTS.REQUEST_LOCATE_ITEM,
                DIALOGUE_FRAME_STATES.FOUND_ALREADY
            ],
            [
                DIALOGUE_INTENTS.REQUEST_LOCATE_ITEM,
                DIALOGUE_FRAME_STATES.FAILED_PREVIOUS
            ],
            [
                DIALOGUE_INTENTS.CHECK_BACK_LOCATE_ITEM,
                DIALOGUE_FRAME_STATES.FRESH_REQUEST
            ],
            [
                DIALOGUE_INTENTS.CHECK_BACK_LOCATE_ITEM,
                DIALOGUE_FRAME_STATES.ACTIVE_TASK
            ],
            [
                DIALOGUE_INTENTS.CHECK_BACK_LOCATE_ITEM,
                DIALOGUE_FRAME_STATES.REMEMBERED_REQUEST
            ],
            [
                DIALOGUE_INTENTS.CHECK_BACK_LOCATE_ITEM,
                DIALOGUE_FRAME_STATES.OFFER_READY
            ],
            [
                DIALOGUE_INTENTS.CHECK_BACK_LOCATE_ITEM,
                DIALOGUE_FRAME_STATES.FOUND_ALREADY
            ],
            [
                DIALOGUE_INTENTS.CHECK_BACK_LOCATE_ITEM,
                DIALOGUE_FRAME_STATES.FAILED_PREVIOUS
            ]
        ];

        promptStates.forEach(([intent, state]) => {
            const frame = buildDialogueFrame(intent, {
                ownerPersonId: 'person-1',
                itemId: 'nav_chip',
                state,
                slots: { itemLabel: 'nav chip', personName: 'Nara Keel' }
            });
            const prompt = realizeDialoguePrompt(frame);

            assert.notEqual(prompt, DIALOGUE_FALLBACK_LINE);
            assert.match(prompt, /nav chip/);
        });
    });
});
