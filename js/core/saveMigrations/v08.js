import { isObject } from './helpers.js';

export function apply(data) {
    if (!isObject(data)) return data;
    if (!Array.isArray(data.tradeRoutes)) data.tradeRoutes = [];
    if (typeof data.nextTradeRouteId !== 'number' || data.nextTradeRouteId < 1) data.nextTradeRouteId = 1;
    return data;
}
