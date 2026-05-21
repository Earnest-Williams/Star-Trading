import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { resetState, state } from '../js/state.js';
import { renderMarketPanel } from '../js/ui/renderMarket.js';

function setupDocument() {
    const elements = new Map();
    globalThis.document = {
        getElementById(id) {
            if (!elements.has(id)) {
                elements.set(id, {
                    html: '',
                    set innerHTML(value) { this.html = value; },
                    get innerHTML() { return this.html; }
                });
            }
            return elements.get(id);
        }
    };
}

describe('renderMarketPanel faction-standing intelligence quality', () => {
    afterEach(() => {
        delete globalThis.document;
        resetState();
    });

    it('uses local faction standing for pressure detail and intelligence tier', () => {
        resetState();
        setupDocument();
        state.player = {
            currentSector: 1,
            time: { day: 12 },
            character: { acumen: 0, tradecraft: 0 },
            factions: {
                reputation: { fu: 300 },
                publicRep: { fu: 300 },
                privateRep: { fu: 0 },
                trust: {},
                leverage: {},
                heat: {},
                favors: {},
                membership: {},
                memory: {},
                intel: [],
                asks: [],
                contacts: {},
                nextAskId: 1
            }
        };
        state.ports = {
            1: {
                typeKey: 'industrial',
                factionId: 'fu',
                stock: { ore: 20, org: 100, eq: 100 },
                maxStock: { ore: 200, org: 200, eq: 200 },
                basePrices: { ore: 80, org: 150, eq: 300 }
            }
        };
        state.economy = {
            ...(state.economy || {}),
            pressureBySector: {
                '1': {
                    ore: {
                        shortageSeverity: 0.5,
                        targetStock: 200,
                        currentStock: 20,
                        dailyConsumption: 18,
                        dailyProduction: 4,
                        causes: ['Refinery feedstock deficit.'],
                        confidence: 0.9
                    }
                }
            },
            contracts: []
        };
        state.dataCargo = {
            sectorKnowledge: {},
            playerHold: { publicSnapshots: {}, privatePayloads: [], securePayloads: [] },
            secureContracts: [],
            ambientTransfers: [],
            nextPayloadId: 1,
            license: { secureCourier: false, issuedByFactionId: null, issuedDay: null }
        };
        state.missions = [];
        state.ambientTrade = { flows: 0, moved: { ore: 3, org: 2, eq: 1 } };

        renderMarketPanel();
        const html = globalThis.document.getElementById('actions').innerHTML;
        assert.match(html, /Common Ore<\/strong>: Stock 20\/200 \| daily use 18\.0 \| daily output 4\.0/);
        assert.match(html, /Information quality tier: <strong>high/);
    });
});
