import { state } from '../state.js';
import { BALANCE } from '../constants.js';
import { getDominantInfluence } from './influence.js';

const routeCache = new Map();
let lastGraphSignature = '';
let cachedRevision = null;
let microtaskScheduled = false;

function numeric(value, fallback = 0) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function gateSortKey(gate) {
    return [
        gate.destinationSectorId,
        gate.id || '',
        gate.corridorId || '',
        gate.status || 'active',
        numeric(gate.effectiveSpanCost),
        numeric(gate.toll),
        numeric(gate.stability, 100)
    ].join(':');
}

function sectorGraphSignature(sectorId) {
    const sector = state.universe[sectorId];
    if (!sector) return `${sectorId}:missing`;
    const gates = Array.isArray(sector.jumpGates)
        ? sector.jumpGates.slice().sort((a, b) => gateSortKey(a).localeCompare(gateSortKey(b)))
        : [];
    const station = sector.station || {};
    return [
        sectorId,
        sector.region || '',
        sector.siteType || '',
        numeric(sector.pirateThreat),
        JSON.stringify(sector.influence || {}),
        numeric(station.pulseReserveCredits),
        numeric(station.pulseReserveMaxCredits),
        gates.map(gateSortKey).join('|')
    ].join(';');
}

function buildGraphSignature() {
    return Object.keys(state.universe)
        .map(Number)
        .sort((a, b) => a - b)
        .map(sectorGraphSignature)
        .join('\n');
}

export function getWorldGraphRevision() {
    if (cachedRevision !== null) return cachedRevision;
    const signature = buildGraphSignature();
    if (signature !== lastGraphSignature) {
        lastGraphSignature = signature;
        state.worldGraphRevision = numeric(state.worldGraphRevision) + 1;
        routeCache.clear();
    }
    cachedRevision = state.worldGraphRevision;
    if (!microtaskScheduled) {
        microtaskScheduled = true;
        Promise.resolve().then(() => { microtaskScheduled = false; cachedRevision = null; });
    }
    return cachedRevision;
}

export function invalidateRoutePlannerCache() {
    lastGraphSignature = '';
    routeCache.clear();
    state.worldGraphRevision = numeric(state.worldGraphRevision) + 1;
    cachedRevision = null;
}

/** Force signature recheck on the next getWorldGraphRevision() call without bumping the revision counter.
 *  Use this when the universe graph may have changed but you want the signature check to confirm it
 *  (rather than unconditionally bumping the revision as invalidateRoutePlannerCache() does). */
export function markGraphDirty() {
    cachedRevision = null;
    lastGraphSignature = '';
}

function getOpenGates(sectorId) {
    const sector = state.universe[sectorId];
    if (!sector || !Array.isArray(sector.jumpGates)) return [];
    return sector.jumpGates
        .filter(gate => gate && gate.status !== 'closed' && state.universe[gate.destinationSectorId])
        .slice()
        .sort((a, b) => {
            const costDelta = edgeCost(sectorId, a) - edgeCost(sectorId, b);
            if (costDelta !== 0) return costDelta;
            if (a.destinationSectorId !== b.destinationSectorId) return a.destinationSectorId - b.destinationSectorId;
            return String(a.id || '').localeCompare(String(b.id || ''));
        });
}

function reservePressureCost(site) {
    if (!site || site.siteType !== 'way_station' || !site.station) return 0;
    const max = numeric(site.station.pulseReserveMaxCredits);
    if (max <= 0) return 4;
    const reserve = numeric(site.station.pulseReserveCredits);
    const fraction = Math.max(0, Math.min(1, reserve / max));
    return (1 - fraction) * 4;
}

function sectorRiskCost(sectorId) {
    const sector = state.universe[sectorId];
    if (!sector) return 0;
    let risk = numeric(sector.pirateThreat);
    if (sector.region === 'Badlands') risk += 1;
    const dominant = getDominantInfluence(sectorId);
    if (dominant === 'vc') risk += 1;
    if (dominant === 'sda') risk -= 1;
    return Math.max(0, risk) * 1.5;
}

function edgeCost(fromSectorId, gate) {
    const spanBase = numeric(BALANCE.GATE_PHYSICS?.VACUUM_SPAN, 1) || 1;
    const spanCost = Math.max(0.1, numeric(gate.effectiveSpanCost, spanBase) / spanBase);
    const tollCost = Math.max(0, numeric(gate.toll)) / 100;
    const stabilityPenalty = Math.max(0, 100 - numeric(gate.stability, 100)) / 25;
    const reserveCost = reservePressureCost(state.universe[fromSectorId])
        + reservePressureCost(state.universe[gate.destinationSectorId]) * 0.5;
    return 1 + spanCost + tollCost + stabilityPenalty + reserveCost + sectorRiskCost(gate.destinationSectorId);
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
        stability: numeric(gate.stability, 100),
        cost: edgeCost(fromSectorId, gate)
    };
}

function reconstructPath(previous, startSectorId, goalSectorId) {
    const segments = [];
    let current = goalSectorId;
    while (current !== startSectorId) {
        const entry = previous.get(current);
        if (!entry) return null;
        segments.push(entry.segment);
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
    const frontier = [{ sectorId: startSectorId, cost: 0 }];
    const settled = new Set();

    while (frontier.length > 0) {
        // O(N) min-extraction: find lowest-cost frontier entry (ties broken by sectorId for determinism).
        let minIdx = 0;
        for (let i = 1; i < frontier.length; i++) {
            const a = frontier[i], b = frontier[minIdx];
            if (a.cost < b.cost || (a.cost === b.cost && a.sectorId < b.sectorId)) minIdx = i;
        }
        const [current] = frontier.splice(minIdx, 1);
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
                segment: buildSegment(current.sectorId, gate)
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
    const queue = [{ sectorId: startSectorId, segments: [] }];
    for (let index = 0; index < queue.length; index++) {
        const current = queue[index];
        const gates = getOpenGates(current.sectorId)
            .sort((a, b) => {
                if (a.destinationSectorId !== b.destinationSectorId) return a.destinationSectorId - b.destinationSectorId;
                return String(a.id || '').localeCompare(String(b.id || ''));
            });
        for (const gate of gates) {
            const next = gate.destinationSectorId;
            if (visited.has(next)) continue;
            const segments = current.segments.concat(buildSegment(current.sectorId, gate));
            if (next === goalSectorId) return segments;
            visited.add(next);
            queue.push({ sectorId: next, segments });
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
