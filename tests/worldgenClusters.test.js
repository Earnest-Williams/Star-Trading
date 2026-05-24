import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { state, resetState } from '../js/state.js';
import { CLUSTER_BLUEPRINTS, validateClusterBlueprint } from '../js/config/worldgenClusters.js';
import { createPlayer, generateUniverse } from '../js/core/universe.js';
import {
    createSparseSitesFromClusterBlueprints,
    validateClusterAssemblyResult
} from '../js/core/universe/generator.js';
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
    it('createSparseSitesFromClusterBlueprints returns exact occupied site count', () => {
        const config = { archetypeKey: 'barred_spiral', occupiedSites: 30, routeDensity: 1, chartedFraction: 0.6 };
        const result = createSparseSitesFromClusterBlueprints(config, seededRng(12345));
        assert.equal(Object.keys(result.sites).length, config.occupiedSites);
    });

    it('validateClusterAssemblyResult returns no errors for valid generated output', () => {
        const config = { archetypeKey: 'barred_spiral', occupiedSites: 30, routeDensity: 1, chartedFraction: 0.6 };
        const result = createSparseSitesFromClusterBlueprints(config, seededRng(424242));
        assert.deepEqual(validateClusterAssemblyResult(result, config), []);
    });

    it('duplicate coordKey or broken siteIdByCoord fixture returns errors', () => {
        const config = { archetypeKey: 'barred_spiral', occupiedSites: 30, routeDensity: 1, chartedFraction: 0.6 };
        const result = createSparseSitesFromClusterBlueprints(config, seededRng(424242));
        const broken = globalThis.structuredClone(result);
        const firstId = Number(Object.keys(broken.sites)[0]);
        const secondId = Number(Object.keys(broken.sites)[1]);
        broken.sites[secondId].coordKey = broken.sites[firstId].coordKey;
        broken.siteIdByCoord[broken.sites[firstId].coordKey] = secondId;
        const errors = validateClusterAssemblyResult(broken, config);
        assert.ok(errors.some((error) => error.includes('duplicate coordKey')));
    });

    it('generated site records do not contain transient cluster metadata fields', () => {
        const config = { archetypeKey: 'barred_spiral', occupiedSites: 30, routeDensity: 1, chartedFraction: 0.6 };
        const result = createSparseSitesFromClusterBlueprints(config, seededRng(424242));
        const bannedFields = ['roleHint', 'clusterId', 'family', 'localId', 'connectorKinds', 'stockBias'];
        for (const site of Object.values(result.sites)) {
            for (const field of bannedFields) {
                assert.equal(Object.hasOwn(site, field), false);
            }
        }
    });

    it('has at least one home_candidate and one non-starter connector transient hint', () => {
        const config = { archetypeKey: 'barred_spiral', occupiedSites: 30, routeDensity: 1, chartedFraction: 0.6 };
        const result = createSparseSitesFromClusterBlueprints(config, seededRng(424242));
        const hints = Object.values(result.clusterHintsBySiteId);
        assert.ok(hints.some((hint) => hint.roleHint === 'home_candidate'));
        assert.ok(hints.some((hint) => hint.family !== 'starter_hub' && (hint.connectorKinds || []).length > 0));
    });

    it('generateUniverse with clusterAssembly completes quality checks and still builds corridors', () => {
        seedGameWithClusters(30, true);
        const sectors = Object.values(state.universe);
        assert.ok(sectors.some((sector) => sector.jumpGates.length > 0));

        const quote = getBidAskForSector(state.world.roles.homeSiteId, 'ore');
        assert.ok(quote.midpoint > 0);
    });

    it('legacy procedural generation still works when clusterAssembly is disabled', () => {
        seedGameWithClusters(30, false);
        assert.equal(Object.keys(state.universe).length, 30);
        assert.ok(state.world.roles.homeSiteId);
    });

    it('does not persist cluster blueprint metadata in save data', () => {
        seedGameWithClusters(30, true);
        const saveData = buildSaveData();
        const hasClusterMetadata = Object.values(saveData.universe).some((site) => (
            Object.hasOwn(site, 'roleHint')
            || Object.hasOwn(site, 'clusterId')
            || Object.hasOwn(site, 'family')
            || Object.hasOwn(site, 'localId')
            || Object.hasOwn(site, 'connectorKinds')
            || Object.hasOwn(site, 'stockBias')
        ));
        assert.equal(hasClusterMetadata, false);
        assert.equal(Object.hasOwn(saveData, 'clusterHintsBySiteId'), false);
    });

    it('all bundled blueprints validate with zero errors', () => {
        for (const blueprint of CLUSTER_BLUEPRINTS) {
            assert.deepEqual(validateClusterBlueprint(blueprint), [], `Expected no validation errors for ${blueprint.id}`);
        }
    });
});
