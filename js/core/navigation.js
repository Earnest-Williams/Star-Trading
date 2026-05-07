import { state } from '../state.js';
import { BALANCE } from '../constants.js';
import { getDominantInfluence } from './influence.js';
import {
    findCheapestCorridorPath,
    findCheapestSectorPath,
    findFewestHopCorridorPath,
    findFewestHopSectorPath
} from './routePlanner.js';

export function getOutboundJumpGates(sectorId) {
    const sector = state.universe[sectorId];
    if (!sector || !Array.isArray(sector.jumpGates)) return [];
    return sector.jumpGates
        .filter(gate => gate && gate.status !== "closed" && state.universe[gate.destinationSectorId])
        .slice()
        .sort((a, b) => {
            const aCost = typeof a.effectiveSpanCost === "number" ? a.effectiveSpanCost : 0;
            const bCost = typeof b.effectiveSpanCost === "number" ? b.effectiveSpanCost : 0;
            if (aCost !== bCost) return aCost - bCost;
            if (a.destinationSectorId !== b.destinationSectorId) return a.destinationSectorId - b.destinationSectorId;
            return String(a.id || "").localeCompare(String(b.id || ""));
        });
}

export function getSectorNeighbors(sectorId) {
    return getOutboundJumpGates(sectorId)
        .map(gate => gate.destinationSectorId)
        .filter((id, index, list) => list.indexOf(id) === index);
}

export function getDirectCorridor(startSectorId, goalSectorId) {
    return getOutboundJumpGates(startSectorId)
        .find(gate => gate.destinationSectorId === goalSectorId) || null;
}

export function findFewestHopPath(startSectorId, goalSectorId) {
    return findFewestHopSectorPath(startSectorId, goalSectorId);
}

export function findFewestHopCorridorRoute(startSectorId, goalSectorId) {
    return findFewestHopCorridorPath(startSectorId, goalSectorId);
}

export function findShortestCorridorPath(startSectorId, goalSectorId) {
    return findCheapestCorridorPath(startSectorId, goalSectorId);
}

export function findShortestSectorPath(startSectorId, goalSectorId) {
    return findCheapestSectorPath(startSectorId, goalSectorId);
}

export function getSectorPathDistance(startSectorId, goalSectorId) {
    const path = findShortestSectorPath(startSectorId, goalSectorId);
    return path ? Math.max(1, path.length - 1) : null;
}

export function areSectorsConnected(startSectorId, goalSectorId) {
    return Boolean(findShortestSectorPath(startSectorId, goalSectorId));
}

export function getCorridorRiskForPath(path) {
    if (!Array.isArray(path) || path.length === 0) return null;
    return path.reduce((sum, sectorId) => {
        const sector = state.universe[sectorId];
        if (!sector) return sum;
        const dominant = getDominantInfluence(sectorId);
        let risk = sector.pirateThreat || 0;
        if (sector.region === "Badlands") risk += 1;
        if (dominant === "vc") risk += 1;
        if (dominant === "sda") risk -= 1;
        return sum + Math.max(0, risk);
    }, 0);
}

export function canTransitDirectCorridor(startSectorId, goalSectorId) {
    return Boolean(getDirectCorridor(startSectorId, goalSectorId));
}


export function getWayStationReserveState(site) {
    if (!site || site.siteType !== "way_station" || !site.station) return null;
    const max = site.station.pulseReserveMaxCredits || 0;
    const reserve = site.station.pulseReserveCredits || 0;
    if (max <= 0) return "Depleted";
    const fraction = reserve / max;
    const thresholds = BALANCE.GATE_PHYSICS.WAY_STATION.RESERVE_STATE_THRESHOLDS;
    if (fraction >= thresholds.full) return "Full";
    if (fraction >= thresholds.stable) return "Stable";
    if (fraction >= thresholds.strained) return "Strained";
    if (fraction >= thresholds.low) return "Low Reserve";
    return "Depleted";
}

export function getRelaySurchargeForPath(path) {
    if (!Array.isArray(path)) return 0;
    const wayStationCount = path.reduce((count, sectorId) => {
        const site = state.universe[sectorId];
        return count + (site && site.siteType === "way_station" ? 1 : 0);
    }, 0);
    const surcharges = BALANCE.GATE_PHYSICS.ROUTE_SURCHARGE_BY_WAY_STATIONS;
    return surcharges[Math.min(wayStationCount, surcharges.length - 1)] || 0;
}
