import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, resetState } from '../js/state.js';
import { addJumpGateCorridor } from '../js/core/universe.js';
import { generateLocalLocationsForSystem } from '../js/core/universe/generator.js';
import {
    canBeginCorridorTransit,
    beginCorridorTransit,
    scanTransit,
    scanTransitDeeper,
    commitCorridorTransit,
    cancelTransitSession,
    moveTo,
    scanDestinationData
} from '../js/systems/travel.js';

describe('travel corridor transit sessions', () => {
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
            },
            2: {
                id: 2,
                name: 'System 2',
                coord: { x: 10, y: 0, z: 0 },
                region: 'Core',
                pirateThreat: 0.2,
                jumpGates: []
            }
        };
        addJumpGateCorridor(1, 2);

        state.player = {
            credits: 1000,
            currentSystemId: 1,
            currentSector: 1,
            currentLocationId: 'loc-1-arrival',
            ship: {
                name: 'Test Ship',
                maxHolds: 50,
                travelMinutesPerCorridor: 45,
                scannerLevel: 1,
                maxShields: 100,
                maxHull: 100,
                loadout: {
                    weapons: null,
                    shields: null,
                    pulseTender: null,
                    scannerArray: null,
                    cargoExpander: null
                }
            },
            time: { day: 1, minuteOfDay: 480, wakeMinute: 480, sleepMinute: 1320 },
            character: {
                stats: { nerve: 50, tradecraft: 50, fieldcraft: 50, command: 50 },
                traits: []
            },
            wing: {
                captainIds: [],
                stance: 'balanced'
            }
        };

        generateLocalLocationsForSystem(1);
        generateLocalLocationsForSystem(2);
    });

    it('validates direct corridors and begins transit without immediate move', () => {
        assert.equal(canBeginCorridorTransit(2), true);
        assert.equal(canBeginCorridorTransit(3), false); // No corridor

        const res = beginCorridorTransit(2);
        assert.ok(res);
        assert.ok(state.transitSession);
        assert.equal(state.transitSession.originSystemId, 1);
        assert.equal(state.transitSession.targetSystemId, 2);
        assert.equal(state.transitSession.status, 'active');

        // Verify player did not move yet
        assert.equal(state.player.currentSystemId, 1);
        assert.equal(state.player.currentSector, 1);
    });

    it('can scan transit session to spend time and increase scan depth', () => {
        beginCorridorTransit(2);
        const initialTime = state.player.time.minuteOfDay;

        // Passive scan
        let res = scanTransit('passive');
        assert.ok(res);
        assert.equal(state.transitSession.scanDepth, 1);
        assert.equal(state.transitSession.elapsedExtraMinutes, 15);
        assert.equal(state.player.time.minuteOfDay, initialTime + 15);

        // Deep scan
        res = scanTransitDeeper();
        assert.ok(res);
        assert.equal(state.transitSession.scanDepth, 3); // 1 + 2
        assert.equal(state.transitSession.elapsedExtraMinutes, 60); // 15 + 45
        assert.equal(state.player.time.minuteOfDay, initialTime + 60);
    });

    it('commits transit, spends remaining time, moves player, and resolves location', () => {
        beginCorridorTransit(2);
        // Base time is 45 minutes. Let's do a passive scan which spends 15.
        scanTransit('passive');

        const initialTime = state.player.time.minuteOfDay;
        
        const commitRes = commitCorridorTransit();
        assert.ok(commitRes);
        assert.equal(state.player.currentSystemId, 2);
        assert.equal(state.player.currentSector, 2);
        assert.equal(state.player.currentLocationId, 'loc-2-arrival');
        assert.equal(state.transitSession, null);

        // Remaining 30 minutes should be spent on commit
        assert.equal(state.player.time.minuteOfDay, initialTime + 30);
    });

    it('can cancel transit session', () => {
        beginCorridorTransit(2);
        const cancelRes = cancelTransitSession();
        assert.ok(cancelRes);
        assert.equal(state.transitSession, null);
        assert.equal(state.player.currentSystemId, 1);
    });

    it('compatibility moveTo wrapper works', () => {
        const initialTime = state.player.time.minuteOfDay;
        const res = moveTo(2);
        assert.ok(res);
        assert.equal(state.player.currentSystemId, 2);
        assert.equal(state.player.currentSector, 2);
        assert.equal(state.player.currentLocationId, 'loc-2-arrival');
        assert.equal(state.player.time.minuteOfDay, initialTime + 45); // spends full travelMinutesPerCorridor (45)
    });

    it('scans destination data only for adjacent systems', () => {
        const initialTime = state.player.time.minuteOfDay;
        assert.equal(scanDestinationData(3, 'passive'), false);
        assert.equal(state.player.time.minuteOfDay, initialTime);
        assert.ok(scanDestinationData(2, 'passive'));
        assert.equal(state.player.time.minuteOfDay, initialTime + 15);
    });
});
