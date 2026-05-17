import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
    PRIORITY_SEVERITY,
    buildPriorityBriefing
} from '../js/core/priorityBriefing.js';
import { buildLoadedState } from '../js/core/persistence.js';
import { renderPriorityBriefingItems } from '../js/ui/onboarding.js';
import { resetState } from '../js/state.js';

function emptyLogisticsSnapshot() {
    return { origin: null, availableRouteOptions: [] };
}

function makeBaseState() {
    return {
        player: {
            currentSector: 1,
            cargo: { ore: 0, org: 0, eq: 0, pulse_canister: 0, heavy_pulse_module: 0 }
        },
        selectedSectorId: 1,
        universe: {
            1: { id: 1, jumpGates: [{ destinationSectorId: 2, status: 'open' }] },
            2: { id: 2, jumpGates: [] }
        },
        ports: {},
        missions: [],
        tradeRoutes: [{ id: 'existing', status: 'active' }],
        currentScreen: 'sector',
        priorityBriefing: { dismissed: {} },
        dataCargo: {
            playerHold: { privatePayloads: [] },
            secureContracts: []
        },
        dialogueMessages: [],
        dialogueOffers: []
    };
}

describe('priority briefing rules', () => {
    afterEach(() => {
        resetState();
    });

    it('ranks local pirate pressure ahead of market surplus', () => {
        const briefingState = makeBaseState();
        briefingState.universe[1].piratePressure = 65;
        briefingState.ports[1] = {
            typeKey: 'mining',
            stock: { ore: 25 },
            maxStock: { ore: 40 }
        };

        const items = buildPriorityBriefing(briefingState, {
            logisticsSnapshotBuilder: emptyLogisticsSnapshot
        });

        assert.equal(items[0].id, 'pirate-pressure-local');
        assert.equal(items[0].severity, PRIORITY_SEVERITY.URGENT);
        assert.equal(items.find(item => item.id === 'check-local-surplus').signal, 'MARKET');
    });

    it('ranks held cargo sale ahead of generic local surplus', () => {
        const briefingState = makeBaseState();
        briefingState.player.cargo.ore = 10;
        briefingState.ports[1] = {
            typeKey: 'industrial',
            stock: { eq: 20 },
            maxStock: { eq: 40 }
        };

        const items = buildPriorityBriefing(briefingState, {
            logisticsSnapshotBuilder: emptyLogisticsSnapshot
        });

        assert.equal(items.find(item => item.signal === 'MARKET').id, 'sell-demand-cargo');
        assert.equal(items.find(item => item.signal === 'MARKET').rank, 15);
    });

    it('marks comms caution when operational traffic exists', () => {
        const briefingState = makeBaseState();
        briefingState.dialogueMessages = [{ id: 1 }];
        briefingState.dialogueOffers = [{ id: 2 }];

        const items = buildPriorityBriefing(briefingState, {
            logisticsSnapshotBuilder: emptyLogisticsSnapshot
        });
        const comms = items.find(item => item.signal === 'COMMS');

        assert.equal(comms.id, 'unreviewed-comms');
        assert.equal(comms.severity, PRIORITY_SEVERITY.CAUTION);
        assert.equal(comms.rank, 12);
    });

    it('hides logistics while an active route exists', () => {
        const briefingState = makeBaseState();
        const logisticsSnapshotBuilder = () => ({
            origin: { sectorId: 1 },
            availableRouteOptions: [{
                destination: { name: 'Industrial Port S2' },
                commodities: [{ commodity: 'ore' }],
                hopCount: 1,
                setupCost: 1200
            }]
        });

        const items = buildPriorityBriefing(briefingState, { logisticsSnapshotBuilder });

        assert.equal(items.some(item => item.signal === 'LOGISTICS'), false);
    });

    it('omits dismissed items and backfills lower ranked signals', () => {
        const briefingState = makeBaseState();
        briefingState.priorityBriefing.dismissed['scout-direct-corridor'] = true;

        const items = buildPriorityBriefing(briefingState, {
            logisticsSnapshotBuilder: emptyLogisticsSnapshot
        });

        assert.equal(items.some(item => item.id === 'scout-direct-corridor'), false);
        assert.equal(items.some(item => item.id === 'open-comms-console'), true);
    });

    it('normalizes a legacy save without priority briefing state', () => {
        const loadedState = buildLoadedState({
            player: { currentSector: 1 },
            universe: { 1: { id: 1, jumpGates: [] } },
            ports: {},
            planets: {}
        });

        assert.deepEqual(loadedState.priorityBriefing, { dismissed: {} });
    });

    it('escapes rendered signal, title, and assessment text', () => {
        const html = renderPriorityBriefingItems([{
            id: 'unsafe',
            signal: '<SIGNAL>',
            title: '<script>alert(1)</script>',
            assessment: 'Assess <img src=x onerror=alert(1)>',
            actionLabel: 'Open',
            action: 'showScreen',
            args: ['sector'],
            why: 'Safe why',
            severity: PRIORITY_SEVERITY.INFO,
            rank: 1
        }]);

        assert.match(html, /&lt;SIGNAL&gt;/);
        assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
        assert.match(html, /Assess &lt;img src=x onerror=alert\(1\)&gt;/);
        assert.doesNotMatch(html, /<script>/);
        assert.doesNotMatch(html, /<img src=x/);
    });
});
