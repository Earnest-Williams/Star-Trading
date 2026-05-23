import { state } from '../state.js';
import { FACTIONS } from '../config/factions.js';
import { formatCredits, log, random } from '../utils.js';
import { Notifications } from '../ui/notifications.js';
import {
    addFactionHeat,
    addFactionRep,
    addFactionTrust,
    ensureFactionState,
    recordFactionMemory
} from './factions.js';

export function getActiveIntel() {
    ensureFactionState();
    return state.player.factions.intel.filter(item => item.expiresDay >= state.player.time.day);
}

export function addIntel(intel) {
    ensureFactionState();
    const entry = {
        id: intel.id || `intel-${state.player.time.day}-${Math.floor(random() * 100000)}`,
        type: intel.type,
        factionId: intel.factionId || null,
        targetFactionId: intel.targetFactionId || null,
        sectorId: intel.sectorId || state.player.currentSector,
        value: intel.value || 25,
        expiresDay: intel.expiresDay || state.player.time.day + 8,
        text: intel.text || "Useful political information."
    };
    state.player.factions.intel.push(entry);
    log(`Intel acquired: ${entry.text}`);
    Notifications.show(`Intel: ${entry.text}`, 2);
    return entry;
}

export function expireIntel() {
    if (!state.player || !state.player.factions) return;
    if (!Array.isArray(state.player.factions.intel)) return;

    state.player.factions.intel = state.player.factions.intel.filter(
        item => item.expiresDay >= state.player.time.day
    );
}

export function sellIntel(intelId, factionId) {
    ensureFactionState();
    const idx = state.player.factions.intel.findIndex(item => item.id === intelId);
    if (idx < 0 || !FACTIONS[factionId]) return;
    const item = state.player.factions.intel[idx];
    if (item.expiresDay < state.player.time.day) {
        state.player.factions.intel.splice(idx, 1);
        log("That intel has expired.");
        return;
    }
    const reward = item.value * (factionId === "traders" ? 18 : 12);
    state.player.credits += reward;
    if (factionId === "vc") {
        addFactionRep("vc", 3, "intel sold quietly", "private");
        addFactionHeat("sda", 3, "suspicious intel traffic");
    } else {
        addFactionRep(factionId, 2, "intel provided", "public");
        addFactionTrust(factionId, 1, "useful intel");
    }
    if (item.targetFactionId && item.targetFactionId !== factionId) {
        recordFactionMemory(item.targetFactionId, "helpedEnemies", 1);
    }
    state.player.factions.intel.splice(idx, 1);
    log(`Intel sold for ${formatCredits(reward)} credits.`);
    return reward;
}
