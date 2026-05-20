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
    Object.entries(state.ports || {}).forEach(([sectorId, port]) => {
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
            sectorPressure[commodity] = { shortageSeverity, surplusSeverity, pricePressure, stockRatio };
        });
        pressureBySector[sectorId] = sectorPressure;
    });
    state.economy.pressureBySector = pressureBySector;
    state.economy.lastPressureDay = state.player?.time?.day ?? null;
    return pressureBySector;
}
