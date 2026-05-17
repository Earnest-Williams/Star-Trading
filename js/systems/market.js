import { state } from '../state.js';
import { BALANCE } from '../constants.js';
import { formatCommodity, formatCredits, getFreeHolds, log, random } from '../utils.js';
import { getFactionPriceMultiplier, addFactionRep, addFactionHeat, applyPoliticalEffect } from '../core/factions.js';
import { spendTime } from '../core/time.js';
import { updatePoliticalAsksForTrade } from './guilds.js';
import { getPortType } from '../core/ports.js';
import { getCharacterStat } from '../core/characterChecks.js';
import { getTraitBonus } from '../core/traitHooks.js';
import { getSkillEffect } from '../core/skillHooks.js';

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function roundPercent(value) {
    return Math.round(value * 1000) / 10;
}

function getMarketCompetency(character) {
    const acumen = getCharacterStat(character, "acumen");
    const tradecraft = getCharacterStat(character, "tradecraft");
    return acumen * 0.7
        + tradecraft * 0.3
        + getTraitBonus(character, "marketInsight") * 5
        + getTraitBonus(character, "propertyValuationBonus") * 2
        + getSkillEffect(character, "marketInsight") * 6
        + getSkillEffect(character, "valuationAccuracy") * 4;
}

function describeMarketQuality(competency) {
    if (competency >= 95) return "max";
    if (competency >= 80) return "high";
    if (competency >= 62) return "medium";
    return "low";
}

export function getMarketRecommendation(port, commodity, character, options = {}) {
    if (!port || !commodity) {
        return {
            quality: "low",
            actionId: "wait",
            estimateAccuracy: 0,
            confidence: 0,
            message: "Market data is unavailable; hire help or gather intel before committing capital."
        };
    }

    const type = getPortType(port);
    const stock = Math.max(0, Number(port.stock?.[commodity] || 0));
    const maxStock = Math.max(1, Number(port.maxStock?.[commodity] || 1));
    const stockRatio = clamp(stock / maxStock, 0, 1);
    const canBuy = type.sells.includes(commodity) && stock > 0;
    const canSell = type.buys.includes(commodity);
    const forcedMode = options.mode === "buy" || options.mode === "sell" ? options.mode : null;
    const buyPrice = canBuy ? getPortPrice(port, commodity, "buy") : null;
    const sellPrice = canSell ? getPortPrice(port, commodity, "sell") : null;
    const scarcitySignal = 1 - stockRatio;
    const buyScore = canBuy ? stockRatio * 100 - (buyPrice || 0) / 20 : -Infinity;
    const sellScore = canSell ? scarcitySignal * 100 + (sellPrice || 0) / 20 : -Infinity;
    const bestAvailableAction = canBuy || canSell
        ? (buyScore >= sellScore ? "buy" : "sell")
        : "wait";
    const actionId = forcedMode || bestAvailableAction;
    const relevantPrice = actionId === "buy" ? buyPrice : sellPrice;
    const competency = getMarketCompetency(character);
    const quality = describeMarketQuality(competency);
    const estimateAccuracy = clamp((competency - 40) / 60, 0.1, 0.98);
    const confidence = clamp(estimateAccuracy * (canBuy || canSell ? 1 : 0.35), 0, 0.98);

    if (quality === "max") {
        return {
            quality,
            actionId,
            price: relevantPrice,
            estimateAccuracy,
            confidence,
            stockRatio,
            message: `Best routine option: ${actionId} ${formatCommodity(commodity)} at ${formatCredits(relevantPrice || 0)} with ${roundPercent(confidence)}% confidence.`
        };
    }
    if (quality === "high") {
        return {
            quality,
            actionId,
            price: relevantPrice,
            estimateAccuracy,
            confidence,
            stockRatio,
            message: `${formatCommodity(commodity)} ${actionId} terms look favorable; estimates are narrow enough for routine execution.`
        };
    }
    if (quality === "medium") {
        return {
            quality,
            actionId,
            price: relevantPrice,
            estimateAccuracy,
            confidence,
            stockRatio,
            message: `${formatCommodity(commodity)} appears workable, but price and stock risk still need a cautious margin.`
        };
    }
    return {
        quality,
        actionId: "gather_intel",
        price: relevantPrice,
        estimateAccuracy,
        confidence,
        stockRatio,
        message: `This ${formatCommodity(commodity)} opportunity is uncertain; your character should gather intel or ask a broker before risking capital.`
    };
}

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
