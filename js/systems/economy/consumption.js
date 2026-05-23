import { state } from '../../state.js';
import { MARKET_COMMODITIES } from '../../constants.js';
import { patchPort, patchPlanet } from '../../core/state/mutations.js';
import { getEconomyNodes } from './nodeAdapter.js';

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

function getNodePriority(nodeRef) {
    const nodeKind = nodeRef?.kind;
    if (nodeKind === 'planet') return 0;
    if (nodeKind === 'port') return 1;
    return 2;
}

export function applyDailyConsumption() {
    const summary = { consumed: {}, unmetDemand: {}, consumedBySector: {}, unmetDemandBySector: {}, sectorsWithShortage: 0 };
    MARKET_COMMODITIES.forEach((commodity) => { summary.consumed[commodity] = 0; summary.unmetDemand[commodity] = 0; });
    Object.entries(state.economy?.profilesBySector || {}).forEach(([sectorId, profile]) => {
        const nodeRefs = getEconomyNodes(sectorId);
        if (!nodeRefs.length) return;
        const needs = mergeNeeds(profile.baselineConsumption, profile.industrialConsumption, profile.serviceConsumption);
        const sectorConsumed = {};
        const sectorUnmet = {};
        let hadShortage = false;
        const pendingNeeds = {};
        Object.entries(needs).forEach(([commodity, dailyNeed]) => {
            pendingNeeds[commodity] = Math.max(0, asNumber(dailyNeed));
        });
        const sortedNodeRefs = nodeRefs.slice().sort((a, b) => {
            const kindDelta = getNodePriority(a) - getNodePriority(b);
            if (kindDelta !== 0) return kindDelta;
            const aSector = Number(a?.sectorId ?? sectorId);
            const bSector = Number(b?.sectorId ?? sectorId);
            return aSector - bSector;
        });
        sortedNodeRefs.forEach((nodeRef) => {
            const node = nodeRef.node;
            if (!node.stock) node.stock = {};
            const updatedStock = { ...node.stock };
            let stockChanged = false;
            Object.keys(pendingNeeds).forEach((commodity) => {
                const remainingNeed = Math.max(0, asNumber(pendingNeeds[commodity]));
                if (remainingNeed <= 0) return;
                const available = Math.max(0, asNumber(updatedStock[commodity]));
                const consumed = Math.min(available, remainingNeed);
                if (consumed <= 0) return;
                updatedStock[commodity] = Math.max(0, available - consumed);
                pendingNeeds[commodity] = Math.max(0, remainingNeed - consumed);
                summary.consumed[commodity] = (summary.consumed[commodity] || 0) + consumed;
                sectorConsumed[commodity] = (sectorConsumed[commodity] || 0) + consumed;
                stockChanged = true;
            });
            if (stockChanged) {
                if (nodeRef.kind === 'port') patchPort(sectorId, { stock: updatedStock });
                else if (nodeRef.kind === 'planet') patchPlanet(sectorId, { stock: updatedStock });
                else node.stock = updatedStock;
            }
        });
        Object.entries(pendingNeeds).forEach(([commodity, remainingNeed]) => {
            const unmet = Math.max(0, asNumber(remainingNeed));
            summary.unmetDemand[commodity] = (summary.unmetDemand[commodity] || 0) + unmet;
            sectorUnmet[commodity] = (sectorUnmet[commodity] || 0) + unmet;
            if (unmet > 0) hadShortage = true;
        });
        summary.consumedBySector[sectorId] = sectorConsumed;
        summary.unmetDemandBySector[sectorId] = sectorUnmet;
        if (hadShortage) summary.sectorsWithShortage += 1;
    });
    state.economy.dailySummary = { ...(state.economy.dailySummary || {}), day: state.player?.time?.day ?? null, consumption: summary };
    return summary;
}
