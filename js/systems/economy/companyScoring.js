import { state } from '../../state.js';
import { deriveRouteMetrics } from '../tradeRoutes.js';
import { COMPANY_ARCHETYPES } from '../../config/companies.js';

const TYPES = Object.freeze(Object.keys(COMPANY_ARCHETYPES));
const MAX_NEARBY_EXTRACTION_HOPS = 3;
const MISSING_HOP_COUNT_FALLBACK = MAX_NEARBY_EXTRACTION_HOPS + 1;
const SCORE_REASONS = Object.freeze({
    localExtraction: extraction => `local extraction ${Math.round(extraction)}`,
    nearbyExtraction: nearby => `nearby extraction ${Math.round(nearby)}`,
    feedstockAccess: total => `feedstock access ${Math.round(total)}`,
    refineryPortBias: 'refinery port bias',
    processedInputAccess: 'processed input access',
    manufacturingOutputBias: 'manufacturing output bias',
    importExportPressure: 'import/export pressure',
    strongRouteAccess: 'strong route access',
    connectedLogisticsPosition: 'connected logistics position',
    stardockRefitBias: 'stardock refit bias',
    stardockManufacturingBias: 'stardock manufacturing bias',
    agriculturalOutputProfile: 'agricultural output profile',
    populationDemand: populationDemand => `population demand ${populationDemand.toFixed(1)}`,
    pirateThreat: pirateThreat => `pirate threat ${pirateThreat}`,
    lowRouteAccessSecurityDemand: 'low route access security demand',
    hiddenVcFrontFaction: 'hidden VC/front faction',
    frontSector: 'front sector',
    badlandsCover: 'badlands cover'
});
const num = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const hasAny = (items, needles) => {
    if (!Array.isArray(items)) return false;
    return needles.some(needle => items.includes(needle));
};

function nearbyExtraction(sectorId) {
    return Object.keys(state.economy?.profilesBySector || {}).reduce((sum, sid) => {
        const metrics = deriveRouteMetrics(Number(sectorId), Number(sid));
        if (!metrics?.path || (metrics.hopCount || MISSING_HOP_COUNT_FALLBACK) > MAX_NEARBY_EXTRACTION_HOPS) return sum;
        return sum + num(state.economy?.profilesBySector?.[sid]?.extractionCapacity)
            / Math.max(1, metrics.hopCount || 1);
    }, 0);
}

function routeAccessFor(profile) {
    return Math.max(0, Math.min(1, num(profile.routeAccess, 1 - num(profile.routeDependence, 0.5))));
}

function addReason(reasons, condition, text) {
    if (condition) reasons.push(text);
}

function getSectorScoringContext(sectorId) {
    const profile = state.economy?.profilesBySector?.[sectorId] || {};
    const sector = state.universe?.[sectorId] || {};
    const port = state.ports?.[sectorId] || {};
    const planet = state.planets?.[sectorId] || {};
    const imports = Array.isArray(profile.likelyImports) ? profile.likelyImports : [];
    const exports = Array.isArray(profile.likelyExports) ? profile.likelyExports : [];
    const portType = port.typeKey || '';
    const roleTags = Array.isArray(profile.roleTags) ? profile.roleTags : [];
    return {
        routeAccess: routeAccessFor(profile),
        extraction: num(profile.extractionCapacity),
        nearby: nearbyExtraction(sectorId),
        imports,
        exports,
        importPressure: imports.length,
        exportPressure: exports.length,
        demand: num(profile.demandWeight),
        populationDemand: num(profile.populationDemand),
        portType,
        hazard: num(sector.asteroids?.hazard),
        front: sector.front ? 1 : 0,
        hiddenVc: port.hiddenFactionId === 'vc' || roleTags.includes('faction:vc') || roleTags.includes('front:hidden'),
        badlands: sector.region === 'Badlands' ? 1 : 0,
        pirateThreat: num(sector.pirateThreat),
        industrialInputs: hasAny(imports, ['refined_metals', 'polymers', 'rare_earths', 'coolants', 'heavy_metals']),
        industrialOutputs: hasAny(exports, ['eq', 'machinery', 'repair_parts', 'electronics', 'construction_kits', 'control_cores']),
        agriPlanet: planet.typeKey === 'agricultural' || portType === 'agricultural' || hasAny(exports, ['org', 'fertilizer', 'medical_supplies']),
        stardock: portType === 'stardock' || roleTags.includes('port:stardock')
    };
}

/**
 * Score a company archetype for a sector.
 * Pass a precomputed context when scoring multiple types for the same sector.
 */
export function scoreCompanyTypeForSector(sectorId, type, context) {
    const sectorContext = context || getSectorScoringContext(sectorId);
    const {
        routeAccess,
        extraction,
        nearby,
        imports,
        importPressure,
        exportPressure,
        demand,
        populationDemand,
        portType,
        hazard,
        front,
        hiddenVc,
        badlands,
        pirateThreat,
        industrialInputs,
        industrialOutputs,
        agriPlanet,
        stardock
    } = sectorContext;
    const reasons = [];
    let score = 0;

    if (type === 'mining_contractor') {
        score = extraction * 0.02 + nearby * 0.004 - hazard * 1.5 + (portType === 'mining' ? 2.5 : 0);
        addReason(reasons, extraction > 0, SCORE_REASONS.localExtraction(extraction));
        addReason(reasons, nearby > 0, SCORE_REASONS.nearbyExtraction(nearby));
    } else if (type === 'refinery_operator') {
        score = (extraction + nearby) * 0.012 + importPressure * 0.8 + exportPressure * 0.6 + (portType === 'refinery' ? 2 : 0);
        addReason(reasons, extraction + nearby > 0, SCORE_REASONS.feedstockAccess(extraction + nearby));
        addReason(reasons, portType === 'refinery', SCORE_REASONS.refineryPortBias);
    } else if (type === 'industrial_supplier') {
        score = demand * 1.8 + importPressure + exportPressure * 0.7 + routeAccess * 3 + (industrialInputs ? 1.5 : 0) + (industrialOutputs ? 1.2 : 0) + (portType === 'industrial' ? 2 : 0);
        addReason(reasons, industrialInputs, SCORE_REASONS.processedInputAccess);
        addReason(reasons, industrialOutputs, SCORE_REASONS.manufacturingOutputBias);
    } else if (type === 'import_export') {
        score = (importPressure + exportPressure) * 1.2 + routeAccess * 4 + Math.min(importPressure, exportPressure) * 2;
        addReason(reasons, importPressure + exportPressure > 0, SCORE_REASONS.importExportPressure);
        addReason(reasons, routeAccess > 0.6, SCORE_REASONS.strongRouteAccess);
    } else if (type === 'haulage') {
        score = (importPressure + exportPressure) + routeAccess * 4 + Math.min(importPressure, exportPressure) * 1.5;
        addReason(reasons, routeAccess > 0.5, SCORE_REASONS.connectedLogisticsPosition);
    } else if (type === 'ship_refitter') {
        score = routeAccess * 2 + demand + (stardock ? 3 : 0) + (industrialInputs ? 1 : 0);
        addReason(reasons, stardock, SCORE_REASONS.stardockRefitBias);
    } else if (type === 'dockyard') {
        score = routeAccess * 2 + demand * 1.2 + (stardock ? 3 : 0) + (industrialInputs ? 1 : 0) + (industrialOutputs ? 1 : 0);
        addReason(reasons, stardock, SCORE_REASONS.stardockManufacturingBias);
    } else if (type === 'agri_collective') {
        score = (agriPlanet ? 5 : 0) + populationDemand * 1.5 + routeAccess + (hasAny(imports, ['water_ice', 'coolants', 'polymers']) ? 1.2 : 0);
        addReason(reasons, agriPlanet, SCORE_REASONS.agriculturalOutputProfile);
        addReason(reasons, populationDemand > 0, SCORE_REASONS.populationDemand(populationDemand));
    } else if (type === 'security_contractor') {
        score = hazard + pirateThreat * 0.7 + (1 - routeAccess) * 2 + (front ? 2 : 0) + badlands;
        addReason(reasons, pirateThreat > 0, SCORE_REASONS.pirateThreat(pirateThreat));
        addReason(reasons, routeAccess < 0.5, SCORE_REASONS.lowRouteAccessSecurityDemand);
    } else if (type === 'black_market_front') {
        score = (hiddenVc ? 7 : 0) + front * 5 + badlands * 2 + pirateThreat * 0.5 + (1 - routeAccess) * 2;
        addReason(reasons, hiddenVc, SCORE_REASONS.hiddenVcFrontFaction);
        addReason(reasons, front, SCORE_REASONS.frontSector);
        addReason(reasons, badlands, SCORE_REASONS.badlandsCover);
    }

    const boundedScore = Math.max(0, score);
    return {
        type,
        score: boundedScore,
        count: boundedScore >= 0.75 ? Math.max(1, Math.min(3, Math.round(boundedScore / 4))) : 0,
        reasons: reasons.length > 0 ? reasons : [`route:${routeAccess.toFixed(2)}`, `extract:${Math.round(extraction)}`]
    };
}

export function scoreCompanyTypesForSector(sectorId, context) {
    const sectorContext = context || getSectorScoringContext(sectorId);
    return TYPES.map(type => scoreCompanyTypeForSector(sectorId, type, sectorContext))
        .sort((a, b) => b.score - a.score || a.type.localeCompare(b.type));
}

export function chooseCapacityBasedCompanyTypes(sectorId) {
    const profile = state.economy?.profilesBySector?.[sectorId] || {};
    const context = getSectorScoringContext(sectorId);
    const capacity = Math.max(1, Math.min(8, Math.round(num(profile.companyCapacity, 3))));
    const picks = [];

    if (context.stardock) {
        picks.push('ship_refitter');
        picks.push('dockyard');
    }
    if (context.front || context.hiddenVc) {
        picks.push('black_market_front');
    }

    const ranked = scoreCompanyTypesForSector(sectorId, context).filter(candidate => candidate.score > 0);
    ranked.forEach(candidate => {
        const remaining = capacity - picks.length;
        if (remaining <= 0) return;
        const currentCount = picks.filter(p => p === candidate.type).length;
        const allowedToAdd = Math.max(0, candidate.count - currentCount);
        const count = Math.min(remaining, allowedToAdd);
        for (let index = 0; index < count; index += 1) picks.push(candidate.type);
    });
    if (picks.length === 0) picks.push('haulage');
    return picks;
}

export function explainCompanyScore(sectorId, type) {
    return scoreCompanyTypeForSector(sectorId, type);
}
