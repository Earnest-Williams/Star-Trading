import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, resetState } from '../js/state.js';
import { generateLocalLocationsForSystem } from '../js/core/universe/generator.js';
import { getLocalLocationsForSystem, canMoveLocal, moveLocal, scanLocalLocation, scanLocalSpace } from '../js/systems/travel.js';

describe('local space system', () => {
    beforeEach(() => {
        resetState();
        state.universe = {
            1: {
                id: 1,
                name: 'System 1',
                coord: { x: 0, y: 0, z: 0 },
                region: 'Core',
                pirateThreat: 0.1,
                asteroids: { hazard: 0.2 },
                siteType: 'way_station',
                jumpGates: []
            }
        };
        state.ports = {
            1: { typeKey: 'mining', factionId: 'hc' }
        };
        state.planets = {
            1: { name: 'Planet 1' }
        };
        state.player = {
            credits: 1000,
            currentSystemId: 1,
            currentSector: 1,
            currentLocationId: 'loc-1-arrival',
            ship: {
                name: 'Test Ship',
                maxHolds: 50,
                travelMinutesPerCorridor: 30,
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
    });

    it('generates local locations from system/site features', () => {
        generateLocalLocationsForSystem(1);

        const locations = getLocalLocationsForSystem(1);
        assert.ok(locations.length > 0);

        // Verify arrival point
        const arrival = locations.find(l => l.kind === 'arrival_point');
        assert.ok(arrival);
        assert.equal(arrival.id, 'loc-1-arrival');
        assert.equal(arrival.known, true);

        // Verify station/port
        const station = locations.find(l => l.kind === 'station');
        assert.ok(station);
        assert.equal(station.id, 'loc-1-port');
        assert.equal(station.dockable, true);

        // Verify planet
        const planet = locations.find(l => l.kind === 'planet');
        assert.ok(planet);
        assert.equal(planet.id, 'loc-1-planet');

        // Verify asteroid belt
        const belt = locations.find(l => l.kind === 'asteroid_belt');
        assert.ok(belt);
        assert.equal(belt.id, 'loc-1-belt');
        assert.equal(belt.hazard, 0.2);

        // Verify way_station/relay
        const relay = locations.find(l => l.kind === 'relay');
        assert.ok(relay);
        assert.equal(relay.id, 'loc-1-relay');

        // Verify hidden anomaly
        const anomaly = locations.find(l => l.kind === 'anomaly');
        assert.ok(anomaly);
        assert.equal(anomaly.known, false); // Hidden initially
    });

    it('can move locally and costs time', () => {
        generateLocalLocationsForSystem(1);
        
        const canMove = canMoveLocal('loc-1-port');
        assert.equal(canMove, true);

        const initialTime = state.player.time.minuteOfDay;
        const res = moveLocal('loc-1-port', { minutes: 30 });
        assert.ok(res);
        assert.equal(state.player.currentLocationId, 'loc-1-port');
        assert.equal(state.player.time.minuteOfDay, initialTime + 30);
        assert.equal(state.player.currentSector, 1); // system should not change
    });

    it('can scan local locations and spaces', () => {
        generateLocalLocationsForSystem(1);
        
        // Passive scan
        const initialTime = state.player.time.minuteOfDay;
        let res = scanLocalLocation('loc-1-port', 'passive');
        assert.ok(res);
        assert.equal(state.player.time.minuteOfDay, initialTime + 10);

        // Deep scan reveals anomalies and takes more time
        res = scanLocalLocation('loc-1-anomaly-1', 'deep');
        assert.ok(res);
        assert.equal(state.player.time.minuteOfDay, initialTime + 10 + 60);

        const anomaly = state.localSpace.locationsById['loc-1-anomaly-1'];
        assert.equal(anomaly.surveyed, true);
        assert.equal(anomaly.known, true); // Revealed now
    });

    it('can run local space scan to discover anomalies', () => {
        generateLocalLocationsForSystem(1);
        const anomaly = state.localSpace.locationsById['loc-1-anomaly-1'];
        assert.equal(anomaly.known, false);

        // Equip deep scanner module and set high fieldcraft to guarantee scan success
        state.player.ship.loadout.scannerArray = 'scanner_deep_ii';
        state.player.character.stats.fieldcraft = 300;

        // Scan local space with deep scan to discover anomalies
        const res = scanLocalSpace('deep');
        assert.ok(res);
        assert.equal(anomaly.known, true);
    });
});
