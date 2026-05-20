import { state } from '../../state.js';
import { BALANCE } from '../../constants.js';
import { PORT_DEFAULTS } from '../../config/worldgen.js';

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function toFiniteNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveBasePrice(port, commodity) {
    const portBase = port?.basePrices?.[commodity];
    if (typeof portBase === 'number' && Number.isFinite(portBase) && portBase > 0) {
        return portBase;
    }
    const fallbackBase = PORT_DEFAULTS.BASE_PRICES?.[commodity];
    if (typeof fallbackBase === 'number' && Number.isFinite(fallbackBase) && fallbackBase > 0) {
        return fallbackBase;
    }
    return BALANCE.MIN_TRADE_PRICE;
}

function getStockRatio(port, commodity) {
    const stock = Math.max(0, toFiniteNumber(port?.stock?.[commodity], 0));
    const maxStock = Math.max(1, toFiniteNumber(port?.maxStock?.[commodity], 1));
    return clamp(stock / maxStock, 0, 1);
}

function getPressureMultiplier(port, sectorId, commodity, mode) {
    const pressureRecord = sectorId === null ? null : state.economy?.pressureBySector?.[sectorId]?.[commodity];
    const stockRatio = getStockRatio(port, commodity);
    if (!pressureRecord || typeof pressureRecord !== 'object') {
        return mode === 'buy'
            ? BALANCE.MARKET.BUY_PRICE_BASE_MULTIPLIER
                + (1 - stockRatio) * BALANCE.MARKET.BUY_PRICE_SCARCITY_MULTIPLIER
            : BALANCE.MARKET.SELL_PRICE_BASE_MULTIPLIER
                + (1 - stockRatio) * BALANCE.MARKET.SELL_PRICE_SCARCITY_MULTIPLIER;
    }

    const shortageSeverity = clamp(toFiniteNumber(pressureRecord.shortageSeverity, 0), 0, 1);
    const surplusSeverity = clamp(toFiniteNumber(pressureRecord.surplusSeverity, 0), 0, 1);
    const shortagePressure = clamp(
        toFiniteNumber(pressureRecord.pricePressure, 1),
        BALANCE.MARKET.PRESSURE_PRICE_MIN,
        BALANCE.MARKET.PRESSURE_PRICE_MAX
    );

    if (mode === 'buy') {
        return clamp(
            BALANCE.MARKET.BUY_PRICE_BASE_MULTIPLIER
                + shortageSeverity * BALANCE.MARKET.BUY_PRICE_SCARCITY_MULTIPLIER
                - surplusSeverity * BALANCE.MARKET.BUY_SURPLUS_SEVERITY_DISCOUNT
                + (shortagePressure - 1) * BALANCE.MARKET.BUY_PRESSURE_EFFECT_MULTIPLIER,
            BALANCE.MARKET.BUY_PRICE_BASE_MULTIPLIER * BALANCE.MARKET.PRESSURE_MULTIPLIER_MIN_FACTOR,
            BALANCE.MARKET.BUY_PRICE_BASE_MULTIPLIER + BALANCE.MARKET.BUY_PRICE_SCARCITY_MULTIPLIER
        );
    }

    return clamp(
        BALANCE.MARKET.SELL_PRICE_BASE_MULTIPLIER
            + shortageSeverity * BALANCE.MARKET.SELL_PRICE_SCARCITY_MULTIPLIER
            - surplusSeverity * BALANCE.MARKET.SELL_SURPLUS_SEVERITY_DISCOUNT
            + (shortagePressure - 1) * BALANCE.MARKET.SELL_PRESSURE_EFFECT_MULTIPLIER,
        BALANCE.MARKET.SELL_PRICE_BASE_MULTIPLIER * BALANCE.MARKET.PRESSURE_MULTIPLIER_MIN_FACTOR,
        BALANCE.MARKET.SELL_PRICE_BASE_MULTIPLIER + BALANCE.MARKET.SELL_PRICE_SCARCITY_MULTIPLIER
    );
}

export function getSpotPrice(port, sectorId, commodity, mode) {
    const base = resolveBasePrice(port, commodity);
    const multiplier = getPressureMultiplier(port, sectorId, commodity, mode);
    return Math.max(BALANCE.MIN_TRADE_PRICE, Math.round(base * multiplier));
}

export function getSpotPriceForSector(sectorId, commodity, mode) {
    const node = state.ports?.[sectorId] || state.planets?.[sectorId] || null;
    return getSpotPrice(node, sectorId, commodity, mode);
}

export function getExpectedRouteValue(originSector, destinationSector, commodity, amount) {
    const normalizedAmount = Math.max(0, toFiniteNumber(amount, 0));
    const buyPrice = getSpotPriceForSector(originSector, commodity, 'buy');
    const sellPrice = getSpotPriceForSector(destinationSector, commodity, 'sell');
    const spread = Math.max(BALANCE.TRADE_ROUTE.PROFIT_SPREAD_FLOOR, sellPrice - buyPrice);
    const expectedProfit = Math.max(
        BALANCE.TRADE_ROUTE.PROFIT_FLOOR,
        Math.floor(spread * normalizedAmount * BALANCE.TRADE_ROUTE.PROFIT_MULTIPLIER)
    );
    return {
        buyPrice,
        sellPrice,
        spread,
        expectedProfit
    };
}
