import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { resetState, state } from '../js/state.js';
import { makeDeliveryMission, makeMiningMission } from '../js/systems/missions.js';
import { renderMarketPanel } from '../js/ui/renderMarket.js';

function setupMissionState() {
    resetState();
    state.player = {
        currentSector: 1,
        seed: 12345,
        time: { day: 1, minuteOfDay: 480 }
    };
    state.rng = { seed: 12345, calls: 0 };
    state.nextMissionId = 1;
    state.universe = {
        1: { id: 1, influence: { fu: 50 }, surveyed: true, jumpGates: [] },
        2: { id: 2, influence: { hc: 50 }, surveyed: true, jumpGates: [] },
        3: { id: 3, influence: { fu: 50 }, surveyed: true, jumpGates: [] }
    };
    state.ports = {
        1: { typeKey: 'consumer', factionId: 'fu', stock: {}, basePrices: { ore: 80 } },
        2: { typeKey: 'legacy-bad-key', stock: { ore: 5000, org: 0, eq: 0 }, basePrices: { ore: 80 } },
        3: { stock: { ore: 0, org: 0, eq: 0 }, basePrices: { ore: 80 } }
    };
    state.planets = {};
    state.companies = {};
    state.companyIdsBySector = {};
    state.people = {};
    state.peopleByCompany = {};
}

function setupDocument() {
    globalThis.document = {
        getElementById(id) {
            if (id !== 'actions') return null;
            return {
                set innerHTML(value) {
                    this.html = value;
                },
                html: ''
            };
        }
    };
}

describe('port type normalisation', () => {
    afterEach(() => {
        delete globalThis.document;
        resetState();
    });

    it('normalises invalid port types before delivery mission generation', () => {
        setupMissionState();

        const mission = makeDeliveryMission();

        assert.equal(state.ports[2].typeKey, 'mining');
        assert.equal(state.ports[3].typeKey, 'consumer');
        assert.equal(mission?.type, 'delivery');
    });

    it('normalises invalid port types before mining mission generation', () => {
        setupMissionState();

        const mission = makeMiningMission();

        assert.equal(state.ports[2].typeKey, 'mining');
        assert.equal(state.ports[3].typeKey, 'consumer');
        assert.equal(mission?.type, 'mining');
    });

    it('renders a market panel for a port with an unknown legacy type key', () => {
        resetState();
        setupDocument();
        state.player = { currentSector: 1 };
        state.ports = {
            1: {
                typeKey: 'legacy-bad-key',
                factionId: 'fu',
                stock: { ore: 0, org: 0, eq: 0 },
                maxStock: { ore: 0, org: 0, eq: 0 },
                basePrices: { ore: 80, org: 150, eq: 300 }
            }
        };
        state.missions = [];

        assert.doesNotThrow(() => renderMarketPanel());
        assert.equal(state.ports[1].typeKey, 'consumer');
    });
});
