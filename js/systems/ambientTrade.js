import { state } from '../state.js';
import { BALANCE, MARKET_COMMODITIES } from '../constants.js';
import { formatCommodity, makeStock, random } from '../utils.js';
import { getAllLogisticsNodes, getRouteMarketValue, deriveRouteMetrics } from './tradeRoutes.js';

function getNodePressureSignal(node, commodity) {
    return state.economy?.pressureBySector?.[node.sectorId]?.[commodity] || null;
}

function getNodeSurplus(node, commodity) {
    const signal = getNodePressureSignal(node, commodity);
    const maxStock = Math.max(1, node.maxStock?.[commodity] || 1);
    const stock = Math.max(0, node.stock?.[commodity] || 0);
    const fallbackSurplus = Math.max(0, Math.floor(stock - maxStock * 0.25));
    if (!signal) return fallbackSurplus;
    const shortageSeverity = Math.max(0, Number(signal.shortageSeverity || 0));
    const surplusBias = Math.max(0, 1 - shortageSeverity * 1.5);
    return Math.max(0, Math.floor((stock - maxStock * 0.25) * surplusBias));
}

function getNodeShortage(node, commodity) {
    const signal = getNodePressureSignal(node, commodity);
    const maxStock = Math.max(1, node.maxStock?.[commodity] || 1);
    const stock = Math.max(0, node.stock?.[commodity] || 0);
    if (!signal) return Math.max(0, Math.floor(maxStock * 0.62 - stock));
    const shortageSeverity = Math.max(0, Number(signal.shortageSeverity || 0));
    return Math.max(0, Math.floor(maxStock * shortageSeverity));
}

function isProfitableAmbientFlow(source, sink, commodity) {
    const buy = getRouteMarketValue(source.sectorId, commodity, 'buy');
    const sell = getRouteMarketValue(sink.sectorId, commodity, 'sell');
    return sell - buy >= BALANCE.AMBIENT_TRADE.MIN_MARGIN;
}

export function runAmbientTradeDaily() {
    const summary = {
        day: state.player.time.day,
        moved: makeStock(),
        flows: 0,
        blockedFlows: 0,
        blockedUnits: makeStock(),
        residualDemand: makeStock(),
        attemptedDemand: makeStock()
    };
    const nodes = getAllLogisticsNodes();
    MARKET_COMMODITIES.forEach((commodity) => {
        const sources = nodes
            .map((node) => ({ node, surplus: getNodeSurplus(node, commodity) }))
            .filter((item) => item.surplus > 0)
            .sort((a, b) => b.surplus - a.surplus);
        const sinks = nodes
            .map((node) => ({ node, shortage: getNodeShortage(node, commodity) }))
            .filter((item) => item.shortage > 0)
            .sort((a, b) => b.shortage - a.shortage);
        sinks.forEach((sinkItem) => {
            let sinkRemainingCap = Math.floor(sinkItem.shortage * BALANCE.AMBIENT_TRADE.MAX_DAILY_FILL_SHARE);
            if (sinkRemainingCap <= 0) return;
            summary.attemptedDemand[commodity] += sinkRemainingCap;
            let sinkBlockedUnits = 0;
            sources.forEach((sourceItem) => {
                if (sinkRemainingCap <= 0 || sourceItem.surplus <= 0) return;
                if (sourceItem.node.sectorId === sinkItem.node.sectorId) return;
                const metrics = deriveRouteMetrics(sourceItem.node.sectorId, sinkItem.node.sectorId);
                const distance = metrics.hopCount;
                if (distance === null || distance > BALANCE.AMBIENT_TRADE.MAX_SEARCH_DISTANCE) {
                    const remainingBlockedCap = Math.max(0, sinkRemainingCap - sinkBlockedUnits);
                    sinkBlockedUnits += Math.min(remainingBlockedCap, sourceItem.surplus);
                    summary.blockedFlows += 1;
                    return;
                }
                const risk = metrics.risk || 0;
                if (!isProfitableAmbientFlow(sourceItem.node, sinkItem.node, commodity)) return;
                const distanceFactor = 1 / (1 + Math.max(0, distance - BALANCE.AMBIENT_TRADE.DISTANCE_BASELINE) * BALANCE.AMBIENT_TRADE.DISTANCE_PENALTY);
                const riskFactor = 1 / (1 + risk * BALANCE.AMBIENT_TRADE.RISK_PENALTY);
                const jitter = 1 - BALANCE.AMBIENT_TRADE.JITTER + random() * BALANCE.AMBIENT_TRADE.JITTER * 2;
                const exportCap = Math.floor(sourceItem.surplus * BALANCE.AMBIENT_TRADE.MAX_DAILY_EXPORT_SHARE);
                const base = Math.floor(BALANCE.AMBIENT_TRADE.BASE_FLOW * distanceFactor * riskFactor * jitter);
                const amount = Math.max(0, Math.min(base, exportCap, sourceItem.surplus, sinkRemainingCap));
                if (amount <= 0) return;
                sourceItem.node.stock[commodity] = Math.max(0, (sourceItem.node.stock[commodity] || 0) - amount);
                sinkItem.node.stock[commodity] = Math.min(sinkItem.node.maxStock[commodity] || BALANCE.AMBIENT_TRADE.DEFAULT_MAX_STOCK_CAP, (sinkItem.node.stock[commodity] || 0) + amount);
                sourceItem.surplus -= amount;
                sinkRemainingCap -= amount;
                summary.moved[commodity] += amount;
                summary.flows += 1;
            });
            summary.residualDemand[commodity] += sinkRemainingCap;
            summary.blockedUnits[commodity] += Math.min(sinkBlockedUnits, summary.residualDemand[commodity]);
        });
    });
    state.ambientTrade = summary;
    return summary;
}

export function describeAmbientTradeSummary(summary = state.ambientTrade) {
    if (!summary || summary.flows <= 0) return 'Ambient trade found no profitable connected shortages today.';
    const moved = MARKET_COMMODITIES.map((commodity) => `${summary.moved[commodity]} ${formatCommodity(commodity)}`).join(' / ');
    const residual = MARKET_COMMODITIES.map((commodity) => `${summary.residualDemand[commodity]} ${formatCommodity(commodity)}`).join(' / ');
    const blocked = MARKET_COMMODITIES.map((commodity) => `${summary.blockedUnits[commodity]} ${formatCommodity(commodity)}`).join(' / ');
    return `Ambient trade moved ${moved} across ${summary.flows} flows. Residual demand for routed/player trade: ${residual}. Blocked network pressure: ${blocked}.`;
}
