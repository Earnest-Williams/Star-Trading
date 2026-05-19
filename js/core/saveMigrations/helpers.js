import { DEFAULT_FACTION_RELATIONS, BALANCE } from '../../constants.js';

export function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function deepClone(value, fallback) {
    if (!isObject(value) && !Array.isArray(value)) return fallback;
    return JSON.parse(JSON.stringify(value));
}

export function deterministicSeedFromPayload(data) {
    const payload = JSON.stringify(data || {});
    let hash = 2166136261;
    for (let i = 0; i < payload.length; i++) {
        hash ^= payload.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) || 1;
}

export function migrateLegacyWarpAdjacencyToJumpGates(universe) {
    if (!isObject(universe)) return;
    Object.values(universe).forEach(sector => {
        if (!isObject(sector)) return;
        if (!Array.isArray(sector.jumpGates)) sector.jumpGates = [];
    });
    Object.values(universe).forEach(sector => {
        if (!isObject(sector) || !Array.isArray(sector.warps)) return;
        sector.warps.forEach(targetId => {
            const target = isObject(universe) ? universe[targetId] : null;
            if (!isObject(target) || sector.id === targetId) return;
            if (sector.jumpGates.some(gate => gate.destinationSectorId === targetId)) return;
            if (!Array.isArray(target.jumpGates)) target.jumpGates = [];
            const corridorId = `legacy-corridor-${Math.min(sector.id, targetId)}-${Math.max(sector.id, targetId)}`;
            const gateAId = `legacy-gate-${sector.id}-${targetId}`;
            const gateBId = `legacy-gate-${targetId}-${sector.id}`;
            sector.jumpGates.push({ id: gateAId, corridorId, destinationSectorId: targetId, destinationGateId: gateBId, status: 'active', owningFactionId: null, toll: 0, stability: BALANCE?.ROUTE_PLANNER?.DEFAULT_STABILITY ?? 100 });
            if (!target.jumpGates.some(gate => gate.destinationSectorId === sector.id)) {
                target.jumpGates.push({ id: gateBId, corridorId, destinationSectorId: sector.id, destinationGateId: gateAId, status: 'active', owningFactionId: null, toll: 0, stability: BALANCE?.ROUTE_PLANNER?.DEFAULT_STABILITY ?? 100 });
            }
        });
    });
    Object.values(universe).forEach(sector => {
        if (isObject(sector) && Object.prototype.hasOwnProperty.call(sector, 'warps')) delete sector.warps;
    });
}

export function migrateShipTransitFields(player) {
    if (!isObject(player) || !isObject(player.ship)) return;
    const legacyTransitMinutes = player.ship.travelMinutesPerWarp;
    if (typeof player.ship.travelMinutesPerCorridor !== 'number') {
        player.ship.travelMinutesPerCorridor = typeof legacyTransitMinutes === 'number' ? legacyTransitMinutes : 45;
    }
    delete player.ship.travelMinutesPerWarp;
}

export function ensureFactionRelationsOnPlayer(data) {
    if (!isObject(data) || !isObject(data.player)) return;
    if (!data.player.seed) data.player.seed = deterministicSeedFromPayload(data);
    if (!data.player.factionRelations) {
        data.player.factionRelations = data.factionRelations
            ? deepClone(data.factionRelations, deepClone(DEFAULT_FACTION_RELATIONS, {}))
            : deepClone(DEFAULT_FACTION_RELATIONS, {});
    }
}
