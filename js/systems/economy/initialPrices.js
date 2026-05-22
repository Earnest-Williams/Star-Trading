import { state } from '../../state.js';
import { BALANCE, MARKET_COMMODITIES } from '../../constants.js';
import { getCommodityDef } from '../../config/economy/commodities.js';
import { deriveRouteMetrics } from '../tradeRoutes.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const n = (v, f = 0) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : f;
};

function profileDemand(profile, commodity) {
  return n(profile?.baselineConsumption?.[commodity]) + n(profile?.industrialConsumption?.[commodity]) + n(profile?.populationDemand) + (profile?.likelyImports?.includes(commodity) ? Math.max(0.5, n(profile?.demandWeight, 1)) : 0);
}

function profileSupply(profile, node, commodity) {
  const stock = Math.max(0, n(node?.stock?.[commodity]));
  const reserve = Math.max(0, n(profile?.strategicReserve?.[commodity]));
  const aboveReserve = Math.max(0, stock - reserve);
  const exportBias = profile?.likelyExports?.includes(commodity) ? Math.max(0.5, n(profile?.supplyWeight, 1)) : 0;
  return exportBias + n(profile?.extractionCapacity) * 0.02 + aboveReserve * 0.04;
}

export function calibrateInitialUniversePrices() {
  if (!state.economy) return {};
  const profiles = state.economy.profilesBySector || {};
  const diagnostics = {};
  const basePrices = {};
  const sectorIds = Object.keys(profiles).map(Number).sort((a, b) => a - b);
  for (const commodity of MARKET_COMMODITIES) {
    const def = getCommodityDef(commodity) || {};
    const intrinsic = Math.max(BALANCE.MIN_TRADE_PRICE, n(def.basePrice, BALANCE.MIN_TRADE_PRICE));
    const producers = [];
    const consumers = [];
    let totalDemand = 0;
    let totalSupply = 0;
    for (const sectorId of sectorIds) {
      const profile = profiles[sectorId];
      const node = state.ports?.[sectorId] || state.planets?.[sectorId] || null;
      const demand = profileDemand(profile, commodity);
      const supply = profileSupply(profile, node, commodity);
      totalDemand += demand;
      totalSupply += supply;
      if (supply > 0) producers.push(sectorId);
      if (demand > 0) consumers.push(sectorId);
    }
    let totalRouteCost = 0;
    let routePairs = 0;
    let isolatedDemand = 0;
    for (const c of consumers) {
      let reachable = false;
      let bestCost = Infinity;
      for (const p of producers) {
        if (p === c) { reachable = true; bestCost = 0; break; }
        const m = deriveRouteMetrics(p, c);
        if (m?.path && m.hopCount !== null && n(m.risk) < 8 && n(m.hopCount) <= 8) {
          reachable = true;
          const cost = n(m.hopCount) + n(m.totalEffectiveSpan, n(m.hopCount)) * 0.2 + n(m.risk) * 0.5 + n(m.surcharge) * 2;
          if (cost < bestCost) bestCost = cost;
        }
      }
      if (!reachable) isolatedDemand += 1;
      if (Number.isFinite(bestCost)) { totalRouteCost += bestCost; routePairs += 1; }
    }
    const producerShare = producers.length > 0 ? 1 / producers.length : 1;
    const supplyDemandIndex = clamp((totalDemand + 1) / (totalSupply + 1), 0.6, 1.8);
    const producerConcentrationIndex = clamp(1 + producerShare * 0.3, 0.9, 1.4);
    const averageNetworkCost = routePairs > 0 ? totalRouteCost / routePairs : 4;
    const networkFrictionIndex = clamp(1 + averageNetworkCost * 0.05, 0.9, 1.5);
    const isolatedDemandShare = consumers.length > 0 ? isolatedDemand / consumers.length : 0;
    const isolationIndex = clamp(1 + isolatedDemandShare * 0.4, 1, 1.4);
    const raw = intrinsic * supplyDemandIndex * producerConcentrationIndex * networkFrictionIndex * isolationIndex;
    const vol = clamp(n(def.volatility, 0.2), 0.08, 0.45);
    const minFactor = 1 - vol * 0.8;
    const maxFactor = 1 + vol * 1.2;
    const finalUniverseBasePrice = Math.round(clamp(raw, intrinsic * minFactor, intrinsic * maxFactor));
    basePrices[commodity] = Math.max(BALANCE.MIN_TRADE_PRICE, finalUniverseBasePrice);
    diagnostics[commodity] = { basePrice: intrinsic, totalDemand, totalSupply, producerCount: producers.length, consumerCount: consumers.length, averageNetworkCost, isolatedDemandShare, supplyDemandIndex, producerConcentrationIndex, networkFrictionIndex, isolationIndex, finalUniverseBasePrice: basePrices[commodity] };
  }
  state.economy.universeBasePrices = basePrices;
  state.economy.priceDiagnostics = diagnostics;
  state.economy.lastPriceCalibrationDay = state.player?.time?.day ?? null;
  return basePrices;
}

export function getUniverseBasePrice(commodity) {
  return state.economy?.universeBasePrices?.[commodity] || null;
}

export function getPriceCalibrationDiagnostics(commodity) {
  return state.economy?.priceDiagnostics?.[commodity] || null;
}
