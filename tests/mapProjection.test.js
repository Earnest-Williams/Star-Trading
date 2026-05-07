import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { state, resetState } from '../js/state.js';
import { getMapNodes, invalidateMapProjectionCache } from '../js/ui/renderMap.js';

function seedMapState() {
    resetState();
    invalidateMapProjectionCache();
    state.player = { currentSector: 1 };
    state.universe = {
        1: { id: 1, charted: true, coord: { x: 0, y: 0, z: 0 }, jumpGates: [] },
        2: { id: 2, charted: true, coord: { x: 10, y: 0, z: 0 }, jumpGates: [] },
        3: { id: 3, charted: true, coord: { x: 20, y: 0, z: 0 }, jumpGates: [] },
        4: { id: 4, charted: false, coord: { x: 5, y: 5, z: 0 }, jumpGates: [] }
    };
}

describe('map projection cache', () => {
    beforeEach(seedMapState);

    it('reuses projected nodes until projection inputs change', () => {
        const first = getMapNodes();
        const second = getMapNodes();

        assert.equal(second, first);

        state.universe[4].charted = true;
        const afterCharting = getMapNodes();

        assert.notEqual(afterCharting, first);
        assert.ok(afterCharting[4]);

        const reusedAfterCharting = getMapNodes();
        assert.equal(reusedAfterCharting, afterCharting);
    });

    it('invalidates cache when coords change on an already-charted sector', () => {
        const before = getMapNodes();
        const beforeX = before[2].x;

        state.universe[2].coord = { x: 15, y: 0, z: 0 };
        const after = getMapNodes();

        assert.notEqual(after, before);
        assert.notEqual(after[2].x, beforeX);
    });

    it('invalidates cache when a site is mutated in place without replacing state.universe', () => {
        const universeRef = state.universe;
        const before = getMapNodes();
        const beforeY = before[2].y;

        state.universe[2].coord.y = 10;
        const after = getMapNodes();

        assert.equal(state.universe, universeRef);
        assert.notEqual(after, before);
        assert.notEqual(after[2].y, beforeY);
    });

    it('invalidates cache when charted state toggles on a visible site', () => {
        state.player.currentSector = 2;
        const before = getMapNodes();

        state.universe[2].charted = false;
        const after = getMapNodes();

        assert.notEqual(after, before);
        assert.ok(after[2]);
        assert.equal(state.universe[2].charted, false);
    });

    it('reuses cache when current sector changes between already-charted sectors', () => {
        const before = getMapNodes();

        state.player.currentSector = 2;
        const afterChartedSectorChange = getMapNodes();

        assert.equal(afterChartedSectorChange, before);
    });

    it('invalidates cache when player moves to an uncharted sector', () => {
        const before = getMapNodes();

        state.player.currentSector = 4;
        const after = getMapNodes();

        assert.notEqual(after, before);
        assert.ok(after[4]);
    });

    it('supports explicit map projection invalidation for geometry mutation sites', () => {
        const before = getMapNodes();

        invalidateMapProjectionCache();
        const after = getMapNodes();

        assert.notEqual(after, before);
        assert.equal(after[1].x, before[1].x);
        assert.equal(after[1].y, before[1].y);
    });
});
