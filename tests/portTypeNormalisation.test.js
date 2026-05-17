import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { resetState, state } from '../js/state.js';
import { makeDeliveryMission, makeMiningMission } from '../js/systems/missions.js';
import { renderMarketPanel } from '../js/ui/renderMarket.js';
import { renderSectorContents } from '../js/ui/renderSector.js';
import { renderReputationScreen } from '../js/ui/renderReputation.js';
import { buildLogisticsSnapshot, getLogisticsNode } from '../js/systems/tradeRoutes.js';
import { buildPriorityBriefing } from '../js/core/priorityBriefing.js';
import { hasGuildJoinAccess } from '../js/core/factions.js';
import { seedCompaniesAndPeople } from '../js/systems/companies.js';

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
    const elements = new Map();
    globalThis.document = {
        getElementById(id) {
            if (!elements.has(id)) {
                elements.set(id, {
                    style: {},
                    html: '',
                    set innerHTML(value) {
                        this.html = value;
                    },
                    get innerHTML() {
                        return this.html;
                    }
                });
            }
            return elements.get(id);
        }
    };
}

function setupLegacyPortState() {
    resetState();
    state.player = {
        currentSector: 1,
        seed: 12345,
        time: { day: 1, minuteOfDay: 480 },
        ship: { travelMinutesPerCorridor: 60 },
        cargo: { ore: 10, org: 0, eq: 0 },
        factions: { contacts: {}, intel: [] },
        credits: 1000
    };
    state.rng = { seed: 12345, calls: 0 };
    state.universe = {
        1: {
            id: 1,
            name: 'Legacy Mine',
            siteType: 'port',
            richness: 1,
            region: 'Core',
            influence: { hc: 50 },
            surveyed: true,
            charted: true,
            reachable: true,
            pirateThreat: 0,
            jumpGates: [{ destinationSectorId: 2, status: 'open' }]
        },
        2: {
            id: 2,
            name: 'Consumer Hub',
            siteType: 'port',
            richness: 1,
            region: 'Core',
            influence: { fu: 50 },
            surveyed: true,
            charted: true,
            reachable: true,
            pirateThreat: 0,
            jumpGates: [{ destinationSectorId: 1, status: 'open' }]
        }
    };
    state.ports = {
        1: {
            typeKey: 'legacy-bad-key',
            factionId: 'hc',
            stock: { ore: 500, org: 0, eq: 0 },
            maxStock: { ore: 1000, org: 0, eq: 0 },
            basePrices: { ore: 80, org: 150, eq: 300 }
        },
        2: {
            typeKey: 'consumer',
            factionId: 'fu',
            stock: { ore: 0, org: 20, eq: 20 },
            maxStock: { ore: 1000, org: 1000, eq: 1000 },
            basePrices: { ore: 80, org: 150, eq: 300 }
        }
    };
    state.planets = {};
    state.tradeRoutes = [];
    state.missions = [];
    state.companies = {};
    state.companyIdsBySector = {};
    state.people = {};
    state.peopleBySector = {};
    state.polities = {};
    state.captains = {};
    state.captainEventLog = [];
    state.worldEvents = [];
    state.dataCargo = {
        sectorKnowledge: {},
        playerHold: { publicSnapshots: {}, privatePayloads: [], securePayloads: [] },
        secureContracts: []
    };
}

function emptyLogisticsSnapshot() {
    return { origin: null, availableRouteOptions: [] };
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

    it('renders sector contents for a port with an unknown legacy type key', () => {
        setupLegacyPortState();
        setupDocument();

        assert.doesNotThrow(() => renderSectorContents());
        assert.equal(state.ports[1].typeKey, 'mining');
        assert.match(document.getElementById('sectorContents').innerHTML, /Mining Outpost/);
    });

    it('builds logistics nodes and snapshots for a port with an unknown legacy type key', () => {
        setupLegacyPortState();

        assert.doesNotThrow(() => getLogisticsNode(1));
        assert.doesNotThrow(() => buildLogisticsSnapshot(1));
        assert.equal(getLogisticsNode(1).name, 'Mining Outpost S1');
        assert.equal(state.ports[1].typeKey, 'mining');
    });

    it('renders reputation assets for a port with an unknown legacy type key', () => {
        setupLegacyPortState();
        setupDocument();
        state.reputationTab = 'assets';

        assert.doesNotThrow(() => renderReputationScreen());
        assert.equal(state.ports[1].typeKey, 'mining');
        assert.match(document.getElementById('actions').innerHTML, /Mining Outpost/);
    });

    it('normalises guild access checks for inferable legacy port keys', () => {
        setupLegacyPortState();

        assert.equal(hasGuildJoinAccess('miners'), true);
        assert.equal(state.ports[1].typeKey, 'mining');
    });

    it('normalises company seeding for inferable legacy port keys', () => {
        setupLegacyPortState();

        assert.doesNotThrow(() => seedCompaniesAndPeople(() => 0));
        const companies = state.companyIdsBySector[1].map(id => state.companies[id]);

        assert.ok(companies.some(company => company.type === 'mining_contractor'));
        assert.ok(companies.some(company => company.type === 'import_export'));
        assert.equal(state.ports[1].typeKey, 'mining');
    });

    it('uses inferred legacy port types for priority briefing market suggestions', () => {
        setupLegacyPortState();
        state.ports[1].stock = { ore: 0, org: 0, eq: 500 };
        state.ports[1].maxStock = { ore: 0, org: 0, eq: 1000 };

        const items = buildPriorityBriefing(state, {
            logisticsSnapshotBuilder: emptyLogisticsSnapshot
        });

        assert.equal(items.find(item => item.signal === 'MARKET').id, 'sell-demand-cargo');
        assert.equal(state.ports[1].typeKey, 'industrial');
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
