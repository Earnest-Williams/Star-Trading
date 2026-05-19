import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { seedDialogueRelationshipState } from './helpers/dialogueState.js';
import { applyDialogueRelationshipDelta, getDialogueRelationship } from '../js/systems/people.js';

function seed() {
    seedDialogueRelationshipState({ id: 'person-1', name: 'Nara' });
}

describe('dialogue relationships', () => {
    beforeEach(seed);

    it('stores trust and familiarity on person records', () => {
        applyDialogueRelationshipDelta('person-1', { trust: 3, familiarity: 2, tags: ['test'], reason: 'test' });
        const relationship = getDialogueRelationship('person-1');
        assert.equal(relationship.trust, 3);
        assert.equal(relationship.familiarity, 2);
        assert.deepEqual(relationship.tags, ['test']);
    });
});
