import { state } from '../../state.js';
import { BALANCE, MARKET_COMMODITIES } from '../../constants.js';
import { formatCommodity, makeStock, random } from '../../utils.js';
import { getAllLogisticsNodes, deriveRouteMetrics } from '../tradeRoutes.js';
import { getBidAskForSector, getMidMarketPriceForSector } from './pricing.js';
import { patchPort, patchPlanet, patchAmbientTrade } from '../../core/state/mutations.js';

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

function isProfitableAmbientFlow(source, sink, commodity, metrics) {
    const sourceQuote = getBidAskForSector(source.sectorId, commodity);
    const sinkQuote = getBidAskForSector(sink.sectorId, commodity);
    const sourceAcquisition = sourceQuote.ask || getMidMarketPriceForSector(source.sectorId, commodity);
    const deliveredValue = sinkQuote.bid || getMidMarketPriceForSector(sink.sectorId, commodity);
    const transportFriction = (Number(metrics?.hopCount || 0) * 1) + (Number(metrics?.risk || 0) * 0.8);
    const requiredMargin = Math.max(2, BALANCE.AMBIENT_TRADE.MIN_MARGIN * 0.2);
    return deliveredValue >= sourceAcquisition + transportFriction + requiredMargin;
}

export function runEconomyAmbientFlowsDaily() {
    const summary = {
        day: state.player.time.day,
        moved: makeStock(),
        flows: 0,
        blockedFlows: 0,
        blockedUnits: makeStock(),
        residualDemand: makeStock(),
        attemptedDemand: makeStock(),
        pricePressureBefore: {},
        pricePressureAfter: {}
    };
    summary.blockedByReason = {
        disconnected: makeStock(),
        unprofitable: makeStock(),
        highRisk: makeStock()
    };
    const nodes = getAllLogisticsNodes();
    // Accumulate all stock changes keyed by sectorId; apply one patch per sector at the end.
    const pendingStock = new Map();
    function getPendingStock(sectorId, kind) {
        if (pendingStock.has(sectorId)) return pendingStock.get(sectorId).stock;
        const node = kind === 'port' ? state.ports?.[sectorId] : state.planets?.[sectorId];
        return node?.stock || {};
    }
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
            const recordBlockedFlow = (reason, sourceSurplus) => {
                const remainingBlockedCap = Math.max(0, sinkRemainingCap - sinkBlockedUnits);
                const blocked = Math.min(remainingBlockedCap, sourceSurplus);
                if (blocked <= 0) return;
                sinkBlockedUnits += blocked;
                summary.blockedByReason[reason][commodity] += blocked;
                summary.blockedFlows += 1;
            };
            sources.forEach((sourceItem) => {
                if (sinkRemainingCap <= 0 || sourceItem.surplus <= 0) return;
                if (sourceItem.node.sectorId === sinkItem.node.sectorId) return;
                const metrics = deriveRouteMetrics(sourceItem.node.sectorId, sinkItem.node.sectorId);
                const distance = metrics.hopCount;
                if (distance === null || distance > BALANCE.AMBIENT_TRADE.MAX_SEARCH_DISTANCE) {
                    recordBlockedFlow('disconnected', sourceItem.surplus);
                    return;
                }
                const risk = metrics.risk || 0;
                if (risk >= BALANCE.AMBIENT_TRADE.RISK_REJECTION_THRESHOLD) {
                    recordBlockedFlow('highRisk', sourceItem.surplus);
                    return;
                }
                if (!isProfitableAmbientFlow(sourceItem.node, sinkItem.node, commodity, metrics)) {
                    recordBlockedFlow('unprofitable', sourceItem.surplus);
                    return;
                }
                const distanceFactor = 1 / (1 + Math.max(0, distance - BALANCE.AMBIENT_TRADE.DISTANCE_BASELINE) * BALANCE.AMBIENT_TRADE.DISTANCE_PENALTY);
                const riskFactor = 1 / (1 + risk * BALANCE.AMBIENT_TRADE.RISK_PENALTY);
                const jitter = 1 - BALANCE.AMBIENT_TRADE.JITTER + random() * BALANCE.AMBIENT_TRADE.JITTER * 2;
                const exportCap = Math.floor(sourceItem.surplus * BALANCE.AMBIENT_TRADE.MAX_DAILY_EXPORT_SHARE);
                const base = Math.floor(BALANCE.AMBIENT_TRADE.BASE_FLOW * distanceFactor * riskFactor * jitter);
                const amount = Math.max(0, Math.min(base, exportCap, sourceItem.surplus, sinkRemainingCap));
                if (amount <= 0) return;
                const srcId = sourceItem.node.sectorId;
                const snkId = sinkItem.node.sectorId;
                const srcKind = sourceItem.node.kind;
                const snkKind = sinkItem.node.kind;
                // Verify backing state nodes exist before committing any change.
                const srcStateNode = srcKind === 'port' ? state.ports?.[srcId] : state.planets?.[srcId];
                const snkStateNode = snkKind === 'port' ? state.ports?.[snkId] : state.planets?.[snkId];
                if (!srcStateNode || !snkStateNode) return;
                const srcStock = getPendingStock(srcId, srcKind);
                const snkStock = getPendingStock(snkId, snkKind);
                pendingStock.set(srcId, { kind: srcKind, stock: { ...srcStock, [commodity]: Math.max(0, (srcStock[commodity] || 0) - amount) } });
                pendingStock.set(snkId, { kind: snkKind, stock: { ...snkStock, [commodity]: Math.min(sinkItem.node.maxStock[commodity] || BALANCE.AMBIENT_TRADE.DEFAULT_MAX_STOCK_CAP, (snkStock[commodity] || 0) + amount) } });
                sourceItem.surplus -= amount;
                sinkRemainingCap -= amount;
                summary.moved[commodity] += amount;
                summary.flows += 1;
            });
            summary.residualDemand[commodity] += sinkRemainingCap;
            summary.blockedUnits[commodity] += Math.min(sinkBlockedUnits, sinkRemainingCap);
        });
    });
    // Apply one patch per sector, avoiding redundant revision increments.
    pendingStock.forEach(({ kind, stock }, sectorId) => {
        if (kind === 'port') patchPort(sectorId, { stock });
        else patchPlanet(sectorId, { stock });
    });
    patchAmbientTrade(summary);
    return summary;
}

export function describeAmbientFlowSummary(summary = state.ambientTrade) {
    const safeSummary = summary || {};
    const flows = Number(safeSummary.flows) || 0;
    if (flows <= 0) return 'Ambient trade found no profitable connected shortages today.';

    const movedMap = safeSummary.moved || {};
    const residualMap = safeSummary.residualDemand || {};
    const blockedMap = safeSummary.blockedUnits || {};
    const blockedReasons = safeSummary.blockedByReason || {};

    const moved = MARKET_COMMODITIES.map((commodity) => `${Number(movedMap[commodity]) || 0} ${formatCommodity(commodity)}`).join(' / ');
    const residual = MARKET_COMMODITIES.map((commodity) => `${Number(residualMap[commodity]) || 0} ${formatCommodity(commodity)}`).join(' / ');
    const blocked = MARKET_COMMODITIES.map((commodity) => `${Number(blockedMap[commodity]) || 0} ${formatCommodity(commodity)}`).join(' / ');
    const disconnected = MARKET_COMMODITIES.map((commodity) => `${Number(blockedReasons.disconnected?.[commodity]) || 0} ${formatCommodity(commodity)}`).join(' / ');
    const unprofitable = MARKET_COMMODITIES.map((commodity) => `${Number(blockedReasons.unprofitable?.[commodity]) || 0} ${formatCommodity(commodity)}`).join(' / ');
    const highRisk = MARKET_COMMODITIES.map((commodity) => `${Number(blockedReasons.highRisk?.[commodity]) || 0} ${formatCommodity(commodity)}`).join(' / ');
    return `Ambient trade moved ${moved} across ${flows} flows. Residual demand for routed/player trade: ${residual}. Blocked network pressure: ${blocked}. Blocked by disconnection: ${disconnected}. Blocked by unprofitable margin: ${unprofitable}. Blocked by high risk: ${highRisk}.`;
}

export function getAmbientFlowCandidates(commodity) {
    const nodes = getAllLogisticsNodes();
    return nodes.filter((node) => Number(node?.stock?.[commodity] || 0) > 0).map((node) => node.sectorId);
}
