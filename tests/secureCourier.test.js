import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { resetState, state } from '../js/state.js';
import { normaliseDataCargoState } from '../js/core/dataCargo.js';
import { getFactionRep, setFactionRep } from '../js/core/factions.js';
import {
    acceptSecureContract,
    canAcceptSecureContract,
    completeSecurePayload,
    failExpiredSecurePayloads,
    getActiveSecurePayloads,
    grantSecureCourierLicense,
    hasSecureCourierLicense,
    maybeSecureDataInterception
} from '../js/systems/secureCourier.js';

function buildSecureCourierWorld() {
    resetState();
    state.player = {
        currentSector: 1,
        time: { day: 5, minuteOfDay: 480, wakeMinute: 480, sleepMinute: 1320 },
        ship: { travelMinutesPerCorridor: 45 },
        credits: 100,
        shields: 50,
        hull: 100,
        factions: null
    };
    state.universe = {
        1: { id: 1, name: 'One', region: 'Core', pirateThreat: 1, influence: { sda: 60, fu: 20, hc: 10, vc: 5 } },
        2: { id: 2, name: 'Two', region: 'Rim', pirateThreat: 4, influence: { sda: 20, fu: 55, hc: 10, vc: 5 } }
    };
    state.ports = {
        1: { typeKey: 'stardock', factionId: 'sda', publicFactionId: 'sda', hiddenFactionId: null, stock: {}, maxStock: {}, basePrices: {} },
        2: { typeKey: 'industrial', factionId: 'hc', publicFactionId: 'hc', hiddenFactionId: null, stock: {}, maxStock: {}, basePrices: {} }
    };
    state.planets = {};
    state.dataCargo = {
        sectorKnowledge: {},
        playerHold: { publicSnapshots: {}, privatePayloads: [], securePayloads: [] },
        secureContracts: [],
        ambientTransfers: [],
        nextPayloadId: 1,
        license: { secureCourier: false, issuedByFactionId: null, issuedDay: null }
    };
}

function addAvailableSecureContract(overrides = {}) {
    const contract = {
        id: 'secure-test',
        tier: 'secure',
        type: 'diplomatic_packet',
        originSectorId: 1,
        destinationSectorId: 2,
        factionId: 'hc',
        targetFactionId: 'sda',
        createdDay: 5,
        expiresDay: 8,
        value: 120,
        risk: 3,
        status: 'available',
        text: 'Sealed HC courier packet bound for SDA liaison staff in S2.',
        ...overrides
    };
    state.dataCargo.secureContracts.push(contract);
    return contract;
}

describe('secure courier licensing and acceptance', () => {
    beforeEach(buildSecureCourierWorld);

    it('defaults secure courier license to false', () => {
        normaliseDataCargoState();
        assert.equal(hasSecureCourierLicense(), false);
        assert.deepEqual(state.dataCargo.license, {
            secureCourier: false,
            issuedByFactionId: null,
            issuedDay: null
        });
    });

    it('grants secure courier licenses', () => {
        const granted = grantSecureCourierLicense('sda');
        assert.equal(granted, true);
        assert.equal(hasSecureCourierLicense(), true);
        assert.equal(state.dataCargo.license.issuedByFactionId, 'sda');
        assert.equal(state.dataCargo.license.issuedDay, 5);
    });

    it('cannot accept secure contracts from the wrong sector', () => {
        grantSecureCourierLicense('sda');
        addAvailableSecureContract({ originSectorId: 2 });
        assert.equal(acceptSecureContract('secure-test'), false);
        assert.equal(state.dataCargo.secureContracts.length, 1);
        assert.equal(state.dataCargo.playerHold.securePayloads.length, 0);
    });

    it('cannot accept secure contracts without license or trusted standing', () => {
        const contract = addAvailableSecureContract();
        assert.equal(canAcceptSecureContract(contract), false);
        assert.equal(acceptSecureContract(contract.id), false);
    });

    it('allows faction reputation to satisfy the gate without a license', () => {
        const contract = addAvailableSecureContract();
        setFactionRep('hc', 45);
        assert.equal(canAcceptSecureContract(contract), true);
        const payload = acceptSecureContract(contract.id);
        assert.equal(payload.id, contract.id);
        assert.equal(state.dataCargo.secureContracts.length, 0);
        assert.equal(state.dataCargo.playerHold.securePayloads.length, 1);
    });

    it('accepted secure contracts move into secure payload hold', () => {
        grantSecureCourierLicense('sda');
        const contract = addAvailableSecureContract();
        const payload = acceptSecureContract(contract.id);
        assert.equal(payload.status, 'accepted');
        assert.equal(payload.acquiredDay, 5);
        assert.equal(state.dataCargo.secureContracts.length, 0);
        assert.deepEqual(getActiveSecurePayloads().map(item => item.id), [contract.id]);
    });
});

describe('secure courier delivery, expiry, and interception', () => {
    beforeEach(buildSecureCourierWorld);

    it('only delivers secure payloads at their destination sector', () => {
        grantSecureCourierLicense('sda');
        const contract = addAvailableSecureContract();
        acceptSecureContract(contract.id);
        assert.equal(completeSecurePayload(contract.id), false);
        assert.equal(state.player.credits, 100);
        assert.equal(state.dataCargo.playerHold.securePayloads.length, 1);
    });

    it('delivery pays credits and removes the payload', () => {
        grantSecureCourierLicense('sda');
        const contract = addAvailableSecureContract();
        acceptSecureContract(contract.id);
        state.player.currentSector = 2;
        const delivered = completeSecurePayload(contract.id);
        assert.equal(delivered.id, contract.id);
        assert.equal(state.player.credits, 220);
        assert.equal(state.dataCargo.playerHold.securePayloads.length, 0);
        assert.ok(getFactionRep('hc') > 0);
    });

    it('expires accepted secure payloads and removes them', () => {
        grantSecureCourierLicense('sda');
        const contract = addAvailableSecureContract({ expiresDay: 4 });
        acceptSecureContract(contract.id);
        const result = failExpiredSecurePayloads();
        assert.deepEqual(result, { failedCount: 1 });
        assert.equal(state.dataCargo.playerHold.securePayloads.length, 0);
    });

    it('can compromise a secure payload during forced interception', () => {
        grantSecureCourierLicense('sda');
        const contract = addAvailableSecureContract();
        acceptSecureContract(contract.id);
        const rolls = [0, 0.6, 0];
        const result = maybeSecureDataInterception(() => rolls.shift() ?? 0);
        assert.equal(result.intercepted, true);
        assert.equal(result.outcome, 'compromised');
        assert.equal(result.payloadId, contract.id);
        assert.equal(state.dataCargo.playerHold.securePayloads.length, 0);
    });
});

describe('secure courier normalisation', () => {
    beforeEach(buildSecureCourierWorld);

    it('repairs Phase 1 and Phase 2 data cargo shapes', () => {
        state.dataCargo = {
            sectorKnowledge: {},
            playerHold: { publicSnapshots: {}, privatePayloads: [] },
            ambientTransfers: [],
            nextPayloadId: 1
        };
        normaliseDataCargoState();
        assert.deepEqual(state.dataCargo.playerHold.securePayloads, []);
        assert.deepEqual(state.dataCargo.secureContracts, []);
        assert.deepEqual(state.dataCargo.license, {
            secureCourier: false,
            issuedByFactionId: null,
            issuedDay: null
        });
    });
});
