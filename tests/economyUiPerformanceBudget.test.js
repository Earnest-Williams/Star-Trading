import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import { resetState, state } from '../js/state.js';
import { MARKET_COMMODITIES } from '../js/constants.js';
import { renderMarketPanel } from '../js/ui/renderMarket.js';

const SECTOR_COUNT = 120;
const ITERATIONS = 1000;
const WARMUP_ITERATIONS = 20;
const AVERAGE_RENDER_BUDGET_MS = 5.0;

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

function makeCommodityMap(factory) {
    return Object.fromEntries(MARKET_COMMODITIES.map((commodity, index) => [
        commodity,
        factory(commodity, index)
    ]));
}

function setupMarketPerformanceState() {
    resetState();
    setupDocument();
    state.player = {
        currentSector: 1,
        time: { day: 30, minuteOfDay: 480 },
        character: { acumen: 100, tradecraft: 100 },
        cargo: {}
    };
    state.universe = {};
    state.ports = {};
    state.planets = {};
    state.missions = [];
    state.captains = {};
    state.ambientTrade = {
        flows: 14,
        moved: makeCommodityMap((commodity) => ({ ore: 8, org: 4, eq: 2 }[commodity] || 0)),
        residualDemand: makeCommodityMap(() => 0),
        blockedUnits: makeCommodityMap(() => 0),
        blockedByReason: {
            disconnected: makeCommodityMap(() => 0),
            unprofitable: makeCommodityMap(() => 0),
            highRisk: makeCommodityMap(() => 0)
        }
    };
    state.dataCargo = {
        sectorKnowledge: {},
        playerHold: { publicSnapshots: {}, privatePayloads: [], securePayloads: [] },
        secureContracts: [],
        ambientTransfers: [],
        nextPayloadId: 1,
        license: { secureCourier: false, issuedByFactionId: null, issuedDay: null }
    };
    state.economy = {
        ...(state.economy || {}),
        profilesBySector: {},
        pressureBySector: {},
        recentVolumeBySector: {},
        contracts: [],
        nextContractId: 1
    };

    for (let sectorId = 1; sectorId <= SECTOR_COUNT; sectorId += 1) {
        const isCurrentSector = sectorId === 1;
        state.universe[sectorId] = {
            id: sectorId,
            name: `Budget Sector ${sectorId}`,
            pirateThreat: sectorId % 4,
            surveyed: true,
            charted: true,
            reachable: true,
            jumpGates: []
        };
        state.ports[sectorId] = {
            sectorId,
            typeKey: sectorId % 5 === 0 ? 'mining' : 'industrial',
            factionId: 'fu',
            stock: makeCommodityMap((commodity, index) => isCurrentSector ? 35 + index * 5 : 260 + sectorId + index * 3),
            maxStock: makeCommodityMap((commodity, index) => 300 + index * 20),
            basePrices: makeCommodityMap((commodity, index) => 80 + index * 25)
        };
        state.economy.profilesBySector[String(sectorId)] = {
            populationDemand: 100,
            extractionCapacity: sectorId % 7,
            targetStock: makeCommodityMap((commodity, index) => 220 + index * 10),
            routeAccess: 0.85
        };
        state.economy.pressureBySector[String(sectorId)] = makeCommodityMap((commodity, index) => {
            const targetStock = 220 + index * 10;
            const currentStock = isCurrentSector ? 35 + index * 5 : 260 + sectorId + index * 3;
            const surplus = Math.max(0, currentStock - targetStock);
            return {
                targetStock,
                currentStock,
                dailyConsumption: isCurrentSector ? 18 + index : 8 + index,
                dailyDemand: isCurrentSector ? 18 + index : 8 + index,
                dailyProduction: isCurrentSector ? 4 + index : 14 + index,
                unmetDemand: isCurrentSector ? 12 + index : 0,
                surplus,
                shortageSeverity: isCurrentSector ? 0.45 : 0,
                surplusSeverity: isCurrentSector ? 0 : Math.min(1, surplus / Math.max(1, targetStock)),
                confidence: 0.9,
                pricePressure: isCurrentSector ? 1.2 : 0.9,
                stockRatio: currentStock / Math.max(1, targetStock),
                routeAccess: 0.85,
                lastUpdatedDay: 30,
                primaryCause: isCurrentSector
                    ? `${commodity} stock is below target and local demand is persistent.`
                    : `${commodity} stock is above local target; export pressure is likely.`
            };
        });
    }
}

describe('economy UI performance budget', () => {
    afterEach(() => {
        delete globalThis.document;
        resetState();
    });

    it('renders market explainability within the Phase 9 budget envelope', () => {
        setupMarketPerformanceState();
        for (let index = 0; index < WARMUP_ITERATIONS; index += 1) renderMarketPanel();

        const startedAt = performance.now();
        for (let index = 0; index < ITERATIONS; index += 1) renderMarketPanel();
        const averageMs = (performance.now() - startedAt) / ITERATIONS;

        assert.ok(Number.isFinite(averageMs));
        assert.ok(
            averageMs <= AVERAGE_RENDER_BUDGET_MS,
            `market explainability render averaged ${averageMs.toFixed(3)}ms; budget is ${AVERAGE_RENDER_BUDGET_MS.toFixed(1)}ms`
        );
        const html = globalThis.document.getElementById('actions').innerHTML;
        assert.match(html, /Severity: shortage/);
        assert.match(html, /Track context/);
    });
});
