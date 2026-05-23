import { state } from '../state.js';
import { BALANCE } from '../config/economy.js';
import { FACTIONS, MAJOR_FACTIONS, INFLUENCE_BASES } from '../config/factions.js';
import { clampRange, log } from '../utils.js';
import { addWorldEvent } from './worldEvents.js';

export function createBaseInfluence(region) {
    const base = INFLUENCE_BASES[region] || INFLUENCE_BASES.Frontier;
    const influence = {};
    MAJOR_FACTIONS.forEach(id => { influence[id] = base[id] || 0; });
    return influence;
}

export function normaliseSectorInfluence(sector) {
    if (!sector.influence) sector.influence = createBaseInfluence(sector.region || "Frontier");
    MAJOR_FACTIONS.forEach(id => {
        if (typeof sector.influence[id] !== "number") sector.influence[id] = 0;
        sector.influence[id] = clampRange(sector.influence[id], 0, 100);
    });
}

export function addSectorInfluence(sectorId, factionId, amount, reason) {
    const sector = state.universe[sectorId];
    if (!sector || !MAJOR_FACTIONS.includes(factionId) || amount === 0) return;
    normaliseSectorInfluence(sector);
    const before = sector.influence[factionId] || 0;
    sector.influence[factionId] = clampRange(before + amount, 0, 100);
    MAJOR_FACTIONS.forEach(otherId => {
        if (otherId === factionId) return;
        const pressure = Math.max(0, Math.trunc(Math.abs(amount) / 3));
        if (amount > 0 && pressure > 0) sector.influence[otherId] = clampRange((sector.influence[otherId] || 0) - pressure, 0, 100);
    });
    const influenceRevision = Number(state.influenceRevision);
    state.influenceRevision = Number.isFinite(influenceRevision) ? influenceRevision + 1 : 1;
    if (reason && Math.abs(amount) >= 3) {
        const text = `${FACTIONS[factionId].short} influence ${amount > 0 ? "+" : ""}${amount} in sector ${sectorId}: ${reason}.`;
        addWorldEvent({ type: "influence", factionId, sectorId, text, importance: 2, alert: false });
        log(text);
    }
}

export function getDominantInfluence(sectorId) {
    const sector = state.universe[sectorId];
    if (!sector) return "fu";
    normaliseSectorInfluence(sector);
    let bestId = "fu", bestValue = -Infinity;
    MAJOR_FACTIONS.forEach(id => {
        const value = sector.influence[id] || 0;
        if (value > bestValue) { bestValue = value; bestId = id; }
    });
    return bestId;
}

export function getInfluenceSpread(sectorId) {
    const sector = state.universe[sectorId];
    if (!sector) return [];
    normaliseSectorInfluence(sector);
    return MAJOR_FACTIONS.map(id => ({ id, value: sector.influence[id] || 0 })).sort((a, b) => b.value - a.value);
}

export function getSectorStatusLabel(sectorId) {
    const spread = getInfluenceSpread(sectorId);
    if (spread.length < 2) return "Stable";
    const gap = spread[0].value - spread[1].value;
    if (gap <= BALANCE.CONTESTED_GAP) return "Contested";
    if (spread[0].value >= 70) return "Controlled";
    if (spread[0].value >= 50) return "Dominated";
    return "Mixed";
}

export function getSectorFactionId(sectorId) {
    const sector = state.universe[sectorId];
    if (!sector) return "fu";
    return getDominantInfluence(sectorId);
}
