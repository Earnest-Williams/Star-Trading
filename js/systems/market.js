import { state } from '../state.js';
import { BALANCE, COMMODITIES, PORT_TYPES, FACTIONS } from '../constants.js';
import { formatCommodity, formatCredits, getFreeHolds, log, random } from '../utils.js';
import { getInfluenceSpread, addSectorInfluence } from '../core/influence.js';
import { getFactionPriceMultiplier, getFactionLabel, getFactionRep, addFactionRep, addFactionHeat, applyPoliticalEffect } from '../core/factions.js';
import { spendTime } from '../core/time.js';
import { updatePoliticalAsksForTrade } from './guilds.js';

export function getPortPrice(port, commodity, mode) {
    const stock = Math.max(0, port.stock[commodity]);
    const maxStock = Math.max(1, port.maxStock[commodity]);
    const stockRatio = Math.max(0, Math.min(1, stock / maxStock));
    const base = port.basePrices[commodity];
    const marketPrice = mode === "buy"
        ? base * (0.75 + (1 - stockRatio) * 0.90)
        : base * (0.65 + (1 - stockRatio) * 1.20);
    return Math.max(BALANCE.MIN_TRADE_PRICE, Math.round(marketPrice * getFactionPriceMultiplier(port, mode)));
}

export function tradeCommodity(commodity, mode) {
    const port = state.ports[state.player.currentSector];
    if (!port) return;
    const type = PORT_TYPES[port.typeKey];
    const price = getPortPrice(port, commodity, mode);
    let amount = BALANCE.TRADE_BATCH;
    if (mode === "buy") {
        if (!type.sells.includes(commodity)) { log("This port does not sell that commodity."); return; }
        amount = Math.min(amount, port.stock[commodity], getFreeHolds(), Math.floor(state.player.credits / price));
        if (amount <= 0) { log("You cannot buy that right now. Check credits, port stock, and free holds."); return; }
        if (!spendTime(BALANCE.TRADE_TIME_MINUTES)) return;
        state.player.credits -= amount * price;
        state.player.cargo[commodity] += amount;
        port.stock[commodity] -= amount;
        log(`Bought ${amount} ${formatCommodity(commodity)} for ${formatCredits(amount * price)} credits. Trade took ${BALANCE.TRADE_TIME_MINUTES} minutes.`);
        if (amount >= BALANCE.TRADE_BATCH) {
            applyPoliticalEffect({ factionId: port.factionId, publicRep: 1, trust: 1, sectorId: state.player.currentSector, influence: 1, reason: "routine public trade", memoryKey: "reliableJobs" });
            if (port.hiddenFactionId && random() < 0.18) {
                addFactionRep(port.hiddenFactionId, 1, "quiet port relationship", "private");
                const sector = state.universe[state.player.currentSector];
                if (sector && sector.front) sector.front.suspicion = Math.min(100, sector.front.suspicion + 2);
            }
        }
    } else {
        if (!type.buys.includes(commodity)) { log("This port does not buy that commodity."); return; }
        amount = Math.min(amount, state.player.cargo[commodity]);
        if (amount <= 0) { log("You do not have that cargo to sell."); return; }
        if (!spendTime(BALANCE.TRADE_TIME_MINUTES)) return;
        state.player.credits += amount * price;
        state.player.cargo[commodity] -= amount;
        port.stock[commodity] = Math.min(port.maxStock[commodity], port.stock[commodity] + amount);
        log(`Sold ${amount} ${formatCommodity(commodity)} for ${formatCredits(amount * price)} credits. Trade took ${BALANCE.TRADE_TIME_MINUTES} minutes.`);
        if (amount >= BALANCE.TRADE_BATCH) {
            applyPoliticalEffect({ factionId: port.factionId, publicRep: 1, trust: 1, sectorId: state.player.currentSector, influence: 2, reason: "supply-chain support", memoryKey: "reliableJobs" });
            if (commodity === "eq" && port.hiddenFactionId === "vc") {
                addFactionRep("vc", 2, "off-ledger equipment supply", "private");
                addFactionHeat("sda", 2, "unusual equipment routing");
            }
        }
    }
    updatePoliticalAsksForTrade(commodity, amount, mode);
}
