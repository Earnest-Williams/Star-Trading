import { state } from '../../state.js';
import { BALANCE } from '../../constants.js';
import { getCommodityDef } from '../../config/economy/commodities.js';
import { getMidPriceForSector, getSpatialPriceDiagnostics } from './spatialPrices.js';

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function toFiniteNumber(value, fallback = 0) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }

function resolveBasePrice(commodity) {
  const universeBase = state.economy?.universeBasePrices?.[commodity];
  if (Number.isFinite(universeBase) && universeBase > 0) return universeBase;
  const commodityBase = getCommodityDef(commodity)?.basePrice;
  if (Number.isFinite(commodityBase) && commodityBase > 0) return commodityBase;
  return BALANCE.MIN_TRADE_PRICE;
}

export function getMidMarketPriceForSector(sectorId, commodity) {
  const mid = getMidPriceForSector(sectorId, commodity);
  if (Number.isFinite(mid) && mid > 0) return mid;
  return resolveBasePrice(commodity);
}

export function getBidAskForSector(sectorId, commodity) {
    const midpoint = getMidMarketPriceForSector(sectorId, commodity);
    const def = getCommodityDef(commodity) || {};
    const signal = state.economy?.pressureBySector?.[sectorId]?.[commodity] || {};
    const diag = getSpatialPriceDiagnostics(sectorId, commodity) || {};
    const shortage = clamp(toFiniteNumber(signal.shortageSeverity, 0), 0, 1);
    const volatility = clamp(toFiniteNumber(def.volatility, 0.2), 0.08, 0.45);
    const risk = clamp(toFiniteNumber(diag.routeFriction, 0), 0, 2);
    const confidence = clamp(toFiniteNumber(signal.confidence ?? diag.confidence, 0.5), 0, 1);
    const spread = clamp(
        0.06
            + volatility * 0.28
            + shortage * 0.2
            + risk * 0.03
            + (1 - confidence) * 0.08,
        0.04,
        0.7
    );
    const ask = Math.max(BALANCE.MIN_TRADE_PRICE, Math.ceil(midpoint * (1 + spread / 2)));
    const bid = Math.max(BALANCE.MIN_TRADE_PRICE, Math.floor(midpoint * (1 - spread / 2)));
    return { midpoint, ask, bid, spread, confidence, risk };
}

export function getSpotPrice(port, sectorId, commodity, mode) {
    if (sectorId === null || sectorId === undefined || !Number.isFinite(Number(sectorId))) return resolveBasePrice(commodity);
    const quote = getBidAskForSector(sectorId, commodity);
    return mode === 'sell' ? quote.bid : quote.ask;
}

export function getSpotPriceForSector(sectorId, commodity, mode) {
  return getSpotPrice(null, sectorId, commodity, mode);
}

export function getExpectedRouteValue(originSector, destinationSector, commodity, amount) {
    const normalizedAmount = Math.max(0, toFiniteNumber(amount, 0));
    const origin = getBidAskForSector(originSector, commodity);
    const destination = getBidAskForSector(destinationSector, commodity);
    const spread = destination.bid - origin.ask;
    const estimatedGross = spread * normalizedAmount;
    const transportCost = Math.round(
        Math.max(0, (origin.risk + destination.risk) * normalizedAmount * 0.15)
    );
    const estimatedNet = estimatedGross - transportCost;
    return {
        originAsk: origin.ask,
        destinationBid: destination.bid,
        spread,
        estimatedGross,
        estimatedNet,
        transportCost,
        risk: Math.max(origin.risk, destination.risk),
        confidence: Math.min(origin.confidence, destination.confidence),
        buyPrice: origin.ask,
        sellPrice: destination.bid,
        expectedProfit: Math.floor(estimatedNet * BALANCE.TRADE_ROUTE.PROFIT_MULTIPLIER)
    };
}
