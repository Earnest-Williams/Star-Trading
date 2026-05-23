// @ts-check
import { state } from '../state.js';
import { nudgeCaptainRelation } from './captains.js';
import { addWorldEvent } from '../core/worldEvents.js';
import { StateSlice, stateChanged } from '../core/state/index.js';
import { log } from '../utils.js';
import {
    findEntanglement,
    addOrNudgeEntanglement,
    normaliseEntanglements
} from './entanglements/implementation.js';

const PLAYER_PARTY = Object.freeze({ type: "player", id: "player" });

function makeCaptainParty(captainId) {
    return { type: "captain", id: captainId };
}

/**
 * Checks if a captain is assigned as a route escort.
 * @param {string} captainId
 * @returns {boolean}
 */
export function isCaptainAssignedAsRouteEscort(captainId) {
    if (!Array.isArray(state.tradeRoutes)) return false;
    return state.tradeRoutes.some(route => route.escortCaptainId === captainId);
}

/**
 * Checks if a captain can be assigned as a wingman.
 * @param {string} captainId
 * @returns {{ ok: boolean, reason?: string }}
 */
export function canAssignWingman(captainId) {
    const captain = state.captains?.[captainId];
    if (!captain || captain.status !== "active") {
        return { ok: false, reason: "Captain is not active." };
    }
    if (!captain.known) {
        return { ok: false, reason: "Captain is not known." };
    }
    if (captain.currentSector !== state.player.currentSector) {
        return { ok: false, reason: "Captain is not in your current system." };
    }
    if (captain.currentPlan && captain.currentPlan.type === "mission") {
        return { ok: false, reason: "Captain is busy with a mission." };
    }
    if (isCaptainAssignedAsRouteEscort(captainId)) {
        return { ok: false, reason: "Captain is assigned as a route escort." };
    }
    if (state.player.wing?.captainIds?.includes(captainId)) {
        return { ok: false, reason: "Captain is already in your wing." };
    }

    const rel = captain.relationshipToPlayer || {};
    if (rel.rivalry >= 45) {
        return { ok: false, reason: "Rivalry is too high." };
    }

    // Qualify by relationship, romance, favor, secret, or explicit wingman entanglement
    const hasRomance = findEntanglement("romance", PLAYER_PARTY, makeCaptainParty(captainId));
    const hasSecret = findEntanglement("secret", PLAYER_PARTY, makeCaptainParty(captainId));
    const hasFavor = findEntanglement("favor", PLAYER_PARTY, makeCaptainParty(captainId));
    const hasWingmanEnt = findEntanglement("wingman", PLAYER_PARTY, makeCaptainParty(captainId));
    const highRep = rel.opinion >= 15 && rel.trust >= 10;
    const favorOwed = rel.debt < 0; // Negative debt means player is owed a favor or captain owes debt to player

    if (!hasRomance && !hasSecret && !hasFavor && !hasWingmanEnt && !highRep && !favorOwed) {
        return {
            ok: false,
            reason: "Requires cordial terms, favor owed, secret connection, or personal bond."
        };
    }

    return { ok: true };
}

/**
 * Assigns a captain to the player's wing.
 * @param {string} captainId
 * @param {string} role balanced | overwatch | sensor | quiet | logistics
 * @returns {any} Command result / state slices
 */
export function assignWingman(captainId, role = "balanced") {
    const check = canAssignWingman(captainId);
    if (!check.ok) {
        log(check.reason);
        return false;
    }

    const captain = state.captains[captainId];
    if (!state.player.wing) {
        state.player.wing = { captainIds: [], stance: "balanced" };
    }
    if (!state.player.wing.captainIds) {
        state.player.wing.captainIds = [];
    }

    state.player.wing.captainIds.push(captainId);
    state.player.wing.stance = role;

    // Add or update wingman entanglement
    addOrNudgeEntanglement({
        kind: "wingman",
        parties: [PLAYER_PARTY, makeCaptainParty(captainId)],
        strength: 20,
        pressure: 10,
        publicKnown: false,
        source: "wingman_assignment",
        data: { role }
    });

    // Nudge relationship
    nudgeCaptainRelation(captainId, { opinion: 5, trust: 3 }, "assigned to wing escort");

    // Emit world event
    addWorldEvent({
        type: "wingman",
        captainId,
        sectorId: state.player.currentSector,
        text: `${captain.name} joined your wing as an escort (${role} stance).`,
        importance: 2,
        alert: true
    });

    log(`${captain.name} joined your wing.`);

    return stateChanged(StateSlice.PLAYER, StateSlice.CAPTAINS, StateSlice.ENTANGLEMENTS, StateSlice.EVENTS);
}

/**
 * Releases a captain from the player's wing.
 * @param {string} captainId
 * @returns {any} Command result / state slices
 */
export function releaseWingman(captainId) {
    if (!state.player.wing || !state.player.wing.captainIds || !state.player.wing.captainIds.includes(captainId)) {
        log("Captain is not in your wing.");
        return false;
    }

    state.player.wing.captainIds = state.player.wing.captainIds.filter(id => id !== captainId);

    const captain = state.captains[captainId];
    nudgeCaptainRelation(captainId, { opinion: 2 }, "released from wing escort");

    // Emit world event
    addWorldEvent({
        type: "wingman",
        captainId,
        sectorId: state.player.currentSector,
        text: `${captain.name} was released from your wing.`,
        importance: 1,
        alert: false
    });

    log(`${captain.name} released from wing.`);

    return stateChanged(StateSlice.PLAYER, StateSlice.CAPTAINS, StateSlice.EVENTS);
}

/**
 * Gets all active wingmen captains.
 * @returns {any[]}
 */
export function getActiveWingmen() {
    if (!state.player.wing || !Array.isArray(state.player.wing.captainIds)) return [];
    return state.player.wing.captainIds
        .map(id => state.captains?.[id])
        .filter(c => c && c.status === "active");
}

/**
 * Resolves modifiers for transit scan / travel safety based on active wingmen.
 * @param {string} context
 */
export function getWingmanTransitModifiers() {
    const modifiers = {
        pirateIncidentReduction: 0,
        damageReduction: 0,
        snapshotQuality: 0,
        dataCargoFindChance: 0,
        quietScanBonus: 0,
        interceptionReduction: 0
    };

    const wingmen = getActiveWingmen();
    const stance = state.player.wing?.stance || "balanced";

    wingmen.forEach(captain => {
        const arch = captain.archetype;
        if (arch === "mercenary") {
            if (stance === "overwatch") {
                modifiers.pirateIncidentReduction += 0.25;
                modifiers.damageReduction += 0.30;
            } else {
                modifiers.pirateIncidentReduction += 0.15;
                modifiers.damageReduction += 0.15;
            }
        } else if (arch === "trader") {
            if (stance === "logistics") {
                modifiers.dataCargoFindChance += 0.25;
                modifiers.snapshotQuality += 0.30;
            } else {
                modifiers.dataCargoFindChance += 0.15;
                modifiers.snapshotQuality += 0.15;
            }
        } else if (arch === "smuggler") {
            if (stance === "quiet") {
                modifiers.quietScanBonus += 30;
                modifiers.interceptionReduction += 0.25;
            } else {
                modifiers.quietScanBonus += 15;
                modifiers.interceptionReduction += 0.12;
            }
        }
    });

    return modifiers;
}

/**
 * Resolves modifiers for local system scan / opportunities based on active wingmen.
 * @param {string} context
 */
export function getWingmanLocalModifiers() {
    const modifiers = {
        anomalyScanBonus: 0,
        hazardDetection: 0,
        colonyOpportunityBonus: 0,
        salvageBonus: 0,
        cargoOpportunityBonus: 0
    };

    const wingmen = getActiveWingmen();
    const stance = state.player.wing?.stance || "balanced";

    wingmen.forEach(captain => {
        const arch = captain.archetype;
        if (arch === "miner") {
            if (stance === "sensor") {
                modifiers.anomalyScanBonus += 30;
                modifiers.hazardDetection += 0.20;
            } else {
                modifiers.anomalyScanBonus += 15;
                modifiers.hazardDetection += 0.10;
            }
        } else if (arch === "colonist") {
            if (stance === "balanced") {
                modifiers.colonyOpportunityBonus += 20;
            } else {
                modifiers.colonyOpportunityBonus += 10;
            }
        } else if (arch === "industrialist") {
            if (stance === "logistics") {
                modifiers.salvageBonus += 0.30;
                modifiers.cargoOpportunityBonus += 0.20;
            } else {
                modifiers.salvageBonus += 0.15;
                modifiers.cargoOpportunityBonus += 0.10;
            }
        }
    });

    return modifiers;
}

/**
 * Ticks wingman pressure daily.
 */
export function updateWingmenDaily() {
    normaliseEntanglements();
    const wingmen = getActiveWingmen();
    wingmen.forEach(captain => {
        const party = makeCaptainParty(captain.id);
        const entanglement = findEntanglement("wingman", PLAYER_PARTY, party);
        if (entanglement) {
            entanglement.pressure = Math.min(100, (entanglement.pressure || 0) + 8);
            if (entanglement.pressure > 60 && Math.random() < 0.25) {
                // Obligation favor debt increases
                captain.relationshipToPlayer.debt = Math.max(-20, (captain.relationshipToPlayer.debt || 0) - 1);
                log(`Relying on wingman ${captain.name} increases your obligations.`);
            }
        }
    });
}
