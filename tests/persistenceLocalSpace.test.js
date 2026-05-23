import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, resetState } from '../js/state.js';
import { normaliseLoadedGame } from '../js/core/persistence.js';

describe('persistence save normalization for local space & loadouts', () => {
    beforeEach(() => {
        resetState();
        state.universe = {
            1: {
                id: 1,
                name: 'System 1',
                coord: { x: 0, y: 0, z: 0 },
                region: 'Core',
                pirateThreat: 0.1,
                jumpGates: []
            }
        };
        // A minimal player state loaded without the new fields
        state.player = {
            currentSector: 1,
            ship: {
                name: 'Test Ship',
                maxHolds: 50,
                maxShields: 100,
                scannerLevel: 1,
                combatRating: 10
            }
        };
    });

    afterEach(() => {
        resetState();
    });

    it('normalizes missing localSpace, currentSystemId, currentLocationId, ship loadout, and wing defaults', () => {
        // Assert initial missing fields
        assert.equal(state.player.currentSystemId, undefined);
        assert.equal(state.player.currentLocationId, undefined);
        assert.equal(state.player.wing, undefined);
        assert.equal(state.player.ship.loadout, undefined);
        assert.deepEqual(state.localSpace, {
            locationsById: {},
            locationIdsBySystemId: {},
            discoveredLocationIds: {},
            nextLocalLocationId: 1
        });

        // Run normalizer
        normaliseLoadedGame(state);

        // Verify normalized state
        assert.equal(state.player.currentSystemId, 1);
        assert.equal(state.player.currentLocationId, 'loc-1-arrival');
        assert.ok(state.player.wing);
        assert.deepEqual(state.player.wing.captainIds, []);
        assert.equal(state.player.wing.stance, 'balanced');
        assert.ok(state.player.ship.loadout);
        assert.equal(state.player.ship.loadout.weapons, null);

        // Verify local space POIs are generated for the system
        assert.ok(state.localSpace.locationIdsBySystemId[1].length > 0);
        const arrivalLoc = state.localSpace.locationsById['loc-1-arrival'];
        assert.ok(arrivalLoc);
        assert.equal(arrivalLoc.kind, 'arrival_point');
    });

    it('remains idempotent on multiple normalisation runs', () => {
        normaliseLoadedGame(state);
        
        const firstLocationIds = [...state.localSpace.locationIdsBySystemId[1]];
        const firstLoadout = { ...state.player.ship.loadout };

        normaliseLoadedGame(state);

        // Verify local space has not duplicated locations
        assert.deepEqual(state.localSpace.locationIdsBySystemId[1], firstLocationIds);
        // Verify loadout is unchanged
        assert.deepEqual(state.player.ship.loadout, firstLoadout);
    });
});
