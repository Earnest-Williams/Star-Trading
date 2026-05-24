import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const MODULE_EXPORTS = Object.freeze({
    '../js/systems/captains.js': [
        'addCaptainHistory',
        'applyContestMissionOutcome',
        'captainCanOpenTradeRoutes',
        'captainDisplayName',
        'captainMissionScore',
        'createCaptainEconomy',
        'createCaptains',
        'ensureCaptainRelation',
        'getCaptain',
        'getCaptainDominantFaction',
        'getCaptainGuildTier',
        'getCaptainRelationshipLabel',
        'getCaptainsInSector',
        'getKnownCaptains',
        'missionCandidateCaptains',
        'normaliseCaptains',
        'nudgeCaptainFaction',
        'nudgeCaptainRelation',
        'prepareMissionOpportunity',
        'updateCaptainsDaily',
        'updateCaptainsHourly'
    ],
    '../js/core/universe.js': [
        'addJumpGateCorridor',
        'applyClusterWorldgenHints',
        'calculateEffectiveSpanCost',
        'calculateGatePulseCost',
        'coordKey',
        'createPlayer',
        'createPlayerFromBuild',
        'createSparseSitesFromClusterBlueprints',
        'ensureEconomicActivityConnectivity',
        'generateClusterCenters',
        'generateSiteCoordinate',
        'generateStars',
        'generateUniverse',
        'getRichnessLabel',
        'getSiteTypeLabel',
        'initRng',
        'makePlanet',
        'makePort',
        'makeStock',
        'metricShearAtCoord',
        'setSiteCoord',
        'validateClusterAssemblyResult',
        'validateClusterWorldgenAfterEconomy',
        'validateClusterWorldgenAfterHints',
        'generateLocalLocationsForSystem',
        'generateAllLocalLocations'
    ],
    '../js/systems/tradeRoutes.js': [
        'assignCaptainToRoute',
        'buildLogisticsSnapshot',
        'closeTradeRoute',
        'createCaptainTradeRoute',
        'createRouteRecord',
        'createTradeRoute',
        'deriveRouteMetrics',
        'estimateRouteProfit',
        'findShortestCorridorPath',
        'getAllLogisticsNodes',
        'getLogisticsNode',
        'getRouteCommodityOptions',
        'getRouteDistance',
        'getRouteEscortCandidates',
        'getRouteEscortPower',
        'getRouteMarketValue',
        'getRoutePath',
        'getRouteRisk',
        'getRouteRiskForSectors',
        'getRouteSetupCost',
        'hydrateTradeRoute',
        'maybeRoutePoliticalSideEffect',
        'normaliseTradeRoutes',
        'routeExists',
        'runTradeRoute',
        'runTradeRoutesDaily',
        'toggleTradeRoute',
        'unassignRouteEscort'
    ],
    '../js/core/dataCargo.js': [
        'addPrivatePayloadToPlayerHold',
        'buildDataCargoDebugSummary',
        'buildSectorPublicSnapshot',
        'carryPublicSnapshotForPlayer',
        'createPrivatePayload',
        'cullOldPublicSnapshots',
        'discardPrivatePayload',
        'expirePrivatePayloads',
        'getActivePrivatePayloads',
        'getCurrentSectorKnowledge',
        'getFreshnessLabel',
        'getFreshnessSummaryForSector',
        'getKnownPublicSnapshotsForSector',
        'getPlayerDataHoldSummary',
        'getPublicSnapshotAge',
        'getSectorDataFreshness',
        'maybeGeneratePrivatePayloadOnArrival',
        'mergePublicSnapshotsOnArrival',
        'normaliseDataCargoState',
        'releasePrivatePayload',
        'runAmbientDataPropagationDaily',
        'sellPrivatePayload'
    ],
    '../js/systems/entanglements.js': [
        'addOrNudgeEntanglement',
        'canDeepenRomanceWithCaptain',
        'canStartRomanceWithCaptain',
        'deepenRomanceWithCaptain',
        'findEntanglement',
        'getCaptainEntanglements',
        'getCaptainMissionEntanglementModifier',
        'getEntanglementsForParty',
        'makeContactParty',
        'maybeSpawnEntanglementEvents',
        'normaliseEntanglements',
        'startRomanceWithCaptain',
        'syncRelationshipEntanglements',
        'updateEntanglementsDaily'
    ]
});

const SPLIT_MODULES = Object.freeze([
    '../js/systems/captains/core.js',
    '../js/systems/captains/economy.js',
    '../js/systems/captains/ai.js',
    '../js/systems/captains/persistence.js',
    '../js/core/universe/generator.js',
    '../js/core/universe/physics.js',
    '../js/core/universe/projection.js',
    '../js/core/universe/index.js',
    '../js/systems/tradeRoutes/validation.js',
    '../js/systems/tradeRoutes/economics.js',
    '../js/systems/tradeRoutes/assignment.js',
    '../js/systems/tradeRoutes/index.js',
    '../js/core/dataCargo/types.js',
    '../js/core/dataCargo/contraband.js',
    '../js/core/dataCargo/missionHooks.js',
    '../js/core/dataCargo/index.js',
    '../js/systems/entanglements/factions.js',
    '../js/systems/entanglements/events.js',
    '../js/systems/entanglements/index.js'
]);

describe('split module compatibility barrels', () => {
    Object.entries(MODULE_EXPORTS).forEach(([modulePath, expectedExports]) => {
        it(`${modulePath} exposes the pre-split public API`, async () => {
            const module = await import(modulePath);
            assert.deepEqual(Object.keys(module).sort(), expectedExports.slice().sort());
        });
    });

    it('all split module entry points import cleanly', async () => {
        const importedModules = await Promise.all(SPLIT_MODULES.map(modulePath => import(modulePath)));
        assert.equal(importedModules.length, SPLIT_MODULES.length);
    });
});
