import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { resetState, state } from '../js/state.js';
import {
    calculateGatePulseCost,
    createPlayer,
    generateUniverse
} from '../js/core/universe.js';
import { BALANCE, MARKET_COMMODITIES } from '../js/constants.js';
import { tradeCommodity } from '../js/systems/market.js';

function seedGame() {
    resetState();
    state.player = createPlayer();
    state.player.seed = 424242;
    state.worldgenSettings = {
        galaxyArchetype: 'barred_spiral',
        occupiedSites: 60,
        routeDensity: 1,
        chartedFraction: BALANCE.WORLDGEN.DEFAULT_CHARTED_FRACTION
    };
    generateUniverse();
}

describe('sparse 3D world generation and gate economy', () => {
    beforeEach(seedGame);

    it('stores occupied sites sparsely with role anchors and charted start space', () => {
        const ids = Object.keys(state.sitesById).map(Number);
        assert.equal(ids.length, 60);
        assert.equal(state.sitesById, state.universe);
        assert.ok(state.world.roles.homeSiteId, 'home site role should exist');
        assert.ok(state.siteIdByCoord[state.universe[state.world.roles.homeSiteId].coordKey]);
        assert.ok(ids.every(id => state.universe[id].coord && state.universe[id].coordKey));

        const chartedCount = ids.filter(id => state.universe[id].charted).length;
        assert.equal(chartedCount, Math.round(60 * BALANCE.WORLDGEN.DEFAULT_CHARTED_FRACTION));
    });

    it('keeps stellar systems dominant and way stations within the configured cap', () => {
        const sites = Object.values(state.universe);
        const stellarCount = sites.filter(site => site.siteType === 'stellar_system').length;
        const wayStationCount = sites.filter(site => site.siteType === 'way_station').length;
        const wayStationCap = Math.ceil(sites.length * BALANCE.WORLDGEN.WAY_STATION_MAX_FRACTION);

        assert.ok(stellarCount > sites.length / 2, 'stellar systems should dominate the generated map');
        assert.ok(wayStationCount <= wayStationCap, 'way station count should stay within cap');
    });

    it('uses the first-pass gate pulse formulas for reference courier jumps', () => {
        const cost = calculateGatePulseCost({
            effectiveSpanCost: BALANCE.GATE_PHYSICS.VACUUM_SPAN * 0.70,
            apertureDiameterM: 4,
            holdSeconds: 12
        });

        assert.ok(cost.sourceCredits > 7 && cost.sourceCredits < 7.2);
        assert.ok(cost.anchorCredits > 1 && cost.anchorCredits < 1.1);
        assert.ok(cost.totalCredits > 8 && cost.totalCredits < 8.3);
    });

    it('exposes packaged jump inventory as tradable market cargo', () => {
        assert.ok(MARKET_COMMODITIES.includes('pulse_canister'));
        assert.ok(MARKET_COMMODITIES.includes('heavy_pulse_module'));

        const homeSiteId = state.world.roles.homeSiteId;
        state.player.currentSector = homeSiteId;
        const port = state.ports[homeSiteId];
        assert.ok(port.stock.pulse_canister > 0, 'home port should stock pulse canisters');

        const startingCredits = state.player.credits;
        tradeCommodity('pulse_canister', 'buy');

        assert.ok(state.player.cargo.pulse_canister > 0);
        assert.ok(state.player.credits < startingCredits);
    });
});
