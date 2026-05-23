import { state } from '../state.js';
import { BALANCE } from '../config/economy.js';
import { log, random } from '../utils.js';
import { getDominantInfluence } from '../core/influence.js';
import { getPrivateFactionRep, addFactionLeverage, getPirateIncidentMultiplier } from '../core/factions.js';
import { spendTime, advanceTime } from '../core/time.js';
import { Notifications } from '../ui/notifications.js';
import { applyShipDamage } from './combat.js';
import { canTransitDirectCorridor } from '../core/navigation.js';
import {
    carryPublicSnapshotForPlayer,
    maybeGeneratePrivatePayloadOnArrival,
    mergePublicSnapshotsOnArrival
} from '../core/dataCargo.js';
import { maybeSecureDataInterception } from './secureCourier.js';

export function moveTo(target) {
    target = parseInt(target, 10);
    if (!canTransitDirectCorridor(state.player.currentSector, target)) {
        log("No direct jump corridor to that sector.");
        return;
    }
    if (!state.player.ship) {
        log("You need an assigned ship or hired transport before leaving the site.");
        return;
    }
    const transitMinutes = state.player.ship.travelMinutesPerCorridor;
    if (!spendTime(transitMinutes)) return;
    carryPublicSnapshotForPlayer(state.player.currentSector);
    state.player.currentSector = target;
    state.selectedSectorId = target;
    const mergeResult = mergePublicSnapshotsOnArrival(target);
    log(`Transited to sector ${target} via jump gate corridor. Travel took ${transitMinutes} minutes.`);
    if (mergeResult.mergedCount > 0) {
        log(`Updated ${mergeResult.mergedCount} public data snapshot${mergeResult.mergedCount === 1 ? "" : "s"} for sector ${target}.`);
    }
    maybeGeneratePrivatePayloadOnArrival(target);
    maybeTravelIncident();
    maybeSecureDataInterception();
}

export function maybeTravelIncident() {
    const sector = state.universe[state.player.currentSector];
    if (sector.pirateThreat <= 0) return;
    const dominant = getDominantInfluence(state.player.currentSector);
    let chance = Math.min(BALANCE.TRAVEL.PIRATE_INCIDENT_BASE_CHANCE * sector.pirateThreat * getPirateIncidentMultiplier(), BALANCE.TRAVEL.PIRATE_INCIDENT_MAX_CHANCE);
    if (dominant === "sda") chance *= BALANCE.TRAVEL.SDA_INCIDENT_MULTIPLIER;
    if (dominant === "vc" && getPrivateFactionRep("vc") > BALANCE.TRAVEL.VC_RECOGNITION_REP_THRESHOLD) chance *= BALANCE.TRAVEL.VC_INCIDENT_MULTIPLIER;
    if (random() > chance) return;
    const damage = BALANCE.TRAVEL.PIRATE_DAMAGE_BASE + Math.floor(random() * BALANCE.TRAVEL.PIRATE_DAMAGE_RANDOM) + sector.pirateThreat * BALANCE.TRAVEL.PIRATE_DAMAGE_THREAT_MULTIPLIER;
    applyShipDamage(damage);
    log(`Pirates harassed your corridor exit. Shields absorbed ${damage} damage.`);
    Notifications.show(`Pirate attack — ${damage} damage`, 3);
    if (dominant === "vc" && random() < BALANCE.TRAVEL.VC_LEVERAGE_CHANCE) addFactionLeverage("vc", 1, "pirate crew recognized your transponder");
}

export function restUntilMorning() {
    const minutesToMorning = state.player.time.minuteOfDay < state.player.time.wakeMinute
        ? state.player.time.wakeMinute - state.player.time.minuteOfDay
        : (BALANCE.DAY_MINUTES - state.player.time.minuteOfDay) + state.player.time.wakeMinute;
    advanceTime(minutesToMorning, "rest until morning");
    log(`Day ${state.player.time.day}. You rested until morning; the frontier kept moving without you.`);
}
