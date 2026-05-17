import { state } from '../state.js';
import { BALANCE } from '../constants.js';
import { log, random } from '../utils.js';
import { addWorldEvent } from '../core/worldEvents.js';
import { addFactionRep, addFactionLeverage, getPrivateFactionRep, getFactionTrust, applyPoliticalEffect } from '../core/factions.js';
import { addIntel } from '../core/intel.js';
import { spendTime } from '../core/time.js';
import { Notifications } from '../ui/notifications.js';

export function applyShipDamage(amount) {
    if (!state.player.ship) return;
    let remaining = amount;
    const shieldHit = Math.min(state.player.shields, remaining);
    state.player.shields -= shieldHit;
    remaining -= shieldHit;
    if (remaining > 0) state.player.hull -= remaining;
    if (state.player.hull <= 0) {
        state.player.hull = 1;
        state.player.credits = Math.max(0, Math.floor(state.player.credits * BALANCE.COMBAT.EMERGENCY_REPAIR_CREDIT_MULTIPLIER));
        log("Your ship barely survived. Emergency repairs consumed a chunk of your credits.");
        Notifications.show(`Emergency repairs! Lost ${Math.round((1 - BALANCE.COMBAT.EMERGENCY_REPAIR_CREDIT_MULTIPLIER) * 100)}% credits`, 4);
    }
}

export function fightPirates() {
    const sector = state.universe[state.player.currentSector];
    if (sector.pirateThreat <= 0) { log("No pirate threat here."); return; }
    if (state.player.fighters < BALANCE.COMBAT.PIRATE_FIGHT_MIN_FIGHTERS) { log(`You need at least ${BALANCE.COMBAT.PIRATE_FIGHT_MIN_FIGHTERS} fighters to engage pirates.`); return; }
    if (!spendTime(BALANCE.COMBAT.PIRATE_FIGHT_TIME_MINUTES)) return;
    const threat = sector.pirateThreat;
    const vcSoftening = Math.max(0, getPrivateFactionRep("vc") + getFactionTrust("vc")) / BALANCE.COMBAT.VC_SOFTENING_DIVISOR;
    const fighterLoss = Math.min(state.player.fighters, Math.max(1, Math.floor((BALANCE.COMBAT.FIGHTER_LOSS_BASE + random() * (BALANCE.COMBAT.FIGHTER_LOSS_RANDOM_BASE + threat * BALANCE.COMBAT.FIGHTER_LOSS_THREAT_MULTIPLIER)) * (1 - vcSoftening))));
    const shieldDamage = Math.max(1, Math.floor((BALANCE.COMBAT.SHIELD_DAMAGE_BASE + random() * (BALANCE.COMBAT.SHIELD_DAMAGE_RANDOM_BASE + threat * BALANCE.COMBAT.SHIELD_DAMAGE_THREAT_MULTIPLIER)) * (1 - vcSoftening / BALANCE.COMBAT.SHIELD_DAMAGE_SOFTENING_DIVISOR)));
    const reward = BALANCE.COMBAT.PIRATE_REWARD_BASE + threat * BALANCE.COMBAT.PIRATE_REWARD_THREAT_MULTIPLIER + Math.floor(random() * BALANCE.COMBAT.PIRATE_REWARD_RANDOM);
    state.player.fighters -= fighterLoss;
    applyShipDamage(shieldDamage);
    state.player.credits += reward;
    state.player.reputation += 1;
    applyPoliticalEffect({ factionId: "sda", publicRep: 3, trust: 1, favors: threat >= 3 ? 1 : 0, sectorId: state.player.currentSector, influence: 4, reason: "pirate suppression", memoryKey: "reliableJobs" });
    addFactionRep("vc", -2, "pirate suppression", "public");
    addFactionLeverage("vc", threat >= 3 ? 1 : 0, "you disrupted a useful deniable asset");
    sector.pirateThreat = Math.max(0, sector.pirateThreat - 1 - Math.floor(random() * 2));
    addWorldEvent({ type: "security", factionId: "sda", sectorId: state.player.currentSector, text: `You cleared pirates in sector ${state.player.currentSector}; SDA influence improved and VC standing suffered.`, importance: 3, alert: false });
    log(`Cleared pirates for ${reward} credits. Lost ${fighterLoss} fighters and took ${shieldDamage} damage.`);
    if (random() < BALANCE.COMBAT.PIRATE_INTEL_CHANCE) {
        addIntel({ type: "pirate_route", factionId: "vc", targetFactionId: "sda", sectorId: state.player.currentSector, value: BALANCE.COMBAT.PIRATE_INTEL_VALUE_BASE + threat * BALANCE.COMBAT.PIRATE_INTEL_VALUE_THREAT_MULTIPLIER, expiresDay: state.player.time.day + BALANCE.COMBAT.PIRATE_INTEL_EXPIRY_DAYS, text: `Recovered route chatter linking pirate traffic near sector ${state.player.currentSector} to a shadow broker.` });
    }
}
