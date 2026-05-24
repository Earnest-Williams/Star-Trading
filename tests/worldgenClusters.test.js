import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { state, resetState } from '../js/state.js';
import { CLUSTER_BLUEPRINTS, validateClusterBlueprint } from '../js/config/worldgenClusters.js';
import { createPlayer, generateUniverse } from '../js/core/universe.js';
import { createSparseSitesFromClusterBlueprints } from '../js/core/universe/generator.js';
import { buildSaveData } from '../js/core/persistence.js';
import { seededRng } from '../js/utils.js';
import { getBidAskForSector } from '../js/systems/economy/pricing.js';

function seedGameWithClusters(occupiedSites = 30, enabled = true) {
    resetState();
    state.player = createPlayer();
    state.player.seed = 424242;
    state.worldgenSettings = {
        galaxyArchetype: 'barred_spiral',
        occupiedSites,
        routeDensity: 1,
        chartedFraction: 0.6,
        clusterAssembly: enabled
    };
    generateUniverse();
}

describe('cluster blueprint worldgen mvp', () => {
    
    it('createSparseSitesFromClusterBlueprints returns contract-compatible structure', () => {
        const config = {
            archetypeKey: 'barred_spiral',
            occupiedSites: 30,
            routeDensity: 1,
            chartedFraction: 0.6
        };
        const rng = seededRng(12345);
        const result = createSparseSitesFromClusterBlueprints(config, rng);
        
        assert.ok(result.sites);
        assert.ok(result.siteIdByCoord);
        assert.ok(result.archetypeName);
        assert.ok(result.clusterHintsBySiteId);
        
        const siteCount = Object.keys(result.sites).length;
        assert.equal(siteCount, 30);
        
        // Ensure coordinates are unique
        const coords = new Set();
        for (const site of Object.values(result.sites)) {
            assert.ok(site.coord);
            assert.ok(site.coordKey);
            assert.ok(Number.isFinite(site.coord.x));
            assert.ok(Number.isFinite(site.coord.y));
            assert.ok(Number.isFinite(site.coord.z));
            assert.ok(!coords.has(site.coordKey), `Duplicate coordinate found: ${site.coordKey}`);
            coords.add(site.coordKey);
        }
    });

    it('uses transient home_candidate roleHint for anchor selection and keeps roleHint off sites', () => {
        seedGameWithClusters(30, true);
        
        const homeSiteId = state.world.roles.homeSiteId;
        assert.ok(homeSiteId);
        
        const homeSite = state.universe[homeSiteId];
        assert.equal(homeSite.name, "StarDock");
        assert.equal(homeSite.richness, "hub");
        assert.equal(homeSite.siteType, "stellar_system");
        
        const sparse = createSparseSitesFromClusterBlueprints({
            archetypeKey: 'barred_spiral',
            occupiedSites: 30,
            routeDensity: 1,
            chartedFraction: 0.6
        }, seededRng(424242));
        const hintedHomeSiteId = Number(Object.entries(sparse.clusterHintsBySiteId)
            .find(([, hint]) => hint.roleHint === 'home_candidate')?.[0]);
        assert.equal(hintedHomeSiteId, homeSiteId, 'Transient home_candidate hint should drive home anchor selection');

        const hasRoleHintProperty = Object.values(state.universe)
            .some(site => Object.hasOwn(site, 'roleHint'));
        assert.ok(!hasRoleHintProperty, 'Generated sites should not persist roleHint');
    });

    it('applies site type, richness, faction bias, and stock bias hints', () => {
        seedGameWithClusters(30, true);
        const sparse = createSparseSitesFromClusterBlueprints({
            archetypeKey: 'barred_spiral',
            occupiedSites: 30,
            routeDensity: 1,
            chartedFraction: 0.6
        }, seededRng(424242));
        const mineSiteId = Number(Object.entries(sparse.clusterHintsBySiteId)
            .find(([, hint]) => hint.localId === 'mine')?.[0]);
        
        // Find the starter mining site which has custom stockBias and factionBias
        const miningSite = state.universe[mineSiteId];
        assert.ok(miningSite, "Starter mining site should exist");
        
        // Validate faction bias was added to base Frontier bias
        // Frontier base bias: fu: 46, sda: 18, hc: 18, vc: 12
        // Mining site has bias: hc: +12, fu: +4
        assert.ok(miningSite.influence.hc > 18, "Helion Combine influence should be boosted by faction bias");
        
        // Validate stock bias from hint pass
        // The mine site has stockBias: { ore: "surplus", repair_parts: "shortage" }
        const minePort = state.ports[miningSite.id];
        assert.ok(minePort, "Mining site should have a port");
        
        const oreStock = minePort.stock.ore;
        const maxOre = minePort.maxStock.ore;
        const partsStock = minePort.stock.repair_parts;
        const maxParts = minePort.maxStock.repair_parts;
        
        // surplus -> 75% max stock, shortage -> 15% max stock
        assert.equal(oreStock, Math.floor(maxOre * 0.75), "Ore stock should be surplus (75% max stock)");
        assert.equal(partsStock, Math.floor(maxParts * 0.15), "Repair parts stock should be shortage (15% max stock)");
    });

    it('downstream simulation passes (corridors, economy, pressure) complete without errors', () => {
        seedGameWithClusters(30, true);
        
        // 1. Corridors exist
        const sectors = Object.values(state.universe);
        assert.ok(sectors.some(s => s.jumpGates.length > 0), "Some sectors should have jump gate corridors");
        
        // 2. Economy profiles created
        // Verify ports have seeded items and economy profile populated
        const stardockPort = state.ports[state.world.roles.homeSiteId];
        assert.ok(stardockPort, "StarDock should have a port");
        assert.ok(stardockPort.stock.pulse_canister > 0, "StarDock should have pulse canisters");
        
        // 3. Economy pressure recomputed
        assert.ok(state.economy, "Economy state should exist");
        // Verify that there is at least one price calibrated in the system
        assert.ok(Object.keys(state.economy.universeBasePrices).length > 0, "Universe base prices should be calibrated");
        
        const quote = getBidAskForSector(state.world.roles.homeSiteId, 'ore');
        assert.ok(quote.midpoint > 0, "StarDock should have a valid midpoint price for ore");
        assert.ok(quote.ask > 0, "StarDock should have a valid ask price for ore");
        assert.ok(quote.bid > 0, "StarDock should have a valid bid price for ore");
    });

    it('legacy procedural generation still works when clusterAssembly is disabled', () => {
        seedGameWithClusters(30, false);
        
        const ids = Object.keys(state.universe).map(Number);
        assert.equal(ids.length, 30);
        
        // Anchor assignment should still select a homeSiteId
        const homeSiteId = state.world.roles.homeSiteId;
        assert.ok(homeSiteId);
        
        // Check that no site has roleHint since procedurally generated sites do not have roleHint
        const hasRoleHintProperty = Object.values(state.universe).some(s => Object.hasOwn(s, 'roleHint'));
        assert.ok(!hasRoleHintProperty, "Procedural sites should not have role hints");
    });

    it('all bundled blueprints validate with zero errors', () => {
        for (const blueprint of CLUSTER_BLUEPRINTS) {
            const errors = validateClusterBlueprint(blueprint);
            assert.deepEqual(errors, [], `Expected no validation errors for ${blueprint.id}`);
        }
    });

    it('invalid connector localId fails validation', () => {
        const badBlueprint = globalThis.structuredClone(CLUSTER_BLUEPRINTS[0]);
        badBlueprint.id = 'bad-connector';
        badBlueprint.connectors = [{ localId: 'missing-node', kind: 'trade_seam' }];
        const errors = validateClusterBlueprint(badBlueprint);
        assert.ok(errors.some(error => error.includes("connector references unknown localId 'missing-node'")));
    });

    it('invalid planetHint fails validation', () => {
        const badBlueprint = globalThis.structuredClone(CLUSTER_BLUEPRINTS[0]);
        badBlueprint.id = 'bad-planet';
        badBlueprint.sites[0].planetHint = 'agricultural';
        const errors = validateClusterBlueprint(badBlueprint);
        assert.ok(errors.some(error => error.includes("unknown planetHint 'agricultural'")));
    });

    it('invalid stock commodity fails validation', () => {
        const badBlueprint = globalThis.structuredClone(CLUSTER_BLUEPRINTS[0]);
        badBlueprint.id = 'bad-commodity';
        badBlueprint.sites[0].stockBias = { unknown_commodity: 'surplus' };
        const errors = validateClusterBlueprint(badBlueprint);
        assert.ok(errors.some(error => error.includes("unknown stockBias commodity 'unknown_commodity'")));
    });

});
    it('does not persist cluster blueprint metadata in save data', () => {
        seedGameWithClusters(30, true);
        const saveData = buildSaveData();

        const hasRoleHintProperty = Object.values(saveData.universe)
            .some(site => Object.hasOwn(site, 'roleHint'));
        assert.ok(!hasRoleHintProperty, 'Save universe should not include roleHint');
        assert.ok(!Object.hasOwn(saveData, 'clusterHintsBySiteId'), 'Top-level save data should not include cluster hints');

        const hasClusterMetadata = Object.values(saveData.universe).some(site => (
            Object.hasOwn(site, 'clusterId')
            || Object.hasOwn(site, 'family')
            || Object.hasOwn(site, 'localId')
        ));
        assert.ok(!hasClusterMetadata, 'Save universe should not include cluster metadata fields');
    });

    it('badlands risk cluster has nonzero pirate threat on at least one hinted site', () => {
        const config = {
            archetypeKey: 'barred_spiral',
            occupiedSites: 30,
            routeDensity: 1,
            chartedFraction: 0.6
        };
        const sparse = createSparseSitesFromClusterBlueprints(config, seededRng(424242));
        const badlandsRiskSiteIds = Object.entries(sparse.clusterHintsBySiteId)
            .filter(([, hint]) => hint.family === 'badlands_risk')
            .map(([id]) => Number(id));
        assert.ok(badlandsRiskSiteIds.length > 0, 'Badlands risk hinted sites should exist');

        const hasRisk = badlandsRiskSiteIds.some((id) => sparse.sites[id].pirateThreat > 0);
        assert.ok(hasRisk, 'At least one badlands_risk hinted site should have pirate threat > 0');
    });
