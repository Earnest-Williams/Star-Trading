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
    getFreshnessLabel,
    getFreshnessSummaryForSector,
    getPlayerDataHoldSummary,
    getPublicSnapshotAge,
    getSectorDataFreshness,
    mergePublicSnapshotsOnArrival,
    normaliseDataCargoState,
    releasePrivatePayload,
    sellPrivatePayload
} from '../js/core/dataCargo.js';
import { buildSaveData, migrateSave, SAVE_STATE_FIELDS } from '../js/core/persistence.js';
import { renderCommunicationsScreen } from '../js/ui/renderComms.js';

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


describe('data cargo communications helpers', () => {
    beforeEach(buildDataCargoWorld);

    it('labels public snapshot freshness by age', () => {
        assert.equal(getFreshnessLabel(0), 'fresh');
        assert.equal(getFreshnessLabel(1), 'fresh');
        assert.equal(getFreshnessLabel(4), 'aging');
        assert.equal(getFreshnessLabel(8), 'stale');
        assert.equal(getFreshnessLabel(9), 'cold');
        assert.equal(getFreshnessLabel(null), 'unknown');
    });

    it('computes public snapshot age without mutating the snapshot', () => {
        const snapshot = { ...buildSectorPublicSnapshot(1), observedDay: 2, deliveredDay: 4 };
        assert.equal(getPublicSnapshotAge(snapshot, 7), 5);
        assert.equal(snapshot.observedDay, 2);
    });

    it('summarizes current, known, and unknown sector freshness', () => {
        state.dataCargo.sectorKnowledge[1] = {
            publicSnapshots: {
                2: { ...buildSectorPublicSnapshot(2), observedDay: 1, deliveredDay: 5 }
            }
        };
        const current = getFreshnessSummaryForSector(1);
        assert.equal(current.liveLocal, true);
        assert.equal(current.label, 'current');

        const known = getFreshnessSummaryForSector(2);
        assert.equal(known.label, 'aging');
        assert.equal(known.lastObservedDay, 1);
        assert.equal(known.deliveredDay, 5);
        assert.equal(known.knownFromSectorId, 1);

        const unknown = getFreshnessSummaryForSector(999);
        assert.equal(unknown.label, 'unknown');
        assert.equal(unknown.known, false);
    });

    it('summarizes the player data hold', () => {
        state.dataCargo.playerHold.publicSnapshots[1] = buildSectorPublicSnapshot(1);
        addPrivatePayloadToPlayerHold({ sourceSectorId: 1, targetSectorId: 2, text: 'Private note.' });
        state.dataCargo.playerHold.securePayloads.push({
            id: 'secure-test',
            tier: 'secure',
            originSectorId: 1,
            destinationSectorId: 2,
            factionId: 'sda',
            acquiredDay: 5,
            expiresDay: 9,
            value: 125,
            risk: 2,
            status: 'accepted',
            text: 'Sealed packet.'
        });
        const summary = getPlayerDataHoldSummary();
        assert.equal(summary.publicSnapshotCount, 1);
        assert.equal(summary.privatePayloadCount, 1);
        assert.equal(summary.securePayloadCount, 1);
    });

    it('renders communications entries and empty state without throwing', () => {
        assert.doesNotThrow(() => renderCommunicationsScreen());
        let html = renderCommunicationsScreen();
        assert.match(html, /Communications Console/);
        assert.match(html, /No private intel/);
        assert.match(html, /No secure courier packets/);

        state.dataCargo.sectorKnowledge[1] = {
            publicSnapshots: {
                2: { ...buildSectorPublicSnapshot(2), observedDay: 3, deliveredDay: 5 }
            }
        };
        addPrivatePayloadToPlayerHold({ sourceSectorId: 1, targetSectorId: 2, value: 40, text: 'Suppressed report.' });
        state.dataCargo.playerHold.securePayloads.push({
            id: 'secure-render',
            tier: 'secure',
            originSectorId: 1,
            destinationSectorId: 1,
            factionId: 'sda',
            acquiredDay: 5,
            expiresDay: 8,
            value: 150,
            risk: 3,
            status: 'accepted',
            text: 'Sealed SDA packet.'
        });
        html = renderCommunicationsScreen();
        assert.match(html, /S2/);
        assert.match(html, /aging/);
        assert.match(html, /Suppressed report/);
        assert.match(html, /sellPrivatePayload/);
        assert.match(html, /Sealed SDA packet/);
        assert.match(html, /completeSecurePayload/);
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
