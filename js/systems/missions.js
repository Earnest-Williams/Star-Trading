import { state } from '../state.js';
import { FACTIONS, BALANCE, PORT_TYPES, COMMODITIES } from '../constants.js';
import { formatCommodity, formatCredits, log } from '../utils.js';
import { getDominantInfluence, addSectorInfluence } from '../core/influence.js';
import { addWorldEvent } from '../core/worldEvents.js';
import { getGuildTier, getFactionRep, getFactionTrust, getPrivateFactionRep, applyPoliticalEffect, recordFactionMemory, addIntel, ensureFactionState, addFactionTrust, getFactionPoliticalPole } from '../core/factions.js';
import { spendTime } from '../core/time.js';
import { Notifications } from '../ui/notifications.js';
import { nudgeCaptainRelation, prepareMissionOpportunity, normaliseCaptains, applyContestMissionOutcome } from '../systems/captains.js';

export { prepareMissionOpportunity };

export function activePortSectors() { return Object.keys(state.ports).map(Number); }

export function makeBaseMission(title, originSector, rewardCredits, expiresInDays) {
    const port = state.ports[originSector];
    const dominant = getDominantInfluence(originSector);
    let factionId = port && port.factionId ? port.factionId : dominant;
    if (Math.random() < 0.25) factionId = dominant;
    if (port && port.hiddenFactionId && Math.random() < 0.12) factionId = port.hiddenFactionId;
    return {
        id: state.nextMissionId++,
        title, originSector, factionId,
        rewardCredits, rewardRep: 2,
        expiresDay: state.player.time.day + expiresInDays,
        status: "available",
        operationMinutes: 30
    };
}

export function makeDeliveryMission() {
    const sectors = activePortSectors().filter(s => s !== 1 && PORT_TYPES[state.ports[s].typeKey].sells.length > 0);
    if (sectors.length < 1) return null;
    const origin = sectors[Math.floor(Math.random() * sectors.length)];
    const commodity = PORT_TYPES[state.ports[origin].typeKey].sells[0];
    const destinations = activePortSectors().filter(s => s !== origin && PORT_TYPES[state.ports[s].typeKey].buys.includes(commodity));
    if (destinations.length < 1) return null;
    const destination = destinations[Math.floor(Math.random() * destinations.length)];
    const amount = 10 + Math.floor(Math.random() * 3) * 10;
    const distance = Math.abs(destination - origin) + 1;
    const reward = amount * state.ports[origin].basePrices[commodity] + distance * 180 + 600;
    const m = makeBaseMission(`Deliver ${amount} ${formatCommodity(commodity)} to sector ${destination}`, origin, reward, 4 + Math.ceil(distance / 6));
    m.type = "delivery";
    m.destinationSector = destination;
    m.commodity = commodity;
    m.amount = amount;
    return m;
}

export function makeMiningMission() {
    const origin = activePortSectors()[Math.floor(Math.random() * activePortSectors().length)];
    const amount = 30 + Math.floor(Math.random() * 5) * 10;
    const m = makeBaseMission(`Mine ${amount} Ore for sector ${origin}`, origin, amount * 95 + 700, 5);
    m.factionId = PORT_TYPES[state.ports[origin].typeKey].factionId === "hc" ? "miners" : m.factionId;
    m.type = "mining";
    m.amount = amount;
    m.progress = 0;
    return m;
}

export function makeSurveyMission() {
    const origin = activePortSectors()[Math.floor(Math.random() * activePortSectors().length)];
    const candidates = Object.values(state.universe).filter(s => !s.surveyed && s.id !== origin);
    if (candidates.length < 1) return null;
    const target = candidates[Math.floor(Math.random() * candidates.length)].id;
    const m = makeBaseMission(`Survey sector ${target}`, origin, 1200 + target * 25, 5);
    m.type = "survey";
    m.targetSector = target;
    return m;
}

export function makeColonyMission() {
    const origin = activePortSectors()[Math.floor(Math.random() * activePortSectors().length)];
    const candidates = Object.keys(state.planets).map(Number).filter(s => !state.planets[s].owner);
    if (candidates.length < 1) return null;
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    const m = makeBaseMission(`Found a colony in sector ${target}`, origin, 4500, 8);
    m.type = "colony";
    m.targetSector = target;
    return m;
}

export function generateMissionPool(count) {
    const requested = count || 10;
    for (let i = 0; i < requested; i++) {
        const typeRoll = Math.random();
        let mission = null;
        if (typeRoll < 0.45) mission = makeDeliveryMission();
        else if (typeRoll < 0.70) mission = makeMiningMission();
        else if (typeRoll < 0.88) mission = makeSurveyMission();
        else mission = makeColonyMission();
        if (mission) state.missions.push(prepareMissionOpportunity(mission));
    }
}

export function missionDescription(m) {
    if (m.type === "delivery") return `Pickup/source: sector ${m.originSector}. Deliver ${m.amount} ${formatCommodity(m.commodity)} to sector ${m.destinationSector}.`;
    if (m.type === "mining") return `Mine ${m.amount} Ore, then report back to sector ${m.originSector}.`;
    if (m.type === "survey") return `Survey sector ${m.targetSector}, then report back to sector ${m.originSector}.`;
    if (m.type === "colony") return `Found a colony in sector ${m.targetSector}, then report back to sector ${m.originSector}.`;
    if (m.type === "contest") return `${m.context || "Political conflict contract."} Travel to sector ${m.targetSector}, spend ${m.operationMinutes || 90} minutes on the operation, then report the result.`;
    return "Mission details unavailable.";
}

export function isMissionVisible(m) {
    if (!m.factionId || !FACTIONS[m.factionId]) return true;
    const faction = FACTIONS[m.factionId];
    if (faction.type === "guild") return getGuildTier(m.factionId) > 0 || getFactionRep(m.factionId) >= 50 || getFactionTrust(m.factionId) >= 25;
    if (m.factionId === "vc") return getFactionRep("vc") > -250 || getPrivateFactionRep("vc") >= 25 || getGuildTier("smugglers") > 0;
    return getFactionRep(m.factionId) > -250;
}

export function expireMissions() {
    state.missions.forEach(m => {
        if ((m.status === "available" || m.status === "accepted" || m.status === "captain_taken") && m.expiresDay < state.player.time.day) {
            m.status = "expired";
        }
    });
    ensureFactionState();
    state.player.factions.asks.forEach(ask => {
        const wasAccepted = ask.status === "accepted";
        if ((ask.status === "available" || ask.status === "accepted") && ask.expiresDay < state.player.time.day) {
            ask.status = "expired";
            if (wasAccepted) addFactionTrust(ask.factionId, -2, "missed political ask");
        }
    });
    const openCount = state.missions.filter(m => m.status === "available").length;
    if (openCount < 6) generateMissionPool(6 - openCount);
}

export function notifyCaptainsPlayerCompletedMission(mission) {
    normaliseCaptains();
    (mission.candidates || []).forEach(captainId => {
        const captain = state.captains[captainId];
        if (!captain) return;
        const sameFaction = mission.factionId && (getFactionPoliticalPole(mission.factionId) === getFactionPoliticalPole(captain.preferredFaction));
        if (sameFaction) {
            nudgeCaptainRelation(captainId, { opinion: 2, trust: 1 }, "respected your competent contract work");
        } else {
            nudgeCaptainRelation(captainId, { rivalry: 3 }, "noticed you shaping a faction outcome they care about");
        }
    });
}

export function acceptMission(id) {
    id = parseInt(id, 10);
    const m = state.missions.find(mn => mn.id === id);
    if (!m || m.status !== "available") return;
    if (m.originSector !== state.player.currentSector) { log("You must be at the mission origin to accept it."); return; }
    m.status = "accepted";
    m.takenBy = "player";
    (m.candidates || []).forEach(captainId => {
        const captain = state.captains[captainId];
        if (!captain) return;
        nudgeCaptainRelation(captainId, { rivalry: 2, opinion: -1 }, `you accepted an opportunity ${captain.name} was considering`);
    });
    log(`Accepted mission: ${m.title}.`);
    // updateUI will be called by the action handler in ui.js
}

export function completeMission(id) {
    id = parseInt(id, 10);
    const m = state.missions.find(mn => mn.id === id);
    if (!m || m.status !== "accepted") return;
    if (m.expiresDay < state.player.time.day) {
        m.status = "expired";
        log(`Mission expired: ${m.title}.`);
        return;
    }
    if (m.type === "delivery") {
        if (state.player.currentSector !== m.destinationSector) { log(`Delivery destination is sector ${m.destinationSector}.`); return; }
        if (state.player.cargo[m.commodity] < m.amount) { log(`You need ${m.amount} ${formatCommodity(m.commodity)} to complete this delivery.`); return; }
        if (!spendTime(30)) return;
        state.player.cargo[m.commodity] -= m.amount;
        addSectorInfluence(m.destinationSector, m.factionId || "fu", 2, "mission cargo delivery");
    } else if (m.type === "mining") {
        if (state.player.currentSector !== m.originSector) { log(`Report back to sector ${m.originSector}.`); return; }
        if (m.progress < m.amount) { log(`Mining progress is ${m.progress}/${m.amount} Ore.`); return; }
        if (!spendTime(30)) return;
    } else if (m.type === "survey") {
        if (state.player.currentSector !== m.originSector) { log(`Report back to sector ${m.originSector}.`); return; }
        if (!state.universe[m.targetSector].surveyed) { log(`Sector ${m.targetSector} has not been surveyed yet.`); return; }
        if (!spendTime(30)) return;
    } else if (m.type === "colony") {
        if (state.player.currentSector !== m.originSector) { log(`Report back to sector ${m.originSector}.`); return; }
        if (!state.planets[m.targetSector] || state.planets[m.targetSector].owner !== "Player") { log(`No player colony exists in sector ${m.targetSector} yet.`); return; }
        if (!spendTime(30)) return;
    } else if (m.type === "contest") {
        if (state.player.currentSector !== m.targetSector) { log(`Political operation target is sector ${m.targetSector}.`); return; }
        if (!spendTime(m.operationMinutes || 90)) return;
        applyContestMissionOutcome(m, "player");
    }
    m.status = "completed";
    state.player.credits += m.rewardCredits;
    state.player.reputation += m.rewardRep;
    addWorldEvent({
        type: "player_mission",
        factionId: m.factionId || "fu",
        sectorId: m.destinationSector || m.targetSector || m.originSector,
        text: `You completed ${m.title}; faction influence and relationships adjusted.`,
        importance: 3, alert: false
    });
    const factionId = m.factionId || "fu";
    applyPoliticalEffect({ factionId, publicRep: m.rewardRep, trust: 1, favors: m.rewardRep >= 3 ? 1 : 0, sectorId: m.destinationSector || m.targetSector || m.originSector, influence: 2, reason: "mission completed", memoryKey: "reliableJobs" });
    if (FACTIONS[factionId] && FACTIONS[factionId].type === "major") {
        const fr = (state.player && state.player.factionRelations) || {};
        Object.entries(fr[factionId] || {}).forEach(([otherId, relation]) => {
            if (relation <= -50) recordFactionMemory(otherId, "helpedEnemies", 1);
        });
    }
    if (m.type === "survey" && Math.random() < 0.35) {
        addIntel({
            type: "survey", factionId,
            sectorId: m.targetSector,
            value: 25,
            expiresDay: state.player.time.day + 7,
            text: `Fresh survey data from sector ${m.targetSector}.`
        });
    }
    notifyCaptainsPlayerCompletedMission(m);
    log(`Completed mission: ${m.title}. Reward: ${formatCredits(m.rewardCredits)} credits.`);
    Notifications.show(`Mission complete: +${formatCredits(m.rewardCredits)}c`, 2);
}
