import { state } from '../../state.js';
import { makeStock } from '../../utils.js';
import { getAsteroidExtractionPotential } from './extraction.js';

const PRODUCTION_RECIPES = Object.freeze({
    heavy_metals: Object.freeze({ role: 'industrial', baseCapacity: 4, output: 1, inputs: Object.freeze({ ore: 2 }) }),
    electronics: Object.freeze({ role: 'industrial', baseCapacity: 3, output: 1, inputs: Object.freeze({ heavy_metals: 1, rare_earths: 1 }) }),
    eq: Object.freeze({ role: 'stardock', baseCapacity: 2, output: 1, inputs: Object.freeze({ heavy_metals: 1, electronics: 1 }) }),
    pulse_canister: Object.freeze({ role: 'refinery', baseCapacity: 2, output: 1, inputs: Object.freeze({ water_ice: 2 }) })
});

function roleMultiplier(profile, recipe) {
    const tags = profile.roleTags || [];
    if (tags.includes('port:stardock') && recipe.role === 'stardock') return 1;
    if (tags.includes('port:way_station') && recipe.role === 'refinery') return 0.5;
    if (tags.includes('extractive') && recipe.role === 'industrial') return 0.4;
    return 0.25;
}

export function applyDailyProduction() {
    const summary = { produced: makeStock() };
    Object.entries(state.economy?.profilesBySector || {}).forEach(([sectorId, profile]) => {
        const port = state.ports?.[sectorId];
        const site = state.universe?.[sectorId];
        if (!port || !site) return;
        if (!port.stock) port.stock = {};
        const extraction = getAsteroidExtractionPotential(site);
        Object.entries(extraction).forEach(([commodity, amount]) => {
            const max = Math.max(0, port.maxStock?.[commodity] || 0);
            const current = Math.max(0, port.stock?.[commodity] || 0);
            const add = Math.min(Math.max(0, amount), Math.max(0, max - current));
            port.stock[commodity] = current + add;
            summary.produced[commodity] = (summary.produced[commodity] || 0) + add;
        });
        Object.entries(PRODUCTION_RECIPES).forEach(([commodity, recipe]) => {
            const capacity = Math.floor(recipe.baseCapacity * roleMultiplier(profile, recipe));
            if (capacity <= 0) return;
            let maxByInput = capacity;
            Object.entries(recipe.inputs).forEach(([input, amountPerUnit]) => {
                const current = Math.max(0, port.stock?.[input] || 0);
                maxByInput = Math.min(maxByInput, Math.floor(current / amountPerUnit));
            });
            const outputUnits = Math.max(0, maxByInput);
            if (outputUnits <= 0) return;
            Object.entries(recipe.inputs).forEach(([input, amountPerUnit]) => {
                port.stock[input] = Math.max(0, (port.stock[input] || 0) - outputUnits * amountPerUnit);
            });
            const max = Math.max(0, port.maxStock?.[commodity] || 0);
            const current = Math.max(0, port.stock?.[commodity] || 0);
            const produced = Math.min(outputUnits * recipe.output, Math.max(0, max - current));
            port.stock[commodity] = current + produced;
            summary.produced[commodity] = (summary.produced[commodity] || 0) + produced;
        });
    });
    state.economy.dailySummary = { ...(state.economy.dailySummary || {}), day: state.player?.time?.day ?? null, production: summary };
    return summary;
}
