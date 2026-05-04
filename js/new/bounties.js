// js/new/bounties.js
// Stub module for the Bounty system (planned feature).
// Covers SDA-issued warrants, player bounties, captain bounty hunting,
// and the tension between legal enforcement and frontier independence.

// import { state } from '../state.js';
// import { FACTIONS, BALANCE } from '../constants.js';
// import { addWorldEvent } from '../core/worldEvents.js';
// import { addFactionRep, addFactionHeat } from '../core/factions.js';

/**
 * Returns all active bounties visible to the player.
 * @returns {Array}
 */
export function getActiveBounties() {
    // TODO: implement bounty board
    return [];
}

/**
 * Issues a new bounty (SDA warrant or private contract).
 * @param {Object} bountyDef - { targetId, type, reward, issuedBy, expiresDay }
 */
export function issueBounty(bountyDef) {
    // TODO: implement
}

/**
 * Claims a bounty reward after defeating or capturing the target.
 * @param {string} bountyId
 */
export function claimBounty(bountyId) {
    // TODO: implement
}

/**
 * Checks whether the player currently has a bounty on their head.
 * @returns {boolean}
 */
export function playerHasBounty() {
    // TODO: implement
    return false;
}
