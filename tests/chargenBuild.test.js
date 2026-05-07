import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CHAR_DEFAULTS } from '../js/config/chargen.js';
import { TRAIT_CATEGORIES, TRAITS } from '../js/config/traits.js';
import {
    buildCharacterFromSpec,
    calcStatGain,
    validateBuild
} from '../js/core/characterBuild.js';
import { createPlayerFromBuild } from '../js/core/universe.js';

const baseBuild = {
    statSpend: { nerve: 0, tradecraft: 0, fieldcraft: 0, command: 0 },
    originTraitId: 'dockside_brokers_apprentice',
    careerTraitIds: [],
    platform: { type: 'ship_owned', employerLaneId: null }
};

describe('chargen math and validation', () => {
    it('uses the nonlinear stat buy curve and caps at 100', () => {
        assert.equal(calcStatGain(10), 30);
        assert.equal(calcStatGain(15), 40);
        assert.equal(calcStatGain(25), 50);
        const built = buildCharacterFromSpec({
            ...baseBuild,
            statSpend: { nerve: 25, tradecraft: 0, fieldcraft: 0, command: 0 }
        });
        assert.equal(built.character.stats.nerve, CHAR_DEFAULTS.STAT_CAP);
    });

    it('rejects invalid caps, budget, and platform lanes with useful errors', () => {
        const overCap = validateBuild({
            ...baseBuild,
            statSpend: { nerve: 26, tradecraft: 0, fieldcraft: 0, command: 0 }
        });
        assert.equal(overCap.valid, false);
        assert.match(overCap.reason, /nerve/);

        const overBudget = validateBuild({
            ...baseBuild,
            statSpend: { nerve: 1, tradecraft: 0, fieldcraft: 0, command: 0 },
            careerTraitIds: ['veteran_miner', 'freight_dispatcher']
        });
        assert.equal(overBudget.valid, false);
        assert.match(overBudget.reason, /budget/);

        const badLane = validateBuild({
            ...baseBuild,
            platform: { type: 'ship_owned', employerLaneId: 'sda_auxiliary' }
        });
        assert.equal(badLane.valid, false);
        assert.match(badLane.reason, /employer lane/);
    });

    it('converts leftover build points to starting cash', () => {
        const player = createPlayerFromBuild(baseBuild);
        assert.equal(player.credits, 15000);
    });

    it('enforces origin and career trait category slots plus exclusivity', () => {
        assert.equal(validateBuild({ ...baseBuild, originTraitId: 'veteran_miner' }).valid, false);
        assert.equal(validateBuild({ ...baseBuild, careerTraitIds: ['dockside_brokers_apprentice'] }).valid, false);
        const exclusive = validateBuild({
            ...baseBuild,
            careerTraitIds: ['quiet_hands', 'union_paperwork']
        });
        assert.equal(exclusive.valid, false);
        assert.match(exclusive.reason, /exclusive/);
    });
});

describe('trait catalog', () => {
    it('defines all agreed origins and careers as chargen-only data', () => {
        const origins = [
            'dockside_brokers_apprentice',
            'raised_in_an_asteroid_mine',
            'black_route_family',
            'frontier_cartographer',
            'quartermasters_child',
            'political_adjutant'
        ];
        const careers = [
            'veteran_miner',
            'freight_dispatcher',
            'quiet_hands',
            'long_range_ears',
            'settlement_organizer',
            'manifest_forger',
            'rival_handler',
            'union_paperwork'
        ];
        origins.forEach(id => {
            assert.equal(TRAITS[id].category, TRAIT_CATEGORIES.ORIGIN);
            assert.equal(TRAITS[id].chargenOnly, true);
        });
        careers.forEach(id => {
            assert.equal(TRAITS[id].category, TRAIT_CATEGORIES.CAREER);
            assert.equal(TRAITS[id].chargenOnly, true);
        });
    });
});

describe('platform start packages', () => {
    it('supports owned, rented, salary, and commission starts', () => {
        const rented = createPlayerFromBuild({ ...baseBuild, platform: { type: 'ship_rented', employerLaneId: null } });
        assert.equal(rented.ship.name, 'Rented Merchant Cutter');
        assert.equal(rented.employment.leaseDaily, 120);

        const salary = createPlayerFromBuild({
            ...baseBuild,
            platform: { type: 'employed_salary', employerLaneId: 'hc_extractor' }
        });
        assert.equal(salary.employment.factionId, 'hc');
        assert.equal(salary.employment.wageDaily, 180);
        assert.ok(salary.employment.access.includes('mining'));

        const commission = createPlayerFromBuild({
            ...baseBuild,
            platform: { type: 'employed_commission', employerLaneId: 'vc_runner' }
        });
        assert.equal(commission.employment.factionId, 'vc');
        assert.equal(commission.employment.commissionShare, 0.12);
    });
});
