import { state } from '../../state.js';
import { MARKET_COMMODITIES } from '../../constants.js';
import { patchPort, patchPlanet } from '../../core/state/mutations.js';
import { getEconomyNode } from './nodeAdapter.js';

function asNumber(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }

function mergeNeeds(...sources) {
    const merged = {};
    sources.forEach((source) => {
        if (!source || typeof source !== 'object') return;
        Object.entries(source).forEach(([commodity, amount]) => {
            merged[commodity] = (merged[commodity] || 0) + asNumber(amount);
        });
    });
    return merged;
}

export function applyDailyConsumption() {
    const summary = { consumed: {}, unmetDemand: {}, consumedBySector: {}, unmetDemandBySector: {}, sectorsWithShortage: 0 };
    MARKET_COMMODITIES.forEach((commodity) => { summary.consumed[commodity] = 0; summary.unmetDemand[commodity] = 0; });
    Object.entries(state.economy?.profilesBySector || {}).forEach(([sectorId, profile]) => {
        const nodeRef = getEconomyNode(sectorId);
        if (!nodeRef) return;
        const needs = mergeNeeds(profile.baselineConsumption, profile.industrialConsumption, profile.serviceConsumption);
        const sectorConsumed = {};
        const sectorUnmet = {};
        let hadShortage = false;
        const node = nodeRef.node;
        if (!node.stock) node.stock = {};
        const updatedStock = { ...node.stock };
        let stockChanged = false;
        Object.entries(needs).forEach(([commodity, dailyNeed]) => {
            const need = Math.max(0, asNumber(dailyNeed));
            const available = Math.max(0, asNumber(updatedStock[commodity]));
            const consumed = Math.min(available, need);
            const unmet = Math.max(0, need - consumed);
            if (consumed > 0) {
                updatedStock[commodity] = Math.max(0, available - consumed);
                stockChanged = true;
            }
            summary.consumed[commodity] = (summary.consumed[commodity] || 0) + consumed;
            summary.unmetDemand[commodity] = (summary.unmetDemand[commodity] || 0) + unmet;
            sectorConsumed[commodity] = (sectorConsumed[commodity] || 0) + consumed;
            sectorUnmet[commodity] = (sectorUnmet[commodity] || 0) + unmet;
            if (unmet > 0) hadShortage = true;
        });
        if (stockChanged) {
            if (nodeRef.kind === 'port') patchPort(sectorId, { stock: updatedStock });
            else if (nodeRef.kind === 'planet') patchPlanet(sectorId, { stock: updatedStock });
            else node.stock = updatedStock;
        }
        summary.consumedBySector[sectorId] = sectorConsumed;
        summary.unmetDemandBySector[sectorId] = sectorUnmet;
        if (hadShortage) summary.sectorsWithShortage += 1;
    });
    state.economy.dailySummary = { ...(state.economy.dailySummary || {}), day: state.player?.time?.day ?? null, consumption: summary };
    return summary;
}
