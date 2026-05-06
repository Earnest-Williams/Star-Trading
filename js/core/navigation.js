import { state } from '../state.js';
import { getDominantInfluence } from './influence.js';

export function getOutboundJumpGates(sectorId) {
    const sector = state.universe[sectorId];
    if (!sector || !Array.isArray(sector.jumpGates)) return [];
    return sector.jumpGates
        .filter(gate => gate && gate.status !== "closed" && state.universe[gate.destinationSectorId])
        .slice()
        .sort((a, b) => {
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

export function findShortestCorridorPath(startSectorId, goalSectorId) {
    if (!state.universe[startSectorId] || !state.universe[goalSectorId]) return null;
    if (startSectorId === goalSectorId) return [];
    const queue = [{ sectorId: startSectorId, segments: [] }];
    const seen = new Set([startSectorId]);
    while (queue.length > 0) {
        const current = queue.shift();
        for (const gate of getOutboundJumpGates(current.sectorId)) {
            const next = gate.destinationSectorId;
            if (seen.has(next)) continue;
            const segment = {
                fromSectorId: current.sectorId,
                gateId: gate.id,
                corridorId: gate.corridorId,
                toSectorId: next,
                destinationGateId: gate.destinationGateId
            };
            const segments = current.segments.concat([segment]);
            if (next === goalSectorId) return segments;
            seen.add(next);
            queue.push({ sectorId: next, segments });
        }
    }
    return null;
}

export function findShortestSectorPath(startSectorId, goalSectorId) {
    const corridorPath = findShortestCorridorPath(startSectorId, goalSectorId);
    if (!corridorPath) return null;
    if (corridorPath.length === 0) return [startSectorId];
    return [startSectorId].concat(corridorPath.map(segment => segment.toSectorId));
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
