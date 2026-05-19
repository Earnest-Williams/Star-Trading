import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { state, resetState } from '../js/state.js';
import { drawMap, getMapNodes, invalidateMapProjectionCache, stopMapAnimation } from '../js/ui/renderMap.js';
import { setSiteCoord } from '../js/core/universe.js';
import { Renderer } from '../js/ui/renderer.js';

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


    it('recomputes projected nodes when camera yaw or pitch changes', () => {
        state.universe[2].coord = { x: 10, y: 0, z: 4 };
        state.universe[3].coord = { x: 20, y: 5, z: 9 };
        const before = getMapNodes();
        const beforeSecondY = before[2].y;

        state.mapCamera = { yaw: 0.45, pitch: 0.25 };
        const after = getMapNodes();

        assert.notEqual(after, before);
        assert.notEqual(after[2].y, beforeSecondY);

        const reused = getMapNodes();
        assert.equal(reused, after);
    });

    it('requires explicit invalidation after coordinate mutation on an already-charted sector', () => {
        const before = getMapNodes();
        const beforeX = before[2].x;

        state.universe[2].coord = { x: 15, y: 0, z: 0 };
        // Coordinate changes are not automatically detected; call invalidateMapProjectionCache() explicitly.
        const cached = getMapNodes();
        assert.equal(cached, before);

        invalidateMapProjectionCache();
        const after = getMapNodes();

        assert.notEqual(after, before);
        assert.notEqual(after[2].x, beforeX);
    });

    it('requires explicit invalidation after in-place coord mutation without replacing state.universe', () => {
        const universeRef = state.universe;
        const before = getMapNodes();

        state.universe[2].coord.y = 10;
        // In-place mutation is not automatically detected; call invalidateMapProjectionCache() explicitly.
        const cached = getMapNodes();
        assert.equal(state.universe, universeRef);
        assert.equal(cached, before);

        invalidateMapProjectionCache();
        const after = getMapNodes();

        assert.notEqual(after, before);
    });

    it('reuses cache when charted state changes for a sector still in the visible set', () => {
        state.player.currentSector = 2;
        const before = getMapNodes();

        state.universe[2].charted = false;
        // Sector 2 is still visible (it is currentSector), so the visible id set is unchanged.
        // Node positions are the same; rendering reads charted state directly from universe.
        const after = getMapNodes();

        assert.equal(after, before);
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


    it('setSiteCoord updates projection cache and coord index', () => {
        const before = getMapNodes();
        const result = setSiteCoord(2, { x: 33, y: 1, z: 0 });
        assert.equal(result.ok, true);
        const after = getMapNodes();
        assert.notEqual(after, before);
        assert.equal(state.siteIdByCoord['33,1,0'], 2);
    });

    it('setSiteCoord rejects invalid coords and missing site ids without mutation', () => {
        const snapshot = JSON.stringify(state.universe[2].coord);
        const bad = setSiteCoord(2, { x: NaN, y: 0, z: 0 });
        assert.equal(bad.ok, false);
        const missing = setSiteCoord(999, { x: 1, y: 2, z: 3 });
        assert.equal(missing.ok, false);
        assert.equal(JSON.stringify(state.universe[2].coord), snapshot);
    });

    it('setSiteCoord rejects occupied coordinates and keeps prior index values', () => {
        state.siteIdByCoord = {
            '10,0,0': 2,
            '20,0,0': 3
        };
        const snapshot = JSON.stringify(state.universe[2].coord);
        const result = setSiteCoord(2, { x: 20, y: 0, z: 0 });
        assert.equal(result.ok, false);
        assert.match(result.message || '', /already occupied/i);
        assert.equal(JSON.stringify(state.universe[2].coord), snapshot);
        assert.equal(state.siteIdByCoord['10,0,0'], 2);
        assert.equal(state.siteIdByCoord['20,0,0'], 3);
    });

    it('supports explicit map projection invalidation for geometry mutation sites', () => {
        const before = getMapNodes();

        invalidateMapProjectionCache();
        const after = getMapNodes();

        assert.notEqual(after, before);
        assert.equal(after[1].x, before[1].x);
        assert.equal(after[1].y, before[1].y);
    });

    it('schedules a follow-up animation frame for star twinkle updates', () => {
        const originalDocument = globalThis.document;
        const originalRaf = globalThis.requestAnimationFrame;
        const originalCancel = globalThis.cancelAnimationFrame;
        const originalInvalidate = Renderer.invalidate;
        const scheduled = [];
        const invalidated = [];
        const ctx = {
            clearRect() {},
            fillRect() {},
            beginPath() {},
            moveTo() {},
            lineTo() {},
            stroke() {},
            arc() {},
            fill() {},
            fillText() {},
            globalAlpha: 1,
            fillStyle: "#000000",
            strokeStyle: "#000000",
            lineWidth: 1,
            font: "10px sans-serif"
        };
        const canvas = {
            width: 320,
            height: 180,
            getContext: () => ctx
        };

        globalThis.document = {
            getElementById: id => (id === 'map' ? canvas : null)
        };
        globalThis.requestAnimationFrame = fn => {
            scheduled.push(fn);
            return scheduled.length;
        };
        globalThis.cancelAnimationFrame = () => {};
        Renderer.invalidate = key => invalidated.push(key);

        state.ports = {};
        state.planets = {};
        state.tradeRoutes = [];
        state.captains = {};
        state.starField = [{ x: 10, y: 12, size: 1, alpha: 0.7, depth: 0, twinkle: 0 }];

        drawMap();
        assert.equal(scheduled.length, 1);

        scheduled[0](1234);
        assert.deepEqual(invalidated, ['map']);

        stopMapAnimation();
        Renderer.invalidate = originalInvalidate;
        globalThis.document = originalDocument;
        globalThis.requestAnimationFrame = originalRaf;
        globalThis.cancelAnimationFrame = originalCancel;
    });
});
