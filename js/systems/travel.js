// @ts-check
import { state } from '../state.js';
import { BALANCE } from '../config/economy.js';
import { log, random } from '../utils.js';
import { getDominantInfluence } from '../core/influence.js';
import { getPrivateFactionRep, addFactionLeverage, getPirateIncidentMultiplier } from '../core/factions.js';
import { spendTime, advanceTime } from '../core/time.js';
import { Notifications } from '../ui/notifications.js';
import { applyShipDamage } from './combat.js';
import { canTransitDirectCorridor, getDirectCorridor } from '../core/navigation.js';
import {
    carryPublicSnapshotForPlayer,
    maybeGeneratePrivatePayloadOnArrival,
    mergePublicSnapshotsOnArrival,
    addPrivatePayloadToPlayerHold
} from '../core/dataCargo.js';
import { maybeSecureDataInterception } from './secureCourier.js';
import {
    getScanResolutionScore,
    getDeepScanRiskAdjustment
} from '../core/characterChecks.js';
import { getShipSystemBonuses } from './shipLoadout.js';
import { getWingmanTransitModifiers, getWingmanLocalModifiers } from './wingmen.js';
import { StateSlice, stateChanged } from '../core/state/index.js';

// =====================================================
// LOCAL SPACE MOVEMENT & UTILITIES
// =====================================================

export function getLocalLocationsForSystem(systemId) {
    if (!state.localSpace || !state.localSpace.locationIdsBySystemId[systemId]) return [];
    return state.localSpace.locationIdsBySystemId[systemId].map(id => state.localSpace.locationsById[id]);
}

export function getCurrentLocalLocation() {
    if (!state.player || !state.player.currentLocationId) return null;
    return state.localSpace?.locationsById[state.player.currentLocationId] || null;
}

export function getCurrentLocalServices() {
    const loc = getCurrentLocalLocation();
    if (!loc || !loc.dockable) return new Set();
    const services = new Set();
    if (loc.marketId) services.add("market");
    if (loc.planetId) services.add("colony");
    if (loc.stationId && loc.stationId === state.world?.roles?.shipyardSiteId) services.add("shipyard");
    return services;
}

export function canAccessLocalService(serviceId) {
    return getCurrentLocalServices().has(serviceId);
}

export function canMoveLocal(locationId) {
    const { player, localSpace } = state;
    if (!player || !player.ship) return false;
    if (!localSpace || !localSpace.locationsById[locationId]) return false;
    const loc = localSpace.locationsById[locationId];
    if (loc.systemId !== player.currentSystemId) return false;
    if (player.currentLocationId === locationId) return false;
    // Location must be discovered/known to maneuver there
    if (!localSpace.discoveredLocationIds[locationId] && !loc.known) return false;
    return true;
}

export function moveLocal(locationId, options = {}) {
    if (!canMoveLocal(locationId)) {
        log("Cannot maneuver to that location.");
        return false;
    }
    const { player, localSpace } = state;
    const loc = localSpace.locationsById[locationId];
    const transitMinutes = options.minutes || 30;

    if (!spendTime(transitMinutes)) {
        log("Not enough time remaining today.");
        return false;
    }

    const previousLocationId = player.currentLocationId;
    player.currentLocationId = locationId;

    log(`Maneuvered from ${localSpace.locationsById[previousLocationId]?.name || "previous contact"} to ${loc.name}. Travel took ${transitMinutes} minutes.`);

    // Resolve local incident
    resolveTravelIncident({
        movementType: "local",
        locationId,
        shipBonuses: getShipSystemBonuses(player.ship),
        wingmanModifiers: getWingmanLocalModifiers()
    });

    return stateChanged(StateSlice.PLAYER, StateSlice.LOCAL_SPACE, StateSlice.UI_RUNTIME);
}

// =====================================================
// SCANNING GAMEPLAY
// =====================================================

/**
 * Resolves a scan outcome for local or corridor context.
 */
function resolveScanOutcome({ scanPower, difficulty, depth }) {
    const { player } = state;
    const roll = random() * 100;
    const margin = scanPower - difficulty;

    if (margin < -15) {
        log("Sensor array returned only static. Signal degraded.");
        return;
    }

    // Determine outcomes based on roll and scan depth
    if (depth === "deep") {
        if (roll < 20) {
            // Find private data payload
            const value = 800 + Math.floor(random() * 1200);
            const payload = {
                title: "Encrypted Ledger Link",
                description: `Intercepted transaction data from site ${player.currentSystemId}.`,
                value,
                expiryDays: 3,
                text: "Encrypted link packet found during deep scan."
            };
            addPrivatePayloadToPlayerHold(payload);
            log(`Deep scan revealed an encrypted link packet! Added to private data hold.`);
        } else if (roll < 40) {
            // Survey anomaly / data burst
            player.credits += 400;
            log(`Signal capture complete. Decoded stellar telemetry worth 400 credits.`);
        } else if (roll < 65) {
            // Secure courier lead
            log(`Sensor sweep registered a secure courier transponder beacon. Recorded lead.`);
        } else {
            // Public snapshot data improvement
            mergePublicSnapshotsOnArrival(player.currentSystemId);
            log(`Sensor sweep completed. Public snapshot knowledge refined.`);
        }
    } else {
        // Passive scan
        if (roll < 15) {
            // Telemetry data
            player.credits += 100;
            log(`Passive scan resolved basic telemetry. Logged 100 credits.`);
        } else {
            log(`Passive scan complete. No outstanding anomalies detected.`);
        }
    }
}

export function scanLocalLocation(locationId, depth = "passive") {
    const { player, localSpace } = state;
    if (!player || !player.ship || !localSpace || !localSpace.locationsById[locationId]) return false;
    const loc = localSpace.locationsById[locationId];
    if (loc.systemId !== player.currentSystemId) return false;
    const minutes = depth === "deep" ? 60 : 10;

    if (!spendTime(minutes)) {
        log("Not enough time remaining today.");
        return false;
    }

    const shipBonuses = getShipSystemBonuses(player.ship);
    const wingmanModifiers = getWingmanLocalModifiers();

    const scanPower = (shipBonuses.localScanPower || 10) +
                      getScanResolutionScore(player.character) +
                      (wingmanModifiers.anomalyScanBonus || 0);

    const difficulty = loc.scanDifficulty + (loc.threat * 5) + (loc.hazard * 10);

    log(`Scanning ${loc.name} at depth: ${depth}. (Power: ${scanPower} vs Difficulty: ${difficulty})`);

    if (depth === "deep") {
        loc.surveyed = true;
        // Deep scan risk adjustment reduces exposure
        const riskMod = getDeepScanRiskAdjustment(player.character);
        const risk = Math.max(0, (loc.hazard * 40) + (loc.threat * 15) + riskMod);
        if (random() * 100 < risk) {
            const damage = Math.floor(10 + random() * 20);
            applyShipDamage(damage);
            log(`Stellar volatility or pirate interference damaged systems. Shields absorbed ${damage} damage.`);
        }

        // Reveal hidden anomaly
        if (loc.kind === "anomaly" && !loc.known) {
            loc.known = true;
            localSpace.discoveredLocationIds[loc.id] = true;
            log(`Anomalous signal resolved! Discovered contact: ${loc.name}.`);
        }
        resolveScanOutcome({ context: "local_location", locationId, scanPower, difficulty, depth });
    } else {
        resolveScanOutcome({ context: "local_location", locationId, scanPower, difficulty, depth });
    }

    return stateChanged(StateSlice.PLAYER, StateSlice.LOCAL_SPACE, StateSlice.UI_RUNTIME);
}

export function scanLocalSpace(depth = "passive") {
    const { player } = state;
    if (!player || !player.ship) return false;
    const minutes = depth === "deep" ? 60 : 15;

    if (!spendTime(minutes)) {
        log("Not enough time remaining today.");
        return false;
    }

    const shipBonuses = getShipSystemBonuses(player.ship);
    const wingmanModifiers = getWingmanLocalModifiers();

    const scanPower = (shipBonuses.localScanPower || 10) +
                      getScanResolutionScore(player.character) +
                      (wingmanModifiers.anomalyScanBonus || 0);

    log(`Initiated local space sector scan. Depth: ${depth}. Scan Power: ${scanPower}`);

    // Try to discover hidden anomalies in the system
    const systemId = player.currentSystemId;
    const locations = getLocalLocationsForSystem(systemId);
    let revealedAny = false;

    locations.forEach(loc => {
        if (loc.kind === "anomaly" && !loc.known) {
            const difficulty = loc.scanDifficulty;
            if (scanPower >= difficulty || (depth === "deep" && random() < 0.6)) {
                loc.known = true;
                state.localSpace.discoveredLocationIds[loc.id] = true;
                log(`Passive sensors locked onto anomaly contact: ${loc.name}.`);
                revealedAny = true;
            }
        }
    });

    if (!revealedAny) {
        log("No new local contacts resolved.");
    }

    return stateChanged(StateSlice.PLAYER, StateSlice.LOCAL_SPACE, StateSlice.UI_RUNTIME);
}

// =====================================================
// CORRIDOR MOVEMENT & TRANSIT SESSIONS
// =====================================================

export function canBeginCorridorTransit(targetSystemId) {
    const { player } = state;
    if (!player || !player.ship) return false;
    if (state.transitSession) return false;
    return canTransitDirectCorridor(player.currentSystemId, targetSystemId);
}

export function beginCorridorTransit(targetSystemId) {
    if (!canBeginCorridorTransit(targetSystemId)) {
        log("Cannot transit to that system.");
        return false;
    }
    const { player } = state;
    const corridor = getDirectCorridor(player.currentSystemId, targetSystemId);
    if (!corridor) return false;

    state.transitSession = {
        originSystemId: player.currentSystemId,
        targetSystemId,
        corridorId: corridor.corridorId,
        startedDay: player.time.day,
        startedMinute: player.time.minuteOfDay,
        baseMinutes: player.ship.travelMinutesPerCorridor,
        elapsedExtraMinutes: 0,
        scanDepth: 0,
        signalStrength: 0,
        noise: 0,
        anomalyLock: null,
        discoveredLocationIds: [],
        discoveredPayloadIds: [],
        threatWarning: null,
        wingmanCaptainIds: player.wing?.captainIds ? [...player.wing.captainIds] : [],
        status: "active"
    };

    log(`Began corridor alignment transit toward system ${targetSystemId}. Corridor span: ${corridor.effectiveSpanCost.toFixed(2)}.`);

    return stateChanged(StateSlice.PLAYER, StateSlice.UI_RUNTIME, StateSlice.TRANSIT);
}

export function scanTransit(depth = "passive") {
    const session = state.transitSession;
    if (!session || session.status !== "active") return false;
    const minutes = depth === "deep" ? 45 : 15;

    if (!spendTime(minutes)) {
        log("Not enough time remaining today.");
        return false;
    }

    session.scanDepth += (depth === "deep" ? 2 : 1);
    session.elapsedExtraMinutes += minutes;

    const shipBonuses = getShipSystemBonuses(state.player.ship);
    const wingmanModifiers = getWingmanTransitModifiers();
    const scanPower = (shipBonuses.transitScanPower || 10) +
                      getScanResolutionScore(state.player.character) +
                      (wingmanModifiers.quietScanBonus || 0);

    log(`Corridor transit scan complete. Depth ${session.scanDepth}, Power ${scanPower}.`);

    if (scanPower > 25 && random() < 0.4) {
        session.threatWarning = "Pirate patrols detected near corridor exit.";
        log(`Scanner warning: ${session.threatWarning}`);
    }

    if (depth === "deep" && random() < 0.3) {
        // Generate a private payload during transit
        const value = 600 + Math.floor(random() * 800);
        const payload = {
            title: "Corridor Signal Intercept",
            description: `Data link intercepted in corridor ${session.corridorId}.`,
            value,
            expiryDays: 2,
            text: "Transit intercept data."
        };
        addPrivatePayloadToPlayerHold(payload);
        log(`Deep scan pulled an encrypted signal packet from corridor resonance.`);
    }

    return stateChanged(StateSlice.TRANSIT, StateSlice.UI_RUNTIME);
}

export function scanTransitDeeper() {
    return scanTransit("deep");
}

export function commitCorridorTransit() {
    const session = state.transitSession;
    if (!session || session.status !== "active") return false;

    const remainingMinutes = Math.max(0, session.baseMinutes - session.elapsedExtraMinutes);
    if (remainingMinutes > 0) {
        if (!spendTime(remainingMinutes)) {
            log("Not enough time remaining today to complete the jump.");
            return false;
        }
    }

    const origin = session.originSystemId;
    const target = session.targetSystemId;

    carryPublicSnapshotForPlayer(origin);
    state.player.currentSystemId = target;
    state.player.currentSector = target;
    state.selectedSectorId = target;
    state.player.currentLocationId = `loc-${target}-arrival`; // arrival point

    const mergeResult = mergePublicSnapshotsOnArrival(target);
    log(`Transited to system ${target} via jump gate. Travel took ${session.baseMinutes} minutes.`);
    if (mergeResult.mergedCount > 0) {
        log(`Updated ${mergeResult.mergedCount} public data snapshot${mergeResult.mergedCount === 1 ? "" : "s"} for system ${target}.`);
    }

    maybeGeneratePrivatePayloadOnArrival(target);

    // Resolve travel incident
    resolveTravelIncident({
        movementType: "corridor",
        originSystemId: origin,
        targetSystemId: target,
        scanState: session,
        shipBonuses: getShipSystemBonuses(state.player.ship),
        wingmanModifiers: getWingmanTransitModifiers()
    });

    maybeSecureDataInterception();

    // Clear session
    state.transitSession = null;

    return stateChanged(StateSlice.PLAYER, StateSlice.UNIVERSE, StateSlice.UI_RUNTIME, StateSlice.TRANSIT);
}

export function cancelTransitSession() {
    if (state.transitSession) {
        state.transitSession = null;
        log("Transit corridor alignment aborted.");
    }
    return stateChanged(StateSlice.TRANSIT, StateSlice.UI_RUNTIME);
}

export function scanDestinationData(targetSystemId, depth = "passive") {
    const { player } = state;
    if (!player || !player.ship) return false;
    const parsedTarget = Number(targetSystemId);
    if (!canTransitDirectCorridor(player.currentSystemId, parsedTarget)) return false;
    const minutes = depth === "deep" ? 45 : 15;
    if (!spendTime(minutes)) return false;
    mergePublicSnapshotsOnArrival(parsedTarget);
    log(`Long-range scan resolved destination data for system ${parsedTarget}.`);
    return stateChanged(StateSlice.PLAYER, StateSlice.UNIVERSE, StateSlice.UI_RUNTIME);
}

export function moveTo(target) {
    target = parseInt(target, 10);
    if (!canBeginCorridorTransit(target)) {
        log("No direct jump corridor or ship available.");
        return false;
    }
    beginCorridorTransit(target);
    return commitCorridorTransit();
}

// =====================================================
// INCIDENT RESOLUTION
// =====================================================

export function resolveTravelIncident({
    movementType,
    targetSystemId,
    locationId,
    scanState,
    shipBonuses,
    wingmanModifiers
}) {
    shipBonuses = shipBonuses || {};
    wingmanModifiers = wingmanModifiers || {};

    if (movementType === "corridor") {
        const sector = state.universe[targetSystemId];
        if (!sector || sector.pirateThreat <= 0) return;

        const dominant = getDominantInfluence(targetSystemId);
        let chance = Math.min(
            BALANCE.TRAVEL.PIRATE_INCIDENT_BASE_CHANCE * sector.pirateThreat * getPirateIncidentMultiplier(),
            BALANCE.TRAVEL.PIRATE_INCIDENT_MAX_CHANCE
        );
        if (dominant === "sda") chance *= BALANCE.TRAVEL.SDA_INCIDENT_MULTIPLIER;
        if (dominant === "vc" && getPrivateFactionRep("vc") > BALANCE.TRAVEL.VC_RECOGNITION_REP_THRESHOLD) {
            chance *= BALANCE.TRAVEL.VC_INCIDENT_MULTIPLIER;
        }

        // Apply scan and wingman modifiers
        if (scanState && scanState.scanDepth > 0) {
            chance *= Math.max(0.2, 1 - (scanState.scanDepth * 0.15));
        }
        chance *= (1 - (wingmanModifiers.pirateIncidentReduction || 0) - (shipBonuses.pirateIncidentReduction || 0));

        if (random() > chance) return;

        let damage = BALANCE.TRAVEL.PIRATE_DAMAGE_BASE +
                     Math.floor(random() * BALANCE.TRAVEL.PIRATE_DAMAGE_RANDOM) +
                     sector.pirateThreat * BALANCE.TRAVEL.PIRATE_DAMAGE_THREAT_MULTIPLIER;

        // Apply damage reduction
        damage = Math.floor(damage * (1 - (wingmanModifiers.damageReduction || 0)));

        applyShipDamage(damage);
        log(`Pirates harassed your corridor exit. Shields absorbed ${damage} damage.`);
        Notifications.show(`Pirate attack — ${damage} damage`, 3);

        if (dominant === "vc" && random() < BALANCE.TRAVEL.VC_LEVERAGE_CHANCE) {
            addFactionLeverage("vc", 1, "pirate crew recognized transponder");
        }
    } else {
        // Local movement incidents
        const loc = state.localSpace?.locationsById[locationId];
        if (!loc) return;
        const roll = random();

        // 15% base chance + threat/hazard multipliers
        const chance = 0.15 + (loc.threat * 0.05) + (loc.hazard * 0.10);
        if (roll > chance) return;

        const incidents = [];
        if (loc.kind === "asteroid_belt") incidents.push("belt_debris");
        if (loc.threat > 0) incidents.push("pirate_shadowing");
        incidents.push("drive_misalignment", "false_anomaly");

        const picked = incidents[Math.floor(random() * incidents.length)];

        if (picked === "belt_debris") {
            let damage = Math.floor(15 + random() * 25);
            if (wingmanModifiers.hazardDetection > 0) damage = Math.floor(damage * (1 - wingmanModifiers.hazardDetection));
            applyShipDamage(damage);
            log(`Navigated through thick debris. Shields absorbed ${damage} damage.`);
        } else if (picked === "pirate_shadowing") {
            log("Sensors alert: Pirate scout shadowed your vector but did not engage.");
        } else if (picked === "drive_misalignment") {
            const extraTime = shipBonuses.pulseReserveSupport > 0 ? 15 : 45;
            spendTime(extraTime);
            log(`Maneuvering drive misaligned. Realignment took an extra ${extraTime} minutes.`);
        } else if (picked === "false_anomaly") {
            log("Sensor echo: local gravitational noise registered on passive array.");
        }
    }
}

export function restUntilMorning() {
    const minutesToMorning = state.player.time.minuteOfDay < state.player.time.wakeMinute
        ? state.player.time.wakeMinute - state.player.time.minuteOfDay
        : (BALANCE.DAY_MINUTES - state.player.time.minuteOfDay) + state.player.time.wakeMinute;
    advanceTime(minutesToMorning, "rest until morning");
    log(`Day ${state.player.time.day}. You rested until morning; the frontier kept moving without you.`);
}
