import { state } from '../../state.js';
import { deriveRouteMetrics } from '../tradeRoutes.js';
import { COMPANY_ARCHETYPES } from '../../config/companies.js';

const TYPES = Object.freeze(Object.keys(COMPANY_ARCHETYPES));
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
        if (!metrics.path || (metrics.hopCount || 99) > 3) return sum;
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

export function scoreCompanyTypeForSector(sectorId, type) {
    const profile = state.economy?.profilesBySector?.[sectorId] || {};
    const sector = state.universe?.[sectorId] || {};
    const port = state.ports?.[sectorId] || {};
    const planet = state.planets?.[sectorId] || {};
    const routeAccess = routeAccessFor(profile);
    const extraction = num(profile.extractionCapacity);
    const nearby = nearbyExtraction(sectorId);
    const imports = Array.isArray(profile.likelyImports) ? profile.likelyImports : [];
    const exports = Array.isArray(profile.likelyExports) ? profile.likelyExports : [];
    const importPressure = imports.length;
    const exportPressure = exports.length;
    const demand = num(profile.demandWeight);
    const populationDemand = num(profile.populationDemand);
    const portType = port.typeKey || '';
    const roleTags = Array.isArray(profile.roleTags) ? profile.roleTags : [];
    const hazard = num(sector.asteroids?.hazard);
    const front = sector.front ? 1 : 0;
    const hiddenVc = port.hiddenFactionId === 'vc' || roleTags.includes('faction:vc') || roleTags.includes('front:hidden');
    const badlands = sector.region === 'Badlands' ? 1 : 0;
    const pirateThreat = num(sector.pirateThreat);
    const industrialInputs = hasAny(imports, ['refined_metals', 'polymers', 'rare_earths', 'coolants', 'heavy_metals']);
    const industrialOutputs = hasAny(exports, ['eq', 'machinery', 'repair_parts', 'electronics', 'construction_kits', 'control_cores']);
    const agriPlanet = planet.typeKey === 'agricultural' || portType === 'agricultural' || hasAny(exports, ['org', 'fertilizer', 'medical_supplies']);
    const stardock = portType === 'stardock' || roleTags.includes('port:stardock');
    const reasons = [];
    let score = 0;

    if (type === 'mining_contractor') {
        score = extraction * 0.02 + nearby * 0.004 - hazard * 1.5 + (portType === 'mining' ? 2.5 : 0);
        addReason(reasons, extraction > 0, `local extraction ${Math.round(extraction)}`);
        addReason(reasons, nearby > 0, `nearby extraction ${Math.round(nearby)}`);
    } else if (type === 'refinery_operator') {
        score = (extraction + nearby) * 0.012 + importPressure * 0.8 + exportPressure * 0.6 + (portType === 'refinery' ? 2 : 0);
        addReason(reasons, extraction + nearby > 0, `feedstock access ${Math.round(extraction + nearby)}`);
        addReason(reasons, portType === 'refinery', 'refinery port bias');
    } else if (type === 'industrial_supplier') {
        score = demand * 1.8 + importPressure + exportPressure * 0.7 + routeAccess * 3 + (industrialInputs ? 1.5 : 0) + (industrialOutputs ? 1.2 : 0) + (portType === 'industrial' ? 2 : 0);
        addReason(reasons, industrialInputs, 'processed input access');
        addReason(reasons, industrialOutputs, 'manufacturing output bias');
    } else if (type === 'import_export') {
        score = (importPressure + exportPressure) * 1.2 + routeAccess * 4 + Math.min(importPressure, exportPressure) * 2;
        addReason(reasons, importPressure + exportPressure > 0, 'import/export pressure');
        addReason(reasons, routeAccess > 0.6, 'strong route access');
    } else if (type === 'haulage') {
        score = (importPressure + exportPressure) + routeAccess * 4 + Math.min(importPressure, exportPressure) * 1.5;
        addReason(reasons, routeAccess > 0.5, 'connected logistics position');
    } else if (type === 'ship_refitter') {
        score = routeAccess * 2 + demand + (stardock ? 3 : 0) + (industrialInputs ? 1 : 0);
        addReason(reasons, stardock, 'stardock refit bias');
    } else if (type === 'dockyard') {
        score = routeAccess * 2 + demand * 1.2 + (stardock ? 3 : 0) + (industrialInputs ? 1 : 0) + (industrialOutputs ? 1 : 0);
        addReason(reasons, stardock, 'stardock manufacturing bias');
    } else if (type === 'agri_collective') {
        score = (agriPlanet ? 5 : 0) + populationDemand * 1.5 + routeAccess + (hasAny(imports, ['water_ice', 'coolants', 'polymers']) ? 1.2 : 0);
        addReason(reasons, agriPlanet, 'agricultural output profile');
        addReason(reasons, populationDemand > 0, `population demand ${populationDemand.toFixed(1)}`);
    } else if (type === 'security_contractor') {
        score = hazard + pirateThreat * 0.7 + (1 - routeAccess) * 2 + (front ? 2 : 0) + badlands;
        addReason(reasons, pirateThreat > 0, `pirate threat ${pirateThreat}`);
        addReason(reasons, routeAccess < 0.5, 'low route access security demand');
    } else if (type === 'black_market_front') {
        score = (hiddenVc ? 7 : 0) + front * 5 + badlands * 2 + pirateThreat * 0.5 + (1 - routeAccess) * 2;
        addReason(reasons, hiddenVc, 'hidden VC/front faction');
        addReason(reasons, front, 'front sector');
        addReason(reasons, badlands, 'badlands cover');
    }

    const boundedScore = Math.max(0, score);
    return {
        type,
        score: boundedScore,
        count: boundedScore >= 0.75 ? Math.max(1, Math.min(3, Math.round(boundedScore / 4))) : 0,
        reasons: reasons.length > 0 ? reasons : [`route:${routeAccess.toFixed(2)}`, `extract:${Math.round(extraction)}`]
    };
}

export function scoreCompanyTypesForSector(sectorId) {
    return TYPES.map(type => scoreCompanyTypeForSector(sectorId, type))
        .sort((a, b) => b.score - a.score || a.type.localeCompare(b.type));
}

export function chooseCapacityBasedCompanyTypes(sectorId) {
    const profile = state.economy?.profilesBySector?.[sectorId] || {};
    const capacity = Math.max(1, Math.min(8, Math.round(num(profile.companyCapacity, 3))));
    const ranked = scoreCompanyTypesForSector(sectorId).filter(candidate => candidate.score > 0);
    const picks = [];
    ranked.forEach(candidate => {
        const remaining = capacity - picks.length;
        if (remaining <= 0) return;
        const count = Math.min(remaining, candidate.count);
        for (let index = 0; index < count; index += 1) picks.push(candidate.type);
    });
    if (picks.length === 0) picks.push('haulage');
    return picks;
}

export function explainCompanyScore(sectorId, type) {
    return scoreCompanyTypeForSector(sectorId, type);
}
