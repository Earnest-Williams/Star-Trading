// Cross-system simulation tests.
// Exercises seeded world generation and basic time-advance invariants
// without touching any browser-specific code.
import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resetState, state } from '../js/state.js';
import { createPlayer } from '../js/core/universe.js';
import { initSessionRng, random, restoreSessionRng, seededRng } from '../js/utils.js';
import {
    registerDailyHook,
    clearDailyHooks,
    clearHourlyHooks,
    advanceTime
} from '../js/core/time.js';
import {
    updatePortsDaily,
    updateThreatsDaily,
    updateFactionsDaily
} from '../js/systems/politics.js';
import { expireMissions } from '../js/systems/missions.js';
import { BALANCE } from '../js/constants.js';
import { assertInRange } from './helpers/assertions.js';
import { seedGeneratedUniverse, TEST_SEEDS } from './helpers/gameState.js';

const FIXED_SEED = TEST_SEEDS.SIMULATION;
const MINUTES_PER_DAY = BALANCE.DAY_MINUTES;

function seedGame(seed = FIXED_SEED) {
    seedGeneratedUniverse({ seed });
    state.worldEvents = [];
    state.nextWorldEventId = 1;
    state.captains = {};
    state.captainEventLog = [];
    state.nextCaptainEventId = 1;
}

function worldSnapshot() {
    return {
        sectorCount: Object.keys(state.universe).length,
        corridors: Object.fromEntries(
            Object.entries(state.universe).map(([id, sector]) => [
                id,
                sector.jumpGates
                    .map(gate => gate.destinationSectorId)
                    .sort((a, b) => a - b)
            ])
        ),
        portKeys: Object.keys(state.ports).sort()
    };
}

function registerSimulationHooks() {
    clearDailyHooks();
    clearHourlyHooks();

    registerDailyHook(() => {
        updatePortsDaily();
        updateThreatsDaily();
        updateFactionsDaily();
        expireMissions();
    });
}

describe('seededRng', () => {
    it('is deterministic for the same seed', () => {
        const rngA = seededRng(FIXED_SEED);
        const rngB = seededRng(FIXED_SEED);
        const first = Array.from({ length: 20 }, () => rngA());
        const second = Array.from({ length: 20 }, () => rngB());
        assert.deepEqual(first, second, 'same seed should produce identical sequence');
    });

    it('stays within [0, 1)', () => {
        const rng = seededRng(FIXED_SEED);
        for (let i = 0; i < 100; i += 1) {
            const value = rng();
            assert.ok(value >= 0 && value < 1, `value ${value} out of range`);
        }
    });

    it('is seed-sensitive', () => {
        const rngSeedA = seededRng(1);
        const rngSeedB = seededRng(2);
        const sequenceA = Array.from({ length: 10 }, () => rngSeedA());
        const sequenceB = Array.from({ length: 10 }, () => rngSeedB());
        assert.notDeepEqual(
            sequenceA,
            sequenceB,
            'different seeds should produce different sequences'
        );
    });
});

describe('session RNG', () => {
    it('replays, restores, and reinitializes deterministically', () => {
        initSessionRng(FIXED_SEED);
        const first = Array.from({ length: 10 }, () => random());
        initSessionRng(FIXED_SEED);
        const second = Array.from({ length: 10 }, () => random());
        assert.deepEqual(first, second, 'session RNG should replay from the same seed');

        initSessionRng(FIXED_SEED);
        const expected = Array.from({ length: 6 }, () => random());
        restoreSessionRng({ seed: FIXED_SEED, calls: 3 }, 0);
        const resumed = Array.from({ length: 3 }, () => random());
        assert.deepEqual(
            resumed,
            expected.slice(3),
            'restored RNG should continue at saved call count'
        );

        initSessionRng(FIXED_SEED);
        random();
        resetState();
        state.player = createPlayer();
        state.player.seed = FIXED_SEED;
        assert.doesNotThrow(() => random());
        assert.equal(state.rng.seed, FIXED_SEED);
        assert.equal(state.rng.calls, 1);
    });
});

describe('generateUniverse — determinism', () => {
    it('keeps seeded world snapshots stable and seed-sensitive', () => {
        seedGame(FIXED_SEED);
        const snapshotA = worldSnapshot();

        seedGame(FIXED_SEED);
        const snapshotB = worldSnapshot();

        assert.deepEqual(snapshotA, snapshotB, 'same seed should produce same world');
        assert.equal(
            snapshotA.sectorCount,
            BALANCE.WORLDGEN.DEFAULT_OCCUPIED_SITES,
            'sector count should match the configured default'
        );

        seedGame(1);
        const portKeysA = worldSnapshot().portKeys;
        seedGame(2);
        const portKeysB = worldSnapshot().portKeys;
        assert.notDeepEqual(portKeysA, portKeysB, 'different seeds should differ');
    });

    it('creates a navigable role-anchored StarDock map', () => {
        seedGame(FIXED_SEED);
        const homeSiteId = state.world.roles.homeSiteId;
        assert.ok(state.universe[homeSiteId], 'home role should point at an occupied site');
        assert.equal(state.universe[homeSiteId].name, 'StarDock');
        assert.ok(state.ports[homeSiteId], 'home site should have a port');
        assert.equal(state.ports[homeSiteId].typeKey, 'stardock');
        assert.equal(state.player.currentSector, homeSiteId);

        Object.values(state.universe).forEach(sector => {
            assert.ok(
                sector.jumpGates.length >= 1,
                `sector ${sector.id} should have at least one jump corridor`
            );
        });
    });
});

describe('simulation — 10-day advance', () => {
    beforeEach(() => {
        registerSimulationHooks();
        seedGame(FIXED_SEED);

        state.player.time.wakeMinute = 0;
        state.player.time.sleepMinute = MINUTES_PER_DAY;
        state.missions = [];
        state.nextMissionId = 1;

        advanceTime(10 * MINUTES_PER_DAY);
    });

    it('advances 10 days', () => {
        assert.equal(state.player.time.day, 11);
    });

    it('keeps tracked port stocks non-negative', () => {
        Object.entries(state.ports).forEach(([sectorId, port]) => {
            ['ore', 'org', 'eq'].forEach(commodity => {
                assert.ok(
                    port.stock[commodity] >= 0,
                    `port in sector ${sectorId} has negative ${commodity} stock`
                );
            });
        });
    });

    it('keeps pirate threat in range', () => {
        Object.values(state.universe).forEach(sector => {
            assertInRange(sector.pirateThreat, 0, 6, `sector ${sector.id} pirateThreat`);
        });
    });

    it('keeps faction relations in range', () => {
        const relations = state.player.factionRelations;
        Object.keys(relations).forEach(source => {
            Object.keys(relations[source]).forEach(target => {
                assertInRange(
                    relations[source][target],
                    -100,
                    100,
                    `factionRelations[${source}][${target}]`
                );
            });
        });
    });
});
