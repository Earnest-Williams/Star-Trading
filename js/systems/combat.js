import { state } from '../state.js';
import { FACTIONS } from '../constants.js';
import { log, random } from '../utils.js';
import { getDominantInfluence } from '../core/influence.js';
import { addWorldEvent } from '../core/worldEvents.js';
import { addFactionRep, addFactionHeat, addFactionLeverage, addFactionTrust, getPrivateFactionRep, getFactionTrust, applyPoliticalEffect, getPirateIncidentMultiplier } from '../core/factions.js';
import { addIntel } from '../core/intel.js';
import { spendTime } from '../core/time.js';
import { Notifications } from '../ui/notifications.js';

export function applyShipDamage(amount) {
    let remaining = amount;
    const shieldHit = Math.min(state.player.shields, remaining);
    state.player.shields -= shieldHit;
    remaining -= shieldHit;
    if (remaining > 0) state.player.hull -= remaining;
    if (state.player.hull <= 0) {
        state.player.hull = 1;
        state.player.credits = Math.max(0, Math.floor(state.player.credits * 0.75));
        log("Your ship barely survived. Emergency repairs consumed a chunk of your credits.");
        Notifications.show("Emergency repairs! Lost 25% credits", 4);
    }
}

export function fightPirates() {
    const sector = state.universe[state.player.currentSector];
    if (sector.pirateThreat <= 0) { log("No pirate threat here."); return; }
    if (state.player.fighters < 10) { log("You need at least 10 fighters to engage pirates."); return; }
    if (!spendTime(60)) return;
    const threat = sector.pirateThreat;
    const vcSoftening = Math.max(0, getPrivateFactionRep("vc") + getFactionTrust("vc")) / 1000;
    const fighterLoss = Math.min(state.player.fighters, Math.max(1, Math.floor((3 + random() * (8 + threat * 4)) * (1 - vcSoftening))));
    const shieldDamage = Math.max(1, Math.floor((10 + random() * (12 + threat * 8)) * (1 - vcSoftening / 2)));
    const reward = 250 + threat * 350 + Math.floor(random() * 300);
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
    if (random() < 0.25) {
        addIntel({ type: "pirate_route", factionId: "vc", targetFactionId: "sda", sectorId: state.player.currentSector, value: 30 + threat * 5, expiresDay: state.player.time.day + 7, text: `Recovered route chatter linking pirate traffic near sector ${state.player.currentSector} to a shadow broker.` });
    }
}
