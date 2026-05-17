import { state } from '../state.js';
import { BALANCE } from '../constants.js';
import { formatCommodity, formatCredits, getFreeHolds, log, random } from '../utils.js';
import { getFactionPriceMultiplier, addFactionRep, addFactionHeat, applyPoliticalEffect } from '../core/factions.js';
import { spendTime } from '../core/time.js';
import { updatePoliticalAsksForTrade } from './guilds.js';
import { getPortType } from '../core/ports.js';

export function getPortPrice(port, commodity, mode) {
    const stock = Math.max(0, port.stock[commodity] || 0);
    const maxStock = Math.max(1, port.maxStock[commodity] || 1);
    const stockRatio = Math.max(0, Math.min(1, stock / maxStock));
    const base = port.basePrices[commodity] || BALANCE.MIN_TRADE_PRICE;
    const marketPrice = mode === "buy"
        ? base * (BALANCE.MARKET.BUY_PRICE_BASE_MULTIPLIER + (1 - stockRatio) * BALANCE.MARKET.BUY_PRICE_SCARCITY_MULTIPLIER)
        : base * (BALANCE.MARKET.SELL_PRICE_BASE_MULTIPLIER + (1 - stockRatio) * BALANCE.MARKET.SELL_PRICE_SCARCITY_MULTIPLIER);
    return Math.max(BALANCE.MIN_TRADE_PRICE, Math.round(marketPrice * getFactionPriceMultiplier(port, mode)));
}

export function tradeCommodity(commodity, mode) {
    const port = state.ports[state.player.currentSector];
    if (!port) return;
    const type = getPortType(port);
    const price = getPortPrice(port, commodity, mode);
    let amount = BALANCE.TRADE_BATCH;
    if (mode === "buy") {
        if (!type.sells.includes(commodity)) { log("This port does not sell that commodity."); return; }
        amount = Math.min(amount, port.stock[commodity] || 0, getFreeHolds(), Math.floor(state.player.credits / price));
        if (amount <= 0) { log("You cannot buy that right now. Check credits, port stock, and free holds."); return; }
        if (!spendTime(BALANCE.TRADE_TIME_MINUTES)) return;
        state.player.credits -= amount * price;
        state.player.cargo[commodity] = (state.player.cargo[commodity] || 0) + amount;
        port.stock[commodity] = Math.max(0, (port.stock[commodity] || 0) - amount);
        log(`Bought ${amount} ${formatCommodity(commodity)} for ${formatCredits(amount * price)} credits. Trade took ${BALANCE.TRADE_TIME_MINUTES} minutes.`);
        if (amount >= BALANCE.TRADE_BATCH) {
            applyPoliticalEffect({ factionId: port.factionId, publicRep: BALANCE.MARKET.ROUTINE_PUBLIC_REP_GAIN, trust: BALANCE.MARKET.ROUTINE_TRUST_GAIN, sectorId: state.player.currentSector, influence: BALANCE.MARKET.ROUTINE_BUY_INFLUENCE_GAIN, reason: "routine public trade", memoryKey: "reliableJobs" });
            if (port.hiddenFactionId && random() < BALANCE.MARKET.HIDDEN_FACTION_RELATION_CHANCE) {
                addFactionRep(port.hiddenFactionId, BALANCE.MARKET.HIDDEN_FACTION_REP_GAIN, "quiet port relationship", "private");
                const sector = state.universe[state.player.currentSector];
                if (sector && sector.front) sector.front.suspicion = Math.min(BALANCE.MARKET.FRONT_SUSPICION_MAX, sector.front.suspicion + BALANCE.MARKET.FRONT_SUSPICION_TRADE_GAIN);
            }
        }
    } else {
        if (!type.buys.includes(commodity)) { log("This port does not buy that commodity."); return; }
        amount = Math.min(amount, state.player.cargo[commodity] || 0);
        if (amount <= 0) { log("You do not have that cargo to sell."); return; }
        if (!spendTime(BALANCE.TRADE_TIME_MINUTES)) return;
        state.player.credits += amount * price;
        state.player.cargo[commodity] = Math.max(0, (state.player.cargo[commodity] || 0) - amount);
        port.stock[commodity] = Math.min(port.maxStock[commodity] || 1, (port.stock[commodity] || 0) + amount);
        log(`Sold ${amount} ${formatCommodity(commodity)} for ${formatCredits(amount * price)} credits. Trade took ${BALANCE.TRADE_TIME_MINUTES} minutes.`);
        if (amount >= BALANCE.TRADE_BATCH) {
            applyPoliticalEffect({ factionId: port.factionId, publicRep: BALANCE.MARKET.ROUTINE_PUBLIC_REP_GAIN, trust: BALANCE.MARKET.ROUTINE_TRUST_GAIN, sectorId: state.player.currentSector, influence: BALANCE.MARKET.ROUTINE_SELL_INFLUENCE_GAIN, reason: "supply-chain support", memoryKey: "reliableJobs" });
            if (commodity === "eq" && port.hiddenFactionId === "vc") {
                addFactionRep("vc", BALANCE.MARKET.VC_EQUIPMENT_REP_GAIN, "off-ledger equipment supply", "private");
                addFactionHeat("sda", BALANCE.MARKET.SDA_EQUIPMENT_HEAT_GAIN, "unusual equipment routing");
            }
        }
    }
    updatePoliticalAsksForTrade(commodity, amount, mode);
}
