import { state } from '../../state.js';
import { PORT_DEFAULTS } from '../../config/worldgen.js';
import { makeStock } from '../../utils.js';
import { patchPort, patchSite } from '../../core/state/mutations.js';
import { getAsteroidExtractionPotential } from './extraction.js';

const PRODUCTION_RECIPES = Object.freeze({
    refined_metals: Object.freeze({ role: 'industrial', baseCapacity: 4, output: 1, inputs: Object.freeze({ ore: 1, heavy_metals: 1 }) }),
    polymers: Object.freeze({ role: 'industrial', baseCapacity: 3, output: 1, inputs: Object.freeze({ org: 1, water_ice: 1 }) }),
    coolants: Object.freeze({ role: 'refinery', baseCapacity: 3, output: 1, inputs: Object.freeze({ water_ice: 1, rare_earths: 1 }) }),
    fertilizer: Object.freeze({ role: 'industrial', baseCapacity: 2, output: 1, inputs: Object.freeze({ org: 1, water_ice: 1 }) }),
    electronics: Object.freeze({ role: 'industrial', baseCapacity: 3, output: 1, inputs: Object.freeze({ heavy_metals: 1, rare_earths: 1 }) }),
    machinery: Object.freeze({ role: 'industrial', baseCapacity: 2, output: 1, inputs: Object.freeze({ refined_metals: 1, electronics: 1 }) }),
    eq: Object.freeze({ role: 'stardock', baseCapacity: 2, output: 1, inputs: Object.freeze({ machinery: 1, electronics: 1 }) }),
    pulse_canister: Object.freeze({ role: 'refinery', baseCapacity: 2, output: 1, inputs: Object.freeze({ water_ice: 1, coolants: 1 }) }),
    repair_parts: Object.freeze({ role: 'industrial', baseCapacity: 2, output: 1, inputs: Object.freeze({ refined_metals: 1, polymers: 1 }) }),
    medical_supplies: Object.freeze({ role: 'industrial', baseCapacity: 2, output: 1, inputs: Object.freeze({ polymers: 1, water_ice: 1 }) }),
    construction_kits: Object.freeze({ role: 'stardock', baseCapacity: 1, output: 1, inputs: Object.freeze({ refined_metals: 1, machinery: 1 }) }),
    heavy_pulse_module: Object.freeze({ role: 'stardock', baseCapacity: 1, output: 1, inputs: Object.freeze({ pulse_canister: 1, machinery: 1 }) }),
    gate_coils: Object.freeze({ role: 'stardock', baseCapacity: 1, output: 1, inputs: Object.freeze({ heavy_metals: 1, electronics: 1 }) }),
    control_cores: Object.freeze({ role: 'industrial', baseCapacity: 1, output: 1, inputs: Object.freeze({ electronics: 1, rare_earths: 1 }) })
});

function roleMultiplier(profile, recipe) {
    const tags = profile.roleTags || [];
    if (tags.includes('port:stardock') && recipe.role === 'stardock') return 1;
    if ((tags.includes('port:way_station') || tags.includes('way_station')) && recipe.role === 'refinery') return 0.5;
    if (tags.includes('extractive') && recipe.role === 'industrial') return 0.4;
    return 0.25;
}


function getRecipeCapacity(profile, recipe) {
    const multiplier = roleMultiplier(profile, recipe);
    const scaledCapacity = recipe.baseCapacity * multiplier;
    if (scaledCapacity <= 0) return 0;
    const rounded = Math.floor(scaledCapacity);
    if (rounded > 0) return rounded;
    return 1;
}

function getCommodityCapacity(port, profile, commodity) {
    const explicit = Number(port?.maxStock?.[commodity]);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    const target = Number(profile?.targetStock?.[commodity]);
    if (Number.isFinite(target) && target > 0) return Math.max(1, target * 2);
    const fallback = Number(PORT_DEFAULTS.MAX_STOCK?.[commodity]);
    if (Number.isFinite(fallback) && fallback > 0) return fallback;
    return Math.max(1, Number(port?.stock?.[commodity]) || 0);
}

export function applyDailyProduction() {
    const summary = { produced: makeStock(), productionBySector: {} };
    Object.entries(state.economy?.profilesBySector || {}).forEach(([sectorId, profile]) => {
        const port = state.ports?.[sectorId];
        const site = state.universe?.[sectorId];
        if (!port || !site) return;
        if (!port.stock) port.stock = {};
        const extraction = getAsteroidExtractionPotential(site);
        const updatedStock = { ...port.stock };
        let extractedReserveDraw = 0;
        let stockChanged = false;
        if (!summary.productionBySector[sectorId]) summary.productionBySector[sectorId] = {};
        Object.entries(extraction).forEach(([commodity, amount]) => {
            const max = getCommodityCapacity(port, profile, commodity);
            const current = Math.max(0, updatedStock?.[commodity] || 0);
            const add = Math.min(Math.max(0, amount), Math.max(0, max - current));
            if (add > 0) {
                updatedStock[commodity] = current + add;
                summary.produced[commodity] = (summary.produced[commodity] || 0) + add;
                summary.productionBySector[sectorId][commodity] = (summary.productionBySector[sectorId][commodity] || 0) + add;
                if (['ore', 'heavy_metals', 'rare_earths', 'water_ice'].includes(commodity)) extractedReserveDraw += add;
                stockChanged = true;
            }
        });
        if (site.asteroids && extractedReserveDraw > 0) {
            patchSite(sectorId, {
                asteroids: {
                    ...site.asteroids,
                    ore: Math.max(0, Number(site.asteroids.ore || 0) - extractedReserveDraw)
                }
            });
        }
        Object.entries(PRODUCTION_RECIPES).forEach(([commodity, recipe]) => {
            const capacity = getRecipeCapacity(profile, recipe);
            if (capacity <= 0) return;
            let maxByInput = capacity;
            Object.entries(recipe.inputs).forEach(([input, amountPerUnit]) => {
                const current = Math.max(0, updatedStock?.[input] || 0);
                maxByInput = Math.min(maxByInput, Math.floor(current / amountPerUnit));
            });
            const max = getCommodityCapacity(port, profile, commodity);
            const current = Math.max(0, updatedStock?.[commodity] || 0);
            const outputCapacity = Math.max(0, max - current);
            if (outputCapacity <= 0) return;
            const outputUnits = Math.min(Math.max(0, maxByInput), Math.floor(outputCapacity / recipe.output));
            if (outputUnits <= 0) return;
            Object.entries(recipe.inputs).forEach(([input, amountPerUnit]) => {
                updatedStock[input] = Math.max(0, (updatedStock[input] || 0) - outputUnits * amountPerUnit);
            });
            const produced = Math.min(outputUnits * recipe.output, outputCapacity);
            updatedStock[commodity] = current + produced;
            summary.produced[commodity] = (summary.produced[commodity] || 0) + produced;
            summary.productionBySector[sectorId][commodity] = (summary.productionBySector[sectorId][commodity] || 0) + produced;
            stockChanged = true;
        });
        if (stockChanged) patchPort(sectorId, { stock: updatedStock });
    });
    state.economy.dailySummary = { ...(state.economy.dailySummary || {}), day: state.player?.time?.day ?? null, production: summary };
    return summary;
}
