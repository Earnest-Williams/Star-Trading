// Tests for systems/missions.js — expiry logic and basic mission creation.
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Stub browser globals used by transitively-imported modules.
globalThis.document = { getElementById: () => null };

import { state } from '../js/state.js';
import { createPlayer } from '../js/core/universe.js';
import { expireMissions } from '../js/systems/missions.js';
import { PORT_TYPES, DEFAULT_FACTION_RELATIONS } from '../js/constants.js';

// Minimal state for mission tests (no universe generation needed).
function resetMissionState(dayOverride = 5) {
    state.player = createPlayer();
    state.player.seed = 99999;
    state.player.time.day = dayOverride;
    state.player.factionRelations = JSON.parse(JSON.stringify(DEFAULT_FACTION_RELATIONS));
    // Minimal universe + ports so expireMissions' pool-refill step can generate missions
    state.universe = {
        1: { id: 1, name: 'StarDock', region: 'Core', warps: [2], pirateThreat: 0, surveyed: true,
             influence: { sda: 60, fu: 20, hc: 10, vc: 5 }, front: null },
        2: { id: 2, name: 'Core Sector 2', region: 'Core', warps: [1, 3], pirateThreat: 0, surveyed: false,
             influence: { sda: 50, fu: 25, hc: 15, vc: 5 }, front: null },
        3: { id: 3, name: 'Core Sector 3', region: 'Core', warps: [2], pirateThreat: 0, surveyed: false,
             influence: { sda: 45, fu: 30, hc: 15, vc: 5 }, front: null },
    };
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
