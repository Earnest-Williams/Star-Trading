import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    getCaptainMissionScore,
    getInspectionChanceMod,
    getMiningYieldMultiplier,
    getRouteReliabilityAdjustment,
    getRouteRiskAdjustment
} from '../js/core/characterChecks.js';

const baseline = {
    stats: { nerve: 50, tradecraft: 50, fieldcraft: 50, command: 50 },
    traits: []
};

const specialist = {
    stats: { nerve: 70, tradecraft: 80, fieldcraft: 85, command: 75 },
    traits: ['raised_in_an_asteroid_mine', 'veteran_miner', 'freight_dispatcher', 'rival_handler']
};

describe('character effects', () => {
    it('improves mining yield without replacing ship capability', () => {
        assert.ok(getMiningYieldMultiplier(specialist) > getMiningYieldMultiplier(baseline));
    });

    it('reduces inspection risk for tradecraft and smuggling traits', () => {
        const smuggler = { ...specialist, traits: ['black_route_family', 'quiet_hands'] };
        assert.ok(getInspectionChanceMod(smuggler) < getInspectionChanceMod(baseline));
    });

    it('changes captain mission scoring and route reliability', () => {
        assert.ok(getCaptainMissionScore(specialist, { type: 'contest' }) > getCaptainMissionScore(baseline, { type: 'contest' }));
        assert.ok(getRouteReliabilityAdjustment(specialist) > getRouteReliabilityAdjustment(baseline));
    });

    it('changes route risk evaluation for fieldcraft and route traits', () => {
        assert.ok(getRouteRiskAdjustment(specialist) < getRouteRiskAdjustment(baseline));
    });
});

describe('expanded character effects', () => {
    it('adjusts mission outcome bands and faction ask quality', async () => {
        const checks = await import('../js/core/characterChecks.js');
        assert.equal(checks.getMissionOutcomeBand(baseline, { type: 'delivery' }).band, 'standard');
        assert.notEqual(checks.getMissionOutcomeBand(specialist, { type: 'contest' }).band, 'rough');
        assert.ok(checks.getFactionAskCompletionQuality(specialist, { type: 'ore_quota' }).score > checks.getFactionAskCompletionQuality(baseline, { type: 'ore_quota' }).score);
    });

    it('adjusts captain, employment, colony, and political actions', async () => {
        const checks = await import('../js/core/characterChecks.js');
        assert.ok(checks.getCaptainRelationshipActionAdjustment(specialist) > checks.getCaptainRelationshipActionAdjustment(baseline));
        assert.ok(checks.getEmploymentTerms(specialist, { wageDaily: 100, commissionShare: 0.1, leaseDaily: 120 }).leaseDaily < 120);
        assert.ok(checks.getColonyActionAdjustment(specialist) > checks.getColonyActionAdjustment(baseline));
        assert.ok(checks.getPoliticalActionAdjustment(specialist) > checks.getPoliticalActionAdjustment(baseline));
    });
});
