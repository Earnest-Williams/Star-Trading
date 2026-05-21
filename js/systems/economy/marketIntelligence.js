import { state } from '../../state.js';
import { getFreshnessSummaryForSector } from '../../core/dataCargo/implementation.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const num = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

function buildPrimaryCauses(record) {
    if (Array.isArray(record.causes) && record.causes.length > 0) return record.causes;
    const primaryCause = String(record.primaryCause || '').trim();
    return [primaryCause || 'No dominant cause telemetry.'];
}

export function getMarketInformationQuality(actorContext, sectorId){
    const acumen = num(actorContext?.acumen, actorContext?.character?.acumen || 0);
    const tradecraft = num(actorContext?.tradecraft, actorContext?.character?.tradecraft || 0);
    const standing = num(actorContext?.factionStanding, 0);
    const freshness = getFreshnessSummaryForSector(sectorId);
    const freshnessScore = freshness.label === 'current'
        ? 1
        : freshness.label === 'fresh'
            ? 0.75
            : freshness.label === 'stale'
                ? 0.45
                : freshness.known
                    ? 0.3
                    : 0.1;
    const skillScore = clamp((acumen + tradecraft) / 200 + standing / 300, 0, 1);
    const localVisibilityBonus = Number(actorContext?.currentSector) === Number(sectorId) ? 0.2 : 0;
    const score = clamp(skillScore * 0.65 + freshnessScore * 0.35 + localVisibilityBonus, 0, 1);
    const tier = score >= 0.72 ? 'high' : score >= 0.42 ? 'medium' : 'low';
    return { score, tier, freshness: freshness.label, known: freshness.known };
}

export function getDisplayedMarketSignal(sectorId, commodity, actorContext, options={}){
    const q = getMarketInformationQuality(actorContext, sectorId);
    const s = state.economy?.pressureBySector?.[sectorId]?.[commodity] || {};
    if (q.tier === 'high') {
        const dailyConsumption = num(s.dailyConsumption ?? s.dailyDemand);
        const causes = buildPrimaryCauses(s);
        return {
            quality: q,
            stock: num(s.currentStock),
            target: num(s.targetStock),
            dailyDemand: dailyConsumption,
            dailyConsumption,
            dailyProduction: num(s.dailyProduction),
            shortageSeverity: num(s.shortageSeverity),
            surplusSeverity: num(s.surplusSeverity),
            confidence: num(s.confidence, q.score),
            causes,
            primaryCause: causes[0],
            intelPrompt: null
        };
    }
    if (q.tier === 'medium') {
        return {
            quality: q,
            stockBand: Math.round(num(s.currentStock) / 10) * 10,
            targetBand: Math.round(num(s.targetStock) / 10) * 10,
            dailyUseBand: Math.round(num(s.dailyDemand ?? s.dailyConsumption) / 5) * 5,
            causes: ['market pressure trend'],
            intelPrompt: null
        };
    }
    return {
        quality: q,
        label: num(s.shortageSeverity) > 0.5 ? 'shortage risk' : 'volatile',
        causes: ['insufficient telemetry'],
        intelPrompt: 'Gather intel for precise market telemetry.'
    };
}

export function getDisplayedSupplierSignals(sectorId, commodity, actorContext, options={}){
    const q = getMarketInformationQuality(actorContext, sectorId);
    const rows = Object.entries(state.economy?.pressureBySector || {})
        .filter(([sid, pressure]) => Number(sid) !== Number(sectorId)
            && num(pressure?.[commodity]?.surplus) > 0)
        .map(([sid, pressure]) => ({
            sectorId: Number(sid),
            surplus: num(pressure?.[commodity]?.surplus),
            routeAccess: num(pressure?.[commodity]?.routeAccess, 0),
            confidence: num(pressure?.[commodity]?.confidence, 0)
        }))
        .sort((a, b) => b.surplus - a.surplus)
        .slice(0, 3);
    return rows.map((row) => q.tier === 'high'
        ? row
        : q.tier === 'medium'
            ? { ...row, surplus: Math.round(row.surplus / 10) * 10, confidenceLabel: row.confidence > 0.7 ? 'high' : 'medium' }
            : { sectorId: row.sectorId, label: 'possible supplier', confidenceLabel: 'low' });
}

export function formatMarketIntelligenceQuality(quality) {
    return `${quality.tier} (${Math.round(quality.score * 100)}%)`;
}
