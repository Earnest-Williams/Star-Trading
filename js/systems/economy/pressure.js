import { state } from '../../state.js';
import { BALANCE, MARKET_COMMODITIES } from '../../constants.js';
import { recomputeSpatialPrices } from './spatialPrices.js';
import { getEconomyNodes } from './nodeAdapter.js';

function toNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

const SHORTAGE_SEVERITY_THRESHOLD = 0.45;

function profileDailyConsumption(profile, commodity) {
    return (Number(profile?.baselineConsumption?.[commodity]) || 0)
        + (Number(profile?.industrialConsumption?.[commodity]) || 0)
        + (Number(profile?.serviceConsumption?.[commodity]) || 0);
}

function getEffectiveMaxStock(node, profile, commodity) {
    const explicit = toNumber(node?.maxStock?.[commodity], 0);
    if (explicit > 0) return explicit;
    const target = toNumber(profile?.targetStock?.[commodity], 0);
    if (target > 0) return Math.max(1, target * 2);
    return Math.max(1, toNumber(node?.stock?.[commodity], 0));
}

function explainPressure(profile, commodity, record) {
    if (record.unmetDemand > 0) return `${commodity} demand is not fully met.`;
    if (record.shortageSeverity > SHORTAGE_SEVERITY_THRESHOLD && profileDailyConsumption(profile, commodity) > 0)
        return `${commodity} stock is below target and local demand is persistent.`;
    if (record.surplus > 0) return `${commodity} stock is above local target; export pressure is likely.`;
    return `${commodity} is near local target.`;
}

export function recomputeEconomyPressure() {
    if (!state.economy) return {};
    const pressureBySector = {};
    Object.entries(state.economy?.profilesBySector || {}).forEach(([sectorId, profile]) => {
        const nodeRefs = getEconomyNodes(sectorId);
        const sectorPressure = {};
        MARKET_COMMODITIES.forEach((commodity) => {
            let maxStock = 0;
            let currentStock = 0;
            nodeRefs.forEach((nodeRef) => {
                const nodeMax = getEffectiveMaxStock(nodeRef.node, profile, commodity);
                maxStock += nodeMax;
                currentStock += clamp(toNumber(nodeRef.node?.stock?.[commodity], 0), 0, nodeMax);
            });
            const fallbackTarget = Math.max(1, maxStock * BALANCE.ECONOMY.TARGET_STOCK_RATIO);
            const targetStock = Math.max(1, Number(profile?.targetStock?.[commodity] || fallbackTarget));
            const stockRatio = currentStock / targetStock;
            const shortageSeverity = clamp(1 - stockRatio, 0, 1);
            const surplusSeverity = clamp(stockRatio - 1, 0, 1);
            const pricePressure = clamp(
                1 + shortageSeverity * BALANCE.ECONOMY.SHORTAGE_PRICE_MULTIPLIER - surplusSeverity * BALANCE.ECONOMY.SURPLUS_PRICE_DISCOUNT,
                BALANCE.MARKET.PRESSURE_PRICE_MIN,
                BALANCE.MARKET.PRESSURE_PRICE_MAX
            );
            const profileConsumption = profileDailyConsumption(profile, commodity);
            const consumedToday = Number(state.economy?.dailySummary?.consumption?.consumedBySector?.[sectorId]?.[commodity] || 0);
            const unmetToday = Number(state.economy?.dailySummary?.consumption?.unmetDemandBySector?.[sectorId]?.[commodity] || 0);
            const dailyConsumption = Math.max(0, profileConsumption, consumedToday + unmetToday);
            const dailyProduction = Math.max(0, Number(state.economy?.dailySummary?.production?.productionBySector?.[sectorId]?.[commodity] || 0));
            const unmetDemand = Math.max(0, unmetToday, dailyConsumption - currentStock);
            const surplus = Math.max(0, currentStock - targetStock);
            const signalMagnitude = Math.max(shortageSeverity, surplusSeverity);
            const throughputRatio = clamp((dailyConsumption + dailyProduction) / Math.max(1, targetStock), 0, 1);
            const confidence = clamp(0.25 + signalMagnitude * 0.5 + throughputRatio * 0.25, 0, 1);
            const routeAccess = clamp(Number(profile?.routeAccess ?? (1 - Number(profile?.routeDependence || 0))), 0, 1);
            const record = { targetStock, currentStock, dailyConsumption, dailyDemand: dailyConsumption, dailyProduction, unmetDemand, surplus, shortageSeverity, surplusSeverity, confidence, pricePressure, stockRatio, routeAccess, lastUpdatedDay: state.player?.time?.day ?? null };
            record.primaryCause = explainPressure(profile, commodity, record);
            sectorPressure[commodity] = record;
        });
        pressureBySector[sectorId] = sectorPressure;
    });
    state.economy.pressureBySector = pressureBySector;
    state.economy.lastPressureDay = state.player?.time?.day ?? null;
    recomputeSpatialPrices();
    return pressureBySector;
}
