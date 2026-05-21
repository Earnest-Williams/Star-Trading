import { state } from '../state.js';
import { BALANCE } from '../constants.js';
import { getDominantInfluence } from './influence.js';
import { getPulseServiceSignalForSector } from '../systems/economy/pulseService.js';

const routeCache = new Map();
let cachedRevision = null;
let cachedUniverseRef = null;


class MinHeap {
    constructor(compare) { this.compare = compare; this.items = []; }
    push(item) { this.items.push(item); this.bubbleUp(this.items.length - 1); }
    pop() {
        if (!this.items.length) return null;
        const min = this.items[0];
        const last = this.items.pop();
        if (this.items.length > 0) { this.items[0] = last; this.sinkDown(0); }
        return min;
    }
    get size() { return this.items.length; }
    bubbleUp(index) { while (index > 0) { const parent = Math.floor((index - 1) / 2); if (this.compare(this.items[index], this.items[parent]) >= 0) break; [this.items[index], this.items[parent]] = [this.items[parent], this.items[index]]; index = parent; } }
    sinkDown(index) { const len = this.items.length; while (true) {
            let left = index * 2 + 1;
            let right = left + 1;
            let smallest = index;
            if (left < len && this.compare(this.items[left], this.items[smallest]) < 0) smallest = left;
            if (right < len && this.compare(this.items[right], this.items[smallest]) < 0) smallest = right;
            if (smallest === index) break;
            [this.items[index], this.items[smallest]] = [this.items[smallest], this.items[index]];
            index = smallest;
        } }
}

function numeric(value, fallback = 0) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function compareGatesByDestination(a, b) {
    if (a.destinationSectorId !== b.destinationSectorId) return a.destinationSectorId - b.destinationSectorId;
    return String(a.id || '').localeCompare(String(b.id || ''));
}

export function getWorldGraphRevision() {
    const worldRevision = numeric(state.worldGraphRevision);
    const influenceRevision = numeric(state.influenceRevision);
    const universeChanged = cachedUniverseRef !== state.universe;
    const combinedRevision = `${worldRevision}:${influenceRevision}`;
    if (cachedRevision !== combinedRevision || universeChanged) {
        routeCache.clear();
        cachedRevision = combinedRevision;
        cachedUniverseRef = state.universe;
    }
    return combinedRevision;
}

export function invalidateRoutePlannerCache() {
    routeCache.clear();
    state.worldGraphRevision = numeric(state.worldGraphRevision) + 1;
    cachedRevision = null;
    cachedUniverseRef = state.universe;
}

/** Force signature recheck on the next getWorldGraphRevision() call without bumping the revision counter.
 *  Use this when the universe graph may have changed but you want the signature check to confirm it
 *  (rather than unconditionally bumping the revision as invalidateRoutePlannerCache() does). */
export function markGraphDirty() {
    cachedRevision = null;
    cachedUniverseRef = state.universe;
}

function getOpenGates(sectorId) {
    const sector = state.universe[sectorId];
    if (!sector || !Array.isArray(sector.jumpGates)) return [];
    return sector.jumpGates
        .filter(gate => gate && gate.status !== BALANCE.ROUTE_PLANNER.CLOSED_STATUS && state.universe[gate.destinationSectorId])
        .slice()
        .sort((a, b) => {
            const costDelta = edgeCost(sectorId, a) - edgeCost(sectorId, b);
            if (costDelta !== 0) return costDelta;
            return compareGatesByDestination(a, b);
        });
}

function getFewestHopGates(sectorId) {
    const sector = state.universe[sectorId];
    if (!sector || !Array.isArray(sector.jumpGates)) return [];
    return sector.jumpGates
        .filter(gate => gate && gate.status !== BALANCE.ROUTE_PLANNER.CLOSED_STATUS && state.universe[gate.destinationSectorId])
        .slice()
        .sort(compareGatesByDestination);
}

function reservePressureCost(site) {
    if (!site || site.siteType !== 'way_station' || !site.station) return 0;
    const max = numeric(site.station.pulseReserveMaxCredits);
    if (max <= 0) return BALANCE.ROUTE_PLANNER.DEPLETED_RESERVE_COST;
    const reserve = numeric(site.station.pulseReserveCredits);
    const fraction = Math.max(0, Math.min(1, reserve / max));
    return (1 - fraction) * BALANCE.ROUTE_PLANNER.MAX_RESERVE_PRESSURE_COST;
}

function sectorRiskCost(sectorId) {
    const sector = state.universe[sectorId];
    if (!sector) return 0;
    let risk = numeric(sector.pirateThreat);
    if (sector.region === 'Badlands') risk += BALANCE.ROUTE_PLANNER.BADLANDS_RISK_BONUS;
    const dominant = getDominantInfluence(sectorId);
    if (dominant === 'vc') risk += BALANCE.ROUTE_PLANNER.VC_RISK_BONUS;
    if (dominant === 'sda') risk -= BALANCE.ROUTE_PLANNER.SDA_RISK_REDUCTION;
    return Math.max(0, risk) * BALANCE.ROUTE_PLANNER.SECTOR_RISK_MULTIPLIER;
}

function edgeCost(fromSectorId, gate) {
    const spanBase = numeric(BALANCE.GATE_PHYSICS?.VACUUM_SPAN, 1) || 1;
    const spanCost = Math.max(BALANCE.ROUTE_PLANNER.MIN_SPAN_COST, numeric(gate.effectiveSpanCost, spanBase) / spanBase);
    const tollCost = Math.max(0, numeric(gate.toll)) / BALANCE.ROUTE_PLANNER.TOLL_DIVISOR;
    const stabilityPenalty = Math.max(0, BALANCE.ROUTE_PLANNER.DEFAULT_STABILITY - numeric(gate.stability, BALANCE.ROUTE_PLANNER.DEFAULT_STABILITY)) / BALANCE.ROUTE_PLANNER.STABILITY_PENALTY_DIVISOR;
    const reserveCost = reservePressureCost(state.universe[fromSectorId])
        + reservePressureCost(state.universe[gate.destinationSectorId]) * BALANCE.ROUTE_PLANNER.DESTINATION_RESERVE_COST_MULTIPLIER;
    const pulse = getPulseServiceSignalForSector(gate.destinationSectorId);
    const pulseCost = Math.max(0, (pulse.routeSurchargeMultiplier - 1) * 3);
    return BALANCE.ROUTE_PLANNER.BASE_EDGE_COST + spanCost + tollCost + stabilityPenalty + reserveCost + sectorRiskCost(gate.destinationSectorId) + pulseCost;
}

function buildSegment(fromSectorId, gate) {
    const spanBase = numeric(BALANCE.GATE_PHYSICS?.VACUUM_SPAN, 1) || 1;
    return {
        fromSectorId,
        gateId: gate.id,
        corridorId: gate.corridorId,
        toSectorId: gate.destinationSectorId,
        destinationGateId: gate.destinationGateId,
        effectiveSpanCost: numeric(gate.effectiveSpanCost, spanBase),
        toll: numeric(gate.toll),
        stability: numeric(gate.stability, BALANCE.ROUTE_PLANNER.DEFAULT_STABILITY),
        cost: edgeCost(fromSectorId, gate)
    };
}

function reconstructPath(previous, startSectorId, goalSectorId) {
    const segments = [];
    let current = goalSectorId;
    while (current !== startSectorId) {
        const entry = previous.get(current);
        if (!entry) return null;
        segments.push(buildSegment(entry.fromSectorId, entry.gate));
        current = entry.fromSectorId;
    }
    segments.reverse();
    return segments;
}

function planWeightedCorridorPath(startSectorId, goalSectorId) {
    if (!state.universe[startSectorId] || !state.universe[goalSectorId]) return null;
    if (startSectorId === goalSectorId) return [];

    const distances = new Map([[startSectorId, 0]]);
    const previous = new Map();
        const settled = new Set();

    const frontier = new MinHeap((a, b) => (a.cost - b.cost) || (a.sectorId - b.sectorId));
    frontier.push({ sectorId: startSectorId, cost: 0 });

    while (frontier.size > 0) {
        const current = frontier.pop();
        if (settled.has(current.sectorId)) continue;
        if (current.sectorId === goalSectorId) {
            return reconstructPath(previous, startSectorId, goalSectorId);
        }
        settled.add(current.sectorId);

        getOpenGates(current.sectorId).forEach(gate => {
            const next = gate.destinationSectorId;
            if (settled.has(next)) return;
            const candidateCost = current.cost + edgeCost(current.sectorId, gate);
            const knownCost = distances.has(next) ? distances.get(next) : Infinity;
            if (candidateCost >= knownCost) return;
            distances.set(next, candidateCost);
            previous.set(next, {
                fromSectorId: current.sectorId,
                gate
            });
            frontier.push({ sectorId: next, cost: candidateCost });
        });
    }
    return null;
}


function planFewestHopCorridorPath(startSectorId, goalSectorId) {
    if (!state.universe[startSectorId] || !state.universe[goalSectorId]) return null;
    if (startSectorId === goalSectorId) return [];

    const visited = new Set([startSectorId]);
    const previous = new Map();
    const queue = [startSectorId];
    for (let index = 0; index < queue.length; index++) {
        const currentSectorId = queue[index];
        const gates = getFewestHopGates(currentSectorId);
        for (const gate of gates) {
            const next = gate.destinationSectorId;
            if (visited.has(next)) continue;
            previous.set(next, { fromSectorId: currentSectorId, gate });
            if (next === goalSectorId) return reconstructPath(previous, startSectorId, goalSectorId);
            visited.add(next);
            queue.push(next);
        }
    }
    return null;
}

export function findFewestHopCorridorPath(startSectorId, goalSectorId) {
    const revision = getWorldGraphRevision();
    const key = `${revision}:fewest:${startSectorId}->${goalSectorId}`;
    if (routeCache.has(key)) {
        const cached = routeCache.get(key);
        return cached ? cached.map(segment => ({ ...segment })) : null;
    }
    const path = planFewestHopCorridorPath(startSectorId, goalSectorId);
    routeCache.set(key, path);
    return path ? path.map(segment => ({ ...segment })) : null;
}

export function findFewestHopSectorPath(startSectorId, goalSectorId) {
    const corridorPath = findFewestHopCorridorPath(startSectorId, goalSectorId);
    if (!corridorPath) return null;
    if (corridorPath.length === 0) return [startSectorId];
    return [startSectorId].concat(corridorPath.map(segment => segment.toSectorId));
}

export function findCheapestCorridorPath(startSectorId, goalSectorId) {
    const revision = getWorldGraphRevision();
    const key = `${revision}:${startSectorId}->${goalSectorId}`;
    if (routeCache.has(key)) {
        const cached = routeCache.get(key);
        return cached ? cached.map(segment => ({ ...segment })) : null;
    }
    const path = planWeightedCorridorPath(startSectorId, goalSectorId);
    routeCache.set(key, path);
    return path ? path.map(segment => ({ ...segment })) : null;
}

export function findCheapestSectorPath(startSectorId, goalSectorId) {
    const corridorPath = findCheapestCorridorPath(startSectorId, goalSectorId);
    if (!corridorPath) return null;
    if (corridorPath.length === 0) return [startSectorId];
    return [startSectorId].concat(corridorPath.map(segment => segment.toSectorId));
}

export function getPathCost(path) {
    if (!Array.isArray(path)) return null;
    return path.reduce((sum, segment) => sum + numeric(segment.cost), 0);
}
