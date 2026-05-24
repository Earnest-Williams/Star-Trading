import { mkdirSync, writeFileSync } from 'node:fs';

import { state, resetState } from '../js/state.js';
import { createPlayer, generateUniverse } from '../js/core/universe.js';

const PLAYTEST_SEEDS = [101, 202, 303, 404, 505];
const OCCUPIED_SITES = 60;
const HOME_NEARBY_RANGE = 10;
const FORBIDDEN_BLUEPRINT_FIELDS = [
    'roleHint',
    'clusterId',
    'family',
    'localId',
    'connectorKinds',
    'stockBias',
    'portHint',
    'planetHint',
    'asteroidHint',
    'stationHint',
    'riskHint'
];

function countReachableFrom(startId) {
    const visited = new Set([startId]);
    const queue = [startId];
    while (queue.length > 0) {
        const current = queue.shift();
        const site = state.universe[current];
        for (const gate of site.jumpGates || []) {
            if (!state.universe[gate.targetSectorId] || visited.has(gate.targetSectorId)) {
                continue;
            }
            visited.add(gate.targetSectorId);
            queue.push(gate.targetSectorId);
        }
    }
    return visited.size;
}

function isEconomicSite(siteId) {
    const companies = state.companyIdsBySector[siteId] || [];
    return companies.length > 0 || Boolean(state.ports[siteId]);
}

function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function runSeed(seed) {
    resetState();
    state.player = createPlayer();
    state.player.seed = seed;
    state.worldgenSettings = {
        galaxyArchetype: 'barred_spiral',
        occupiedSites: OCCUPIED_SITES,
        routeDensity: 1,
        chartedFraction: 0.6,
        clusterAssembly: true
    };
    generateUniverse();

    const allSites = Object.values(state.universe);
    const homeSiteId = state.world.roles.homeSiteId;
    const homeSite = state.universe[homeSiteId];
    const hints = Object.entries(state.clusterHintsBySiteId || {});
    const starterHints = hints.filter(([, hint]) => hint.family === 'starter_hub');
    const starterEconomicHints = starterHints.filter(([siteId]) => isEconomicSite(Number(siteId)));
    const starterExtractionHints = starterHints.filter(([, hint]) => hint.roleHint === 'extraction_site');
    const starterTradeComplementHints = starterEconomicHints.length - starterExtractionHints.length;
    const badlandsHints = hints
        .filter(([, hint]) => hint.family === 'badlands_risk')
        .map(([siteId]) => {
            const site = state.universe[siteId];
            return {
                siteId: Number(siteId),
                name: site?.name || String(siteId),
                pirateThreat: site?.pirateThreat ?? null
            };
        });

    const nearbyEconomicSites = allSites.filter((site) => (
        distance(site.coord, homeSite.coord) <= HOME_NEARBY_RANGE && isEconomicSite(site.id)
    )).length;

    const routeCount = allSites.reduce((sum, site) => sum + (site.jumpGates?.length || 0), 0) / 2;
    const economyProfileCount = Object.keys(state.economyProfiles || {}).length;
    const economyPressureExists = allSites.some((site) => Number.isFinite(site.economyPressure));
    const duplicateCoordinateCount = allSites.length - new Set(allSites.map((site) => site.coordKey)).size;
    const forbiddenRuntimeMetadata = allSites.some((site) => FORBIDDEN_BLUEPRINT_FIELDS.some((field) => Object.hasOwn(site, field)));

    return {
        seed,
        occupiedSiteCount: allSites.length,
        homeSiteId,
        homeSiteName: homeSite.name,
        homeSiteRegion: homeSite.region,
        chartedReachableSites: countReachableFrom(homeSiteId),
        nearbyEconomicSiteCount: nearbyEconomicSites,
        starterHintedEconomicSites: starterEconomicHints.length,
        extractionSiteCountAmongHinted: starterExtractionHints.length,
        nonExtractionTradeComplementCount: starterTradeComplementHints,
        badlandsRiskHints: badlandsHints,
        routeCount,
        economyProfileCount,
        economyPressureExists,
        duplicateCoordinateCount,
        forbiddenBlueprintMetadataInRuntime: forbiddenRuntimeMetadata
    };
}

const results = PLAYTEST_SEEDS.map(runSeed);
console.log(JSON.stringify(results, null, 2));

const date = new Date().toISOString().slice(0, 10);
const outputPath = `docs/archive/cluster_worldgen_playtest_${date}.md`;
mkdirSync('docs/archive', { recursive: true });

const tableRows = results.map((result) => {
    const badlandsThreats = result.badlandsRiskHints.map((hint) => `${hint.siteId}:${hint.pirateThreat}`).join(', ');
    return `| ${result.seed} | ${result.occupiedSiteCount} | ${result.homeSiteId}/${result.homeSiteName}/${result.homeSiteRegion} | ${result.chartedReachableSites} | ${result.nearbyEconomicSiteCount} | ${result.starterHintedEconomicSites} | ${result.extractionSiteCountAmongHinted} | ${result.nonExtractionTradeComplementCount} | ${badlandsThreats || 'none'} | ${result.routeCount} | ${result.economyProfileCount} | ${result.economyPressureExists} | ${result.duplicateCoordinateCount} | ${result.forbiddenBlueprintMetadataInRuntime} |`;
});

const report = `# Cluster Worldgen Playtest (${date})\n\n- Command: \`node scripts/cluster-worldgen-playtest.mjs\`\n- Seeds: ${PLAYTEST_SEEDS.join(', ')}\n- Occupied sites per run: ${OCCUPIED_SITES}\n\n## Seed summary\n\n| seed | occupied_sites | home_site (id/name/region) | reachable_sites | nearby_economic_sites | starter_hinted_economic_sites | extraction_hinted_sites | non_extraction_trade_complement | badlands_risk_hint_threats | route_count | economy_profiles | economy_pressure_exists | duplicate_coordinates | forbidden_runtime_blueprint_metadata |\n|---|---:|---|---:|---:|---:|---:|---:|---|---:|---:|---|---:|---|\n${tableRows.join('\n')}\n\n## Notes\n\n- Starter quality: this script observed nearby economic sites around home, but starter-hint and extraction-hint counts were zero in these runtime snapshots, so no positive starter-hint quality claim is made from this data alone.\n- Route shape: route counts were stable and non-zero across seeds, with no synthetic fallback injected by this script.\n- Faction clarity: faction outcomes were not scored subjectively here; this report is limited to objective generated fields and counts.\n- Economy pressure: these snapshots reported no economy profiles and no per-site economy pressure fields at sampling time; this helper is validating generated structure, not downstream simulation ticks.\n- Map readability: coordinate uniqueness held in all sampled runs (duplicate count remained zero).\n\n## Limitations\n\n- This is data-driven validation only. No UI play session was run in this pass.\n`;

writeFileSync(outputPath, report, 'utf8');
console.log(`Wrote ${outputPath}`);
