// Cross-system simulation tests.
// Exercises seeded world generation and basic time-advance invariants
// without touching any browser-specific code.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetState, state } from '../js/state.js';
import { createPlayer } from '../js/core/universe.js';
import { initSessionRng, random, restoreSessionRng, seededRng } from '../js/utils.js';
import { registerDailyHook, clearDailyHooks, clearHourlyHooks, advanceTime } from '../js/core/time.js';
import { updatePortsDaily, updateThreatsDaily, updateFactionsDaily } from '../js/systems/politics.js';
import { expireMissions } from '../js/systems/missions.js';
import { BALANCE } from '../js/constants.js';
import { seedGeneratedUniverse, TEST_SEEDS } from './helpers/gameState.js';

const FIXED_SEED = TEST_SEEDS.SIMULATION;
const MINUTES_PER_DAY = BALANCE.DAY_MINUTES; // 1440

function seedGame(seed = FIXED_SEED) {
    seedGeneratedUniverse({ seed });
    state.worldEvents = [];
    state.nextWorldEventId = 1;
    state.captains = {};
    state.captainEventLog = [];
    state.nextCaptainEventId = 1;
}

// =====================================================
// PRNG DETERMINISM
// =====================================================
describe('seededRng', () => {
    it('produces identical sequences for the same seed', () => {
        const rng1 = seededRng(FIXED_SEED);
        const rng2 = seededRng(FIXED_SEED);
        const seq1 = Array.from({ length: 20 }, () => rng1());
        const seq2 = Array.from({ length: 20 }, () => rng2());
        assert.deepEqual(seq1, seq2, 'same seed should produce identical sequence');
    });

    it('produces values in [0, 1)', () => {
        const rng = seededRng(FIXED_SEED);
        for (let i = 0; i < 100; i++) {
            const v = rng();
            assert.ok(v >= 0 && v < 1, `value ${v} out of range`);
        }
    });

    it('produces different sequences for different seeds', () => {
        const rng1 = seededRng(1);
        const rng2 = seededRng(2);
        const seq1 = Array.from({ length: 10 }, () => rng1());
        const seq2 = Array.from({ length: 10 }, () => rng2());
        assert.notDeepEqual(seq1, seq2, 'different seeds should produce different sequences');
    });
});

describe('session RNG', () => {
    it('produces reproducible runtime sequences from the same seed', () => {
        initSessionRng(FIXED_SEED);
        const first = Array.from({ length: 10 }, () => random());
        initSessionRng(FIXED_SEED);
        const second = Array.from({ length: 10 }, () => random());
        assert.deepEqual(first, second, 'session RNG should replay from the same seed');
    });

    it('restores from persisted call counts', () => {
        initSessionRng(FIXED_SEED);
        const expected = Array.from({ length: 6 }, () => random());
        restoreSessionRng({ seed: FIXED_SEED, calls: 3 }, 0);
        const resumed = Array.from({ length: 3 }, () => random());
        assert.deepEqual(resumed, expected.slice(3), 'restored RNG should continue at saved call count');
    });

    it('reinitializes safely after resetState clears persisted RNG metadata', () => {
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

// =====================================================
// DETERMINISTIC WORLD GENERATION
// =====================================================
describe('generateUniverse — determinism', () => {
    it('produces the same sector count on every run with the same seed', () => {
        seedGame(FIXED_SEED);
        const sectorCount1 = Object.keys(state.universe).length;
        seedGame(FIXED_SEED);
        const sectorCount2 = Object.keys(state.universe).length;
        assert.equal(sectorCount1, sectorCount2, 'sector count should be deterministic');
    });

    it('produces the same corridor topology on every run with the same seed', () => {
        seedGame(FIXED_SEED);
        const corridors1 = JSON.stringify(
            Object.fromEntries(Object.entries(state.universe).map(([k, s]) => [k, s.jumpGates.map(g => g.destinationSectorId).sort()]))
        );
        seedGame(FIXED_SEED);
        const corridors2 = JSON.stringify(
            Object.fromEntries(Object.entries(state.universe).map(([k, s]) => [k, s.jumpGates.map(g => g.destinationSectorId).sort()]))
        );
        assert.equal(corridors1, corridors2, 'corridor graph should be identical for the same seed');
    });

    it('produces the same port layout on every run with the same seed', () => {
        seedGame(FIXED_SEED);
        const portKeys1 = Object.keys(state.ports).sort().join(',');
        seedGame(FIXED_SEED);
        const portKeys2 = Object.keys(state.ports).sort().join(',');
        assert.equal(portKeys1, portKeys2, 'port sectors should be identical for the same seed');
    });

    it('creates a role-anchored StarDock with a stardock port', () => {
        seedGame(FIXED_SEED);
        const homeSiteId = state.world.roles.homeSiteId;
        assert.ok(state.universe[homeSiteId], 'home role should point at an occupied site');
        assert.equal(state.universe[homeSiteId].name, 'StarDock');
        assert.ok(state.ports[homeSiteId], 'home site should have a port');
        assert.equal(state.ports[homeSiteId].typeKey, 'stardock');
        assert.equal(state.player.currentSector, homeSiteId);
    });

    it('produces different layouts for different seeds', () => {
        seedGame(1);
        const portKeys1 = Object.keys(state.ports).sort().join(',');
        seedGame(2);
        const portKeys2 = Object.keys(state.ports).sort().join(',');
        // Different seeds usually produce different maps; this checks at least one run differs
        // (extremely unlikely to be identical for well-separated seeds)
        assert.notEqual(portKeys1, portKeys2, 'different seeds should produce different maps');
    });

    it('universe has the configured occupied navigable site count', () => {
        seedGame(FIXED_SEED);
        assert.equal(Object.keys(state.universe).length, BALANCE.WORLDGEN.DEFAULT_OCCUPIED_SITES);
    });

    it('every sector has at least one jump corridor', () => {
        seedGame(FIXED_SEED);
        Object.values(state.universe).forEach(sector => {
            assert.ok(sector.jumpGates.length >= 1,
                `sector ${sector.id} should have at least one jump corridor`);
        });
    });
});

// =====================================================
// TIME ADVANCEMENT OVER N DAYS
// =====================================================
describe('simulation — 10-day advance', () => {
    beforeEach(() => {
        clearDailyHooks();
        clearHourlyHooks();
        seedGame(FIXED_SEED);

        // Register a minimal daily tick that exercises politics + missions
        registerDailyHook(() => {
            updatePortsDaily();
            updateThreatsDaily();
            updateFactionsDaily();
            expireMissions();
        });

        // Start at 08:00, override sleep/wake to allow full-day advance
        state.player.time.wakeMinute = 0;
        state.player.time.sleepMinute = MINUTES_PER_DAY;
        state.missions = [];
        state.nextMissionId = 1;
    });

    it('day counter reaches 11 after advancing 10 full days', () => {
        advanceTime(10 * MINUTES_PER_DAY);
        assert.equal(state.player.time.day, 11);
    });

    it('port stocks remain non-negative after 10 days', () => {
        advanceTime(10 * MINUTES_PER_DAY);
        Object.entries(state.ports).forEach(([sid, port]) => {
            ['ore', 'org', 'eq'].forEach(c => {
                assert.ok(port.stock[c] >= 0,
                    `port in sector ${sid} has negative ${c} stock: ${port.stock[c]}`);
            });
        });
    });

    it('pirate threat stays within 0–6 in all sectors after 10 days', () => {
        advanceTime(10 * MINUTES_PER_DAY);
        Object.values(state.universe).forEach(sector => {
            assert.ok(
                sector.pirateThreat >= 0 && sector.pirateThreat <= 6,
                `sector ${sector.id} pirateThreat=${sector.pirateThreat} out of bounds`
            );
        });
    });

    it('faction relations stay within −100–100 after 10 days', () => {
        advanceTime(10 * MINUTES_PER_DAY);
        const fr = state.player.factionRelations;
        Object.keys(fr).forEach(a => {
            Object.keys(fr[a]).forEach(b => {
                const val = fr[a][b];
                assert.ok(
                    val >= -100 && val <= 100,
                    `factionRelations[${a}][${b}]=${val} out of bounds`
                );
            });
        });
    });
});
