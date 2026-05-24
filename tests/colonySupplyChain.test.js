import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { state, resetState } from '../js/state.js';
import { normaliseLoadedGame } from '../js/core/persistence.js';
import {
    getColonyMaxStock,
    getColonyDailyNeeds,
    applyColonyNeedsConsumption,
    applyColonySpoilage,
    tickColonyLeasesDaily,
    produceColonies
} from '../js/systems/colonies.js';
import { getColonyRouteStrategicValue } from '../js/systems/tradeRoutes/implementation.js';
import { makeStock } from '../js/utils.js';

describe('Colony Supply Chain Depth Systems', () => {
    beforeEach(() => {
        resetState();
        state.universe = {
            1: { id: 1, jumpGates: [], pirateThreat: 1, region: 'Core' },
            2: { id: 2, jumpGates: [], pirateThreat: 0, region: 'Core' }
        };
        state.player = {
            credits: 5000,
            currentSector: 1,
            time: { day: 1 },
            character: { stats: { nerve: 50, tradecraft: 50, fieldcraft: 50, command: 50, acumen: 50 } },
            cargo: makeStock()
        };
    });

    afterEach(() => {
        resetState();
    });

    it('migrates and normalizes older saves containing incomplete colony state', () => {
        // Mock a legacy save colony shape
        state.planets[1] = {
            sectorId: 1,
            owner: 'Player',
            colonists: 150,
            satisfaction: 70,
            buildings: { habitat: 2, mine: 1 }
            // stock, maxStock, leases, housingTier, serviceTier, satisfactionBreakdown are missing
        };

        normaliseLoadedGame(state);

        const planet = state.planets[1];
        assert.ok(planet.stock);
        assert.ok(planet.maxStock);
        assert.deepEqual(planet.leases, []);
        assert.equal(planet.housingTier, 1);
        assert.equal(planet.serviceTier, 1);
        assert.equal(planet.facilityCondition, 100);
        assert.deepEqual(planet.satisfactionBreakdown, { housing: 100, services: 100, supply: 100 });
        assert.ok(planet.maxStock.ore >= 50);
        assert.ok(planet.maxStock.org >= 50);
    });

    it('calculates colony daily needs scaling with housing tiers and facilities', () => {
        const planet = {
            sectorId: 1,
            owner: 'Player',
            colonists: 200,
            buildings: {
                habitat: 1,      // Tier 1 (1+0=1)
                mine: 1,
                farm: 1
            }
        };

        // Tier 1 housing needs water_ice and org
        let needs1 = getColonyDailyNeeds(planet);
        assert.ok(needs1.water_ice > 0);
        assert.ok(needs1.org > 0);
        assert.equal(needs1.repair_parts ?? 0, 1); // mine + farm industrial maintenance

        // Upgrade housing to level 3 (habitat 1 + housing 2 = housingTier 3)
        planet.buildings.housing = 2;
        planet.colonists = 300;
        let needs3 = getColonyDailyNeeds(planet);
        assert.ok(needs3.repair_parts > 1); // pop/150 + maintenance
        assert.ok(needs3.medical_supplies > 0);
        assert.ok(needs3.pulse_canister > 0);
        assert.ok(needs3.electronics > 0);
        // T4 and T5 goods should not be demanded yet
        assert.equal(needs3.eq ?? 0, 3); // eq is just facility maintenance (habitat 1 + mine 1 + farm 1 = 3 eq upkeep)
    });

    it('applies needs consumption, logs shortages, and updates satisfaction breakdown', () => {
        state.planets[1] = {
            sectorId: 1,
            owner: 'Player',
            colonists: 100,
            satisfaction: 80,
            buildings: { habitat: 1, housing: 0, civic_services: 0 },
            stock: makeStock({ water_ice: 5, org: 0 }), // org is missing
            maxStock: makeStock()
        };
        state.planets[1].maxStock = getColonyMaxStock(state.planets[1]);

        // Run consumption
        applyColonyNeedsConsumption();

        const planet = state.planets[1];
        assert.equal(planet.stock.water_ice, 4); // consumed 1 unit (needs.water_ice = Math.max(1, Math.floor(100/100)) = 1)
        assert.equal(planet.shortages.org > 0, true); // missing organics
        assert.equal(planet.satisfactionBreakdown.supply < 100, true);
    });

    it('applies perishable spoilage and mitigates it using cold storage / pulse works', () => {
        const planet = {
            sectorId: 1,
            owner: 'Player',
            buildings: { cold_storage: 0, pulse_works: 0 },
            stock: makeStock({ org: 100, water_ice: 100, pulse_canister: 100 })
        };

        // No protection
        applyColonySpoilage(planet, 1);
        const spoiledOrg = 100 - planet.stock.org;
        const spoiledIce = 100 - planet.stock.water_ice;
        const spoiledPulse = 100 - planet.stock.pulse_canister;
        assert.ok(spoiledOrg > 0);
        assert.ok(spoiledIce > 0);
        assert.ok(spoiledPulse > 0);

        // Reset and add cold storage level 2 and pulse works level 2
        planet.stock = makeStock({ org: 100, water_ice: 100, pulse_canister: 100 });
        planet.buildings.cold_storage = 3; // 3 * 0.4 = 1.2 -> 100% reduction
        planet.buildings.pulse_works = 3;  // 3 * 0.4 = 1.2 -> 100% reduction

        applyColonySpoilage(planet, 1);
        assert.equal(planet.stock.org, 100);
        assert.equal(planet.stock.water_ice, 100);
        assert.equal(planet.stock.pulse_canister, 100);
    });

    it('runs colony production recipes constrained by inputs, labor, and storage', () => {
        state.planets[1] = {
            sectorId: 1,
            typeKey: 'terran',
            owner: 'Player',
            colonists: 0,
            satisfaction: 100,
            facilityCondition: 100,
            buildings: {
                habitat: 1,
                refinery: 1 // Produces refined_metals, polymers, coolants, fertilizer
            },
            stock: makeStock({
                ore: 5, heavy_metals: 5, // refinery input
                org: 0, water_ice: 0 // polymers input missing
            }),
            maxStock: makeStock()
        };
        state.planets[1].maxStock = getColonyMaxStock(state.planets[1]);
        state.tradeRoutes = [{ status: 'active', originSector: 1, destinationSector: 2 }]; // routeAccess = 1.0

        produceColonies();

        const planet = state.planets[1];
        // refinery level 1 consumes up to 4 ore + 4 heavy_metals to produce 4 refined_metals (recipe baseCapacity is 4)
        assert.equal(planet.stock.ore, 1);
        assert.equal(planet.stock.heavy_metals, 1);
        assert.equal(planet.stock.refined_metals, 4);
        
        // polymers should be 0 because org/water_ice inputs are missing (unmet inputs constraint)
        assert.equal(planet.stock.polymers, 0);
    });

    it('collects company lease rent and tracks vacant slot capacities', () => {
        const planet = {
            sectorId: 1,
            owner: 'Player',
            satisfaction: 80,
            buildings: { civic_services: 1 }, // max slots: 1 + 1 = 2
            leases: [
                { id: 'lease-1-1', companyId: 'comp-1', companyName: 'HC Transport', rentDaily: 100, condition: 100, status: 'active' }
            ]
        };

        tickColonyLeasesDaily(planet, 1);
        assert.equal(state.player.credits, 5100); // collected 100 credits rent
        assert.ok(planet.leases[0].condition < 100); // decayed
    });

    it('estimates supply route strategic value by avoided shortages', () => {
        state.planets[1] = {
            sectorId: 1,
            owner: 'Player',
            satisfaction: 40,
            shortages: makeStock({ org: 10 }),
            demandProfile: { targetStock: { org: 80 } },
            stock: makeStock({ org: 2 }),
            buildings: { habitat: 1 }
        };

        const route = {
            originSector: 2,
            destinationSector: 1,
            commodity: 'org',
            purpose: 'colony_supply',
            internalTransfer: true
        };

        // Test strategic value calculation
        const val = getColonyRouteStrategicValue(route, 10);
        assert.ok(val > 0);
    });
});
