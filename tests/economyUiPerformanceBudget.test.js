import assert from 'node:assert/strict';
import { describe, it, before, after } from 'node:test';
import { performance } from 'node:perf_hooks';

import { resetState, state } from '../js/state.js';
import { renderMarketPanel } from '../js/ui/renderMarket.js';

const SECTOR_COUNT = 120;

let _originalDocument;

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

function buildSectorPressure(sectorId) {
    const isMining = sectorId % 3 === 0;
    return {
        ore: isMining
            ? { surplus: 80 + (sectorId % 40), routeAccess: 0.7, confidence: 0.75 }
            : { shortageSeverity: 0.4 + (sectorId % 10) * 0.02, surplusSeverity: 0, stockRatio: 0.15, targetStock: 220, currentStock: 30, dailyConsumption: 18, dailyProduction: 4, primaryCause: 'Manufacturing draw exceeds local refining throughput.', confidence: 0.8 },
        org: { surplus: isMining ? 0 : 20, routeAccess: 0.5, confidence: 0.6 },
        eq: { shortageSeverity: 0.1, surplusSeverity: 0, confidence: 0.5 }
    };
}

function setupEconomyMarketState() {
    resetState();
    setupDocument();
    state.player = { currentSector: 1, time: { day: 24 }, character: {} };

    state.ports = {};
    const pressureBySector = {};
    for (let i = 1; i <= SECTOR_COUNT; i++) {
        state.ports[i] = {
            typeKey: i % 3 === 0 ? 'mining' : 'industrial',
            factionId: i % 2 === 0 ? 'fu' : 'hc',
            stock: { ore: 30 + i, org: 140, eq: 40 },
            maxStock: { ore: 220, org: 220, eq: 220 },
            basePrices: { ore: 80, org: 150, eq: 300 }
        };
        pressureBySector[String(i)] = buildSectorPressure(i);
    }

    state.economyFocus = { sectorId: 1, commodity: 'ore', source: 'perf-test', updatedDay: 24 };
    state.economy = {
        ...(state.economy || {}),
        pressureBySector,
        contracts: [{
            id: 'econ-perf-1',
            destinationSector: 1,
            status: 'available',
            reason: 'Shortage relief requisition',
            commodity: 'ore',
            amount: 60,
            reward: 1800,
            unitReward: 30,
            expiresDay: 27,
            targetStockGap: 90,
            unmetDemand: 15,
            shortageSeverity: 0.42,
            sourceCandidates: [2]
        }]
    };
    state.missions = [];
    state.dataCargo = {
        sectorKnowledge: { 2: { lastObservedDay: 23 } },
        playerHold: { publicSnapshots: {}, privatePayloads: [], securePayloads: [] },
        secureContracts: [],
        ambientTransfers: [],
        nextPayloadId: 1,
        license: { secureCourier: false, issuedByFactionId: null, issuedDay: null }
    };
    state.ambientTrade = {
        flows: 1,
        moved: { ore: 5, org: 2, eq: 1 },
        residualDemand: { ore: 7, org: 0, eq: 0 },
        blockedUnits: { ore: 2, org: 0, eq: 0 },
        blockedByReason: {
            disconnected: { ore: 1, org: 0, eq: 0 },
            unprofitable: { ore: 1, org: 0, eq: 0 },
            highRisk: { ore: 0, org: 0, eq: 0 }
        }
    };
}

describe('economy market explainability render performance budget', () => {
    before(() => {
        _originalDocument = globalThis.document;
    });

    after(() => {
        globalThis.document = _originalDocument;
    });

    it('stays within an average render budget for repeated market panel updates', () => {
        setupEconomyMarketState();

        renderMarketPanel();
        const iterations = 1000;
        const start = performance.now();
        for (let i = 0; i < iterations; i += 1) {
            renderMarketPanel();
        }
        const elapsedMs = performance.now() - start;
        const averageMs = elapsedMs / iterations;

        assert.ok(
            averageMs <= 5.0,
            `Expected average market render <= 5.0ms, got ${averageMs.toFixed(4)}ms`
        );
    });
});
