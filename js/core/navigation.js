import { state } from '../state.js';
import { getDominantInfluence } from './influence.js';

export function getSectorNeighbors(sectorId) {
    const sector = state.universe[sectorId];
    if (!sector || !Array.isArray(sector.jumpGates)) return [];
    return sector.jumpGates
        .filter(gate => gate && gate.status !== "closed" && state.universe[gate.destinationSectorId])
        .map(gate => gate.destinationSectorId)
        .filter((id, index, list) => list.indexOf(id) === index)
        .sort((a, b) => a - b);
}

export function getDirectCorridor(startSectorId, goalSectorId) {
    const sector = state.universe[startSectorId];
    if (!sector || !Array.isArray(sector.jumpGates)) return null;
    return sector.jumpGates.find(gate => gate.status !== "closed" && gate.destinationSectorId === goalSectorId) || null;
}

export function findShortestSectorPath(startSectorId, goalSectorId) {
    if (!state.universe[startSectorId] || !state.universe[goalSectorId]) return null;
    if (startSectorId === goalSectorId) return [startSectorId];
    const queue = [[startSectorId]];
    const seen = new Set([startSectorId]);
    while (queue.length > 0) {
        const path = queue.shift();
        const here = path[path.length - 1];
        for (const next of getSectorNeighbors(here)) {
            if (seen.has(next)) continue;
            const newPath = path.concat([next]);
            if (next === goalSectorId) return newPath;
            seen.add(next);
            queue.push(newPath);
        }
    }
    return null;
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
