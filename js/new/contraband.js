// js/new/contraband.js
// First shipped slice of contraband: hidden hold state, Cartel acquisition,
// SDA inspections, and delivery to ports with hidden Cartel demand.

import { state } from '../state.js';
import { addWorldEvent } from '../core/worldEvents.js';
import { addFactionHeat, addFactionRep, addFactionTrust } from '../core/factions.js';
import { getRouteRiskForSectors } from '../systems/tradeRoutes.js';
import { formatCredits, log, random } from '../utils.js';

const CONTRABAND_TYPES = {
    black_market_eq: { name: "Black-Market Equipment", value: 220, heat: 4 },
    forged_manifests: { name: "Forged Manifests", value: 140, heat: 2 },
    restricted_meds: { name: "Restricted Meds", value: 180, heat: 3 }
};

function ensureContrabandHold() {
    if (!state.player) return [];
    if (!Array.isArray(state.player.contrabandHold)) state.player.contrabandHold = [];
    return state.player.contrabandHold;
}

export function getContrabandHold() {
    return ensureContrabandHold().filter(item => item.amount > 0);
}

export function acquireContraband(itemType, amount) {
    const definition = CONTRABAND_TYPES[itemType];
    const count = parseInt(amount, 10);
    if (!definition || !Number.isFinite(count) || count <= 0) return false;
    const hold = ensureContrabandHold();
    const existing = hold.find(item => item.type === itemType);
    if (existing) existing.amount += count;
    else hold.push({ type: itemType, amount: count, acquiredSector: state.player.currentSector });
    addFactionRep("vc", Math.max(1, Math.floor(count / 5)), "contraband pickup", "private");
    addFactionTrust("vc", 1, "accepted hidden cargo");
    addFactionHeat("sda", definition.heat, "contraband pickup");
    addWorldEvent({
        type: "contraband_acquired",
        sectorId: state.player.currentSector,
        factionId: "vc",
        text: `Loaded ${count} ${definition.name} into the hidden hold.`,
        importance: 2,
        alert: true
    });
    return true;
}

export function runInspectionCheck() {
    const hold = getContrabandHold();
    if (hold.length === 0) return false;
    const heat = hold.reduce((sum, item) => {
        const definition = CONTRABAND_TYPES[item.type];
        return sum + (definition ? definition.heat * item.amount : item.amount);
    }, 0);
    const scannerMitigation = Math.max(0, (state.player.ship.scannerLevel || 1) - 1) * 0.04;
    const detectionChance = Math.min(0.75, 0.08 + heat * 0.015 - scannerMitigation);
    if (random() >= detectionChance) return false;
    const confiscated = hold.reduce((sum, item) => sum + item.amount, 0);
    state.player.contrabandHold = [];
    addFactionHeat("sda", Math.min(25, 5 + confiscated), "contraband discovered");
    addFactionRep("vc", -Math.min(8, confiscated), "lost a hidden shipment", "private");
    addWorldEvent({
        type: "contraband_bust",
        sectorId: state.player.currentSector,
        factionId: "sda",
        text: `SDA inspectors found and confiscated ${confiscated} contraband units.`,
        importance: 4,
        alert: true
    });
    return true;
}

export function deliverContraband(contactId) {
    const hold = getContrabandHold();
    if (hold.length === 0) return false;
    const port = state.ports[state.player.currentSector];
    if (!port || port.hiddenFactionId !== "vc") {
        log("No trusted Cartel receiver is available in this sector.");
        return false;
    }
    const delivered = hold.reduce((sum, item) => sum + item.amount, 0);
    const cargoValue = hold.reduce((sum, item) => {
        const definition = CONTRABAND_TYPES[item.type];
        return sum + item.amount * (definition ? definition.value : 100);
    }, 0);
    const originSector = hold[0].acquiredSector || state.player.currentSector;
    const routeRisk = getRouteRiskForSectors(originSector, state.player.currentSector) || 0;
    const reward = Math.floor(cargoValue * (1.0 + Math.min(0.5, routeRisk * 0.04)));
    state.player.credits += reward;
    state.player.contrabandHold = [];
    addFactionRep("vc", Math.max(2, Math.floor(delivered / 3)), "contraband delivered", "private");
    addFactionTrust("vc", 2, "completed a hidden delivery");
    addFactionHeat("sda", Math.min(10, 1 + Math.floor(delivered / 4)), "contraband delivery rumors");
    addWorldEvent({
        type: "contraband_delivered",
        sectorId: state.player.currentSector,
        factionId: "vc",
        text: `Delivered ${delivered} hidden units for ${contactId || "a Cartel receiver"} and earned ${formatCredits(reward)} credits.`,
        importance: 3,
        alert: true
    });
    return reward;
}
