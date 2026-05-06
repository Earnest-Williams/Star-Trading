import { state } from '../state.js';
import { BALANCE, COMMODITIES } from '../constants.js';
import { formatCommodity, makeStock, random } from '../utils.js';
import { getAllLogisticsNodes, getRouteMarketValue } from './tradeRoutes.js';
import { findShortestSectorPath, getSectorPathDistance, getCorridorRiskForPath } from '../core/navigation.js';

function getNodeSurplus(node, commodity) {
    const stock = node.stock[commodity] || 0;
    const maxStock = Math.max(1, node.maxStock[commodity] || 1);
    const preferredFloor = node.sells.includes(commodity) ? maxStock * 0.25 : maxStock * 0.55;
    return Math.max(0, Math.floor(stock - preferredFloor));
}

function getNodeShortage(node, commodity) {
    const stock = node.stock[commodity] || 0;
    const maxStock = Math.max(1, node.maxStock[commodity] || 1);
    const desired = node.buys.includes(commodity) ? maxStock * 0.62 : maxStock * 0.35;
    return Math.max(0, Math.floor(desired - stock));
}

function isProfitableAmbientFlow(source, sink, commodity) {
    const buy = getRouteMarketValue(source.sectorId, commodity, "buy");
    const sell = getRouteMarketValue(sink.sectorId, commodity, "sell");
    return sell - buy >= BALANCE.AMBIENT_TRADE.MIN_MARGIN;
}

export function runAmbientTradeDaily() {
    const summary = { day: state.player.time.day, moved: makeStock(0, 0, 0), flows: 0 };
    const nodes = getAllLogisticsNodes();
    COMMODITIES.forEach(commodity => {
        const sources = nodes
            .map(node => ({ node, surplus: getNodeSurplus(node, commodity) }))
            .filter(item => item.surplus > 0)
            .sort((a, b) => b.surplus - a.surplus);
        const sinks = nodes
            .map(node => ({ node, shortage: getNodeShortage(node, commodity) }))
            .filter(item => item.shortage > 0)
            .sort((a, b) => b.shortage - a.shortage);
        sinks.forEach(sinkItem => {
            let sinkRemainingCap = Math.floor(sinkItem.shortage * BALANCE.AMBIENT_TRADE.MAX_DAILY_FILL_SHARE);
            if (sinkRemainingCap <= 0) return;
            sources.forEach(sourceItem => {
                if (sinkRemainingCap <= 0 || sourceItem.surplus <= 0) return;
                if (sourceItem.node.sectorId === sinkItem.node.sectorId) return;
                const distance = getSectorPathDistance(sourceItem.node.sectorId, sinkItem.node.sectorId);
                if (distance === null || distance > BALANCE.AMBIENT_TRADE.MAX_SEARCH_DISTANCE) return;
                const path = findShortestSectorPath(sourceItem.node.sectorId, sinkItem.node.sectorId);
                const risk = getCorridorRiskForPath(path) || 0;
                if (!isProfitableAmbientFlow(sourceItem.node, sinkItem.node, commodity)) return;
                const distanceFactor = 1 / (1 + Math.max(0, distance - 1) * BALANCE.AMBIENT_TRADE.DISTANCE_PENALTY);
                const riskFactor = 1 / (1 + risk * BALANCE.AMBIENT_TRADE.RISK_PENALTY);
                const jitter = 1 - BALANCE.AMBIENT_TRADE.JITTER + random() * BALANCE.AMBIENT_TRADE.JITTER * 2;
                const exportCap = Math.floor(sourceItem.surplus * BALANCE.AMBIENT_TRADE.MAX_DAILY_EXPORT_SHARE);
                const base = Math.floor(BALANCE.AMBIENT_TRADE.BASE_FLOW * distanceFactor * riskFactor * jitter);
                const amount = Math.max(0, Math.min(base, exportCap, sourceItem.surplus, sinkRemainingCap));
                if (amount <= 0) return;
                sourceItem.node.stock[commodity] = Math.max(0, (sourceItem.node.stock[commodity] || 0) - amount);
                sinkItem.node.stock[commodity] = Math.min(sinkItem.node.maxStock[commodity] || 9999, (sinkItem.node.stock[commodity] || 0) + amount);
                sourceItem.surplus -= amount;
                sinkRemainingCap -= amount;
                summary.moved[commodity] += amount;
                summary.flows += 1;
            });
        });
    });
    state.ambientTrade = summary;
    return summary;
}

export function describeAmbientTradeSummary(summary = state.ambientTrade) {
    if (!summary || summary.flows <= 0) return "Ambient trade found no profitable connected shortages today.";
    return `Ambient trade moved ${COMMODITIES.map(c => `${summary.moved[c]} ${formatCommodity(c)}`).join(" / ")} across ${summary.flows} aggregate flows.`;
}
