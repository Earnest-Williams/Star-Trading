/** @typedef {"buy" | "sell"} TradeMode */

/**
 * @typedef {Object} TradeContext
 * @property {string} commodity
 * @property {TradeMode} mode
 * @property {Object} port
 * @property {Object} type
 * @property {number} price
 */

import { state } from '../state.js';
import { BALANCE } from '../constants.js';
import { formatCommodity, formatCredits, getFreeHolds, log, random } from '../utils.js';
import { addFactionHeat, addFactionRep, applyPoliticalEffect } from '../core/factions.js';
import { getPortType } from '../core/ports.js';
import { recordLogisticsDelivery } from './logisticsObjectives.js';

export function resolveTradeContext(commodity, mode, getPortPrice) {
    if (mode !== "buy" && mode !== "sell") {
        log("Invalid trade mode. Use buy or sell.");
        return null;
    }
    const port = state.ports[state.player?.currentSector];
    if (!port) return null;
    return {
        commodity,
        mode,
        port,
        type: getPortType(port),
        price: getPortPrice(port, commodity, mode)
    };
}

export function validateTradeAndAmount(context) {
    const { commodity, mode, port, type, price } = context;
    if (!commodity) {
        log("Invalid commodity.");
        return 0;
    }
    let amount = BALANCE.TRADE_BATCH;
    if (mode === "buy") {
        if (!type.sells.includes(commodity)) {
            log("This port does not sell that commodity.");
            return 0;
        }
        amount = Math.min(
            amount,
            port.stock?.[commodity] || 0,
            getFreeHolds(),
            Math.floor((state.player?.credits || 0) / price)
        );
        if (amount <= 0) {
            log("You cannot buy that right now. Check credits, port stock, and free holds.");
        }
        return amount;
    }
    if (!type.buys.includes(commodity)) {
        log("This port does not buy that commodity.");
        return 0;
    }
    amount = Math.min(amount, state.player?.cargo?.[commodity] || 0);
    if (amount <= 0) {
        log("You do not have that cargo to sell.");
    }
    return amount;
}

export function applyTradeStateMutation(context, amount) {
    const { commodity, mode, port, price } = context;
    const player = state.player;
    const cargo = player.cargo ?? (player.cargo = {});
    const stock = port.stock ?? (port.stock = {});
    const maxStock = port.maxStock ?? (port.maxStock = {});
    const total = amount * price;
    if (mode === "buy") {
        player.credits -= total;
        cargo[commodity] = (cargo[commodity] || 0) + amount;
        stock[commodity] = Math.max(0, (stock[commodity] || 0) - amount);
        log(`Bought ${amount} ${formatCommodity(commodity)} for ${formatCredits(total)} credits. Trade took ${BALANCE.TRADE_TIME_MINUTES} minutes.`);
        return;
    }
    player.credits += total;
    cargo[commodity] = Math.max(0, (cargo[commodity] || 0) - amount);
    stock[commodity] = Math.min(maxStock[commodity] || 1, (stock[commodity] || 0) + amount);
    log(`Sold ${amount} ${formatCommodity(commodity)} for ${formatCredits(total)} credits. Trade took ${BALANCE.TRADE_TIME_MINUTES} minutes.`);
    recordLogisticsDelivery({
        source: "market_trade",
        sectorId: state.player.currentSector,
        commodity,
        amount,
        profit: total
    });
}

export function applyTradePoliticalEffects(context, amount) {
    const { commodity, mode, port } = context;
    if (amount < BALANCE.TRADE_BATCH) return;
    const influence = mode === "buy"
        ? BALANCE.MARKET.ROUTINE_BUY_INFLUENCE_GAIN
        : BALANCE.MARKET.ROUTINE_SELL_INFLUENCE_GAIN;
    const reason = mode === "buy" ? "routine public trade" : "supply-chain support";
    applyPoliticalEffect({ factionId: port.factionId, publicRep: BALANCE.MARKET.ROUTINE_PUBLIC_REP_GAIN, trust: BALANCE.MARKET.ROUTINE_TRUST_GAIN, sectorId: state.player.currentSector, influence, reason, memoryKey: "reliableJobs" });

    if (mode === "buy" && port.hiddenFactionId && random() < BALANCE.MARKET.HIDDEN_FACTION_RELATION_CHANCE) {
        addFactionRep(port.hiddenFactionId, BALANCE.MARKET.HIDDEN_FACTION_REP_GAIN, "quiet port relationship", "private");
        const sector = state.universe[state.player.currentSector];
        if (sector && sector.front) {
            sector.front.suspicion = Math.min(BALANCE.MARKET.FRONT_SUSPICION_MAX, sector.front.suspicion + BALANCE.MARKET.FRONT_SUSPICION_TRADE_GAIN);
        }
    }

    if (mode === "sell" && commodity === "eq" && port.hiddenFactionId === "vc") {
        addFactionRep("vc", BALANCE.MARKET.VC_EQUIPMENT_REP_GAIN, "off-ledger equipment supply", "private");
        addFactionHeat("sda", BALANCE.MARKET.SDA_EQUIPMENT_HEAT_GAIN, "unusual equipment routing");
    }
}

export function executeTradeDetailed(commodity, mode, getPortPrice, spendTime) {
    const context = resolveTradeContext(commodity, mode, getPortPrice);
    if (!context) return { amount: 0, code: "invalid_context" };
    const amount = validateTradeAndAmount(context);
    if (amount <= 0) return { amount: 0, code: "invalid_amount" };
    if (!state.player || !context.port) return { amount: 0, code: "invalid_context" };
    state.player.cargo ??= {};
    context.port.stock ??= {};
    context.port.maxStock ??= {};
    if (!spendTime(BALANCE.TRADE_TIME_MINUTES)) return { amount: 0, code: "time_blocked" };
    applyTradeStateMutation(context, amount);
    applyTradePoliticalEffects(context, amount);
    return { amount, code: "ok" };
}

export function executeTrade(commodity, mode, getPortPrice, spendTime) {
    return executeTradeDetailed(commodity, mode, getPortPrice, spendTime).amount;
}
