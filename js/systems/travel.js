import { state } from '../state.js';
import { BALANCE } from '../constants.js';
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

export function moveTo(target) {
    target = parseInt(target, 10);
    if (!canTransitDirectCorridor(state.player.currentSector, target)) {
        log("No direct jump corridor to that sector.");
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
}

export function maybeTravelIncident() {
    const sector = state.universe[state.player.currentSector];
    if (sector.pirateThreat <= 0) return;
    const dominant = getDominantInfluence(state.player.currentSector);
    let chance = Math.min(0.08 * sector.pirateThreat * getPirateIncidentMultiplier(), 0.35);
    if (dominant === "sda") chance *= 0.65;
    if (dominant === "vc" && getPrivateFactionRep("vc") > 50) chance *= 0.55;
    if (random() > chance) return;
    const damage = 8 + Math.floor(random() * 15) + sector.pirateThreat * 2;
    applyShipDamage(damage);
    log(`Pirates harassed your corridor exit. Shields absorbed ${damage} damage.`);
    Notifications.show(`Pirate attack — ${damage} damage`, 3);
    if (dominant === "vc" && random() < 0.30) addFactionLeverage("vc", 1, "pirate crew recognized your transponder");
}

export function restUntilMorning() {
    const minutesToMorning = state.player.time.minuteOfDay < state.player.time.wakeMinute
        ? state.player.time.wakeMinute - state.player.time.minuteOfDay
        : (BALANCE.DAY_MINUTES - state.player.time.minuteOfDay) + state.player.time.wakeMinute;
    advanceTime(minutesToMorning, "rest until morning");
    log(`Day ${state.player.time.day}. You rested until morning; the frontier kept moving without you.`);
}
