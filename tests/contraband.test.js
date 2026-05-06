import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { resetState, state } from '../js/state.js';
import { addJumpGateCorridor } from '../js/core/universe.js';
import { createFactionState } from '../js/core/factions.js';
import {
    acquireContraband,
    canAcquireContraband,
    canDeliverContraband,
    deliverContraband,
    ensureContrabandHold,
    getContrabandManifest,
    getContrabandSectorProfile,
    getContrabandStatus,
    getHiddenHoldCapacity
} from '../js/systems/contraband.js';

function buildContrabandWorld() {
    resetState();
    state.universe = {
        1: { id: 1, jumpGates: [], pirateThreat: 0, region: 'Core', influence: { sda: 75, fu: 10, hc: 5, vc: 2 } },
        2: { id: 2, jumpGates: [], pirateThreat: 2, region: 'Badlands', influence: { sda: 5, fu: 5, hc: 20, vc: 62 } },
        3: { id: 3, jumpGates: [], pirateThreat: 1, region: 'Badlands', influence: { sda: 12, fu: 8, hc: 20, vc: 58 } }
    };
    addJumpGateCorridor(1, 2);
    addJumpGateCorridor(2, 3);
    state.ports = {
        1: { typeKey: 'stardock', factionId: 'sda', publicFactionId: 'sda', hiddenFactionId: null },
        2: { typeKey: 'industrial', factionId: 'hc', publicFactionId: 'hc', hiddenFactionId: 'vc' },
        3: { typeKey: 'mining', factionId: 'hc', publicFactionId: 'hc', hiddenFactionId: 'vc' }
    };
    state.planets = {};
    state.player = {
        credits: 1000,
        currentSector: 2,
        time: { day: 1, minuteOfDay: 480, wakeMinute: 480, sleepMinute: 1320 },
        ship: { maxHolds: 60, scannerLevel: 1, travelMinutesPerCorridor: 45 },
        cargo: { ore: 0, org: 0, eq: 0 },
        contrabandHold: [],
        factions: createFactionState(),
        factionRelations: {}
    };
    state.tradeRoutes = [];
    state.nextTradeRouteId = 1;
    state.worldEvents = [];
    state.nextWorldEventId = 1;
    state.rng = { seed: 1234, calls: 0 };
}

describe('contraband sector profile', () => {
    beforeEach(buildContrabandWorld);

    it('resolves black-market supply and receiver demand from sector state', () => {
        const sourceProfile = getContrabandSectorProfile(2);
        assert.equal(sourceProfile.hasBlackMarketSource, true);
        assert.equal(sourceProfile.hasCartelReceiver, true);
        assert.ok(sourceProfile.availableTypes.some(item => item.type === 'black_market_eq'));

        const lawfulProfile = getContrabandSectorProfile(1);
        assert.equal(lawfulProfile.hasCartelReceiver, false);
        assert.equal(lawfulProfile.hasBlackMarketSource, false);
    });
});

describe('contraband hold lifecycle', () => {
    beforeEach(buildContrabandWorld);

    it('normalises legacy hold entries without keeping invalid lots', () => {
        state.player.contrabandHold = [
            { type: 'restricted_meds', amount: '2', acquiredSector: 2 },
            { type: 'restricted_meds', amount: 3, acquiredSector: 2 },
            { type: 'unknown', amount: 4, acquiredSector: 2 },
            { type: 'forged_manifests', amount: 0, acquiredSector: 2 }
        ];
        const hold = ensureContrabandHold();
        assert.deepEqual(hold, [{ type: 'restricted_meds', amount: 5, acquiredSector: 2 }]);
        assert.equal(getContrabandManifest().units, 5);
    });

    it('guards acquisition by local supply and hidden-hold capacity', () => {
        assert.equal(getHiddenHoldCapacity(), 10);
        assert.equal(canAcquireContraband('black_market_eq', 4).ok, true);
        assert.equal(acquireContraband('black_market_eq', 4), true);
        assert.equal(getContrabandManifest().units, 4);

        const oversized = canAcquireContraband('black_market_eq', 99);
        assert.equal(oversized.ok, false);
        assert.ok(oversized.reasons.includes('hidden_hold_full'));
    });

    it('blocks delivery outside a trusted receiver and settles at Cartel receivers', () => {
        assert.equal(acquireContraband('black_market_eq', 3), true);
        state.player.currentSector = 1;
        assert.equal(canDeliverContraband().ok, false);
        assert.equal(deliverContraband(), false);

        state.player.currentSector = 3;
        assert.equal(canDeliverContraband().ok, true);
        const reward = deliverContraband('test receiver');
        assert.equal(typeof reward, 'number');
        assert.ok(reward > 660);
        assert.equal(state.player.contrabandHold.length, 0);
        assert.equal(state.player.credits, 1000 + reward);
    });

    it('exposes status with manifest, opportunity, and inspection data', () => {
        acquireContraband('black_market_eq', 2);
        const status = getContrabandStatus(2);
        assert.equal(status.manifest.units, 2);
        assert.equal(status.canDeliver, true);
        assert.ok(status.inspection.detectionChance > 0);
        assert.ok(status.riskLabel > 0);
    });
});
