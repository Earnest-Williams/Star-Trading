import { state } from '../state.js';
import { FACTIONS, FACTION_ASK_TYPES, GUILD_REQUIREMENTS, GUILD_TIER_NAMES, COMMODITIES } from '../constants.js';
import { clampRange, formatCredits, describeCost, hasCargo, removeCargo, log, random } from '../utils.js';
import { addSectorInfluence } from '../core/influence.js';
import { addWorldEvent } from '../core/worldEvents.js';
import { ensureFactionState, addFactionRep, addFactionTrust, addFactionHeat, addFactionLeverage, getGuildTier, applyPoliticalEffect, getFactionRep, hasGuildJoinAccess, canAffordGuildRequirement } from '../core/factions.js';
import { spendTime } from '../core/time.js';
import { Notifications } from '../ui/notifications.js';
import { addIntel, sellIntel } from '../core/intel.js';
export { sellIntel };

export function generateFactionAsks() {
    ensureFactionState();
    state.player.factions.asks = state.player.factions.asks.filter(a => a.expiresDay >= state.player.time.day && a.status !== "completed");
    let attempts = 0;
    while (state.player.factions.asks.filter(a => a.status === "available" || a.status === "accepted").length < 3 && attempts < 8) {
        attempts += 1;
        const ask = makeFactionAsk();
        if (ask) state.player.factions.asks.push(ask);
    }
}

export function makeFactionAsk() {
    ensureFactionState();
    const type = FACTION_ASK_TYPES[Math.floor(random() * FACTION_ASK_TYPES.length)];
    const id = state.player.factions.nextAskId++;
    const sectors = Object.keys(state.universe).map(Number).filter(s => s !== 1);
    const sectorId = sectors[Math.floor(random() * sectors.length)];
    if (type === "ore_quota") {
        return { id, type: "ore_quota", factionId: "miners", title: "Protect the Ore Floor",
            text: `Mine 60 Ore before Day ${state.player.time.day + 5}. The guild wants enough independent supply to resist Helion price pressure.`,
            amount: 60, progress: 0, rewardCredits: 1400, publicRep: 3, trust: 2, favors: 1, sectorId, influence: 3,
            expiresDay: state.player.time.day + 5, status: "available" };
    }
    if (type === "survey_patrol") {
        const target = sectors.find(s => !state.universe[s].surveyed) || sectorId;
        return { id, type: "survey_patrol", factionId: "sda", title: "Patrol Survey Request",
            text: `Survey sector ${target}. SDA wants updated lane data before it assigns patrols.`,
            targetSector: target, rewardCredits: 1100, publicRep: 3, trust: 1, favors: 1, sectorId: target, influence: 3,
            expiresDay: state.player.time.day + 4, status: "available" };
    }
    if (type === "frontier_charter") {
        const targets = Object.keys(state.planets).map(Number).filter(s => !state.planets[s].owner);
        if (targets.length === 0) return null;
        const target = targets[Math.floor(random() * targets.length)];
        return { id, type: "frontier_charter", factionId: "fu", title: "Frontier Charter",
            text: `Found a colony in sector ${target}. The Frontier Union wants a friendly settlement before corporate claims arrive.`,
            targetSector: target, rewardCredits: 2600, publicRep: 4, trust: 2, favors: 1, sectorId: target, influence: 6,
            expiresDay: state.player.time.day + 9, status: "available" };
    }
    if (type === "quiet_delivery") {
        const target = sectorId;
        return { id, type: "quiet_delivery", factionId: "vc", title: "Quiet Equipment Run",
            text: `Bring 10 Equipment to sector ${target}. The manifest is intentionally vague.`,
            targetSector: target, commodity: "eq", amount: 10, rewardCredits: 2200,
            privateRep: 5, trust: 2, favors: 1, heatFactionId: "sda", heat: 4, sectorId: target, influence: 4,
            intel: { type: "front", factionId: "vc", targetFactionId: "sda", sectorId: target, value: 35,
                expiresDay: state.player.time.day + 10, text: `Rumor: sector ${target} is being used as a Cartel back-channel.` },
            expiresDay: state.player.time.day + 5, status: "available" };
    }
    const target = sectorId;
    return { id, type: "market_intel", factionId: "traders", title: "Market Intel Sweep",
        text: `Survey sector ${target} and report the route conditions to the Traders Guild.`,
        targetSector: target, rewardCredits: 1200, publicRep: 2, trust: 1, favors: 1, sectorId: target, influence: 2,
        expiresDay: state.player.time.day + 5, status: "available" };
}

export function isFactionAskComplete(ask) {
    if (ask.type === "ore_quota") return (ask.progress || 0) >= ask.amount;
    if (ask.type === "survey_patrol") return state.universe[ask.targetSector] && state.universe[ask.targetSector].surveyed;
    if (ask.type === "frontier_charter") return state.planets[ask.targetSector] && state.planets[ask.targetSector].owner === "Player";
    if (ask.type === "quiet_delivery") return state.player.currentSector === ask.targetSector && ((ask.progress || 0) >= ask.amount || state.player.cargo[ask.commodity] >= ask.amount);
    if (ask.type === "market_intel") return state.player.currentSector === ask.targetSector && state.universe[ask.targetSector] && state.universe[ask.targetSector].surveyed;
    return false;
}

export function updateFactionAskProgress(type, amount) {
    ensureFactionState();
    state.player.factions.asks.forEach(ask => {
        if (ask.status !== "accepted") return;
        if (ask.type === type && typeof ask.progress === "number") {
            ask.progress = Math.min(ask.amount, ask.progress + amount);
        }
    });
}

export function updatePoliticalAsksForTrade(commodity, amount, mode) {
    ensureFactionState();
    state.player.factions.asks.forEach(ask => {
        if (ask.status !== "accepted") return;
        if (ask.type === "quiet_delivery" && mode === "sell" && commodity === ask.commodity && state.player.currentSector === ask.targetSector) {
            ask.progress = ask.amount;
        }
    });
}

export function acceptFactionAsk(id) {
    id = parseInt(id, 10);
    ensureFactionState();
    const ask = state.player.factions.asks.find(item => item.id === id);
    if (!ask || ask.status !== "available") return;
    ask.status = "accepted";
    addFactionTrust(ask.factionId, 1, "accepted faction ask");
    log(`Accepted political ask: ${ask.title}.`);
}

export function completeFactionAsk(id) {
    id = parseInt(id, 10);
    ensureFactionState();
    const ask = state.player.factions.asks.find(item => item.id === id);
    if (!ask || ask.status !== "accepted") return;
    if (ask.expiresDay < state.player.time.day) {
        ask.status = "expired";
        addFactionTrust(ask.factionId, -2, "missed faction ask");
        log(`Faction ask expired: ${ask.title}.`);
        return;
    }
    if (!isFactionAskComplete(ask)) {
        log(`Ask is not complete yet: ${ask.text}`);
        return;
    }
    if (ask.type === "quiet_delivery" && (ask.progress || 0) < ask.amount && state.player.cargo[ask.commodity] >= ask.amount) {
        state.player.cargo[ask.commodity] -= ask.amount;
    }
    ask.status = "completed";
    state.player.credits += ask.rewardCredits || 0;
    applyPoliticalEffect({ factionId: ask.factionId, publicRep: ask.publicRep || 0, privateRep: ask.privateRep || 0, trust: ask.trust || 1, favors: ask.favors || 1, sectorId: ask.sectorId || state.player.currentSector, influence: ask.influence || 2, reason: "completed political ask", memoryKey: "reliableJobs" });
    if (ask.heatFactionId && ask.heat) addFactionHeat(ask.heatFactionId, ask.heat, "questionable political ask");
    if (ask.intel) addIntel(ask.intel);
    log(`Completed political ask: ${ask.title}. Reward: ${formatCredits(ask.rewardCredits || 0)} credits.`);
}


export function joinGuild(guildId) {
    if (!FACTIONS[guildId] || FACTIONS[guildId].type !== "guild") return;
    if (getGuildTier(guildId) > 0) {
        log(`You are already a ${FACTIONS[guildId].name} ${GUILD_TIER_NAMES[getGuildTier(guildId)]}.`);
        return;
    }
    const req = GUILD_REQUIREMENTS[guildId];
    if (!hasGuildJoinAccess(guildId)) { log(req.note); return; }
    if (!canAffordGuildRequirement(guildId)) {
        log(`Joining ${FACTIONS[guildId].name} requires ${formatCredits(req.credits)} credits and cargo: ${describeCost(req.cargo || {})}.`);
        return;
    }
    if (!spendTime(60)) return;
    state.player.credits -= req.credits;
    removeCargo(req.cargo || {});
    state.player.factions.membership[guildId] = 1;
    applyPoliticalEffect({ factionId: guildId, publicRep: 25, trust: 4, favors: 1, sectorId: state.player.currentSector, influence: 2, reason: "guild membership accepted", memoryKey: "reliableJobs" });
    const affinity = FACTIONS[guildId].majorAffinity;
    if (affinity) addFactionRep(affinity, 5, `${FACTIONS[guildId].short} sponsorship`);
    if (guildId === "smugglers") {
        addFactionRep("vc", 10, "smuggler introduction", "private");
        addFactionHeat("sda", 4, "suspicious guild paperwork");
    }
    log(`Joined ${FACTIONS[guildId].name} as a Member.`);
    Notifications.show(`Joined ${FACTIONS[guildId].name}`, 2);
}

export function promoteGuild(guildId) {
    if (!FACTIONS[guildId] || FACTIONS[guildId].type !== "guild") return;
    const tier = getGuildTier(guildId);
    if (tier <= 0) { log(`Join ${FACTIONS[guildId].name} first.`); return; }
    if (tier >= 3) { log(`You already hold the highest ${FACTIONS[guildId].name} rank.`); return; }
    const requiredRep = tier === 1 ? 120 : 320;
    const cost = tier === 1 ? 2500 : 7500;
    if (getFactionRep(guildId) < requiredRep || state.player.credits < cost) {
        log(`Promotion requires ${requiredRep} ${FACTIONS[guildId].short} rep and ${formatCredits(cost)} credits.`);
        return;
    }
    if (!spendTime(120)) return;
    state.player.credits -= cost;
    state.player.factions.membership[guildId] = tier + 1;
    applyPoliticalEffect({ factionId: guildId, publicRep: 15, trust: 3, favors: 1, sectorId: state.player.currentSector, influence: 3, reason: "guild promotion", memoryKey: "reliableJobs" });
    if (guildId === "smugglers") addFactionLeverage("vc", 2, "deeper syndicate membership");
    log(`Promoted within ${FACTIONS[guildId].name}: ${GUILD_TIER_NAMES[tier + 1]}.`);
}
