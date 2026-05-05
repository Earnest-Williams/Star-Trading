// js/new/intel.js
// Stub module for the Intel system (planned feature).
// Handles player-gathered intelligence: sector surveys, captain rumors,
// faction front discoveries, and intel brokering.

// import { state } from '../state.js';
// import { FACTIONS } from '../constants.js';
// import { addWorldEvent } from '../core/worldEvents.js';

/**
 * Returns all non-expired intel items for the current player.
 * @returns {Array}
 */
export function getActiveIntel() {
    // TODO: implement intel filtering by expiry, type, and faction
    return [];
}

/**
 * Generates a new intel item and adds it to player.factions.intel.
 * @param {Object} intelDef - { type, factionId, sectorId, value, expiresDay, text }
 */
export function addIntelItem(intelDef) {
    // TODO: implement
}

/**
 * Sells an intel item to a faction contact for credits and reputation.
 * @param {string} intelId
 * @param {string} factionId
 */
export function sellIntelItem(intelId, factionId) {
    // TODO: implement
}
