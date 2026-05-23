// @ts-check
import { state } from '../../state.js';
import { BALANCE } from '../../config/economy.js';
import { FACTIONS, MAJOR_FACTIONS } from '../../config/factions.js';
import { CAPTAIN_DEFS } from '../../config/entities.js';
import { getPortType } from '../../core/ports.js';
import { getUniverseBasePrice } from '../economy/initialPrices.js';
import { getCommodityDef } from '../../config/economy/commodities.js';
import { clampRange, log, random } from '../../utils.js';
import { addSectorInfluence, getDominantInfluence } from '../../core/influence.js';
import { addWorldEvent } from '../../core/worldEvents.js';
import { EventBus } from '../../events.js';
import { Notifications } from '../../ui/notifications.js';
import { getFactionPoliticalPole } from '../../core/factions.js';
import { getSectorNeighbors, getSectorPathDistance, canTransitDirectCorridor } from '../../core/navigation.js';
import { createCaptainTradeRoute, getAllLogisticsNodes, deriveRouteMetrics } from '../tradeRoutes.js';
import { createCharacter, normaliseCharacter } from '../../core/characters.js';
import { getCaptainMissionScore, getCaptainRelationshipActionAdjustment, getPoliticalActionAdjustment } from '../../core/characterChecks.js';
import { getCaptainMissionEntanglementModifier } from '../entanglements.js';
import { updateWingmenDaily } from '../wingmen.js';


const CAPTAIN_CHARACTER_TEMPLATES = Object.freeze({
    trader: { stats: { nerve: 56, tradecraft: 78, fieldcraft: 58, command: 68 }, originTraitId: "dockside_brokers_apprentice", careerTraitIds: ["freight_dispatcher"], platform: { type: "ship_tier1_tramp", employerLaneId: null } },
    miner: { stats: { nerve: 68, tradecraft: 54, fieldcraft: 82, command: 58 }, originTraitId: "raised_in_an_asteroid_mine", careerTraitIds: ["veteran_miner"], platform: { type: "ship_tier2_prospector", employerLaneId: null } },
    smuggler: { stats: { nerve: 74, tradecraft: 84, fieldcraft: 66, command: 55 }, originTraitId: "black_route_family", careerTraitIds: ["quiet_hands", "manifest_forger"], platform: { type: "rental_cutter_no_ship", employerLaneId: null } },
    mercenary: { stats: { nerve: 82, tradecraft: 58, fieldcraft: 62, command: 72 }, originTraitId: "political_adjutant", careerTraitIds: ["rival_handler"], platform: { type: "employer_salary_no_ship", employerLaneId: "sda_auxiliary" } },
    colonist: { stats: { nerve: 62, tradecraft: 55, fieldcraft: 70, command: 82 }, originTraitId: "quartermasters_child", careerTraitIds: ["settlement_organizer", "union_paperwork"], platform: { type: "employer_commission_no_ship", employerLaneId: "colonists_logistics" } },
    industrialist: { stats: { nerve: 60, tradecraft: 72, fieldcraft: 70, command: 76 }, originTraitId: "quartermasters_child", careerTraitIds: ["freight_dispatcher"], platform: { type: "employer_commission_no_ship", employerLaneId: "hc_extractor" } },
    pirate: { stats: { nerve: 86, tradecraft: 76, fieldcraft: 68, command: 64 }, originTraitId: "black_route_family", careerTraitIds: ["quiet_hands", "rival_handler"], platform: { type: "rental_cutter_no_ship", employerLaneId: null } },
    fixer: { stats: { nerve: 64, tradecraft: 80, fieldcraft: 62, command: 78 }, originTraitId: "political_adjutant", careerTraitIds: ["rival_handler"], platform: { type: "employer_salary_no_ship", employerLaneId: "traders_guild_freight" } }
});

function createCaptainCharacter(def) {
    const template = CAPTAIN_CHARACTER_TEMPLATES[def.archetype] || CAPTAIN_CHARACTER_TEMPLATES.fixer;
    const traits = [template.originTraitId, ...template.careerTraitIds];
    return createCharacter({
        stats: { ...template.stats },
        traits,
        originTraitId: template.originTraitId,
        careerTraitIds: template.careerTraitIds.slice(),
        platform: { ...template.platform },
        contacts: [],
        packageIds: [],
        equipment: []
    });
}

export function createCaptains() {
    state.captains = {};
    state.captainEventLog = [];
    state.nextCaptainEventId = 1;
    const allIds = Object.keys(CAPTAIN_DEFS);
    Object.values(CAPTAIN_DEFS).forEach(def => {
        const captain = JSON.parse(JSON.stringify(def));
        captain.character = normaliseCharacter(def.character || createCaptainCharacter(def));
        captain.known = Boolean(def.knownAtStart);
        captain.status = "active";
        captain.currentPlan = null;
        captain.history = [];
        captain.relationshipToPlayer = {
            opinion: def.knownAtStart ? 5 : 0,
            trust: def.knownAtStart ? 2 : 0,
            rivalry: 0, debt: 0, leverage: 0
        };
        captain.relations = {};
        state.captains[def.id] = captain;
    });
    allIds.forEach(idA => {
        allIds.forEach(idB => {
            if (idA === idB) return;
            const a = state.captains[idA], b = state.captains[idB];
            const factionAffinity = a.preferredFaction === b.preferredFaction ? 10 : 0;
            const outlawFriction = (a.archetype === "pirate" || b.archetype === "pirate") ? -12 : 0;
            a.relations[idB] = {
                opinion: factionAffinity + outlawFriction + Math.floor(random() * 11) - 5,
                trust: Math.max(0, factionAffinity / 2),
                rivalry: outlawFriction < 0 ? 8 : 0,
                debt: 0
            };
        });
    });
}

export function ensureCaptainRelation(captainA, captainBId) {
    if (!captainA.relations) captainA.relations = {};
    if (!captainA.relations[captainBId]) {
        captainA.relations[captainBId] = { opinion: 0, trust: 0, rivalry: 0, debt: 0 };
    }
    return captainA.relations[captainBId];
}

export function normaliseCaptains() {
    if (!state.captains || Object.keys(state.captains).length === 0) createCaptains();
    const allIds = Object.keys(state.captains);
    Object.values(state.captains).forEach(captain => {
        if (!captain.relationshipToPlayer) captain.relationshipToPlayer = { opinion: 0, trust: 0, rivalry: 0, debt: 0, leverage: 0 };
        if (!captain.history) captain.history = [];
        if (!captain.relations) captain.relations = {};
        allIds.forEach(otherId => {
            if (otherId !== captain.id) ensureCaptainRelation(captain, otherId);
        });
        if (!captain.memberships) captain.memberships = {};
        if (!captain.factionStanding) captain.factionStanding = {};
        if (!captain.cargo) captain.cargo = { ore: 0, org: 0, eq: 0 };
        if (!captain.status) captain.status = "active";
        if (!captain.economy) captain.economy = createCaptainEconomy(captain);
        if (!captain.economy.capabilities) captain.economy = createCaptainEconomy(captain);
        if (typeof captain.economy.nextRouteEvaluationDay !== "number") captain.economy.nextRouteEvaluationDay = 1;
        captain.character = normaliseCharacter(captain.character || createCharacter());
    });
}

export function getCaptain(id) {
    return state.captains[id] || null;
}

export function getKnownCaptains() {
    return Object.values(state.captains).filter(c => c.known || c.currentSector === state.player.currentSector);
}

export function getCaptainsInSector(sectorId, knownOnly = true) {
    return Object.values(state.captains).filter(c => {
        if (c.status !== "active") return false;
        if (c.currentSector !== sectorId) return false;
        return !knownOnly || c.known || sectorId === state.player.currentSector;
    });
}

export function captainDisplayName(captain) {
    return `${captain.name} — "${captain.callsign}"`;
}

export function getCaptainRelationshipLabel(captain) {
    const rel = captain.relationshipToPlayer;
    const score = (rel.opinion || 0) + (rel.trust || 0) * 2 - (rel.rivalry || 0) * 1.5 - (rel.leverage || 0);
    if (score >= 70) return "Close Ally";
    if (score >= 35) return "Friendly";
    if (score >= 10) return "Cordial";
    if (score >= -15) return "Neutral";
    if (score >= -45) return "Rival";
    return "Enemy";
}

export function addCaptainHistory(captain, text, important = false) {
    const entry = { day: state.player.time ? state.player.time.day : 1, text, important };
    captain.history.unshift(entry);
    captain.history = captain.history.slice(0, 12);
    state.captainEventLog.unshift({ id: state.nextCaptainEventId++, captainId: captain.id, day: entry.day, text, important });
    state.captainEventLog = state.captainEventLog.slice(0, 36);
    addWorldEvent({
        type: "captain", captainId: captain.id, sectorId: captain.currentSector,
        text: `${captain.name}: ${text}`,
        importance: important ? 2 : 1, alert: false
    });
    if (important || captain.currentSector === state.player.currentSector) {
        log(`${captain.name}: ${text}`);
    }
    if (important) {
        Notifications.show(`${captain.name}: ${text}`, captain.currentSector === state.player.currentSector ? 3 : 2);
    }
}

export function nudgeCaptainRelation(captainId, deltas, reason) {
    const captain = getCaptain(captainId);
    if (!captain) return;
    const adjustedDeltas = { ...deltas };
    if (state.player && state.player.character) {
        const adjustment = getCaptainRelationshipActionAdjustment(state.player.character);
        if (adjustedDeltas.opinion > 0) adjustedDeltas.opinion += Math.max(0, adjustment);
        if (adjustedDeltas.trust > 0) adjustedDeltas.trust += Math.max(0, Math.floor(adjustment / 2));
        if (adjustedDeltas.rivalry > 0) adjustedDeltas.rivalry = Math.max(0, adjustedDeltas.rivalry - Math.max(0, Math.floor(adjustment / 3)));
    }
    const rel = captain.relationshipToPlayer;
    rel.opinion = clampRange((rel.opinion || 0) + (adjustedDeltas.opinion || 0), -100, 100);
    rel.trust = clampRange((rel.trust || 0) + (adjustedDeltas.trust || 0), -100, 100);
    rel.rivalry = clampRange((rel.rivalry || 0) + (adjustedDeltas.rivalry || 0), 0, 100);
    rel.debt = clampRange((rel.debt || 0) + (adjustedDeltas.debt || 0), -20, 20);
    rel.leverage = clampRange((rel.leverage || 0) + (adjustedDeltas.leverage || 0), 0, 100);
    captain.known = true;
    if (reason) addCaptainHistory(captain, reason, Math.abs(adjustedDeltas.opinion || 0) + Math.abs(adjustedDeltas.rivalry || 0) >= 8);
    EventBus.emit("captain_changed", { captainId });
}

export function nudgeCaptainFaction(captain, factionId, amount) {
    if (!FACTIONS[factionId] || !captain) return;
    captain.factionStanding[factionId] = clampRange((captain.factionStanding[factionId] || 0) + amount, -500, 1000);
}

export function getCaptainGuildTier(captain, guildId) {
    return captain.memberships && captain.memberships[guildId] ? captain.memberships[guildId] : 0;
}

export function getCaptainDominantFaction(captain) {
    let bestId = captain.preferredFaction || "traders";
    let best = -Infinity;
    Object.entries(captain.factionStanding || {}).forEach(([id, value]) => {
        if (!FACTIONS[id]) return;
        const adjusted = value + (captain.memberships && captain.memberships[id] ? 35 : 0);
        if (adjusted > best) { best = adjusted; bestId = id; }
    });
    return bestId;
}

function captainDistanceScore(fromSector, toSector) {
    if (fromSector === toSector) return 0;
    const distance = getSectorPathDistance(fromSector, toSector);
    return distance === null ? 9 : Math.min(9, distance);
}

export function captainMissionScore(captain, mission) {
    if (!mission || mission.status !== "available") return -9999;
    const distance = captainDistanceScore(captain.currentSector, mission.originSector);
    if (distance > 3 && random() < 0.75) return -9999;
    let score = mission.rewardCredits / 220 - distance * 14;
    const standing = (captain.factionStanding || {})[mission.factionId] || 0;
    score += standing / 9;
    if (mission.type === "delivery" && ["trader", "industrialist", "smuggler"].includes(captain.archetype)) score += 35;
    if (mission.type === "mining" && captain.archetype === "miner") score += 55;
    if (mission.type === "survey" && ["fixer", "miner", "trader"].includes(captain.archetype)) score += 22;
    if (mission.type === "colony" && captain.archetype === "colonist") score += 60;
    if (mission.type === "contest") {
        const sponsorPole = getFactionPoliticalPole(mission.factionId);
        const captainPole = getFactionPoliticalPole(captain.preferredFaction);
        if (sponsorPole === captainPole || mission.factionId === captain.preferredFaction) score += 42;
        if (mission.factionId === "sda" && captain.archetype === "mercenary") score += 30;
        if (mission.factionId === "vc" && captain.archetype === "smuggler") score += 30;
        if (mission.factionId === "hc" && ["miner", "industrialist"].includes(captain.archetype)) score += 30;
        if (mission.factionId === "fu" && ["colonist", "trader", "fixer"].includes(captain.archetype)) score += 25;
    }
    if (mission.factionId === "vc" || mission.factionId === "smugglers") score += ((captain.ethics || {}).smuggling || 0) / 3;
    const destination = mission.destinationSector || mission.targetSector || mission.originSector;
    const danger = state.universe[destination] ? state.universe[destination].pirateThreat || 0 : 0;
    score -= danger * (18 - (captain.riskTolerance || 0.5) * 18);
    score += getCaptainMissionEntanglementModifier(captain, mission);
    return score;
}

export function missionCandidateCaptains(mission) {
    normaliseCaptains();
    return Object.values(state.captains)
        .filter(c => c.status === "active")
        .map(c => ({ id: c.id, score: captainMissionScore(c, mission) }))
        .filter(item => item.score > BALANCE.CAPTAIN_MISSION_INTEREST_THRESHOLD)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(item => item.id);
}

export function prepareMissionOpportunity(mission) {
    mission.kind = mission.kind || "opportunity";
    mission.candidates = missionCandidateCaptains(mission);
    mission.visibility = mission.visibility || (mission.factionId === "vc" || mission.factionId === "smugglers" ? "quiet" : "public");
    mission.risk = mission.risk || (mission.visibility === "quiet" ? "inspection" : "normal");
    return mission;
}

function chooseCaptainMission(captain) {
    const candidates = state.missions
        .filter(m => m.status === "available" && m.expiresDay >= state.player.time.day)
        .map(m => ({ mission: m, score: captainMissionScore(captain, m) }))
        .filter(item => item.score > BALANCE.CAPTAIN_MISSION_TAKE_THRESHOLD)
        .sort((a, b) => b.score - a.score);
    if (candidates.length === 0) return null;
    if (random() > 0.62 && candidates[0].score < 95) return null;
    return candidates[0].mission;
}

function startCaptainMission(captain, mission) {
    mission.status = "captain_taken";
    mission.takenBy = captain.id;
    const target = mission.destinationSector || mission.targetSector || mission.originSector;
    const distance = captainDistanceScore(captain.currentSector, target);
    const duration = Math.max(1, Math.min(4, 1 + Math.ceil(distance / 3) + Math.floor(random() * 2)));
    mission.completionDay = state.player.time.day + duration;
    captain.currentPlan = { type: "mission", missionId: mission.id, completionDay: mission.completionDay, targetSector: target };
    captain.currentSector = mission.originSector;
    captain.known = captain.known || mission.originSector === state.player.currentSector;
    const playerWasCandidate = mission.candidates && mission.candidates.includes("player");
    addWorldEvent({
        type: "mission_taken", captainId: captain.id, factionId: mission.factionId, sectorId: mission.originSector,
        text: `${captain.name} accepted ${mission.title} in sector ${mission.originSector}.`,
        importance: playerWasCandidate ? 3 : 2,
        alert: mission.originSector === state.player.currentSector
    });
    addCaptainHistory(captain, `accepted ${mission.title}.`, mission.originSector === state.player.currentSector || playerWasCandidate);
}

export function applyContestMissionOutcome(mission, actor, captain = null) {
    const targetId = mission.targetSector || mission.destinationSector || mission.originSector;
    const sector = state.universe[targetId];
    if (!sector || !mission.factionId) return;
    const sponsorPole = getFactionPoliticalPole(mission.factionId);
    const rivalPole = mission.rivalFactionId ? getFactionPoliticalPole(mission.rivalFactionId) : null;
    // Import adjustFactionRelation lazily to avoid circular dep (captains → politics → missions)
    // We inline a simple version here; full political effect is handled by politics.js hooks
    const actorCharacter = actor === "player" ? state.player.character : captain?.character;
    const politicalAdjustment = Math.max(0, getPoliticalActionAdjustment(actorCharacter));
    if (MAJOR_FACTIONS.includes(sponsorPole)) addSectorInfluence(targetId, sponsorPole, (actor === "player" ? 4 : 3) + politicalAdjustment, `${actor} completed political operation`);
    if (rivalPole && MAJOR_FACTIONS.includes(rivalPole)) {
        sector.influence[rivalPole] = Math.max(0, Math.min(100, (sector.influence[rivalPole] || 0) - 2));
    }
    if (mission.factionId === "sda" && sector.pirateThreat > 0) sector.pirateThreat = Math.max(0, sector.pirateThreat - 1);
    if (mission.factionId === "vc") sector.pirateThreat = Math.min(6, sector.pirateThreat + 1);
    if (mission.factionId === "hc" && sector.asteroids) {
        if (typeof sector.asteroids.maxOre !== "number") sector.asteroids.maxOre = Math.max(sector.asteroids.ore, 2500);
        sector.asteroids.maxOre += 80;
        sector.asteroids.ore = Math.min(sector.asteroids.maxOre, sector.asteroids.ore + 80);
    }
    if (mission.factionId === "fu" && state.planets[targetId] && state.planets[targetId].owner) {
        state.planets[targetId].satisfaction = Math.min(100, (state.planets[targetId].satisfaction || 50) + 3);
    }
    if (captain) {
        nudgeCaptainFaction(captain, mission.factionId, 4);
        addCaptainHistory(captain, `shifted local politics for ${FACTIONS[mission.factionId].short} in sector ${targetId}.`, captain.known);
    }
    addWorldEvent({ type: "political_outcome", factionId: mission.factionId, captainId: captain ? captain.id : null, sectorId: targetId, text: `${actor === "player" ? "You" : captain ? captain.name : "A captain"} completed a political operation for ${FACTIONS[mission.factionId].short} in sector ${targetId}.`, importance: actor === "player" ? 4 : 3, alert: actor === "player" || targetId === state.player.currentSector });
}

function completeCaptainMission(captain, mission) {
    if (!mission || mission.status !== "captain_taken" || mission.takenBy !== captain.id) return;
    const target = mission.destinationSector || mission.targetSector || mission.originSector;
    captain.currentSector = target;
    captain.credits += Math.floor(mission.rewardCredits * 0.62);
    nudgeCaptainFaction(captain, mission.factionId || captain.preferredFaction, mission.rewardRep || 2);
    nudgeCaptainFaction(captain, captain.preferredFaction, 1);
    const politicalFaction = getFactionPoliticalPole(mission.factionId);
    if (MAJOR_FACTIONS.includes(politicalFaction)) addSectorInfluence(target, politicalFaction, 2, "captain contract completed");
    if (mission.type === "delivery" && state.ports[target] && mission.commodity) {
        state.ports[target].stock[mission.commodity] = Math.min(state.ports[target].maxStock[mission.commodity], state.ports[target].stock[mission.commodity] + mission.amount);
    }
    if (mission.type === "survey" && state.universe[mission.targetSector]) state.universe[mission.targetSector].surveyed = true;
    if (mission.type === "colony" && state.planets[mission.targetSector] && !state.planets[mission.targetSector].owner) {
        state.planets[mission.targetSector].owner = captain.name;
        state.planets[mission.targetSector].factionId = captain.preferredFaction;
        state.planets[mission.targetSector].colonists = 80 + Math.floor(random() * 80);
        state.planets[mission.targetSector].buildings.habitat = 1;
        addSectorInfluence(mission.targetSector, getFactionPoliticalPole(captain.preferredFaction), 4, "captain-backed colony founded");
    }
    if (mission.type === "contest") applyContestMissionOutcome(mission, "captain", captain);
    mission.status = "completed_by_captain";
    captain.currentPlan = null;
    const playerWasCandidate = mission.candidates && mission.candidates.includes("player");
    addWorldEvent({
        type: "mission_completed", captainId: captain.id, factionId: mission.factionId, sectorId: target,
        text: `${captain.name} completed ${mission.title}; influence shifted in sector ${target}.`,
        importance: playerWasCandidate ? 3 : 2, alert: playerWasCandidate
    });
    addCaptainHistory(captain, `completed ${mission.title}.`, captain.known);
    if (playerWasCandidate) {
        Notifications.show(`${captain.name} beat you to: ${mission.title}`, 3);
        log(`${captain.name} beat you to an open opportunity: ${mission.title}.`);
    }
}

function moveCaptainTowardInterestingSector(captain) {
    const sector = state.universe[captain.currentSector];
    const neighbors = getSectorNeighbors(captain.currentSector);
    if (!sector || neighbors.length === 0) return;
    let best = neighbors[Math.floor(random() * neighbors.length)];
    let bestScore = -999;
    neighbors.forEach(id => {
        const s = state.universe[id];
        let score = random() * 10;
        if (state.ports[id] && ["trader", "industrialist", "fixer", "smuggler"].includes(captain.archetype)) score += 20;
        if (s.asteroids && captain.archetype === "miner") score += 30;
        if (state.planets[id] && captain.archetype === "colonist") score += 24;
        if (s.pirateThreat > 0 && captain.archetype === "mercenary") score += 35;
        if (s.pirateThreat > 0 && ["trader", "colonist"].includes(captain.archetype)) score -= 25;
        const dominant = getDominantInfluence(id);
        if (dominant === captain.preferredFaction || getFactionPoliticalPole(captain.preferredFaction) === dominant) score += 12;
        if (score > bestScore) { bestScore = score; best = id; }
    });
    captain.currentSector = best;
    if (best === state.player.currentSector) {
        captain.known = true;
        addCaptainHistory(captain, "arrived in your sector.", false);
    }
}

function captainTrade(captain) {
    const port = state.ports[captain.currentSector];
    if (!port) return false;
    const type = getPortType(port);
    const factionId = port.factionId || type.factionId;
    let commodity = null;
    if (type.buys.length > 0) commodity = type.buys[Math.floor(random() * type.buys.length)];
    else if (type.sells.length > 0) commodity = type.sells[Math.floor(random() * type.sells.length)];
    if (!commodity) return false;
    const amount = 5 + Math.floor(random() * 16);
    if (type.buys.includes(commodity)) port.stock[commodity] = Math.min(port.maxStock[commodity], port.stock[commodity] + amount);
    if (type.sells.includes(commodity)) port.stock[commodity] = Math.max(0, port.stock[commodity] - amount);
    const basePrice = getUniverseBasePrice(commodity) || getCommodityDef(commodity)?.basePrice || 100;
    captain.credits += Math.floor(amount * basePrice * 0.12);
    nudgeCaptainFaction(captain, factionId, 1);
    addSectorInfluence(captain.currentSector, factionId, 1, "captain trade volume");
    if (captain.currentSector === state.player.currentSector) addCaptainHistory(captain, `worked the ${type.name} market.`, false);
    return true;
}

function captainMine(captain) {
    const sector = state.universe[captain.currentSector];
    if (!sector || !sector.asteroids || sector.asteroids.ore <= 0) return false;
    const amount = Math.min(sector.asteroids.ore, Math.floor((captain.ship.miningRating || 10) * (0.6 + random() * 0.8) * sector.asteroids.richness));
    sector.asteroids.ore -= amount;
    captain.cargo.ore = Math.min(captain.ship.cargoCapacity, (captain.cargo.ore || 0) + amount);
    nudgeCaptainFaction(captain, "miners", 2);
    nudgeCaptainFaction(captain, "hc", 1);
    addSectorInfluence(captain.currentSector, "hc", 1, "captain mining activity");
    if (captain.currentSector === state.player.currentSector) addCaptainHistory(captain, `mined ${amount} ore from the local field.`, false);
    return true;
}

function captainSmuggle(captain) {
    const sector = state.universe[captain.currentSector];
    if (!sector) return false;
    addSectorInfluence(sector.id, "vc", 2, "quiet captain traffic");
    if (state.ports[sector.id] && random() < 0.25) state.ports[sector.id].hiddenFactionId = "vc";
    nudgeCaptainFaction(captain, "vc", 2);
    if (random() < 0.30) sector.pirateThreat = Math.min(6, sector.pirateThreat + 1);
    if (sector.id === state.player.currentSector) addCaptainHistory(captain, "made a suspiciously quiet cargo exchange.", false);
    return true;
}

function captainFightPirates(captain) {
    const sector = state.universe[captain.currentSector];
    if (!sector || sector.pirateThreat <= 0) return false;
    sector.pirateThreat = Math.max(0, sector.pirateThreat - 1);
    nudgeCaptainFaction(captain, "sda", 2);
    addSectorInfluence(sector.id, "sda", 2, "captain security work");
    if (sector.id === state.player.currentSector) addCaptainHistory(captain, "cleared pirate pressure before you could cash the bounty.", true);
    return true;
}

function captainSupportColony(captain) {
    const planet = state.planets[captain.currentSector];
    if (!planet) return false;
    if (!planet.owner && captain.archetype === "colonist" && random() < 0.18) {
        planet.owner = captain.name;
        planet.factionId = captain.preferredFaction;
        planet.colonists = 75 + Math.floor(random() * 100);
        planet.buildings.habitat = 1;
        addSectorInfluence(captain.currentSector, "fu", 4, "captain-founded settlement");
        addCaptainHistory(captain, `founded a small settlement in sector ${captain.currentSector}.`, true);
        return true;
    }
    if (planet.owner) {
        planet.stock.org += 5 + Math.floor(random() * 12);
        addSectorInfluence(captain.currentSector, "fu", 1, "captain colony relief");
        if (captain.currentSector === state.player.currentSector) addCaptainHistory(captain, "delivered relief supplies to the colony.", false);
        return true;
    }
    return false;
}

function captainPirateRaid(captain) {
    const sector = state.universe[captain.currentSector];
    if (!sector) return false;
    sector.pirateThreat = Math.min(6, sector.pirateThreat + 1);
    addSectorInfluence(sector.id, "vc", 3, "pirate captain raid");
    nudgeCaptainFaction(captain, "vc", 2);
    const localTraders = getCaptainsInSector(sector.id, false).filter(other => other.id !== captain.id && ["trader", "colonist", "industrialist"].includes(other.archetype));
    localTraders.forEach(other => {
        const aRel = ensureCaptainRelation(captain, other.id);
        const bRel = ensureCaptainRelation(other, captain.id);
        aRel.rivalry = clampRange((aRel.rivalry || 0) + 8, 0, 100);
        bRel.rivalry = clampRange((bRel.rivalry || 0) + 10, 0, 100);
        addCaptainHistory(other, `${captain.name} hit traffic near their route.`, other.known);
    });
    if (sector.id === state.player.currentSector) addCaptainHistory(captain, "raided the lane while you were nearby.", true);
    return true;
}

function maybeCaptainJoinOrLeaveGuild(captain) {
    const guild = captain.preferredFaction;
    if (!FACTIONS[guild] || FACTIONS[guild].type !== "guild") return;
    const standing = captain.factionStanding[guild] || 0;
    if (!captain.memberships[guild] && standing > 110 && random() < 0.18) {
        captain.memberships[guild] = 1;
        addCaptainHistory(captain, `joined ${FACTIONS[guild].name}.`, true);
        const major = FACTIONS[guild].majorAffinity;
        if (major) nudgeCaptainFaction(captain, major, 10);
    } else if (captain.memberships[guild] && standing < -60 && random() < 0.25) {
        delete captain.memberships[guild];
        addCaptainHistory(captain, `left ${FACTIONS[guild].name} after a run of bad blood.`, true);
    }
}

export function createCaptainEconomy(captain) {
    const profiles = {
        trader: { canOpenTradeRoutes: true, preferredCommodities: ["ore", "org", "eq"], routeAppetite: 0.85, minimumExpectedMargin: 16, acceptableRiskCeiling: 5 },
        industrialist: { canOpenTradeRoutes: true, preferredCommodities: ["ore", "eq"], routeAppetite: 0.7, minimumExpectedMargin: 18, acceptableRiskCeiling: 6 },
        miner: { canOpenTradeRoutes: true, preferredCommodities: ["ore"], routeAppetite: 0.55, minimumExpectedMargin: 14, acceptableRiskCeiling: 6 },
        colonist: { canOpenTradeRoutes: true, preferredCommodities: ["org", "eq"], routeAppetite: 0.5, minimumExpectedMargin: 10, acceptableRiskCeiling: 4 },
        smuggler: { canOpenTradeRoutes: true, preferredCommodities: ["eq", "org"], routeAppetite: 0.45, minimumExpectedMargin: 24, acceptableRiskCeiling: 9, illicitPreference: true },
        mercenary: { canOpenTradeRoutes: false, preferredCommodities: [], routeAppetite: 0, minimumExpectedMargin: 999, acceptableRiskCeiling: 0 },
        pirate: { canOpenTradeRoutes: false, preferredCommodities: [], routeAppetite: 0, minimumExpectedMargin: 999, acceptableRiskCeiling: 0 },
        fixer: { canOpenTradeRoutes: false, preferredCommodities: [], routeAppetite: 0, minimumExpectedMargin: 999, acceptableRiskCeiling: 0 }
    };
    const profile = profiles[captain.archetype] || profiles.fixer;
    return {
        budget: Math.max(0, Math.floor((captain.credits || 0) * 0.35)),
        homeSectorBias: captain.homeSector || captain.currentSector,
        nextRouteEvaluationDay: 1,
        capabilities: { canOpenTradeRoutes: profile.canOpenTradeRoutes },
        preferredCommodities: profile.preferredCommodities.slice(),
        routeAppetite: profile.routeAppetite,
        minimumExpectedMargin: profile.minimumExpectedMargin,
        acceptableRiskCeiling: profile.acceptableRiskCeiling,
        colonySupportPreference: captain.archetype === "colonist" ? 0.8 : 0.2,
        lawfulPreference: captain.archetype === "smuggler" ? 0.15 : 0.75,
        illicitPreference: Boolean(profile.illicitPreference)
    };
}

export function captainCanOpenTradeRoutes(captain) {
    normaliseCaptains();
    return Boolean(captain.economy && captain.economy.capabilities && captain.economy.capabilities.canOpenTradeRoutes);
}

function evaluateCaptainRouteOpenings(captain) {
    if (!captainCanOpenTradeRoutes(captain)) return;
    if (state.player.time.day < captain.economy.nextRouteEvaluationDay) return;
    captain.economy.nextRouteEvaluationDay = state.player.time.day + BALANCE.CAPTAIN_ROUTE.EVALUATION_INTERVAL_DAYS;
    const owned = state.tradeRoutes.filter(route => route.ownerType === "captain" && route.ownerId === captain.id && route.status !== "closed");
    owned.forEach(route => {
        const metrics = deriveRouteMetrics(route.originSector, route.destinationSector);
        if (metrics.risk === null || metrics.risk > captain.economy.acceptableRiskCeiling + 2 || route.failures >= BALANCE.CAPTAIN_ROUTE.BAD_ROUTE_FAILURES) route.status = "paused";
    });
    if (owned.length >= BALANCE.CAPTAIN_ROUTE.MAX_OWNED_ROUTES) return;
    if (random() > captain.economy.routeAppetite) return;
    const nodes = getAllLogisticsNodes();
    let best = null;
    nodes.forEach(origin => {
        nodes.forEach(destination => {
            if (origin.sectorId === destination.sectorId) return;
            const metrics = deriveRouteMetrics(origin.sectorId, destination.sectorId);
            if (metrics.hopCount === null || metrics.hopCount > 5) return;
            if (metrics.risk === null || metrics.risk > captain.economy.acceptableRiskCeiling) return;
            metrics.profitBands.forEach(option => {
                if (!captain.economy.preferredCommodities.includes(option.commodity)) return;
                const profit = option.expected;
                const physicalSpan = Math.max(1, metrics.totalEffectiveSpan || metrics.hopCount);
                const margin = profit / physicalSpan;
                if (margin < captain.economy.minimumExpectedMargin) return;
                const homeBias = origin.sectorId === captain.homeSector || destination.sectorId === captain.homeSector ? 20 : 0;
                const score = profit + homeBias + getCaptainMissionScore(captain.character, { type: "delivery" }) - physicalSpan * 3 - metrics.risk * 22 - metrics.surcharge * 100;
                if (!best || score > best.score) best = { origin, destination, commodity: option.commodity, score };
            });
        });
    });
    if (!best) return;
    const route = createCaptainTradeRoute(captain, best.origin.sectorId, best.destination.sectorId, best.commodity);
    if (route) addCaptainHistory(captain, `opened captain-operated trade route ${route.name}.`, captain.known);
}

function runCaptainDailyAction(captain) {
    maybeCaptainJoinOrLeaveGuild(captain);
    evaluateCaptainRouteOpenings(captain);
    if (captain.currentPlan && captain.currentPlan.type === "mission") {
        const mission = state.missions.find(m => m.id === captain.currentPlan.missionId);
        if (!mission || mission.status !== "captain_taken") {
            captain.currentPlan = null;
        } else if (state.player.time.day >= captain.currentPlan.completionDay) {
            completeCaptainMission(captain, mission);
            return;
        } else {
            if (captain.currentPlan.targetSector && canTransitDirectCorridor(captain.currentSector, captain.currentPlan.targetSector)) {
                captain.currentSector = captain.currentPlan.targetSector;
            } else {
                moveCaptainTowardInterestingSector(captain);
            }
            return;
        }
    }
    const mission = chooseCaptainMission(captain);
    if (mission) { startCaptainMission(captain, mission); return; }
    moveCaptainTowardInterestingSector(captain);
    if (captain.archetype === "miner" && captainMine(captain)) return;
    if (captain.archetype === "mercenary" && captainFightPirates(captain)) return;
    if (captain.archetype === "pirate" && captainPirateRaid(captain)) return;
    if (captain.archetype === "smuggler" && captainSmuggle(captain)) return;
    if (captain.archetype === "colonist" && captainSupportColony(captain)) return;
    if (["trader", "industrialist", "fixer", "smuggler"].includes(captain.archetype) && captainTrade(captain)) return;
    if (random() < 0.15) addCaptainHistory(captain, "kept a low profile and gathered local news.", false);
}

function resolveCaptainMeetings() {
    const bySector = {};
    Object.values(state.captains).forEach(c => {
        if (c.status !== "active") return;
        if (!bySector[c.currentSector]) bySector[c.currentSector] = [];
        bySector[c.currentSector].push(c);
    });
    Object.entries(bySector).forEach(([sectorIdText, group]) => {
        if (group.length < 2) return;
        for (let i = 0; i < group.length; i++) {
            for (let j = i + 1; j < group.length; j++) {
                const a = group[i], b = group[j];
                if (random() > 0.22) continue;
                const aligned = a.preferredFaction === b.preferredFaction || getFactionPoliticalPole(a.preferredFaction) === getFactionPoliticalPole(b.preferredFaction);
                const aRel = ensureCaptainRelation(a, b.id);
                const bRel = ensureCaptainRelation(b, a.id);
                if (aligned) {
                    aRel.opinion = clampRange((aRel.opinion || 0) + 3, -100, 100);
                    bRel.opinion = clampRange((bRel.opinion || 0) + 3, -100, 100);
                    if (Number(sectorIdText) === state.player.currentSector) log(`${a.name} and ${b.name} traded useful news at the port.`);
                } else {
                    aRel.rivalry = clampRange((aRel.rivalry || 0) + 3, 0, 100);
                    bRel.rivalry = clampRange((bRel.rivalry || 0) + 3, 0, 100);
                    if (Number(sectorIdText) === state.player.currentSector) log(`${a.name} and ${b.name} had a tense exchange over local loyalties.`);
                }
            }
        }
    });
}

export function updateCaptainsDaily(_reason = "daily frontier cycle") {
    normaliseCaptains();
    updateWingmenDaily();

    Object.values(state.captains).forEach(c => {
        if (c.status !== "active") return;
        if (state.player?.wing?.captainIds?.includes(c.id)) {
            c.currentSector = state.player.currentSector;
            return;
        }
        runCaptainDailyAction(c);
    });
    resolveCaptainMeetings();
    state.missions.filter(m => m.status === "available").forEach(prepareMissionOpportunity);
    EventBus.emit("captains_changed");
}

export function updateCaptainsHourly() {
    // Reserved for future hourly captain events
}
