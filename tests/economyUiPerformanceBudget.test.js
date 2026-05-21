import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { performance } from 'node:perf_hooks';

import { resetState, state } from '../js/state.js';
import { renderMarketPanel } from '../js/ui/renderMarket.js';

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

function setupEconomyMarketState() {
    resetState();
    setupDocument();
    state.player = { currentSector: 1, time: { day: 24 }, character: {} };
    state.ports = {
        1: {
            typeKey: 'industrial',
            factionId: 'fu',
            stock: { ore: 30, org: 140, eq: 40 },
            maxStock: { ore: 220, org: 220, eq: 220 },
            basePrices: { ore: 80, org: 150, eq: 300 }
        },
        2: {
            typeKey: 'mining',
            factionId: 'hc',
            stock: { ore: 200, org: 60, eq: 30 },
            maxStock: { ore: 250, org: 250, eq: 250 },
            basePrices: { ore: 80, org: 150, eq: 300 }
        }
    };
    state.economyFocus = { sectorId: 1, commodity: 'ore', source: 'perf-test', updatedDay: 24 };
    state.economy = {
        ...(state.economy || {}),
        pressureBySector: {
            '1': {
                ore: {
                    shortageSeverity: 0.42,
                    surplusSeverity: 0,
                    stockRatio: 0.13,
                    targetStock: 220,
                    currentStock: 30,
                    dailyConsumption: 20,
                    dailyProduction: 5,
                    primaryCause: 'Manufacturing draw exceeds local refining throughput.',
                    confidence: 0.86
                }
            },
            '2': {
                ore: {
                    surplus: 120,
                    routeAccess: 0.85,
                    confidence: 0.75
                }
            }
        },
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
    it('stays within an average render budget for repeated market panel updates', () => {
        setupEconomyMarketState();

        renderMarketPanel();
        const iterations = 200;
        const start = performance.now();
        for (let i = 0; i < iterations; i += 1) {
            renderMarketPanel();
        }
        const elapsedMs = performance.now() - start;
        const averageMs = elapsedMs / iterations;

        assert.ok(
            averageMs <= 2.5,
            `Expected average market render <= 2.5ms, got ${averageMs.toFixed(4)}ms`
        );
    });
});
