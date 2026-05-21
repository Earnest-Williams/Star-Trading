import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { state } from '../js/state.js';
import { buildEconomicProfileForSector } from '../js/systems/economy/profiles.js';
import { foundColony } from '../js/systems/colonies.js';
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

    it('colony founding rebuilds and evolves the sector economic profile', () => {
        const sectorId = Number(Object.keys(state.planets)[0]);
        state.player.currentSector = sectorId;
        state.player.credits = 10000;
        state.player.cargo = { ore: 0, org: 100, eq: 100 };
        const before = buildEconomicProfileForSector(sectorId);
        state.economy.profilesBySector[String(sectorId)] = before;
        state.planets[sectorId].owner = null;
        state.planets[sectorId].buildings = { habitat: 0, mine: 0, farm: 0, factory: 0, defense: 0 };
        foundColony();
        const after = state.economy.profilesBySector[String(sectorId)];
        assert.ok(after);
        assert.notDeepEqual(after, before);
        assert.equal(state.planets[sectorId].owner, 'Player');
    });
});
