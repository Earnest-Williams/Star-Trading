// Smoke tests for core/persistence.js — migrateSave and save normalisation.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Stub browser globals used by transitively-imported modules.
globalThis.document = { getElementById: () => null };
globalThis.requestAnimationFrame = () => {};

import { migrateSave } from '../js/core/persistence.js';
import { SAVE_VERSION } from '../js/constants.js';

// Build the minimal valid save data that every version should contain.
function minimalSave(version) {
    return {
        version,
        player: {
            credits: 5000,
            currentSector: 1,
            ship: { name: 'Test Ship', maxHolds: 75, travelMinutesPerWarp: 45,
                    miningPower: 25, scannerLevel: 1, maxFighters: 2500,
                    maxShields: 400, maxHull: 100 },
            cargo: { ore: 0, org: 0, eq: 0 },
            fighters: 30, shields: 400, hull: 100, reputation: 0,
            time: { day: 1, minuteOfDay: 480, wakeMinute: 480, sleepMinute: 1320 },
            factions: { reputation: {}, trust: {}, heat: {}, membership: {},
                        leverage: {}, favors: {}, memory: {}, publicRep: {},
                        privateRep: {}, intel: [], asks: [], contacts: {},
                        nextAskId: 1 }
        },
        universe: {},
        ports: {},
        planets: {},
        missions: [],
        captains: {},
        captainEventLog: [],
        nextCaptainEventId: 1,
        worldEvents: [],
        nextWorldEventId: 1,
        tradeRoutes: [],
        nextTradeRouteId: 1,
        nextMissionId: 1,
        factionRelations: {}
    };
}

describe('migrateSave — version stamping', () => {
    it('sets version to SAVE_VERSION regardless of input version', () => {
        const result = migrateSave(minimalSave(0));
        assert.equal(result.version, SAVE_VERSION);
    });

    it('is a no-op on a current-version save (aside from version stamp)', () => {
        const save = minimalSave(SAVE_VERSION);
        const before = JSON.stringify(save);
        const result = migrateSave(save);
        // version stays the same; everything else should be unchanged
        assert.equal(result.version, SAVE_VERSION);
        const after = JSON.stringify(result);
        assert.equal(before, after);
    });
});

describe('migrateSave — pre-v6 (faction rebuild)', () => {
    it('removes stale factions so normaliseLoadedGame can rebuild them', () => {
        const save = minimalSave(5);
        save.player.factions = { reputation: { sda: 99 } }; // stale old shape
        const result = migrateSave(save);
        assert.equal(result.player.factions, undefined,
            'factions should be deleted so the normalise step can rebuild it');
    });
});

describe('migrateSave — pre-v7 (event log seeding)', () => {
    it('seeds captainEventLog and worldEvents arrays when missing', () => {
        const save = minimalSave(6);
        delete save.captainEventLog;
        delete save.worldEvents;
        const result = migrateSave(save);
        assert.ok(Array.isArray(result.captainEventLog), 'captainEventLog should be an array');
        assert.ok(Array.isArray(result.worldEvents), 'worldEvents should be an array');
    });

    it('does not overwrite existing captainEventLog', () => {
        const save = minimalSave(6);
        save.captainEventLog = [{ id: 1, text: 'test' }];
        const result = migrateSave(save);
        assert.equal(result.captainEventLog.length, 1);
    });
});

describe('migrateSave — pre-v8 (trade route seeding)', () => {
    it('seeds tradeRoutes and nextTradeRouteId when missing', () => {
        const save = minimalSave(7);
        delete save.tradeRoutes;
        delete save.nextTradeRouteId;
        const result = migrateSave(save);
        assert.ok(Array.isArray(result.tradeRoutes), 'tradeRoutes should be an array');
        assert.equal(result.nextTradeRouteId, 1);
    });

    it('does not overwrite an existing non-empty tradeRoutes array', () => {
        const save = minimalSave(7);
        save.tradeRoutes = [{ id: 1, status: 'active' }];
        save.nextTradeRouteId = 2;
        const result = migrateSave(save);
        assert.equal(result.tradeRoutes.length, 1);
        assert.equal(result.nextTradeRouteId, 2);
    });
});
