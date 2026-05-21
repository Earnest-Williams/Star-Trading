import { state } from '../../state.js';
import { findCheapestSectorPath } from '../../core/routePlanner.js';

const PULSE_GOODS = ['pulse_canister', 'heavy_pulse_module', 'gate_coils', 'control_cores'];

function num(v, d = 0) { const n = Number(v); return Number.isFinite(n) ? n : d; }

function getCommodityReserveRatio(sectorId, commodity) {
  const signal = state.economy?.pressureBySector?.[sectorId]?.[commodity];
  if (signal && Number(signal.targetStock || 0) > 0) return Math.max(0, num(signal.currentStock) / Math.max(1, num(signal.targetStock)));
  const profileTarget = num(state.economy?.profilesBySector?.[sectorId]?.targetStock?.[commodity], 20);
  const stock = num(state.ports?.[sectorId]?.stock?.[commodity]) + num(state.planets?.[sectorId]?.stock?.[commodity]);
  return Math.max(0, stock / Math.max(1, profileTarget));
}

export function getPulseServiceSignalForSector(sectorId) {
  const ratios = PULSE_GOODS.map((c) => getCommodityReserveRatio(sectorId, c));
  const reserveRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  let serviceQuality = 'stable';
  if (reserveRatio < 0.25) serviceQuality = 'failing';
  else if (reserveRatio < 0.5) serviceQuality = 'critical';
  else if (reserveRatio < 0.85) serviceQuality = 'strained';
  const routeSurchargeMultiplier = 1 + Math.max(0, 1 - reserveRatio) * 0.35;
  const reliabilityPenalty = Math.max(0, 1 - reserveRatio) * 12;
  const deepRoutePenalty = Math.max(0, 1 - ratios[1]) * 0.25;
  return { sectorId: Number(sectorId), reserveRatio, serviceQuality, routeSurchargeMultiplier, reliabilityPenalty, deepRoutePenalty, warningLevel: serviceQuality, causes: PULSE_GOODS.filter((_, i) => ratios[i] < 0.8) };
}

export function getPulseServiceSignalForPath(pathOrSectorIds) {
  const sectors = Array.isArray(pathOrSectorIds) ? pathOrSectorIds : [];
  if (sectors.length <= 0) return { reserveRatio: 1, serviceQuality: 'stable', routeSurchargeMultiplier: 1, reliabilityPenalty: 0, deepRoutePenalty: 0, causes: [] };
  const signals = sectors.map(getPulseServiceSignalForSector);
  return {
    reserveRatio: Math.min(...signals.map((s) => s.reserveRatio)),
    serviceQuality: signals.sort((a,b)=>a.reserveRatio-b.reserveRatio)[0]?.serviceQuality || 'stable',
    routeSurchargeMultiplier: Math.max(...signals.map((s) => s.routeSurchargeMultiplier)),
    reliabilityPenalty: signals.reduce((sum, s) => sum + s.reliabilityPenalty, 0) / signals.length,
    deepRoutePenalty: signals.reduce((sum, s) => sum + s.deepRoutePenalty, 0) / signals.length,
    warningLevel: signals.sort((a,b)=>a.reserveRatio-b.reserveRatio)[0]?.warningLevel || 'stable',
    causes: Array.from(new Set(signals.flatMap((s) => s.causes || [])))
  };
}

export function getPulseRouteModifiers(originSector, destinationSector) {
  const path = findCheapestSectorPath(originSector, destinationSector) || [originSector, destinationSector];
  const signal = getPulseServiceSignalForPath(path);
  const hops = Math.max(1, path.length - 1);
  const deepScale = hops >= 4 ? 1 + signal.deepRoutePenalty : 1;
  return {
    signal,
    setupMultiplier: signal.routeSurchargeMultiplier * deepScale,
    failureChanceAdd: Math.min(0.2, signal.reliabilityPenalty / 120 + (hops >= 4 ? signal.deepRoutePenalty * 0.4 : 0)),
    reliabilityPenalty: signal.reliabilityPenalty + (hops >= 4 ? signal.deepRoutePenalty * 10 : 0)
  };
}

export function describePulseServiceSignal(signal) {
  return `${signal.serviceQuality} pulse service (${Math.round(signal.reserveRatio * 100)}% reserve)`;
}
