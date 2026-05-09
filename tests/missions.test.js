// Tests for systems/missions.js — expiry logic and basic mission creation.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { state } from '../js/state.js';
import { createPlayer, addJumpGateCorridor } from '../js/core/universe.js';
import { buildSectorPublicSnapshot, carryPublicSnapshotForPlayer } from '../js/core/dataCargo.js';
import { acceptMission, completeMission, expireMissions, makeStaleSignalMission, maybeGenerateStaleSignalMission } from '../js/systems/missions.js';
import { BALANCE, DEFAULT_FACTION_RELATIONS } from '../js/constants.js';

// Minimal state for mission tests (no universe generation needed).
function resetMissionState(dayOverride = 5) {
    state.player = createPlayer();
    state.player.seed = 99999;
    state.player.time.day = dayOverride;
    state.player.factionRelations = JSON.parse(JSON.stringify(DEFAULT_FACTION_RELATIONS));
    // Minimal universe + ports so expireMissions' pool-refill step can generate missions
    state.universe = {
        1: { id: 1, name: 'StarDock', region: 'Core', jumpGates: [], pirateThreat: 0, surveyed: true,
             influence: { sda: 60, fu: 20, hc: 10, vc: 5 }, front: null, charted: true, reachable: true },
        2: { id: 2, name: 'Core Sector 2', region: 'Core', jumpGates: [], pirateThreat: 0, surveyed: false,
             influence: { sda: 50, fu: 25, hc: 15, vc: 5 }, front: null, charted: true, reachable: true },
        3: { id: 3, name: 'Core Sector 3', region: 'Core', jumpGates: [], pirateThreat: 0, surveyed: false,
             influence: { sda: 45, fu: 30, hc: 15, vc: 5 }, front: null, charted: true, reachable: true },
    };
    addJumpGateCorridor(1, 2);
    addJumpGateCorridor(2, 3);
    state.ports = {
        1: { typeKey: 'stardock', factionId: 'sda', publicFactionId: 'sda', hiddenFactionId: null,
             stock: { ore: 3000, org: 2000, eq: 1000 },
             maxStock: { ore: 6000, org: 5000, eq: 4000 },
             basePrices: { ore: 80, org: 150, eq: 300 } },
        2: { typeKey: 'mining', factionId: 'hc', publicFactionId: 'hc', hiddenFactionId: null,
             stock: { ore: 3000, org: 500, eq: 200 },
             maxStock: { ore: 6000, org: 5000, eq: 4000 },
             basePrices: { ore: 80, org: 150, eq: 300 } },
        3: { typeKey: 'industrial', factionId: 'hc', publicFactionId: 'hc', hiddenFactionId: null,
             stock: { ore: 500, org: 200, eq: 1000 },
             maxStock: { ore: 6000, org: 5000, eq: 4000 },
             basePrices: { ore: 80, org: 150, eq: 300 } },
    };
    state.planets = {};
    state.missions = [];
    state.nextMissionId = 1;
    state.captains = {};
    state.captainEventLog = [];
    state.nextCaptainEventId = 1;
    state.worldEvents = [];
    state.nextWorldEventId = 1;
    state.tradeRoutes = [];
    state.nextTradeRouteId = 1;
    state.dataCargo = {
        sectorKnowledge: {},
        playerHold: { publicSnapshots: {}, privatePayloads: [], securePayloads: [] },
        secureContracts: [],
        ambientTransfers: [],
        nextPayloadId: 1,
        license: { secureCourier: false, issuedByFactionId: null, issuedDay: null }
    };
}

function seedStaleSignalKnowledge(age = BALANCE.DATA_CARGO.STALE_SIGNAL_MIN_AGE_DAYS) {
    state.dataCargo.sectorKnowledge[1] = {
        publicSnapshots: {
            3: { ...buildSectorPublicSnapshot(3), observedDay: state.player.time.day - age, deliveredDay: state.player.time.day - age }
        }
    };
}

function makeMission(overrides = {}) {
    return {
        id: state.nextMissionId++,
        title: 'Test mission',
        originSector: 1,
        factionId: 'fu',
        rewardCredits: 1000,
        rewardRep: 2,
        expiresDay: 10,
        status: 'available',
        operationMinutes: 30,
        ...overrides
    };
}

// =====================================================
// MISSION EXPIRY
// =====================================================
describe('expireMissions', () => {
    beforeEach(() => resetMissionState(5));

    it('leaves a future mission in available status', () => {
        state.missions.push(makeMission({ expiresDay: 10, status: 'available' }));
        expireMissions();
        assert.equal(state.missions[0].status, 'available');
    });

    it('expires a mission whose expiresDay is before the current day', () => {
        state.missions.push(makeMission({ expiresDay: 3, status: 'available' }));
        expireMissions();
        assert.equal(state.missions[0].status, 'expired');
    });

    it('expires an accepted mission past its deadline', () => {
        state.missions.push(makeMission({ expiresDay: 4, status: 'accepted' }));
        expireMissions();
        assert.equal(state.missions[0].status, 'expired');
    });

    it('does not change a completed mission status', () => {
        state.missions.push(makeMission({ expiresDay: 1, status: 'completed' }));
        expireMissions();
        assert.equal(state.missions[0].status, 'completed');
    });

    it('expires on the exact expiry day (expiresDay strictly less than current day)', () => {
        // expiresDay === current day means NOT expired yet
        state.missions.push(makeMission({ expiresDay: 5, status: 'available' }));
        expireMissions();
        assert.equal(state.missions[0].status, 'available',
            'mission expiring on the current day should not yet be expired');
    });

    it('expires when expiresDay < current day', () => {
        // advance to day 6; mission expired on day 5
        state.player.time.day = 6;
        state.missions.push(makeMission({ expiresDay: 5, status: 'available' }));
        expireMissions();
        assert.equal(state.missions[0].status, 'expired');
    });

    it('handles a mix of expired and live missions', () => {
        const m1 = makeMission({ id: 101, expiresDay: 2, status: 'available' });
        const m2 = makeMission({ id: 102, expiresDay: 10, status: 'available' });
        const m3 = makeMission({ id: 103, expiresDay: 4, status: 'accepted' });
        state.missions.push(m1, m2, m3);
        expireMissions();
        assert.equal(m1.status, 'expired');
        assert.equal(m2.status, 'available');
        assert.equal(m3.status, 'expired');
    });

    it('expires captain_taken missions past their deadline', () => {
        state.missions.push(makeMission({ expiresDay: 1, status: 'captain_taken' }));
        expireMissions();
        assert.equal(state.missions[0].status, 'expired');
    });
});


describe('stale signal recovery missions', () => {
    beforeEach(() => resetMissionState(12));

    it('generates for a stale reachable sector and avoids duplicate active targets', () => {
        seedStaleSignalKnowledge();

        const mission = makeStaleSignalMission();
        assert.ok(mission);
        assert.equal(mission.type, 'stale_signal');
        assert.equal(mission.targetSectorId, 3);
        assert.equal(mission.returnSectorId, 1);

        state.missions.push(mission);
        assert.equal(makeStaleSignalMission(), null);
    });

    it('scales stale signal rewards by age and route distance', () => {
        seedStaleSignalKnowledge(BALANCE.DATA_CARGO.STALE_SIGNAL_MIN_AGE_DAYS);
        const nearMission = makeStaleSignalMission();
        state.missions = [];
        state.dataCargo.sectorKnowledge[1].publicSnapshots[3].observedDay -= 4;

        const olderMission = makeStaleSignalMission();

        assert.ok(olderMission.rewardCredits > nearMission.rewardCredits);
        assert.ok(nearMission.rewardCredits >= BALANCE.DATA_CARGO.STALE_SIGNAL_REWARD_BASE
            + 2 * BALANCE.DATA_CARGO.STALE_SIGNAL_REWARD_PER_HOP);
    });

    it('does not complete without a fresh enough public snapshot', () => {
        seedStaleSignalKnowledge();
        const mission = makeStaleSignalMission();
        state.missions.push(mission);
        acceptMission(mission.id);

        completeMission(mission.id);

        assert.equal(mission.status, 'accepted');
        assert.equal(state.player.credits, 15500);
    });

    it('completes with a carried fresh public snapshot and pays credits', () => {
        seedStaleSignalKnowledge();
        const mission = makeStaleSignalMission();
        state.missions.push(mission);
        acceptMission(mission.id);
        state.player.currentSector = 3;
        carryPublicSnapshotForPlayer(3);
        state.player.currentSector = 1;

        completeMission(mission.id);

        assert.equal(mission.status, 'completed');
        assert.ok(state.player.credits > 15500);
    });

    it('expires stale signal missions through existing mission expiry flow', () => {
        seedStaleSignalKnowledge();
        const mission = makeStaleSignalMission();
        mission.expiresDay = 10;
        state.missions.push(mission);

        expireMissions();

        assert.equal(mission.status, 'expired');
    });

    it('posts a low-frequency stale signal mission when one is available', () => {
        seedStaleSignalKnowledge();

        const mission = maybeGenerateStaleSignalMission();

        assert.ok(mission);
        assert.equal(state.missions.filter(item => item.type === 'stale_signal').length, 1);
    });
});
