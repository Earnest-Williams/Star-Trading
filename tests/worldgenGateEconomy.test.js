import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { state } from '../js/state.js';
import { calculateGatePulseCost } from '../js/core/universe.js';
import { areSectorsConnected, getSectorNeighbors } from '../js/core/navigation.js';
import { BALANCE, MARKET_COMMODITIES } from '../js/constants.js';
import { tradeCommodity } from '../js/systems/market.js';
import { assertInRange, assertPositive } from './helpers/assertions.js';
import {
    defaultWorldgenSettings,
    getEconomicSectorIds,
    seedGeneratedUniverse,
    TEST_SEEDS
} from './helpers/gameState.js';

function seedGame() {
    seedGeneratedUniverse({
        seed: TEST_SEEDS.WORLDGEN,
        worldgenSettings: defaultWorldgenSettings(60)
    });
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

        assertInRange(cost.sourceCredits, 7, 7.2, 'sourceCredits');
        assertInRange(cost.anchorCredits, 1, 1.1, 'anchorCredits');
        assertInRange(cost.totalCredits, 8, 8.3, 'totalCredits');
    });

    it('exposes packaged jump inventory as tradable market cargo', () => {
        assert.ok(MARKET_COMMODITIES.includes('pulse_canister'));
        assert.ok(MARKET_COMMODITIES.includes('heavy_pulse_module'));

        const homeSiteId = state.world.roles.homeSiteId;
        state.player.currentSector = homeSiteId;
        const port = state.ports[homeSiteId];
        assertPositive(port.stock.pulse_canister, 'home pulse canister stock');

        const startingCredits = state.player.credits;
        tradeCommodity('pulse_canister', 'buy');

        assertPositive(state.player.cargo.pulse_canister, 'player pulse canister cargo');
        assert.ok(state.player.credits < startingCredits);
    });
});

describe('economic connectivity, companies, people, and polities', () => {
    const connectivityCases = BALANCE.WORLDGEN.SITE_COUNT_PRESETS.map(
        (occupiedSites, index) => ({
            occupiedSites,
            seed: [101, 202, 303][index % 3]
        })
    );

    connectivityCases.forEach(({ occupiedSites, seed }) => {
        it(`connects all economic sectors for ${occupiedSites} sites seed ${seed}`, () => {
            seedGeneratedUniverse({
                seed,
                worldgenSettings: defaultWorldgenSettings(occupiedSites)
            });

            const economicIds = getEconomicSectorIds();
            const anchor = economicIds[0];
            assert.ok(
                economicIds.length > 0,
                `economic sectors should exist for ${occupiedSites} sites seed ${seed}`
            );
            assert.ok(
                economicIds.every(id => areSectorsConnected(anchor, id)),
                `economic sectors should connect for ${occupiedSites} sites seed ${seed}`
            );
        });
    });

    describe('generated economic entities', () => {
        beforeEach(seedGame);

        it('spawns companies and contacts only in economically active sectors', () => {
            const economicIds = new Set(getEconomicSectorIds());

            Object.values(state.companies).forEach(company => {
                assert.ok(
                    economicIds.has(company.sectorId),
                    `company ${company.id} should be in an economic sector`
                );
                assert.ok(
                    company.contactPersonIds.length > 0,
                    `company ${company.id} should have a contact`
                );
            });
            economicIds.forEach(id => {
                assert.ok(
                    (state.companyIdsBySector[id] || []).length > 0,
                    `economic sector ${id} should have a company`
                );
                assert.ok(
                    state.universe[id].localAuthority,
                    `economic sector ${id} should have a local authority`
                );
            });
        });

        it('keeps mission issuer companies aligned with mission origins', async () => {
            const { generateMissionPool } = await import('../js/systems/missions.js');
            generateMissionPool(12);
            state.missions.filter(mission => mission.issuerCompanyId).forEach(mission => {
                const company = state.companies[mission.issuerCompanyId];
                assert.ok(company, `mission issuer ${mission.issuerCompanyId} should exist`);
                assert.equal(company.sectorId, mission.originSector);
                assert.equal(company.factionId, mission.factionId);
            });
        });

        it('assigns contiguous non-independent polities', () => {
            Object.values(state.polities).forEach(polity => {
                if (polity.type === 'independent' || polity.sectorIds.length <= 1) return;
                const allowed = new Set(polity.sectorIds);
                const seen = new Set([polity.sectorIds[0]]);
                const queue = [polity.sectorIds[0]];
                while (queue.length > 0) {
                    const id = queue.shift();
                    getSectorNeighbors(id).forEach(next => {
                        if (!allowed.has(next) || seen.has(next)) return;
                        seen.add(next);
                        queue.push(next);
                    });
                }
                assert.equal(seen.size, allowed.size, `${polity.name} should be contiguous`);
            });
        });
    });
});
