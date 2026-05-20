import { state } from '../../state.js';
import { MARKET_COMMODITIES } from '../../constants.js';
import { patchPort } from '../../core/state/mutations.js';

const BASELINE_CONSUMPTION = Object.freeze({
    water_ice: 2,
    org: 2,
    medical_supplies: 1,
    repair_parts: 1
});

const ROLE_CONSUMPTION = Object.freeze({
    'port:stardock': Object.freeze({ eq: 1, electronics: 1, repair_parts: 2, construction_kits: 1 }),
    way_station: Object.freeze({ pulse_canister: 1, repair_parts: 1 }),
    'port:way_station': Object.freeze({ pulse_canister: 1, repair_parts: 1 }),
    extractive: Object.freeze({ repair_parts: 2, pulse_canister: 1 })
});

function asNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

export function applyDailyConsumption() {
    const summary = { consumed: {}, unmetDemand: {}, sectorsWithShortage: 0 };
    MARKET_COMMODITIES.forEach((commodity) => {
        summary.consumed[commodity] = 0;
        summary.unmetDemand[commodity] = 0;
    });
    Object.entries(state.economy?.profilesBySector || {}).forEach(([sectorId, profile]) => {
        const port = state.ports?.[sectorId];
        if (!port) return;
        if (!port.stock) port.stock = {};
        let hadShortage = false;
        const needs = { ...BASELINE_CONSUMPTION };
        (profile.roleTags || []).forEach((tag) => {
            const roleNeed = ROLE_CONSUMPTION[tag];
            if (!roleNeed) return;
            Object.entries(roleNeed).forEach(([commodity, amount]) => {
                needs[commodity] = (needs[commodity] || 0) + amount;
            });
        });
        const updatedStock = { ...port.stock };
        Object.entries(needs).forEach(([commodity, dailyNeed]) => {
            const need = Math.max(0, asNumber(dailyNeed));
            const available = Math.max(0, asNumber(updatedStock?.[commodity]));
            const consumed = Math.min(available, need);
            const unmet = Math.max(0, need - consumed);
            updatedStock[commodity] = Math.max(0, available - consumed);
            summary.consumed[commodity] = (summary.consumed[commodity] || 0) + consumed;
            summary.unmetDemand[commodity] = (summary.unmetDemand[commodity] || 0) + unmet;
            if (unmet > 0) hadShortage = true;
        });
        patchPort(sectorId, { stock: updatedStock });
        if (hadShortage) summary.sectorsWithShortage += 1;
    });
    state.economy.dailySummary = { ...(state.economy.dailySummary || {}), day: state.player?.time?.day ?? null, consumption: summary };
    return summary;
}
