import { BALANCE } from '../../constants.js';
import { makeStock } from '../../utils.js';

function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function getAsteroidExtractionPotential(site) {
    if (!site?.asteroids) return makeStock();
    const ore = toNumber(site.asteroids.ore, 0);
    const richness = toNumber(site.asteroids.richness, 0);
    const hazard = toNumber(site.asteroids.hazard, 0);
    const capacity = Math.max(0, ore * (1 + richness) * Math.max(0.45, 1 - hazard * 0.12));
    const dailyBase = Math.floor(capacity * BALANCE.ECONOMY.EXTRACTION_SCALE);
    if (dailyBase <= 0) return makeStock();
    return makeStock({
        ore: Math.max(1, Math.floor(dailyBase * 0.7)),
        heavy_metals: Math.floor(dailyBase * 0.2),
        rare_earths: Math.floor(dailyBase * 0.04),
        water_ice: Math.floor(dailyBase * 0.06)
    });
}
