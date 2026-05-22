import { MARKET_COMMODITIES } from '../../js/constants.js';

export function makeCommodityMap(factory) {
    const buildValue = typeof factory === 'function' ? factory : () => factory;
    const map = {};
    MARKET_COMMODITIES.forEach((commodity) => {
        map[commodity] = buildValue(commodity);
    });
    return map;
}

export function makeAmbientTradeSummary(overrides = {}) {
    const base = {
        day: 0,
        flows: 0,
        moved: makeCommodityMap(() => 0),
        residualDemand: makeCommodityMap(() => 0),
        blockedUnits: makeCommodityMap(() => 0),
        attemptedDemand: makeCommodityMap(() => 0),
        blockedByReason: {
            disconnected: makeCommodityMap(() => 0),
            unprofitable: makeCommodityMap(() => 0),
            highRisk: makeCommodityMap(() => 0)
        }
    };

    return {
        ...base,
        ...overrides,
        moved: { ...base.moved, ...(overrides.moved || {}) },
        residualDemand: { ...base.residualDemand, ...(overrides.residualDemand || {}) },
        blockedUnits: { ...base.blockedUnits, ...(overrides.blockedUnits || {}) },
        attemptedDemand: { ...base.attemptedDemand, ...(overrides.attemptedDemand || {}) },
        blockedByReason: {
            disconnected: {
                ...base.blockedByReason.disconnected,
                ...(overrides.blockedByReason?.disconnected || {})
            },
            unprofitable: {
                ...base.blockedByReason.unprofitable,
                ...(overrides.blockedByReason?.unprofitable || {})
            },
            highRisk: {
                ...base.blockedByReason.highRisk,
                ...(overrides.blockedByReason?.highRisk || {})
            }
        }
    };
}
