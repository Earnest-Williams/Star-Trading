import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { state } from '../js/state.js';
import { buildEconomicProfileForSector } from '../js/systems/economy/profiles.js';
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

describe('economy profiles', () => {
    beforeEach(seedGame);

    it('builds profiles for every economically active generated sector', () => {
        const economicSectorIds = getEconomicSectorIds();
        const profileSectorIds = Object.keys(state.economy.profilesBySector).map(Number);

        assert.deepEqual(new Set(profileSectorIds), new Set(economicSectorIds));
        assert.equal(state.economy.lastProfileBuildDay, state.player.time.day);
    });

    it('buildEconomicProfileForSector returns stable, role-aware profiles', () => {
        const sampleSectorId = getEconomicSectorIds()[0];
        const profile = buildEconomicProfileForSector(sampleSectorId);

        assert.ok(profile);
        assert.equal(profile.sectorId, sampleSectorId);
        assert.ok(profile.roleTags.length > 0);
        assert.ok(profile.supplyWeight > 0);
        assert.ok(profile.demandWeight > 0);
        assert.ok(Array.isArray(profile.likelyImports));
        assert.ok(Array.isArray(profile.likelyExports));
    });
});
