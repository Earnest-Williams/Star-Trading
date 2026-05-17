import assert from 'node:assert/strict';

import { BALANCE } from '../../js/constants.js';
import { getPortType } from '../../js/core/ports.js';
import { createPlayer, generateUniverse } from '../../js/core/universe.js';
import { resetState, state } from '../../js/state.js';
import { initSessionRng } from '../../js/utils.js';

export const TEST_SEEDS = Object.freeze({
    ACTIONS: 4242,
    SIMULATION: 42,
    WORLDGEN: 424242
});

export function defaultWorldgenSettings(occupiedSites) {
    return {
        galaxyArchetype: occupiedSites >= 540 ? 'four_arm_spiral' : 'barred_spiral',
        occupiedSites,
        routeDensity: 1,
        chartedFraction: BALANCE.WORLDGEN.DEFAULT_CHARTED_FRACTION
    };
}

export function seedGeneratedUniverse({
    seed = TEST_SEEDS.WORLDGEN,
    worldgenSettings = null,
    initializeRng = false,
    selectCurrentSector = false
} = {}) {
    resetState();
    state.player = createPlayer();
    state.player.seed = seed;

    if (initializeRng) {
        initSessionRng(seed);
    }

    if (worldgenSettings) {
        state.worldgenSettings = { ...worldgenSettings };
    }

    generateUniverse();

    if (selectCurrentSector) {
        state.selectedSectorId = state.player.currentSector;
    }

    return state;
}

export function findPortForCommodity(commodity, mode) {
    assert.ok(mode === 'buy' || mode === 'sell', `unsupported trade mode ${mode}`);

    const entry = Object.entries(state.ports).find(([, port]) => {
        const portType = getPortType(port);

        const supportedCommodities = mode === 'buy' ? portType.sells : portType.buys;
        return supportedCommodities.includes(commodity);
    });

    assert.ok(entry, `expected a port that can ${mode} ${commodity}`);
    return { sectorId: Number(entry[0]), port: entry[1] };
}

export function getEconomicSectorIds() {
    return Object.keys(state.universe).map(Number).filter(id => {
        const sector = state.universe[id];
        return Boolean(
            state.ports[id] || state.planets[id] || sector.asteroids || sector.station
        );
    });
}
