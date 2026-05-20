import { state } from '../state.js';
import { BALANCE } from '../constants.js';
import { formatCommodity, formatCredits, getFreeHolds, log, random } from '../utils.js';
import { getFactionPriceMultiplier } from '../core/factions.js';
import { spendTime } from '../core/time.js';
import { updatePoliticalAsksForTrade } from './guilds.js';
import { getCharacterStat } from '../core/characterChecks.js';
import { getTraitBonus } from '../core/traitHooks.js';
import { getSkillEffect } from '../core/skillHooks.js';
import { getPortType } from '../core/ports.js';
import { executeTradeDetailed } from './marketTrade.js';
import { getSpotPriceForSector } from './economy/pricing.js';

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function roundPercent(value) {
    return Math.round(value * 1000) / 10;
}

const RECOMMENDATION_BALANCE = BALANCE.MARKET.RECOMMENDATION;

function getMarketCompetency(character) {
    const acumen = getCharacterStat(character, "acumen");
    const tradecraft = getCharacterStat(character, "tradecraft");
    return acumen * RECOMMENDATION_BALANCE.COMPETENCY_ACUMEN_WEIGHT
        + tradecraft * RECOMMENDATION_BALANCE.COMPETENCY_TRADECRAFT_WEIGHT
        + getTraitBonus(character, "marketInsight") * RECOMMENDATION_BALANCE.COMPETENCY_TRAIT_MARKET_INSIGHT_MULTIPLIER
        + getTraitBonus(character, "propertyValuationBonus") * RECOMMENDATION_BALANCE.COMPETENCY_TRAIT_PROPERTY_VALUATION_MULTIPLIER
        + getSkillEffect(character, "marketInsight") * RECOMMENDATION_BALANCE.COMPETENCY_SKILL_MARKET_INSIGHT_MULTIPLIER
        + getSkillEffect(character, "valuationAccuracy") * RECOMMENDATION_BALANCE.COMPETENCY_SKILL_VALUATION_ACCURACY_MULTIPLIER;
}

function describeMarketQuality(competency) {
    if (competency >= RECOMMENDATION_BALANCE.QUALITY_MAX_MIN) return "max";
    if (competency >= RECOMMENDATION_BALANCE.QUALITY_HIGH_MIN) return "high";
    if (competency >= RECOMMENDATION_BALANCE.QUALITY_MEDIUM_MIN) return "medium";
    return "low";
}

export function getMarketRecommendation(port, commodity, character, options = {}) {
    if (!port || !commodity) {
        return {
            quality: "low",
            actionId: "wait",
            price: null,
            estimateAccuracy: 0,
            confidence: 0,
            stockRatio: 0,
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
    const buyScore = canBuy
        ? stockRatio * RECOMMENDATION_BALANCE.SCORE_STOCK_SCALE - (buyPrice || 0) / RECOMMENDATION_BALANCE.SCORE_PRICE_DIVISOR
        : -Infinity;
    const sellScore = canSell
        ? scarcitySignal * RECOMMENDATION_BALANCE.SCORE_STOCK_SCALE + (sellPrice || 0) / RECOMMENDATION_BALANCE.SCORE_PRICE_DIVISOR
        : -Infinity;
    const bestAvailableAction = canBuy || canSell
        ? (buyScore >= sellScore ? "buy" : "sell")
        : "wait";
    const actionId = forcedMode || bestAvailableAction;
    const relevantPrice = actionId === "buy" ? buyPrice : sellPrice;
    const competency = getMarketCompetency(character);
    const quality = describeMarketQuality(competency);
    const estimateAccuracy = clamp(
        (competency - RECOMMENDATION_BALANCE.ESTIMATE_ACCURACY_MIN_COMPETENCY)
            / RECOMMENDATION_BALANCE.ESTIMATE_ACCURACY_COMPETENCY_RANGE,
        RECOMMENDATION_BALANCE.ESTIMATE_ACCURACY_MIN,
        RECOMMENDATION_BALANCE.ESTIMATE_ACCURACY_MAX
    );
    const confidence = clamp(
        estimateAccuracy * (canBuy || canSell ? 1 : RECOMMENDATION_BALANCE.NO_ACTION_CONFIDENCE_MULTIPLIER),
        0,
        RECOMMENDATION_BALANCE.MAX_CONFIDENCE
    );

    if (quality === "max") {
        return {
            quality,
            actionId,
            price: relevantPrice,
            estimateAccuracy,
            confidence,
            stockRatio,
            message: actionId === "wait"
                ? `No favorable routine options for ${formatCommodity(commodity)}; market conditions suggest waiting.`
                : `Best routine option: ${actionId} ${formatCommodity(commodity)} at ${formatCredits(relevantPrice || 0)} with ${roundPercent(confidence)}% confidence.`
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
            message: actionId === "wait"
                ? `No favorable routine options for ${formatCommodity(commodity)}; market conditions suggest waiting.`
                : `${formatCommodity(commodity)} ${actionId} terms look favorable; estimates are narrow enough for routine execution.`
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
            message: actionId === "wait"
                ? `No favorable routine options for ${formatCommodity(commodity)}; market conditions suggest waiting.`
                : `${formatCommodity(commodity)} appears workable, but price and stock risk still need a cautious margin.`
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

function resolvePortSectorId(port) {
    const directSectorId = Number(port?.sectorId);
    if (Number.isInteger(directSectorId) && directSectorId >= 0) return directSectorId;
    const matched = Object.entries(state.ports || {}).find(([, candidate]) => candidate === port);
    if (!matched) return null;
    const sectorId = Number(matched[0]);
    return Number.isInteger(sectorId) ? sectorId : null;
}

export function getPortPrice(port, commodity, mode) {
    const sectorId = resolvePortSectorId(port);
    if (sectorId === null) {
        const stock = Math.max(0, port.stock[commodity] || 0);
        const maxStock = Math.max(1, port.maxStock[commodity] || 1);
        const stockRatio = Math.max(0, Math.min(1, stock / maxStock));
        const base = port.basePrices[commodity] || BALANCE.MIN_TRADE_PRICE;
        const marketPrice = mode === "buy"
            ? base * (BALANCE.MARKET.BUY_PRICE_BASE_MULTIPLIER + (1 - stockRatio) * BALANCE.MARKET.BUY_PRICE_SCARCITY_MULTIPLIER)
            : base * (BALANCE.MARKET.SELL_PRICE_BASE_MULTIPLIER + (1 - stockRatio) * BALANCE.MARKET.SELL_PRICE_SCARCITY_MULTIPLIER);
        return Math.max(BALANCE.MIN_TRADE_PRICE, Math.round(marketPrice * getFactionPriceMultiplier(port, mode)));
    }
    const spotPrice = getSpotPriceForSector(sectorId, commodity, mode);
    return Math.max(BALANCE.MIN_TRADE_PRICE, Math.round(spotPrice * getFactionPriceMultiplier(port, mode)));
}

export function tradeCommodity(commodity, mode) {
    const tradeResult = executeTradeDetailed(commodity, mode, getPortPrice, spendTime);
    if (tradeResult.amount <= 0) return;
    updatePoliticalAsksForTrade(commodity, tradeResult.amount, mode);
}
