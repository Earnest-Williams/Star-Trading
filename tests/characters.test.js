// Tests for the character system: stat-buy math, build validation, save migration, old-save compat.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { CHAR_DEFAULTS, CHAR_STATS } from '../js/config/characters.js';
import {
    createCharacter,
    calcStatGain,
    calcPointsForStatValue,
    validateBuild,
    buildCharacterFromSpec,
    normaliseCharacter,
    CHARACTER_SCHEMA_FIELDS
} from '../js/core/characters.js';
import { migrateSave } from '../js/core/persistence.js';
import { SAVE_VERSION, DEFAULT_FACTION_RELATIONS } from '../js/constants.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function minimalSave(version) {
    return {
        version,
        player: {
            credits: 5000,
            currentSector: 1,
            ship: { name: 'Test Ship', maxHolds: 75, travelMinutesPerCorridor: 45,
                    miningPower: 25, scannerLevel: 1, maxFighters: 2500,
                    maxShields: 400, maxHull: 100 },
            cargo: { ore: 0, org: 0, eq: 0 },
            fighters: 30, shields: 400, hull: 100, reputation: 0,
            time: { day: 1, minuteOfDay: 480, wakeMinute: 480, sleepMinute: 1320 },
            seed: 12345,
            factionRelations: JSON.parse(JSON.stringify(DEFAULT_FACTION_RELATIONS)),
            factions: { reputation: {}, trust: {}, heat: {}, membership: {},
                        leverage: {}, favors: {}, memory: {}, publicRep: {},
                        privateRep: {}, intel: [], asks: [], contacts: {},
                        nextAskId: 1 }
        },
        universe: {},
        ports: {},
        planets: {},
        missions: [],
        captains: {},
        captainEventLog: [],
        nextCaptainEventId: 1,
        worldEvents: [],
        nextWorldEventId: 1,
        tradeRoutes: [],
        nextTradeRouteId: 1,
        nextMissionId: 1,
        ambientTrade: { day: 0, moved: { ore: 0, org: 0, eq: 0 }, flows: 0 },
        dataCargo: { sectorKnowledge: {}, playerHold: { publicSnapshots: {} }, ambientTransfers: [] }
    };
}

// ─── createCharacter ────────────────────────────────────────────────────────

describe('createCharacter', () => {
    it('sets all stats to STAT_BASE', () => {
        const ch = createCharacter();
        for (const stat of CHAR_STATS) {
            assert.equal(ch.stats[stat], CHAR_DEFAULTS.STAT_BASE);
        }
    });

    it('has empty traits, originTraitId null, empty careerTraitIds', () => {
        const ch = createCharacter();
        assert.deepEqual(ch.traits, []);
        assert.equal(ch.originTraitId, null);
        assert.deepEqual(ch.careerTraitIds, []);
    });

    it('defaults platform type to tier 1 tramp package', () => {
        const ch = createCharacter();
        assert.equal(ch.platform.type, 'ship_tier1_tramp');
        assert.equal(ch.platform.employerLaneId, null);
    });

    it('overrides are shallow-merged', () => {
        const ch = createCharacter({ originTraitId: 'veteran_miner' });
        assert.equal(ch.originTraitId, 'veteran_miner');
        // other fields unchanged
        assert.equal(ch.stats.nerve, CHAR_DEFAULTS.STAT_BASE);
    });
});

// ─── calcStatGain ────────────────────────────────────────────────────────────

describe('calcStatGain — tier boundaries', () => {
    it('0 points → 0 gain', () => {
        assert.equal(calcStatGain(0), 0);
    });

    it('1 point → 3 gain (first tier)', () => {
        assert.equal(calcStatGain(1), 3);
    });

    it('10 points → 30 gain (full first tier)', () => {
        assert.equal(calcStatGain(10), 30);
    });

    it('11 points → 32 gain (1 point into second tier)', () => {
        assert.equal(calcStatGain(11), 32);
    });

    it('15 points → 40 gain (full second tier)', () => {
        // tier 1: 10×3=30, tier 2: 5×2=10 → 40
        assert.equal(calcStatGain(15), 40);
    });

    it('16 points → 41 gain (1 point into third tier)', () => {
        assert.equal(calcStatGain(16), 41);
    });

    it('25 points → 50 gain (all tiers exhausted)', () => {
        // 10×3 + 5×2 + 10×1 = 30+10+10 = 50 → stat reaches hard cap
        assert.equal(calcStatGain(25), 50);
    });

    it('stat base + max gain equals STAT_CAP', () => {
        assert.equal(CHAR_DEFAULTS.STAT_BASE + calcStatGain(25), CHAR_DEFAULTS.STAT_CAP);
    });
});

// ─── calcPointsForStatValue ──────────────────────────────────────────────────

describe('calcPointsForStatValue', () => {
    it('returns 0 for base value', () => {
        assert.equal(calcPointsForStatValue(CHAR_DEFAULTS.STAT_BASE), 0);
    });

    it('returns correct points for a tier-1 value', () => {
        // gain of 9 → 3 points
        const pts = calcPointsForStatValue(CHAR_DEFAULTS.STAT_BASE + 9);
        assert.equal(pts, 3);
    });

    it('returns 10 points for the max of tier-1 (gain 30)', () => {
        assert.equal(calcPointsForStatValue(CHAR_DEFAULTS.STAT_BASE + 30), 10);
    });

    it('returns 25 for STAT_CAP (gain 50)', () => {
        assert.equal(calcPointsForStatValue(CHAR_DEFAULTS.STAT_CAP), 25);
    });

    it('returns null for below-base value', () => {
        assert.equal(calcPointsForStatValue(CHAR_DEFAULTS.STAT_BASE - 1), null);
    });

    it('returns null for values above STAT_CAP', () => {
        // gain 51 is unreachable
        assert.equal(calcPointsForStatValue(CHAR_DEFAULTS.STAT_CAP + 1), null);
    });
});

// ─── validateBuild ───────────────────────────────────────────────────────────

describe('validateBuild', () => {
    it('accepts an empty (all-zero) build', () => {
        const result = validateBuild({ statSpend: { nerve: 0, tradecraft: 0, fieldcraft: 0, command: 0 }, careerTraitIds: [] });
        assert.equal(result.valid, true);
    });

    it('accepts spending exactly 100 points on stats', () => {
        // 25+25+25+25 = 100 across four focused stats
        const result = validateBuild({ statSpend: { nerve: 25, tradecraft: 25, fieldcraft: 25, command: 25, acumen: 0 }, careerTraitIds: [] });
        assert.equal(result.valid, true);
    });

    it('accepts spending 50 points on stats + 1 career trait (50 pts)', () => {
        const result = validateBuild({ statSpend: { nerve: 25, tradecraft: 25, fieldcraft: 0, command: 0 }, careerTraitIds: ['veteran_miner'] });
        assert.equal(result.valid, true);
    });

    it('rejects negative stat spend', () => {
        const result = validateBuild({ statSpend: { nerve: -1, tradecraft: 0, fieldcraft: 0, command: 0 }, careerTraitIds: [] });
        assert.equal(result.valid, false);
        assert.ok(result.reason.includes('nerve'));
    });

    it('rejects spend exceeding budget', () => {
        // 26 points on nerve would exceed tier max (25) AND total budget
        const result = validateBuild({ statSpend: { nerve: 26, tradecraft: 0, fieldcraft: 0, command: 0 }, careerTraitIds: [] });
        assert.equal(result.valid, false);
    });

    it('rejects total spend over 150', () => {
        const result = validateBuild({
            statSpend: { nerve: 25, tradecraft: 25, fieldcraft: 25, command: 25, acumen: 25 },
            careerTraitIds: ['veteran_miner', 'quiet_hands']
        });
        assert.equal(result.valid, false);
        assert.ok(result.reason.includes(String(CHAR_DEFAULTS.CHARGEN_POINTS)));  
    });

    it('rejects non-object input', () => {
        const result = validateBuild(null);
        assert.equal(result.valid, false);
    });
});

// ─── buildCharacterFromSpec ──────────────────────────────────────────────────

describe('buildCharacterFromSpec', () => {
    it('produces correct stat values from spend', () => {
        const { character } = buildCharacterFromSpec({
            statSpend: { nerve: 10, tradecraft: 5, fieldcraft: 0, command: 0 }
        });
        assert.equal(character.stats.nerve, CHAR_DEFAULTS.STAT_BASE + calcStatGain(10));
        assert.equal(character.stats.tradecraft, CHAR_DEFAULTS.STAT_BASE + calcStatGain(5) + 4);
        assert.equal(character.stats.fieldcraft, CHAR_DEFAULTS.STAT_BASE);
        assert.equal(character.stats.command, CHAR_DEFAULTS.STAT_BASE + 1);
    });

    it('sets originTraitId and includes it in traits', () => {
        const { character } = buildCharacterFromSpec({
            statSpend: {},
            originTraitId: 'raised_in_an_asteroid_mine',
            careerTraitIds: []
        });
        assert.equal(character.originTraitId, 'raised_in_an_asteroid_mine');
        assert.ok(character.traits.includes('raised_in_an_asteroid_mine'));
    });

    it('includes career traits in traits array', () => {
        const { character } = buildCharacterFromSpec({
            statSpend: {},
            originTraitId: null,
            careerTraitIds: ['veteran_miner', 'quiet_hands']
        });
        assert.ok(character.traits.includes('veteran_miner'));
        assert.ok(character.traits.includes('quiet_hands'));
        assert.deepEqual(character.careerTraitIds, ['veteran_miner', 'quiet_hands']);
    });

    it('calculates leftover points correctly for no-cost defaults', () => {
        const { leftoverPoints } = buildCharacterFromSpec({ statSpend: {}, careerTraitIds: [] });
        assert.equal(leftoverPoints, CHAR_DEFAULTS.CHARGEN_POINTS - 50);
    });

    it('calculates leftover after spending 50 points on stats', () => {
        const { leftoverPoints } = buildCharacterFromSpec({
            statSpend: { nerve: 25, tradecraft: 25, fieldcraft: 0, command: 0 },
            careerTraitIds: []
        });
        assert.equal(leftoverPoints, CHAR_DEFAULTS.CHARGEN_POINTS - 100);
    });

    it('calculates leftover after spending 50 on stats + 1 career trait', () => {
        const { leftoverPoints } = buildCharacterFromSpec({
            statSpend: { nerve: 25, tradecraft: 25, fieldcraft: 0, command: 0 },
            careerTraitIds: ['veteran_miner']
        });
        assert.equal(leftoverPoints, CHAR_DEFAULTS.CHARGEN_POINTS - 150);
    });
});

// ─── shared character schema ────────────────────────────────────────────────

describe('shared character schema', () => {
    it('normalises partial player and captain character blocks into one schema', () => {
        const normalised = normaliseCharacter({
            stats: { nerve: 72 },
            traits: 'legacy-trait',
            platform: { type: 'employed_salary' },
            legacyNote: 'preserved'
        });

        const schemaKeys = Object.keys(normalised)
            .filter(key => CHARACTER_SCHEMA_FIELDS.includes(key));
        assert.deepEqual(new Set(schemaKeys), new Set(CHARACTER_SCHEMA_FIELDS));
        assert.equal(normalised.stats.nerve, 72);
        assert.equal(normalised.stats.tradecraft, CHAR_DEFAULTS.STAT_BASE);
        assert.equal(normalised.stats.fieldcraft, CHAR_DEFAULTS.STAT_BASE);
        assert.equal(normalised.stats.command, CHAR_DEFAULTS.STAT_BASE);
        assert.equal(normalised.stats.acumen, CHAR_DEFAULTS.STAT_BASE);
        assert.deepEqual(normalised.traits, []);
        assert.deepEqual(normalised.careerTraitIds, []);
        assert.equal(normalised.originTraitId, null);
        assert.equal(normalised.platform.type, 'employer_salary_no_ship');
        assert.equal(normalised.platform.employerLaneId, null);
        assert.deepEqual(normalised.contacts, []);
        assert.equal(normalised.legacyNote, 'preserved');
    });
});

// ─── save migration — character block ───────────────────────────────────────

describe('migrateSave — v14 character block injection', () => {
    it('injects default character into player when missing (pre-v14 save)', () => {
        const save = minimalSave(13);
        assert.equal(save.player.character, undefined);
        const result = migrateSave(save);
        assert.ok(result.player.character, 'character block should be present');
        assert.equal(result.player.character.stats.nerve, CHAR_DEFAULTS.STAT_BASE);
        assert.equal(result.player.character.originTraitId, null);
        assert.equal(result.player.character.platform.type, 'ship_tier1_tramp');
    });

    it('fills missing fields on legacy partial player and captain characters', () => {
        const save = minimalSave(13);
        save.player.character = { stats: { nerve: 70 } };
        save.captains = {
            npc_1: { id: 'npc_1', character: { stats: { command: 66 } } }
        };

        const result = migrateSave(save);

        assert.equal(result.player.character.stats.nerve, 70);
        assert.equal(result.player.character.stats.tradecraft, CHAR_DEFAULTS.STAT_BASE);
        assert.deepEqual(result.player.character.traits, []);
        assert.equal(result.player.character.platform.type, 'ship_tier1_tramp');
        assert.equal(result.captains.npc_1.character.stats.command, 66);
        assert.equal(result.captains.npc_1.character.stats.nerve, CHAR_DEFAULTS.STAT_BASE);
        assert.deepEqual(result.captains.npc_1.character.contacts, []);
    });

    it('does not overwrite character already present in player', () => {
        const save = minimalSave(13);
        save.player.character = {
            stats: { nerve: 75, tradecraft: 60, fieldcraft: 55, command: 50, acumen: 50 },
            traits: ['veteran_miner'],
            originTraitId: 'veteran_miner',
            careerTraitIds: [],
            platform: { type: 'ship_owned', employerLaneId: null },
            contacts: []
        };
        const result = migrateSave(save);
        assert.equal(result.player.character.stats.nerve, 75);
        assert.ok(result.player.character.traits.includes('veteran_miner'));
    });

    it('injects default character into captains when missing', () => {
        const save = minimalSave(13);
        save.captains = {
            npc_1: { id: 'npc_1', name: 'Rika', callsign: 'Ironwrist' }
        };
        const result = migrateSave(save);
        assert.ok(result.captains.npc_1.character, 'captain should have a character block');
        assert.equal(result.captains.npc_1.character.stats.nerve, CHAR_DEFAULTS.STAT_BASE);
    });

    it('does not overwrite character already present on a captain', () => {
        const save = minimalSave(13);
        save.captains = {
            npc_1: { id: 'npc_1', character: { stats: { nerve: 80, tradecraft: 50, fieldcraft: 50, command: 50, acumen: 50 }, traits: [], originTraitId: null, careerTraitIds: [], platform: { type: 'ship_owned', employerLaneId: null }, contacts: [] } }
        };
        const result = migrateSave(save);
        assert.equal(result.captains.npc_1.character.stats.nerve, 80);
    });

    it('is a no-op on current-version saves that already have character blocks', () => {
        const save = minimalSave(SAVE_VERSION);
        save.player.character = createCharacter();
        const before = JSON.stringify(save);
        const result = migrateSave(save);
        assert.equal(JSON.stringify(result), before);
    });

    it('sets save version to SAVE_VERSION', () => {
        const save = minimalSave(0);
        const result = migrateSave(save);
        assert.equal(result.version, SAVE_VERSION);
    });
});

// ─── old-save compatibility ───────────────────────────────────────────────────

describe('old-save compatibility — character defaults', () => {
    it('very old save (v0) gets a valid character block with base stats', () => {
        const save = minimalSave(0);
        const result = migrateSave(save);
        const ch = result.player.character;
        assert.ok(ch, 'character block must exist');
        for (const stat of CHAR_STATS) {
            assert.equal(ch.stats[stat], CHAR_DEFAULTS.STAT_BASE,
                `stat ${stat} should be at base for old save`);
        }
        assert.equal(ch.platform.type, 'ship_tier1_tramp', 'old saves infer the replacement tier 1 ship package');
        assert.deepEqual(ch.traits, []);
    });
});
