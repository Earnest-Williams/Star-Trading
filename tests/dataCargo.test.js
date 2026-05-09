import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { resetState, state } from '../js/state.js';
import {
    addPrivatePayloadToPlayerHold,
    buildSectorPublicSnapshot,
    carryPublicSnapshotForPlayer,
    createPrivatePayload,
    expirePrivatePayloads,
    getActivePrivatePayloads,
    getSectorDataFreshness,
    mergePublicSnapshotsOnArrival,
    normaliseDataCargoState,
    releasePrivatePayload,
    sellPrivatePayload
} from '../js/core/dataCargo.js';
import { buildSaveData, migrateSave, SAVE_STATE_FIELDS } from '../js/core/persistence.js';

function buildDataCargoWorld() {
    resetState();
    state.player = {
        currentSector: 1,
        time: { day: 5, minuteOfDay: 480, wakeMinute: 480, sleepMinute: 1320 },
        ship: { travelMinutesPerCorridor: 45 },
        credits: 100,
        factions: null
    };
    state.universe = {
        1: { id: 1, name: 'One', region: 'Core', pirateThreat: 2, influence: { sda: 60, fu: 20, hc: 10, vc: 5 } },
        2: { id: 2, name: 'Two', region: 'Rim', pirateThreat: 4, influence: { sda: 20, fu: 55, hc: 10, vc: 5 } }
    };
    state.ports = {
        1: {
            typeKey: 'mining',
            factionId: 'hc',
            publicFactionId: 'hc',
            hiddenFactionId: null,
            stock: { ore: 3000, org: 500, eq: 200, pulse_canister: 10, heavy_pulse_module: 1 },
            maxStock: { ore: 6000, org: 5000, eq: 4000, pulse_canister: 120, heavy_pulse_module: 40 },
            basePrices: { ore: 80, org: 150, eq: 300, pulse_canister: 7, heavy_pulse_module: 26 }
        },
        2: {
            typeKey: 'industrial',
            factionId: 'fu',
            publicFactionId: 'fu',
            hiddenFactionId: null,
            stock: { ore: 500, org: 200, eq: 1000, pulse_canister: 5, heavy_pulse_module: 2 },
            maxStock: { ore: 6000, org: 5000, eq: 4000, pulse_canister: 120, heavy_pulse_module: 40 },
            basePrices: { ore: 90, org: 160, eq: 320, pulse_canister: 8, heavy_pulse_module: 28 }
        }
    };
    state.planets = {};
    state.dataCargo = { sectorKnowledge: {}, playerHold: { publicSnapshots: {}, privatePayloads: [], securePayloads: [] }, secureContracts: [], ambientTransfers: [], nextPayloadId: 1, license: { secureCourier: false, issuedByFactionId: null, issuedDay: null } };
}

describe('data cargo public snapshots', () => {
    beforeEach(buildDataCargoWorld);

    it('copies public snapshot data detached from live port objects', () => {
        const snapshot = buildSectorPublicSnapshot(1);
        assert.equal(snapshot.portStock.ore, 3000);
        state.ports[1].stock.ore = 1;
        state.ports[1].basePrices.ore = 9999;
        assert.equal(snapshot.portStock.ore, 3000);
        assert.notEqual(snapshot.portPrices.buy.ore, 0);
        assert.notStrictEqual(snapshot.portStock, state.ports[1].stock);
    });

    it('arrival merges only newer snapshots', () => {
        carryPublicSnapshotForPlayer(1);
        state.player.currentSector = 2;
        const first = mergePublicSnapshotsOnArrival(2);
        assert.ok(first.mergedCount > 0);
        assert.equal(state.dataCargo.sectorKnowledge[2].publicSnapshots[1].observedDay, 5);

        state.player.time.day = 6;
        state.player.currentSector = 1;
        carryPublicSnapshotForPlayer(1);
        state.player.currentSector = 2;
        const second = mergePublicSnapshotsOnArrival(2);
        assert.ok(second.mergedCount > 0);
        assert.equal(state.dataCargo.sectorKnowledge[2].publicSnapshots[1].observedDay, 6);
    });

    it('older carried snapshots do not replace newer destination knowledge', () => {
        state.dataCargo.playerHold.publicSnapshots[1] = {
            sourceSectorId: 1,
            observedDay: 4,
            deliveredDay: 4,
            portStock: { ore: 100 },
            portPrices: { buy: { ore: 10 }, sell: { ore: 11 } },
            pirateThreat: 1,
            factionStatus: { dominantFactionId: 'hc', status: 'Stable' }
        };
        state.dataCargo.sectorKnowledge[2] = {
            publicSnapshots: {
                1: {
                    sourceSectorId: 1,
                    observedDay: 7,
                    deliveredDay: 7,
                    portStock: { ore: 700 },
                    portPrices: { buy: { ore: 70 }, sell: { ore: 71 } },
                    pirateThreat: 3,
                    factionStatus: { dominantFactionId: 'hc', status: 'Stable' }
                }
            }
        };
        state.player.currentSector = 2;
        mergePublicSnapshotsOnArrival(2);
        assert.equal(state.dataCargo.sectorKnowledge[2].publicSnapshots[1].observedDay, 7);
        assert.equal(state.dataCargo.sectorKnowledge[2].publicSnapshots[1].portStock.ore, 700);
    });

    it('reports compact freshness metadata', () => {
        state.dataCargo.sectorKnowledge[2] = {
            publicSnapshots: {
                1: { ...buildSectorPublicSnapshot(1), observedDay: 3, deliveredDay: 5 }
            }
        };
        const freshness = getSectorDataFreshness(2, 8);
        assert.equal(freshness.knownExternalSnapshots, 1);
        assert.equal(freshness.oldestAgeDays, 5);
        assert.equal(freshness.newestAgeDays, 5);
    });
});

describe('data cargo persistence and normalisation', () => {
    beforeEach(buildDataCargoWorld);

    it('save data includes dataCargo', () => {
        assert.ok(SAVE_STATE_FIELDS.includes('dataCargo'));
        state.dataCargo.sectorKnowledge[2] = { publicSnapshots: { 1: buildSectorPublicSnapshot(1) } };
        const save = buildSaveData();
        assert.deepEqual(save.dataCargo, state.dataCargo);
    });

    it('migrateSave initializes missing dataCargo', () => {
        const save = {
            version: 1,
            player: state.player,
            universe: state.universe,
            ports: state.ports,
            planets: state.planets
        };
        const migrated = migrateSave(save);
        assert.deepEqual(migrated.dataCargo, {
            sectorKnowledge: {},
            playerHold: { publicSnapshots: {}, privatePayloads: [], securePayloads: [] },
            secureContracts: [],
            ambientTransfers: [],
            nextPayloadId: 1,
            license: { secureCourier: false, issuedByFactionId: null, issuedDay: null }
        });
    });

    it('normaliseDataCargoState repairs missing fields', () => {
        state.dataCargo = { sectorKnowledge: { 2: {} }, playerHold: {}, ambientTransfers: null };
        normaliseDataCargoState();
        assert.deepEqual(state.dataCargo.playerHold, { publicSnapshots: {}, privatePayloads: [], securePayloads: [] });
        assert.deepEqual(state.dataCargo.sectorKnowledge[2], { publicSnapshots: {} });
        assert.deepEqual(state.dataCargo.ambientTransfers, []);
        assert.equal(state.dataCargo.nextPayloadId, 1);
        assert.deepEqual(state.dataCargo.secureContracts, []);
        assert.deepEqual(state.dataCargo.license, { secureCourier: false, issuedByFactionId: null, issuedDay: null });
    });
});

describe('data cargo private payloads', () => {
    beforeEach(buildDataCargoWorld);

    it('creates private payloads with ids and default fields', () => {
        const payload = createPrivatePayload({ sourceSectorId: 1, targetSectorId: 2, text: 'Quiet manifest.' });
        assert.equal(payload.id, 'private-1');
        assert.equal(payload.tier, 'private');
        assert.equal(payload.type, 'manifest');
        assert.equal(payload.acquiredDay, 5);
        assert.equal(payload.expiresDay, 12);
        assert.equal(state.dataCargo.nextPayloadId, 2);
    });

    it('private payloads do not auto-merge on arrival', () => {
        addPrivatePayloadToPlayerHold({ sourceSectorId: 1, targetSectorId: 2, text: 'Do not publish.' });
        state.player.currentSector = 2;
        mergePublicSnapshotsOnArrival(2);
        assert.equal(state.dataCargo.playerHold.privatePayloads.length, 1);
        assert.equal(state.dataCargo.sectorKnowledge[2].publicSnapshots[1], undefined);
    });

    it('selling private payloads removes them and increases credits', () => {
        const payload = addPrivatePayloadToPlayerHold({ sourceSectorId: 1, targetSectorId: 2, value: 35, text: 'Valuable note.' });
        const sold = sellPrivatePayload(payload.id, 'traders');
        assert.equal(sold, true);
        assert.equal(state.player.credits, 135);
        assert.equal(getActivePrivatePayloads().length, 0);
    });

    it('releasing private payloads removes them and creates local public knowledge', () => {
        const payload = addPrivatePayloadToPlayerHold({ sourceSectorId: 1, targetSectorId: 2, text: 'Release note.' });
        state.player.currentSector = 2;
        const result = releasePrivatePayload(payload.id);
        assert.deepEqual(result, { merged: true });
        assert.equal(getActivePrivatePayloads().length, 0);
        assert.equal(state.dataCargo.sectorKnowledge[2].publicSnapshots[1].sourceSectorId, 1);
    });

    it('expired payloads are removed', () => {
        addPrivatePayloadToPlayerHold({ sourceSectorId: 1, targetSectorId: 2, expiresDay: 4, text: 'Expired note.' });
        const result = expirePrivatePayloads();
        assert.equal(result.expiredCount, 1);
        assert.equal(state.dataCargo.playerHold.privatePayloads.length, 0);
    });
});
