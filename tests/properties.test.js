import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { ARCHETYPE_PRESETS, CHAR_DEFAULTS, CHAR_STATS, PLATFORM_PACKAGES } from '../js/config/chargen.js';
import { buildCharacterFromSpec, validateBuild } from '../js/core/characterBuild.js';
import { createPlayerFromBuild } from '../js/core/universe.js';
import { normaliseCharacter } from '../js/core/characters.js';
import { state, resetState } from '../js/state.js';
import {
    createStartingProperties,
    applyPlayerPropertyAction,
    getAvailablePropertyActions,
    getPropertyRecommendation,
    resolvePropertyAction,
    summarisePropertyEconomics,
    tickPropertyDaily
} from '../js/systems/properties.js';

function characterWithAcumen(acumen, skillNodeIds = []) {
    return normaliseCharacter({
        stats: { nerve: 50, tradecraft: 50, fieldcraft: 50, command: 50, acumen },
        traits: [],
        skillNodeIds
    });
}

function baselineCharacter(overrides = {}) {
    return normaliseCharacter({
        stats: { nerve: 50, tradecraft: 50, fieldcraft: 50, command: 50, acumen: 50, ...(overrides.stats || {}) },
        traits: overrides.traits || [],
        skillNodeIds: overrides.skillNodeIds || []
    });
}

describe('acumen chargen and save normalization', () => {
    it('includes acumen in the canonical stat list and validation', () => {
        assert.ok(CHAR_STATS.includes('acumen'));
        const result = validateBuild({
            statSpend: { nerve: 0, tradecraft: 0, fieldcraft: 0, command: 0, acumen: 26 },
            careerTraitIds: []
        });
        assert.equal(result.valid, false);
        assert.ok(result.reason.includes('acumen'));
    });

    it('normalizes legacy characters missing acumen', () => {
        const character = normaliseCharacter({ stats: { nerve: 70 } });
        assert.equal(character.stats.acumen, CHAR_DEFAULTS.STAT_BASE);
    });
});

describe('property starting platforms', () => {
    it('validate property platform packages and station landlord builds', () => {
        assert.equal(PLATFORM_PACKAGES.property_dockside_tenement.category, 'property');
        assert.equal(PLATFORM_PACKAGES.property_dockside_tenement.runtimeType, 'property_owned');
        assert.ok(PLATFORM_PACKAGES.property_dockside_tenement.property);
        assert.equal(validateBuild(ARCHETYPE_PRESETS.station_landlord.build).valid, true);
        const { character } = buildCharacterFromSpec(ARCHETYPE_PRESETS.station_landlord.build);
        assert.equal(character.platform.type, 'property_dockside_tenement');
        assert.ok(character.stats.acumen > CHAR_DEFAULTS.STAT_BASE);
    });

    it('creates a property start without an owned or assigned ship', () => {
        const player = createPlayerFromBuild(ARCHETYPE_PRESETS.station_landlord.build);
        assert.equal(player.ship, null);
        assert.equal(player.fighters, 0);
        assert.equal(player.shields, 0);
        assert.equal(player.hull, 0);
        assert.equal(player.properties.length, 1);
        assert.equal(player.properties[0].kind, 'tenement');
    });

    it('creates starting properties from platform data', () => {
        const properties = createStartingProperties('property_warehouse_leasehold', { siteId: 7 });
        assert.equal(properties.length, 1);
        assert.equal(properties[0].siteId, 7);
        assert.equal(properties[0].storageCapacity, 320);
    });

    it('keeps ship, employer, rental, and property starts compatible', () => {
        const ship = createPlayerFromBuild({
            statSpend: { nerve: 0, tradecraft: 0, fieldcraft: 0, command: 0, acumen: 0 },
            originTraitId: 'dockside_brokers_apprentice',
            careerTraitIds: [],
            platform: { type: 'ship_tier1_tramp', employerLaneId: null }
        });
        const employer = createPlayerFromBuild({
            statSpend: { nerve: 0, tradecraft: 0, fieldcraft: 0, command: 0, acumen: 0 },
            originTraitId: 'dockside_brokers_apprentice',
            careerTraitIds: [],
            platform: { type: 'employer_salary_no_ship', employerLaneId: 'hc_extractor' }
        });
        const rental = createPlayerFromBuild({
            statSpend: { nerve: 0, tradecraft: 0, fieldcraft: 0, command: 0, acumen: 0 },
            originTraitId: 'dockside_brokers_apprentice',
            careerTraitIds: [],
            platform: { type: 'rental_cutter_no_ship', employerLaneId: null }
        });
        const property = createPlayerFromBuild(ARCHETYPE_PRESETS.station_landlord.build);

        assert.equal(ship.ship.name, 'Tramp Freighter');
        assert.equal(employer.employment.runtimeType, 'employed_salary');
        assert.equal(employer.ship.name, 'Company Courier');
        assert.equal(rental.employment.runtimeType, 'ship_rented');
        assert.equal(rental.ship.name, 'Rented Merchant Cutter');
        assert.equal(property.ship, null);
        assert.equal(property.properties.length, 1);
    });
});

describe('property daily tick and recommendations', () => {
    beforeEach(() => {
        resetState();
    });
    it('collects rent and applies upkeep and debt deterministically', () => {
        const property = createStartingProperties('property_dockside_tenement', { siteId: 1 })[0];
        const result = tickPropertyDaily(property);
        const economics = summarisePropertyEconomics(property);
        assert.equal(result.creditsDelta, economics.netIncome);
        assert.equal(economics.grossRent, 560.88);
        assert.equal(economics.upkeep, 145);
        assert.equal(economics.debt, 120);
        assert.equal(economics.netIncome, 295.88);
        assert.ok(result.property.condition < property.condition);
    });

    it('changes recommendation quality and estimate accuracy with acumen', () => {
        const property = createStartingProperties('property_market_arcade', { siteId: 2 })[0];
        const low = getPropertyRecommendation(property, characterWithAcumen(50));
        const high = getPropertyRecommendation(property, characterWithAcumen(92));
        assert.equal(low.quality, 'low');
        assert.equal(high.quality, 'high');
        assert.ok(high.estimateAccuracy > low.estimateAccuracy);
    });

    it('uses high relevant skill to strongly guide routine property decisions', () => {
        const property = createStartingProperties('property_warehouse_leasehold', { siteId: 3 })[0];
        const skilled = characterWithAcumen(82, ['rent_ledger_discipline', 'bonded_storage_layout']);
        const recommendation = getPropertyRecommendation(property, skilled);
        assert.equal(recommendation.quality, 'max');
        assert.equal(recommendation.actionId, 'convertPropertyUse');
    });

    it('points low-skill landlords toward intel or help before major property moves', () => {
        const property = createStartingProperties('property_repair_bay_share', { siteId: 5 })[0];
        const low = getPropertyRecommendation(property, baselineCharacter({
            stats: { acumen: 38, command: 38, fieldcraft: 38, tradecraft: 38, nerve: 38 }
        }));

        assert.equal(low.quality, 'low');
        assert.equal(low.actionId, 'gather_intel');
        assert.match(low.text, /Gather intel|hire help/i);
    });

    it('uses multiple property competencies to choose a practical high-skill action', () => {
        const property = {
            ...createStartingProperties('property_repair_bay_share', { siteId: 6 })[0],
            condition: 42,
            occupancy: 0.86
        };
        const skilled = baselineCharacter({
            stats: { acumen: 82, command: 78, fieldcraft: 94, tradecraft: 76, nerve: 74 },
            skillNodeIds: ['pressure_valve_maintenance']
        });
        const recommendation = getPropertyRecommendation(property, skilled);

        assert.equal(recommendation.quality, 'high');
        assert.equal(recommendation.actionId, 'performMaintenance');
        assert.equal(recommendation.pressure, 'maintenance urgency');
    });

    it('applies property screen actions through player-owned system helpers', () => {
        const property = createStartingProperties('property_dockside_tenement', { siteId: 8 })[0];
        state.player = {
            credits: 1000,
            time: { day: 4 },
            character: baselineCharacter({ stats: { command: 78 } }),
            properties: [property]
        };
        const result = applyPlayerPropertyAction(property.id, 'hirePropertyManager');

        assert.equal(result.ok, true);
        assert.equal(result.propertyId, property.id);
        assert.equal(state.player.properties[0].manager.hiredDay, 4);
        assert.equal(result.creditsAfter, 1000);
    });

    it('blocks property actions that cost more credits than the player has', () => {
        const property = createStartingProperties('property_dockside_tenement', { siteId: 8 })[0];
        state.player = {
            credits: 40,
            time: { day: 4 },
            character: baselineCharacter({ stats: { fieldcraft: 72 } }),
            properties: [property]
        };
        const result = applyPlayerPropertyAction(property.id, 'performMaintenance');

        assert.equal(result.ok, false);
        assert.equal(result.reason, 'Insufficient credits to perform performMaintenance.');
        assert.equal(state.player.credits, 40);
        assert.equal(state.player.properties[0].condition, property.condition);
    });

    it('keeps property helpers renderer-independent', () => {
        const property = createStartingProperties('property_repair_bay_share', { siteId: 4 })[0];
        const actionResult = resolvePropertyAction(property, 'performMaintenance', characterWithAcumen(55), { spend: 200 });
        assert.equal(actionResult.ok, true);
        assert.ok(actionResult.property.condition > property.condition);
        assert.ok(getAvailablePropertyActions().includes('refinanceProperty'));
    });

    it('applies trait and skill bonus keys mapped per property action', () => {
        const property = createStartingProperties('property_dockside_tenement', { siteId: 1 })[0];
        const actor = baselineCharacter({ traits: ['habitat_superintendents_child'] });
        const result = resolvePropertyAction(property, 'performMaintenance', actor, { spend: 0 });
        assert.equal(result.ok, true);
        assert.equal(result.score, 52);
    });

    it('does not stack upkeep when replacing an existing property manager', () => {
        const property = createStartingProperties('property_dockside_tenement', { siteId: 1 })[0];
        const actor = baselineCharacter({ stats: { command: 70 } });
        const first = resolvePropertyAction(property, 'hirePropertyManager', actor, { day: 1 });
        const second = resolvePropertyAction(first.property, 'hirePropertyManager', actor, { day: 2 });
        assert.equal(first.ok, true);
        assert.equal(second.ok, true);
        assert.equal(second.property.upkeepDaily, first.property.upkeepDaily);
    });

    it('prevents converting the last residential unit for free storage growth', () => {
        const property = createStartingProperties('property_market_arcade', { siteId: 2 })[0];
        const singleUnitProperty = { ...property, units: 1 };
        const result = resolvePropertyAction(singleUnitProperty, 'convertPropertyUse', baselineCharacter({ stats: { acumen: 70 } }));
        assert.equal(result.ok, false);
        assert.equal(result.reason, 'Cannot convert the last remaining residential unit.');
    });

    it('limits refinance to once per day', () => {
        const property = createStartingProperties('property_market_arcade', { siteId: 2 })[0];
        const actor = baselineCharacter({ stats: { acumen: 80 } });
        const first = resolvePropertyAction(property, 'refinanceProperty', actor);
        const second = resolvePropertyAction(first.property, 'refinanceProperty', actor);
        assert.equal(first.ok, true);
        assert.equal(second.ok, false);
        assert.equal(second.reason, 'Refinance terms are already locked for today.');
    });

    it('uses NOI in value estimate by reducing value when upkeep increases', () => {
        const property = createStartingProperties('property_dockside_tenement', { siteId: 1 })[0];
        const lowUpkeep = resolvePropertyAction({ ...property, upkeepDaily: 100 }, 'setRentPosture', baselineCharacter());
        const highUpkeep = resolvePropertyAction({ ...property, upkeepDaily: 300 }, 'setRentPosture', baselineCharacter());
        assert.equal(lowUpkeep.ok, true);
        assert.equal(highUpkeep.ok, true);
        assert.ok(highUpkeep.property.valueEstimate < lowUpkeep.property.valueEstimate);
    });
});
