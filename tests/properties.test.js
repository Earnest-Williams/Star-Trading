import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ARCHETYPE_PRESETS, CHAR_DEFAULTS, CHAR_STATS, PLATFORM_PACKAGES } from '../js/config/chargen.js';
import { buildCharacterFromSpec, validateBuild } from '../js/core/characterBuild.js';
import { createPlayerFromBuild } from '../js/core/universe.js';
import { normaliseCharacter } from '../js/core/characters.js';
import {
    createStartingProperties,
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
});

describe('property daily tick and recommendations', () => {
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

    it('keeps property helpers renderer-independent', () => {
        const property = createStartingProperties('property_repair_bay_share', { siteId: 4 })[0];
        const actionResult = resolvePropertyAction(property, 'performMaintenance', characterWithAcumen(55), { spend: 200 });
        assert.equal(actionResult.ok, true);
        assert.ok(actionResult.property.condition > property.condition);
        assert.ok(getAvailablePropertyActions().includes('refinanceProperty'));
    });
});
