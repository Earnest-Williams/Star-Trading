import { state } from '../state.js';
import { FACTIONS, DEFAULT_FACTION_RELATIONS, BALANCE, CARGO_COMMODITIES, CONTACT_DEFS, GUILD_FACTIONS, GUILD_REQUIREMENTS, PORT_TYPES } from '../constants.js';
import { clampRange, hasCargo, log } from '../utils.js';
import { addSectorInfluence, getInfluenceSpread } from './influence.js';
import { EventBus } from '../events.js';
import { Notifications } from '../ui/notifications.js';

export function createFactionState() {
    const reputation = {}, publicRep = {}, privateRep = {}, trust = {}, leverage = {}, heat = {}, favors = {}, membership = {}, memory = {};
    Object.keys(FACTIONS).forEach(id => {
        const start = FACTIONS[id].startingRep || 0;
        reputation[id] = start; publicRep[id] = start; privateRep[id] = 0;
        trust[id] = id === "sda" ? 15 : 0;
        leverage[id] = 0; heat[id] = 0; favors[id] = 0;
        memory[id] = { helpedEnemies: 0, smugglingSuspicions: 0, unpaidFines: 0, reliableJobs: 0, betrayals: 0 };
        if (FACTIONS[id].type === "guild") membership[id] = 0;
    });
    return { reputation, publicRep, privateRep, trust, leverage, heat, favors, membership, memory, intel: [], asks: [], contacts: createContactState(), nextAskId: 1 };
}

export function createContactState() {
    const contacts = {};
    Object.values(CONTACT_DEFS).forEach(contact => {
        contacts[contact.id] = {
            known: Boolean(contact.knownAtStart),
            relationship: contact.startingRelation || 0,
            trust: contact.knownAtStart ? 2 : 0,
            leverage: 0,
            lastInteraction: "not met yet"
        };
    });
    return contacts;
}

export function ensureFactionState() {
    if (!state.player.factions) state.player.factions = createFactionState();
    const f = state.player.factions;
    if (!f.reputation) f.reputation = {};
    if (!f.publicRep) f.publicRep = {};
    if (!f.privateRep) f.privateRep = {};
    if (!f.trust) f.trust = {};
    if (!f.leverage) f.leverage = {};
    if (!f.heat) f.heat = {};
    if (!f.favors) f.favors = {};
    if (!f.membership) f.membership = {};
    if (!f.memory) f.memory = {};
    if (!Array.isArray(f.intel)) f.intel = [];
    if (!Array.isArray(f.asks)) f.asks = [];
    if (!f.contacts) f.contacts = createContactState();
    Object.values(CONTACT_DEFS).forEach(contact => {
        if (!f.contacts[contact.id]) {
            f.contacts[contact.id] = {
                known: Boolean(contact.knownAtStart),
                relationship: contact.startingRelation || 0,
                trust: contact.knownAtStart ? 2 : 0,
                leverage: 0, lastInteraction: "not met yet"
            };
        }
    });
    if (typeof f.nextAskId !== "number") f.nextAskId = 1;
    Object.keys(FACTIONS).forEach(id => {
        const start = FACTIONS[id].startingRep || 0;
        if (typeof f.publicRep[id] !== "number") f.publicRep[id] = typeof f.reputation[id] === "number" ? f.reputation[id] : start;
        if (typeof f.privateRep[id] !== "number") f.privateRep[id] = 0;
        if (typeof f.reputation[id] !== "number") f.reputation[id] = f.publicRep[id];
        if (typeof f.trust[id] !== "number") f.trust[id] = id === "sda" ? 15 : 0;
        if (typeof f.leverage[id] !== "number") f.leverage[id] = 0;
        if (typeof f.heat[id] !== "number") f.heat[id] = 0;
        if (typeof f.favors[id] !== "number") f.favors[id] = 0;
        if (!f.memory[id]) f.memory[id] = { helpedEnemies: 0, smugglingSuspicions: 0, unpaidFines: 0, reliableJobs: 0, betrayals: 0 };
        if (FACTIONS[id].type === "guild" && typeof f.membership[id] !== "number") f.membership[id] = 0;
        syncFactionReputation(id);
    });
}

export function markFactionKnown(factionId, reason = "encountered") {
    if (!FACTIONS[factionId]) return;
    ensureFactionState();
    Object.values(CONTACT_DEFS).forEach(contact => {
        if (contact.factionId === factionId && state.player.factions.contacts[contact.id]) {
            state.player.factions.contacts[contact.id].known = true;
            state.player.factions.contacts[contact.id].lastInteraction = reason;
        }
    });
}

export function isFactionKnown(factionId) {
    if (!FACTIONS[factionId]) return false;
    if (["sda", "fu", "hc"].includes(factionId)) return true;
    ensureFactionState();
    if (factionId === "vc") {
        return getFactionRep("vc") > -100 || getPrivateFactionRep("vc") > 0 || getFactionHeat("sda") > 20 || state.player.factions.intel.some(item => item.factionId === "vc" || item.targetFactionId === "vc") || getGuildTier("smugglers") > 0;
    }
    if (FACTIONS[factionId].type === "guild") {
        return getGuildTier(factionId) > 0 || getFactionRep(factionId) > 0 || getFactionTrust(factionId) > 0 || hasGuildJoinAccess(factionId);
    }
    return true;
}

export function getKnownFactionIds() { return Object.keys(FACTIONS).filter(isFactionKnown); }

export function getContactScore(contact) {
    ensureFactionState();
    const contactState = state.player.factions.contacts[contact.id] || { relationship: 0, trust: 0, leverage: 0 };
    const factionScore = getFactionRep(contact.factionId) * 0.30 + getPrivateFactionRep(contact.factionId) * 0.20 + getFactionTrust(contact.factionId) * 1.4 - getFactionHeat(contact.factionId) * 0.30;
    return clampRange((contactState.relationship || 0) + factionScore, -100, 100);
}

export function getKnownContacts() {
    ensureFactionState();
    return Object.values(CONTACT_DEFS).filter(contact => {
        const contactState = state.player.factions.contacts[contact.id];
        return Boolean(contactState && (contactState.known || isFactionKnown(contact.factionId)));
    });
}

export function nudgeContact(contactId, relationshipDelta, trustDelta, reason) {
    ensureFactionState();
    const contactState = state.player.factions.contacts[contactId];
    if (!contactState) return;
    contactState.known = true;
    contactState.relationship = clampRange((contactState.relationship || 0) + relationshipDelta, -100, 100);
    contactState.trust = clampRange((contactState.trust || 0) + trustDelta, -100, 100);
    contactState.lastInteraction = reason || "recent business";
}

export function getContactForFaction(factionId) {
    return Object.values(CONTACT_DEFS).find(contact => contact.factionId === factionId) || null;
}

export function syncFactionReputation(factionId) {
    if (!state.player || !state.player.factions || !FACTIONS[factionId]) return;
    const f = state.player.factions;
    const publicScore = typeof f.publicRep[factionId] === "number" ? f.publicRep[factionId] : 0;
    const privateScore = typeof f.privateRep[factionId] === "number" ? f.privateRep[factionId] : 0;
    f.reputation[factionId] = clampRange(publicScore + privateScore * 0.25, -500, 1000);
}

export function getFactionRep(factionId) { ensureFactionState(); return state.player.factions.publicRep[factionId] || 0; }
export function getPrivateFactionRep(factionId) { ensureFactionState(); return state.player.factions.privateRep[factionId] || 0; }
export function getFactionTrust(factionId) { ensureFactionState(); return state.player.factions.trust[factionId] || 0; }
export function getFactionHeat(factionId) { ensureFactionState(); return state.player.factions.heat[factionId] || 0; }
export function getFactionLeverage(factionId) { ensureFactionState(); return state.player.factions.leverage[factionId] || 0; }
export function getFactionFavors(factionId) { ensureFactionState(); return state.player.factions.favors[factionId] || 0; }

export function setFactionRep(factionId, value) {
    ensureFactionState();
    if (!FACTIONS[factionId]) return;
    state.player.factions.publicRep[factionId] = clampRange(value, -500, 1000);
    syncFactionReputation(factionId);
}

export function setPrivateFactionRep(factionId, value) {
    ensureFactionState();
    if (!FACTIONS[factionId]) return;
    state.player.factions.privateRep[factionId] = clampRange(value, -500, 1000);
    syncFactionReputation(factionId);
}

export function addFactionRep(factionId, amount, reason, visibility = "public") {
    if (!FACTIONS[factionId] || amount === 0) return;
    ensureFactionState();
    const before = visibility === "private" ? getPrivateFactionRep(factionId) : getFactionRep(factionId);
    if (visibility === "private") setPrivateFactionRep(factionId, before + amount);
    else setFactionRep(factionId, before + amount);
    const after = visibility === "private" ? getPrivateFactionRep(factionId) : getFactionRep(factionId);
    if (after !== before && reason) {
        const label = visibility === "private" ? "private standing" : "public standing";
        log(`${FACTIONS[factionId].short} ${label} ${amount > 0 ? "+" : ""}${after - before}: ${reason}.`);
    }
    markFactionKnown(factionId, reason || "reputation changed");
    const contact = getContactForFaction(factionId);
    if (contact && amount !== 0) nudgeContact(contact.id, Math.trunc(amount / 2), visibility === "private" ? 1 : 0, reason || "reputation changed");
    applyFactionRipple(factionId, amount, visibility);
    EventBus.emit("faction_changed", { factionId });
}

export function addFactionTrust(factionId, amount, reason) {
    if (!FACTIONS[factionId] || amount === 0) return;
    ensureFactionState();
    const before = getFactionTrust(factionId);
    state.player.factions.trust[factionId] = clampRange(before + amount, -100, 100);
    const after = getFactionTrust(factionId);
    if (after !== before && reason) log(`${FACTIONS[factionId].short} trust ${amount > 0 ? "+" : ""}${after - before}: ${reason}.`);
    markFactionKnown(factionId, reason || "trust changed");
    const contact = getContactForFaction(factionId);
    if (contact) nudgeContact(contact.id, Math.trunc(amount / 2), amount, reason || "trust changed");
}

export function addFactionHeat(factionId, amount, reason) {
    if (!FACTIONS[factionId] || amount === 0) return;
    ensureFactionState();
    const before = getFactionHeat(factionId);
    state.player.factions.heat[factionId] = clampRange(before + amount, 0, 150);
    const after = getFactionHeat(factionId);
    if (after !== before && reason) log(`${FACTIONS[factionId].short} heat ${amount > 0 ? "+" : ""}${after - before}: ${reason}.`);
    markFactionKnown(factionId, reason || "heat changed");
    if (factionId === "sda" && before < 60 && after >= 60) {
        Notifications.show(`SDA heat reached ${after} — expect inspections`, 3);
    }
}

export function addFactionLeverage(factionId, amount, reason) {
    if (!FACTIONS[factionId] || amount === 0) return;
    ensureFactionState();
    const before = getFactionLeverage(factionId);
    state.player.factions.leverage[factionId] = clampRange(before + amount, 0, 150);
    const after = getFactionLeverage(factionId);
    if (after !== before && reason) log(`${FACTIONS[factionId].short} leverage ${amount > 0 ? "+" : ""}${after - before}: ${reason}.`);
}

export function addFactionFavor(factionId, amount, reason) {
    if (!FACTIONS[factionId] || amount === 0) return;
    ensureFactionState();
    const before = getFactionFavors(factionId);
    state.player.factions.favors[factionId] = clampRange(before + amount, 0, 99);
    const after = getFactionFavors(factionId);
    if (after !== before && reason) log(`${FACTIONS[factionId].short} favor ${amount > 0 ? "+" : ""}${after - before}: ${reason}.`);
}

export function recordFactionMemory(factionId, key, amount = 1) {
    ensureFactionState();
    if (!state.player.factions.memory[factionId]) return;
    if (typeof state.player.factions.memory[factionId][key] !== "number") state.player.factions.memory[factionId][key] = 0;
    state.player.factions.memory[factionId][key] += amount;
}

export function applyFactionRipple(factionId, amount, visibility) {
    const faction = FACTIONS[factionId];
    if (!faction) return;
    if (faction.type === "guild" && faction.majorAffinity) {
        const majorGain = Math.trunc(amount / 3);
        if (majorGain !== 0) addFactionRep(faction.majorAffinity, majorGain, `${faction.short} affinity`, visibility);
    } else if (faction.type === "major") {
        const fr = (state.player && state.player.factionRelations) || DEFAULT_FACTION_RELATIONS;
        Object.entries(fr[factionId] || {}).forEach(([otherId, relation]) => {
            if (Math.abs(relation) < 40) return;
            const ripple = Math.trunc(amount * relation / 500);
            if (ripple !== 0) {
                if (visibility === "private") setPrivateFactionRep(otherId, getPrivateFactionRep(otherId) + ripple);
                else setFactionRep(otherId, getFactionRep(otherId) + ripple);
            }
        });
    }
}

export function applyPoliticalEffect(effect) {
    if (!effect || !effect.factionId || !FACTIONS[effect.factionId]) return;
    const factionId = effect.factionId;
    const reason = effect.reason || "political consequence";
    if (effect.publicRep) addFactionRep(factionId, effect.publicRep, reason, "public");
    if (effect.privateRep) addFactionRep(factionId, effect.privateRep, reason, "private");
    if (effect.trust) addFactionTrust(factionId, effect.trust, reason);
    if (effect.heat) addFactionHeat(factionId, effect.heat, reason);
    if (effect.leverage) addFactionLeverage(factionId, effect.leverage, reason);
    if (effect.favors) addFactionFavor(factionId, effect.favors, reason);
    if (effect.memoryKey) recordFactionMemory(factionId, effect.memoryKey, effect.memoryAmount || 1);
    if (effect.sectorId && effect.influence) addSectorInfluence(effect.sectorId, factionId, effect.influence, reason);
}


export function spendFavor(factionId, amount) {
    ensureFactionState();
    if (getFactionFavors(factionId) < amount) return false;
    state.player.factions.favors[factionId] -= amount;
    return true;
}

export function getGuildTier(guildId) { ensureFactionState(); return state.player.factions.membership[guildId] || 0; }

export function getFactionLabel(rep) {
    if (rep >= 650) return "Trusted";
    if (rep >= 300) return "Friendly";
    if (rep >= 75) return "Warm";
    if (rep >= -50) return "Neutral";
    if (rep >= -200) return "Unfriendly";
    return "Hostile";
}

export function getFactionBarPercent(rep) { return Math.max(0, Math.min(100, Math.round(((rep + 500) / 1500) * 100))); }

export function getFactionPriceMultiplier(port, mode) {
    const factionId = port.factionId || (port.typeKey && PORT_TYPES[port.typeKey] ? PORT_TYPES[port.typeKey].factionId : "fu") || "fu";
    const rep = getFactionRep(factionId);
    const privateRep = getPrivateFactionRep(factionId);
    const trust = getFactionTrust(factionId);
    const heat = factionId === "sda" ? getFactionHeat("sda") : 0;
    const sectorSpread = getInfluenceSpread(state.player.currentSector);
    const sectorInfluence = sectorSpread.find(item => item.id === factionId);
    const influenceBonus = sectorInfluence ? (sectorInfluence.value - 35) / BALANCE.PRICE.INFLUENCE_DIVISOR : 0;
    const repBonus = Math.max(-0.20, Math.min(0.25, rep / BALANCE.PRICE.REP_DIVISOR));
    const privateBonus = Math.max(-0.05, Math.min(0.08, privateRep / BALANCE.PRICE.PRIVATE_DIVISOR));
    const trustBonus = Math.max(-0.04, Math.min(0.05, trust / BALANCE.PRICE.TRUST_DIVISOR));
    const heatPenalty = Math.max(0, Math.min(0.08, heat / BALANCE.PRICE.HEAT_DIVISOR));
    const traderBonus = getGuildTier("traders") * BALANCE.PRICE.TRADER_GUILD_BONUS;
    let affinityBonus = 0;
    GUILD_FACTIONS.forEach(guildId => {
        const guild = FACTIONS[guildId];
        if (guild.majorAffinity === factionId) affinityBonus += getGuildTier(guildId) * BALANCE.PRICE.AFFINITY_GUILD_BONUS;
    });
    const totalBonus = Math.max(-BALANCE.PRICE.MAX_PENALTY, Math.min(BALANCE.PRICE.MAX_BONUS, repBonus + privateBonus + trustBonus + influenceBonus + traderBonus + affinityBonus - heatPenalty));
    if (mode === "buy") return Math.max(BALANCE.PRICE.MIN_MULT, Math.min(BALANCE.PRICE.MAX_MULT, 1 - totalBonus));
    return Math.max(BALANCE.PRICE.MIN_MULT, Math.min(BALANCE.PRICE.MAX_MULT, 1 + totalBonus));
}

export function getMiningYieldMultiplier() { return 1 + getGuildTier("miners") * 0.08; }

export function getColonyProductionMultiplier(planet, commodity) {
    let multiplier = 1 + getGuildTier("colonists") * 0.08;
    if (commodity === "ore") multiplier += getGuildTier("miners") * 0.04;
    const alignedMajor = planet.factionId && FACTIONS[planet.factionId] ? (FACTIONS[planet.factionId].majorAffinity || planet.factionId) : null;
    if (commodity === "eq" && alignedMajor === "hc") multiplier += Math.max(0, getFactionRep("hc")) / 5000;
    if (planet.policy && planet.policy.security === "cartel_protection") multiplier += 0.03;
    return multiplier;
}

export function getPirateIncidentMultiplier() {
    let multiplier = 1 - getGuildTier("smugglers") * 0.12;
    multiplier -= Math.max(0, getFactionRep("vc")) / 3500;
    multiplier -= Math.max(0, getPrivateFactionRep("vc")) / 2200;
    multiplier -= Math.max(0, getFactionTrust("vc")) / 1000;
    multiplier += Math.max(0, getFactionHeat("sda") - 60) / 1200;
    return Math.max(0.35, Math.min(1.35, multiplier));
}

export function hasGuildJoinAccess(guildId) {
    const req = GUILD_REQUIREMENTS[guildId];
    if (!req) return false;
    const port = state.ports[state.player.currentSector];
    const planet = state.planets[state.player.currentSector];
    const sector = state.universe[state.player.currentSector];
    if (req.allowedPortTypes && port && req.allowedPortTypes.includes(port.typeKey)) return true;
    if (req.allowedRegions && sector && req.allowedRegions.includes(sector.region)) return true;
    if (req.allowsPlayerColony && planet && planet.owner === "Player") return true;
    return false;
}

export function canAffordGuildRequirement(guildId) {
    const req = GUILD_REQUIREMENTS[guildId];
    return Boolean(req && state.player.credits >= req.credits && hasCargo(req.cargo || {}));
}

export function factionName(id) { return FACTIONS[id] ? FACTIONS[id].name : "Independent"; }

export function getFactionPoliticalPole(factionId) {
    const faction = FACTIONS[factionId];
    if (!faction) return factionId;
    return faction.majorAffinity || factionId;
}

export function clampPlayerState() {
    ensureFactionState();
    state.player.credits = Math.max(0, Math.floor(state.player.credits));
    state.player.fighters = Math.max(0, Math.min(state.player.fighters, state.player.ship.maxFighters));
    state.player.shields = Math.max(0, Math.min(state.player.shields, state.player.ship.maxShields));
    state.player.hull = Math.max(0, Math.min(state.player.hull, state.player.ship.maxHull));
    CARGO_COMMODITIES.forEach(c => { state.player.cargo[c] = Math.max(0, Math.floor(state.player.cargo[c])); });
}
