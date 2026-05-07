import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { state, resetState } from '../js/state.js';
import { BALANCE } from '../js/constants.js';
import { addJumpGateCorridor } from '../js/core/universe.js';
import { getSectorNeighbors, findShortestSectorPath, getSectorPathDistance, areSectorsConnected } from '../js/core/navigation.js';

function sector(id) {
    return { id, name: `S${id}`, region: 'Core', jumpGates: [], pirateThreat: 0, influence: { sda: 50, fu: 20, hc: 10, vc: 0 } };
}

beforeEach(() => {
    resetState();
    state.universe = { 1: sector(1), 2: sector(2), 3: sector(3), 4: sector(4) };
});

describe('jump-gate corridor navigation', () => {
    it('paired gates form a corridor between sectors', () => {
        addJumpGateCorridor(1, 2);
        assert.equal(state.universe[1].jumpGates.length, 1);
        assert.equal(state.universe[2].jumpGates.length, 1);
        assert.deepEqual(getSectorNeighbors(1), [2]);
        assert.equal(state.universe[1].jumpGates[0].corridorId, state.universe[2].jumpGates[0].corridorId);
    });

    it('shortest path works through corridor-derived adjacency', () => {
        addJumpGateCorridor(1, 2);
        addJumpGateCorridor(2, 4);
        addJumpGateCorridor(1, 3);
        assert.deepEqual(findShortestSectorPath(1, 4), [1, 2, 4]);
    });

    it('prefers lower-cost corridors over fewer expensive hops', () => {
        addJumpGateCorridor(1, 4, { effectiveSpanCost: BALANCE.GATE_PHYSICS.VACUUM_SPAN * 40 });
        addJumpGateCorridor(1, 2, { effectiveSpanCost: BALANCE.GATE_PHYSICS.VACUUM_SPAN * 0.2 });
        addJumpGateCorridor(2, 4, { effectiveSpanCost: BALANCE.GATE_PHYSICS.VACUUM_SPAN * 0.2 });
        assert.deepEqual(findShortestSectorPath(1, 4), [1, 2, 4]);
    });

    it('disconnected sectors return no path', () => {
        addJumpGateCorridor(1, 2);
        assert.equal(findShortestSectorPath(1, 4), null);
        assert.equal(areSectorsConnected(1, 4), false);
    });

    it('direct corridor vs multi-corridor distance is correct', () => {
        addJumpGateCorridor(1, 2);
        addJumpGateCorridor(2, 3);
        assert.equal(getSectorPathDistance(1, 2), 1);
        assert.equal(getSectorPathDistance(1, 3), 2);
    });
});
