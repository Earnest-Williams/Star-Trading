import { state } from '../../state.js';
import { BALANCE, MARKET_COMMODITIES } from '../../constants.js';

function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function recomputeEconomyPressure() {
    if (!state.economy) return {};
    const pressureBySector = {};
    Object.entries(state.economy?.profilesBySector || {}).forEach(([sectorId, profile]) => {
        const port = state.ports?.[sectorId] || state.planets?.[sectorId] || {};
        const sectorPressure = {};
        MARKET_COMMODITIES.forEach((commodity) => {
            const maxStock = Math.max(1, toNumber(port?.maxStock?.[commodity], 1));
            const stock = clamp(toNumber(port?.stock?.[commodity], 0), 0, maxStock);
            const stockRatio = stock / maxStock;
            const shortageSeverity = clamp((BALANCE.ECONOMY.TARGET_STOCK_RATIO - stockRatio) / BALANCE.ECONOMY.TARGET_STOCK_RATIO, 0, 1);
            const surplusSeverity = clamp((stockRatio - BALANCE.ECONOMY.TARGET_STOCK_RATIO) / (1 - BALANCE.ECONOMY.TARGET_STOCK_RATIO), 0, 1);
            const pricePressure = clamp(
                1 + shortageSeverity * BALANCE.ECONOMY.SHORTAGE_PRICE_MULTIPLIER - surplusSeverity * BALANCE.ECONOMY.SURPLUS_PRICE_DISCOUNT,
                BALANCE.MARKET.PRESSURE_PRICE_MIN,
                BALANCE.MARKET.PRESSURE_PRICE_MAX
            );
            const targetStock = Math.max(1, Number(profile?.targetStock?.[commodity] || maxStock * BALANCE.ECONOMY.TARGET_STOCK_RATIO));
            const currentStock = stock;
            const dailyConsumption = Math.max(0, Number(profile?.baselineConsumption?.[commodity] || 0) + Number(profile?.industrialConsumption?.[commodity] || 0));
            const dailyProduction = Math.max(0, Number(state.economy?.dailySummary?.production?.produced?.[commodity] || 0));
            const unmetDemand = Math.max(0, dailyConsumption - currentStock);
            const surplus = Math.max(0, currentStock - targetStock);
            sectorPressure[commodity] = { targetStock, currentStock, dailyConsumption, dailyProduction, unmetDemand, surplus, shortageSeverity, surplusSeverity, pricePressure, stockRatio, routeAccess: Number(profile?.routeDependence || 0), lastUpdatedDay: state.player?.time?.day ?? null };
        });
        pressureBySector[sectorId] = sectorPressure;
    });
    state.economy.pressureBySector = pressureBySector;
    state.economy.lastPressureDay = state.player?.time?.day ?? null;
    return pressureBySector;
}
