import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { state, resetState } from '../js/state.js';
import { getMapNodes } from '../js/ui/renderMap.js';

function seedMapState() {
    resetState();
    state.player = { currentSector: 1 };
    state.universe = {
        1: { id: 1, charted: true, coord: { x: 0, y: 0, z: 0 }, jumpGates: [] },
        2: { id: 2, charted: true, coord: { x: 10, y: 0, z: 0 }, jumpGates: [] },
        3: { id: 3, charted: false, coord: { x: 5, y: 5, z: 0 }, jumpGates: [] }
    };
}

describe('map projection cache', () => {
    beforeEach(seedMapState);

    it('reuses projected nodes until charted geometry or current sector changes', () => {
        const first = getMapNodes();
        const second = getMapNodes();

        assert.equal(second, first);

        state.universe[3].charted = true;
        const afterCharting = getMapNodes();

        assert.notEqual(afterCharting, first);
        assert.ok(afterCharting[3]);

        const reusedAfterCharting = getMapNodes();
        assert.equal(reusedAfterCharting, afterCharting);

        state.player.currentSector = 2;
        const afterCurrentSectorChange = getMapNodes();

        assert.notEqual(afterCurrentSectorChange, afterCharting);
    });
});
