// @ts-check
import { state } from '../state.js';
import { SHIP_MODULE_DEFS } from '../config/shipLoadout.js';
import { spendTime } from '../core/time.js';
import { getGuildTier, addFactionRep, addFactionHeat, getPrivateFactionRep, applyPoliticalEffect } from '../core/factions.js';
import { addWorldEvent } from '../core/worldEvents.js';
import { StateSlice, stateChanged } from '../core/state/index.js';
import { log } from '../utils.js';

/**
 * Normalise a ship's loadout.
 * Ensures the ship has a loadout object with weapons, shields, pulseTender, scannerArray, and cargoExpander.
 * @param {any} ship
 */
export function normaliseShipLoadout(ship) {
    if (!ship) return;
    if (!ship.loadout || typeof ship.loadout !== 'object') {
        ship.loadout = {
            weapons: null,
            shields: null,
            pulseTender: null,
            scannerArray: null,
            cargoExpander: null
        };
    } else {
        ship.loadout.weapons = ship.loadout.weapons || null;
        ship.loadout.shields = ship.loadout.shields || null;
        ship.loadout.pulseTender = ship.loadout.pulseTender || null;
        ship.loadout.scannerArray = ship.loadout.scannerArray || null;
        ship.loadout.cargoExpander = ship.loadout.cargoExpander || null;
    }
}

/**
 * Gets a summary string or object of the ship's current loadout.
 * @param {any} ship
 */
export function getShipLoadoutSummary(ship) {
    if (!ship) return "No ship";
    normaliseShipLoadout(ship);
    const summary = {};
    Object.entries(ship.loadout).forEach(([slot, moduleId]) => {
        if (moduleId) {
            const def = SHIP_MODULE_DEFS[moduleId];
            summary[slot] = def ? def.name : moduleId;
        } else {
            summary[slot] = "Empty";
        }
    });
    return summary;
}

/**
 * Sums up the effects of all installed modules.
 * @param {any} ship
 */
export function getShipSystemBonuses(ship) {
    const bonuses = {
        maxHolds: 0,
        maxShields: 0,
        scannerLevel: 0,
        transitScanPower: 0,
        localScanPower: 0,
        pirateIncidentReduction: 0,
        pulseReserveSupport: 0,
        cargoDataCapacity: 0,
        combatRating: 0
    };
    if (!ship) return bonuses;
    normaliseShipLoadout(ship);
    Object.values(ship.loadout).forEach(moduleId => {
        if (!moduleId) return;
        const mod = SHIP_MODULE_DEFS[moduleId];
        if (!mod || !mod.effects) return;
        Object.keys(bonuses).forEach(key => {
            if (typeof mod.effects[key] === 'number') {
                bonuses[key] += mod.effects[key];
            }
        });
    });
    return bonuses;
}

/**
 * Checks if a module can be installed.
 * @param {string} moduleId
 * @returns {{ ok: boolean, reason?: string, cost?: number }}
 */
export function canInstallShipModule(moduleId) {
    const { player } = state;
    if (!player || !player.ship) {
        return { ok: false, reason: "No assigned ship." };
    }
    const shipyardSiteId = state.world?.roles?.shipyardSiteId;
    if (player.currentSector !== shipyardSiteId) {
        return { ok: false, reason: "Modules can only be installed at StarDock Shipyard." };
    }
    const def = SHIP_MODULE_DEFS[moduleId];
    if (!def) {
        return { ok: false, reason: "Invalid module ID." };
    }

    // Check prerequisites
    if (Array.isArray(def.prerequisites) && def.prerequisites.length > 0) {
        normaliseShipLoadout(player.ship);
        const slot = def.slot;
        const currentInSlot = player.ship.loadout[slot];
        for (const prereq of def.prerequisites) {
            if (currentInSlot !== prereq) {
                const prereqDef = SHIP_MODULE_DEFS[prereq];
                return {
                    ok: false,
                    reason: `Requires ${prereqDef ? prereqDef.name : prereq} installed in slot ${slot}.`
                };
            }
        }
    }

    // Determine cost after discounts
    let cost = def.credits;
    if (def.guildDiscounts) {
        Object.entries(def.guildDiscounts).forEach(([guildId, discount]) => {
            const tier = getGuildTier(guildId);
            cost = Math.round(cost * (1 - tier * discount));
        });
    }

    if (player.credits < cost) {
        return { ok: false, reason: `Not enough credits. Cost: ${cost} credits.`, cost };
    }

    return { ok: true, cost };
}

/**
 * Installs a module onto the player's ship.
 * @param {string} moduleId
 * @returns {any} Command result / state slices
 */
export function installShipModule(moduleId) {
    const check = canInstallShipModule(moduleId);
    if (!check.ok) {
        log(check.reason);
        return false;
    }

    const { player } = state;
    const def = SHIP_MODULE_DEFS[moduleId];
    const cost = check.cost;

    if (!spendTime(def.minutes)) {
        log("Not enough time remaining today.");
        return false;
    }

    player.credits -= cost;
    normaliseShipLoadout(player.ship);

    const slot = def.slot;
    const oldModuleId = player.ship.loadout[slot];
    const oldDef = oldModuleId ? SHIP_MODULE_DEFS[oldModuleId] : null;

    // Mutate loadout
    player.ship.loadout[slot] = moduleId;

    // Apply compatibility updates to ship scalar fields
    // We adjust by (new_effect - old_effect)
    const newEffects = def.effects || {};
    const oldEffects = oldDef ? (oldDef.effects || {}) : {};

    // 1. maxHolds
    const holdsDiff = (newEffects.maxHolds || 0) - (oldEffects.maxHolds || 0);
    if (holdsDiff !== 0) {
        player.ship.maxHolds = Math.max(0, (player.ship.maxHolds || 0) + holdsDiff);
    }

    // 2. maxShields
    const shieldsDiff = (newEffects.maxShields || 0) - (oldEffects.maxShields || 0);
    if (shieldsDiff !== 0) {
        player.ship.maxShields = Math.max(0, (player.ship.maxShields || 0) + shieldsDiff);
        player.shields = Math.min(player.ship.maxShields, Math.max(0, (player.shields || 0) + shieldsDiff));
    }

    // 3. scannerLevel
    const scannerDiff = (newEffects.scannerLevel || 0) - (oldEffects.scannerLevel || 0);
    if (scannerDiff !== 0) {
        player.ship.scannerLevel = Math.max(0, (player.ship.scannerLevel || 0) + scannerDiff);
    }

    // 4. combatRating
    const ratingDiff = (newEffects.combatRating || 0) - (oldEffects.combatRating || 0);
    if (ratingDiff !== 0) {
        player.ship.combatRating = Math.max(0, (player.ship.combatRating || 0) + ratingDiff);
    }

    // Faction rep / heat side effects
    applyPoliticalEffect({
        factionId: "sda",
        publicRep: 1,
        trust: 1,
        sectorId: state.world?.roles?.shipyardSiteId || player.currentSector,
        influence: 1,
        reason: `installed module ${def.name}`
    });

    if (slot === "weapons" && getPrivateFactionRep("vc") > 50) {
        addFactionHeat("sda", def.tier * 2, "notable military module purchase");
    }
    if (slot === "cargoExpander" || slot === "scannerArray") {
        addFactionRep("traders", def.tier, "commercial ship system upgrade");
    }

    // Emit world event
    addWorldEvent({
        type: "shipyard_upgrade",
        sectorId: player.currentSector,
        text: `Installed ship module: ${def.name} into slot ${slot}.`,
        importance: 2,
        alert: false
    });

    log(`Installed ship module: ${def.name}.`);

    return stateChanged(StateSlice.PLAYER, StateSlice.UI_RUNTIME, StateSlice.SHIP_LOADOUT);
}
