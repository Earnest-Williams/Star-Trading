import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { state } from '../js/state.js';
import {
    defaultWorldgenSettings,
    seedGeneratedUniverse,
    TEST_SEEDS
} from './helpers/gameState.js';

function seedGame() {
    seedGeneratedUniverse({
        seed: TEST_SEEDS.WORLDGEN,
        worldgenSettings: defaultWorldgenSettings(60)
    });
}

function countCompaniesByType(sectorId, type) {
    const ids = state.companyIdsBySector?.[sectorId] || [];
    return ids
        .map(id => state.companies[id])
        .filter(company => company?.type === type)
        .length;
}

describe('capacity-based company seeding', () => {
    beforeEach(seedGame);

    it('scales mining contractor presence with extraction capacity', () => {
        const profileEntries = Object.entries(state.economy.profilesBySector || {})
            .map(([sectorId, profile]) => ({ sectorId: Number(sectorId), profile }));
        const extractive = profileEntries
            .filter(({ profile }) => Number(profile.extractionCapacity) > 0)
            .sort((a, b) => Number(b.profile.extractionCapacity) - Number(a.profile.extractionCapacity));

        assert.ok(extractive.length > 0, 'world should include extractive sectors');

        const richest = extractive[0];
        const poorest = extractive[extractive.length - 1];
        const richestMining = countCompaniesByType(richest.sectorId, 'mining_contractor');
        const poorestMining = countCompaniesByType(poorest.sectorId, 'mining_contractor');

        assert.ok(richestMining >= poorestMining, 'richer extraction should not seed fewer miners');
    });

    it('preserves front and stardock special company cases', () => {
        const stardockSectorId = Object.keys(state.ports)
            .map(Number)
            .find(sectorId => state.ports[sectorId]?.typeKey === 'stardock');
        assert.ok(stardockSectorId, 'world should include a stardock');

        const stardockCompanies = (state.companyIdsBySector[stardockSectorId] || [])
            .map(id => state.companies[id]);
        assert.ok(stardockCompanies.some(company => company.type === 'ship_refitter'));
        assert.ok(stardockCompanies.some(company => company.type === 'dockyard'));

        const hiddenFrontSectorId = Object.keys(state.universe)
            .map(Number)
            .find(sectorId => state.universe[sectorId]?.front || state.ports[sectorId]?.hiddenFactionId === 'vc');
        assert.ok(hiddenFrontSectorId, 'world should include hidden front or vc hidden faction');

        const hiddenCompanies = (state.companyIdsBySector[hiddenFrontSectorId] || [])
            .map(id => state.companies[id]);
        assert.ok(hiddenCompanies.some(company => company.type === 'black_market_front'));
    });
});
