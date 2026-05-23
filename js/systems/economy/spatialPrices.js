import { state } from '../../state.js';
import { BALANCE, MARKET_COMMODITIES } from '../../config/economy.js';
import { getCommodityDef } from '../../config/economy/commodities.js';
import { deriveRouteMetrics } from '../tradeRoutes.js';
import { getUniverseBasePrice } from './initialPrices.js';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const n = (v, f = 0) => { const x = Number(v); return Number.isFinite(x) ? x : f; };
let neighborCacheRevision = null;
let neighborCache = new Map();

function getGraphRevision() {
  return Number(state.routePathMetricsRevision ?? state.world?.graphRevision ?? 0);
}

function buildNeighborCache(sectorIds) {
  const revision = getGraphRevision();
  if (revision === neighborCacheRevision && neighborCache.size) return;
  neighborCacheRevision = revision;
  neighborCache = new Map();
  const hopLimit = Number(BALANCE.ECONOMY.SPATIAL_PRICE_RELAXATION.MAX_HOPS);
  for (const sid of sectorIds) {
    const neighbors = [];
    for (const other of sectorIds) {
      if (other === sid) continue;
      const m = deriveRouteMetrics(other, sid);
      if (!m?.path || m.hopCount === null || m.hopCount > hopLimit) continue;
      const distW = 1 / (1 + n(m.hopCount) * BALANCE.ECONOMY.SPATIAL_PRICE_RELAXATION.DISTANCE_WEIGHT_MULTIPLIER);
      const riskW = 1 / (1 + n(m.risk) * BALANCE.ECONOMY.SPATIAL_PRICE_RELAXATION.RISK_WEIGHT_MULTIPLIER);
      const frictionW = 1 / (1 + n(m.surcharge, 0));
      neighbors.push({ sectorId: other, weight: distW * riskW * frictionW });
    }
    neighborCache.set(sid, neighbors);
  }
}
export function recomputeSpatialPrices() {
  if (!state.economy) return {};
  const profiles = state.economy.profilesBySector || {};
  const sectorIds = Object.keys(profiles).map(Number).sort((a, b) => a - b);
  buildNeighborCache(sectorIds);
  const mids = state.economy.nodeMidPrices || {};
  const diags = {};
  for (const commodity of MARKET_COMMODITIES) {
    const def = getCommodityDef(commodity) || {};
    const base = getUniverseBasePrice(commodity) || n(def.basePrice, BALANCE.MIN_TRADE_PRICE);
    const vol = clamp(n(def.volatility, 0.2), 0.08, 0.45);
    const prices = new Map();
    for (const sid of sectorIds) prices.set(sid, n(mids?.[sid]?.[commodity], base));
    const initialMidpoints = new Map(prices);
    const regionalPressures = new Map();
    for (const sid of sectorIds) {
      let regionalDemandPressure = 0;
      let regionalSupplyPressure = 0;
      const neighbors = neighborCache.get(sid) || [];
      for (const neighbor of neighbors) {
        const os = state.economy?.pressureBySector?.[neighbor.sectorId]?.[commodity] || {};
        regionalDemandPressure += clamp(n(os.shortageSeverity), 0, 1) * neighbor.weight;
        regionalSupplyPressure += clamp(n(os.surplusSeverity), 0, 1) * neighbor.weight;
      }
      regionalPressures.set(sid, { regionalDemandPressure, regionalSupplyPressure });
    }
    for (let i = 0; i < 10; i++) {
      const next = new Map();
      for (const sid of sectorIds) {
        const signal = state.economy?.pressureBySector?.[sid]?.[commodity] || {};
        const profile = profiles[sid] || {};
        const isWaystation = Array.isArray(profile.roleTags) && profile.roleTags.includes('way_station');
        const shortage = clamp(n(signal.shortageSeverity), 0, 1);
        const surplus = clamp(n(signal.surplusSeverity), 0, 1);
        const localFlow = isWaystation ? 0 : clamp((n(signal.dailyConsumption) - n(signal.dailyProduction)) / Math.max(1, n(signal.targetStock, 10)), -1, 1);
        const { regionalDemandPressure = 0, regionalSupplyPressure = 0 } = regionalPressures.get(sid) || {};
        const localPressure = shortage * 0.9 - surplus * 0.7 + localFlow * 0.5;
        const networkPressure = regionalDemandPressure * 0.35 - regionalSupplyPressure * 0.3;
        const target = Math.max(BALANCE.MIN_TRADE_PRICE, base * (1 + localPressure + networkPressure));
        const prev = prices.get(sid) || base;
        next.set(sid, prev * 0.65 + target * 0.35);
      }
      for (const [sid, v] of next.entries()) prices.set(sid, v);
    }
    for (const sid of sectorIds) {
      const signal = state.economy?.pressureBySector?.[sid]?.[commodity] || {};
      const profile = profiles[sid] || {};
      const isWaystation = Array.isArray(profile.roleTags) && profile.roleTags.includes('way_station');
      const shortage = clamp(n(signal.shortageSeverity), 0, 1);
      const surplus = clamp(n(signal.surplusSeverity), 0, 1);
      const localFlow = isWaystation ? 0 : clamp((n(signal.dailyConsumption) - n(signal.dailyProduction)) / Math.max(1, n(signal.targetStock, 10)), -1, 1);
      const { regionalDemandPressure = 0, regionalSupplyPressure = 0 } = regionalPressures.get(sid) || {};
      const localPressure = shortage * 0.9 - surplus * 0.7 + localFlow * 0.5;
      const networkPressure = regionalDemandPressure * 0.35 - regionalSupplyPressure * 0.3;
      diags[sid] = diags[sid] || {};
      diags[sid][commodity] = {
        localShortage: shortage,
        localSurplus: surplus,
        localFlow,
        localPressure,
        networkPressure,
        regionalDemandPressure,
        regionalSupplyPressure,
        routeFriction: Math.max(0, regionalDemandPressure + regionalSupplyPressure),
        confidence: clamp(n(signal.confidence, 0.5), 0, 1),
        midpointBefore: initialMidpoints.get(sid) || base,
        midpointAfter: prices.get(sid) || base,
        strongestSupplierSector: null,
        strongestConsumerSector: null
      };
    }
    for (const sid of sectorIds) {
      mids[sid] = mids[sid] || {};
      const bounded = clamp(prices.get(sid) || base, base * (1 - vol), base * (1 + vol * 1.4));
      mids[sid][commodity] = Math.max(BALANCE.MIN_TRADE_PRICE, Math.round(bounded));
    }
  }
  state.economy.nodeMidPrices = mids;
  state.economy.spatialPriceDiagnostics = diags;
  state.economy.lastSpatialPriceDay = state.player?.time?.day ?? null;
  return mids;
}

export function getMidPriceForSector(sectorId, commodity) {
  return state.economy?.nodeMidPrices?.[sectorId]?.[commodity] || null;
}

export function getSpatialPriceDiagnostics(sectorId, commodity) {
  return state.economy?.spatialPriceDiagnostics?.[sectorId]?.[commodity] || null;
}
