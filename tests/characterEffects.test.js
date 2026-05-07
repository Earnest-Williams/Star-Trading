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
