import { state } from '../../state.js';
import { MARKET_COMMODITIES } from '../../constants.js';
import { patchPort, patchPlanet } from '../../core/state/mutations.js';

const POPULATION_BASELINES = Object.freeze({
    0: Object.freeze({}),
    1: Object.freeze({ water_ice: 1, org: 1, repair_parts: 1 }),
    2: Object.freeze({ water_ice: 2, org: 2, repair_parts: 1, medical_supplies: 1 }),
    3: Object.freeze({ water_ice: 3, org: 3, repair_parts: 2, medical_supplies: 1, pulse_canister: 1 }),
    4: Object.freeze({ water_ice: 4, org: 3, repair_parts: 2, medical_supplies: 2, electronics: 1, pulse_canister: 1 }),
    5: Object.freeze({ water_ice: 5, org: 4, repair_parts: 3, medical_supplies: 2, electronics: 2, eq: 1, pulse_canister: 2 })
});

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
        const port = state.ports?.[sectorId];
        const planet = state.planets?.[sectorId];
        if (!port && !planet) return;
        const baseline = POPULATION_BASELINES[profile.populationTier || 0] || {};
        const needs = mergeNeeds(baseline, profile.industrialConsumption, profile.serviceConsumption);
        const sectorConsumed = {};
        const sectorUnmet = {};
        let hadShortage = false;
        const processNode = (node, isPort) => {
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
                if (isPort) patchPort(sectorId, { stock: updatedStock }); else patchPlanet(sectorId, { stock: updatedStock });
            }
        };
        if (port) processNode(port, true);
        if (planet) processNode(planet, false);
        summary.consumedBySector[sectorId] = sectorConsumed;
        summary.unmetDemandBySector[sectorId] = sectorUnmet;
        if (hadShortage) summary.sectorsWithShortage += 1;
    });
    state.economy.dailySummary = { ...(state.economy.dailySummary || {}), day: state.player?.time?.day ?? null, consumption: summary };
    return summary;
}
