import { state } from '../state.js';
import { BALANCE, COMMODITIES, PLANET_TYPES, FACTIONS, BUILDING_DEFS, GUILD_FACTIONS } from '../constants.js';
import { clampRange, makeStock, formatCommodity, formatCredits, getFreeHolds, hasCargo, removeCargo, describeCost, log } from '../utils.js';
import { getDominantInfluence, addSectorInfluence } from '../core/influence.js';
import { addWorldEvent } from '../core/worldEvents.js';
import { getGuildTier, getFactionRep, addFactionRep, addFactionTrust, addFactionHeat, addFactionLeverage, applyPoliticalEffect, getColonyProductionMultiplier } from '../core/factions.js';
import { spendTime } from '../core/time.js';
import { Notifications } from '../ui/notifications.js';
import { updateFactionAskProgress } from './guilds.js';

export function foundColony() {
    const planet = state.planets[state.player.currentSector];
    if (!planet || planet.owner) return;
    const cost = { org: 50, eq: 20 };
    if (state.player.credits < 2500 || !hasCargo(cost)) {
        log("Founding a colony requires 50 Organics, 20 Equipment, and 2,500 credits.");
        return;
    }
    if (!spendTime(480)) return;
    state.player.credits -= 2500;
    removeCargo(cost);
    planet.owner = "Player";
    planet.factionId = getGuildTier("colonists") > 0 ? "colonists" : "fu";
    planet.policy = {
        registration: getFactionRep("sda") >= 0 ? "registered" : "informal",
        economy: "free_trade",
        security: "local_militia",
        hiddenInfluence: { vc: 0 }
    };
    planet.colonists = 100;
    planet.buildings.habitat = 1;
    applyPoliticalEffect({ factionId: "colonists", publicRep: 5, trust: 2, sectorId: state.player.currentSector, influence: 4, reason: "new colony founded", memoryKey: "reliableJobs" });
    applyPoliticalEffect({ factionId: "fu", publicRep: 2, trust: 1, sectorId: state.player.currentSector, influence: 7, reason: "frontier settlement" });
    addFactionHeat("sda", planet.policy.registration === "registered" ? 0 : 3, "informal colony paperwork");
    addWorldEvent({ type: "colony", factionId: planet.factionId, sectorId: state.player.currentSector, text: `You founded a colony on the ${PLANET_TYPES[planet.typeKey].name} planet in sector ${state.player.currentSector}.`, importance: 3, alert: false });
    log(`Founded a colony on the ${PLANET_TYPES[planet.typeKey].name} planet in sector ${state.player.currentSector}.`);
    Notifications.show(`Colony founded in sector ${state.player.currentSector}`, 3);
}

export function alignColony(factionId) {
    const planet = state.planets[state.player.currentSector];
    if (!planet || planet.owner !== "Player") return;
    if (!FACTIONS[factionId] || getGuildTier(factionId) <= 0) {
        log("You need guild membership before aligning a colony to that guild.");
        return;
    }
    if (!spendTime(60)) return;
    planet.factionId = factionId;
    if (!planet.policy) planet.policy = { registration: "registered", economy: "free_trade", security: "local_militia", hiddenInfluence: { vc: 0 } };
    if (factionId === "smugglers") {
        planet.policy.hiddenInfluence.vc = Math.min(100, (planet.policy.hiddenInfluence.vc || 0) + 15);
        addFactionRep("vc", 5, "shadow colony access", "private");
        addFactionHeat("sda", 5, "unusual colony traffic");
    }
    addFactionRep(factionId, 3, "colony alignment");
    addFactionTrust(factionId, 1, "colony charter");
    const major = FACTIONS[factionId].majorAffinity;
    if (major) addSectorInfluence(state.player.currentSector, major, 4, "guild colony charter");
    log(`Colony aligned with ${FACTIONS[factionId].name}.`);
}

export function setColonyPolicy(key, value) {
    const planet = state.planets[state.player.currentSector];
    if (!planet || planet.owner !== "Player") return;
    if (!planet.policy) planet.policy = { registration: "registered", economy: "free_trade", security: "local_militia", hiddenInfluence: { vc: 0 } };
    if (!spendTime(60)) return;
    planet.policy[key] = value;
    if (key === "registration" && value === "registered") {
        applyPoliticalEffect({ factionId: "sda", publicRep: 2, trust: 1, sectorId: state.player.currentSector, influence: 3, reason: "registered colony charter" });
    }
    if (key === "registration" && value === "informal") {
        applyPoliticalEffect({ factionId: "fu", publicRep: 2, trust: 1, sectorId: state.player.currentSector, influence: 2, reason: "informal frontier autonomy" });
        addFactionHeat("sda", 3, "informal colony status");
    }
    if (key === "security" && value === "sda_patrol") {
        applyPoliticalEffect({ factionId: "sda", publicRep: 2, trust: 1, sectorId: state.player.currentSector, influence: 4, reason: "colony patrol contract" });
        const sector = state.universe[state.player.currentSector];
        sector.pirateThreat = Math.max(0, sector.pirateThreat - 1);
    }
    if (key === "security" && value === "local_militia") {
        applyPoliticalEffect({ factionId: "fu", publicRep: 2, trust: 1, sectorId: state.player.currentSector, influence: 3, reason: "local militia charter" });
    }
    if (key === "security" && value === "cartel_protection") {
        if (getGuildTier("smugglers") <= 0) {
            log("You need Smugglers Syndicate membership for Cartel protection.");
            return;
        }
        planet.policy.hiddenInfluence.vc = Math.min(100, (planet.policy.hiddenInfluence.vc || 0) + 20);
        applyPoliticalEffect({ factionId: "vc", privateRep: 5, trust: 2, sectorId: state.player.currentSector, influence: 6, reason: "cartel protection compact" });
        addFactionHeat("sda", 6, "shadow protection rumors");
    }
    log(`Colony policy updated: ${key} = ${value}.`);
}

export function depositToColony(commodity) {
    const planet = state.planets[state.player.currentSector];
    if (!planet || planet.owner !== "Player") return;
    const amount = Math.min(BALANCE.TRADE_BATCH, state.player.cargo[commodity]);
    if (amount <= 0) { log(`You have no ${formatCommodity(commodity)} to deposit.`); return; }
    if (!spendTime(BALANCE.TRADE_TIME_MINUTES)) return;
    state.player.cargo[commodity] -= amount;
    planet.stock[commodity] += amount;
    log(`Deposited ${amount} ${formatCommodity(commodity)} at the colony.`);
}

export function loadFromColony(commodity) {
    const planet = state.planets[state.player.currentSector];
    if (!planet || planet.owner !== "Player") return;
    const freeHolds = getFreeHolds();
    const amount = Math.min(BALANCE.TRADE_BATCH, planet.stock[commodity], Math.max(0, freeHolds));
    if (amount <= 0) { log(`No available ${formatCommodity(commodity)} or no free cargo holds.`); return; }
    if (!spendTime(BALANCE.TRADE_TIME_MINUTES)) return;
    planet.stock[commodity] -= amount;
    state.player.cargo[commodity] += amount;
    log(`Loaded ${amount} ${formatCommodity(commodity)} from the colony.`);
}

export function buildColonyStructure(key) {
    const planet = state.planets[state.player.currentSector];
    const def = BUILDING_DEFS[key];
    if (!planet || planet.owner !== "Player" || !def) return;
    if (state.player.credits < def.credits || !hasCargo(def.cargo)) {
        log(`${def.name} requires ${formatCredits(def.credits)} credits and cargo: ${describeCost(def.cargo)}.`);
        return;
    }
    if (!spendTime(def.minutes)) return;
    state.player.credits -= def.credits;
    removeCargo(def.cargo);
    planet.buildings[key] += 1;
    log(`Built ${def.name} level ${planet.buildings[key]} on the colony.`);
}

export function getColonyDailyNeeds(planet) {
    if (!planet || planet.owner !== "Player") return makeStock(0, 0, 0);
    return makeStock(
        Math.floor((planet.buildings.factory * 3 + planet.buildings.defense * 2 + planet.colonists / 180)),
        Math.max(1, Math.floor(planet.colonists / 95 + planet.buildings.habitat)),
        Math.floor(planet.buildings.habitat + planet.buildings.mine + planet.buildings.farm + planet.buildings.defense * 2 + planet.colonists / 220)
    );
}

export function updateColonyNeedsDaily() {
    Object.entries(state.planets).forEach(([sectorIdText, planet]) => {
        if (planet.owner !== "Player") return;
        if (typeof planet.satisfaction !== "number") planet.satisfaction = 60;
        if (!planet.shortages) planet.shortages = makeStock(0, 0, 0);
        const sectorId = Number(sectorIdText);
        const needs = getColonyDailyNeeds(planet);
        let shortageCount = 0;
        COMMODITIES.forEach(c => {
            const need = needs[c] || 0;
            const used = Math.min(planet.stock[c] || 0, need);
            planet.stock[c] -= used;
            const missing = Math.max(0, need - used);
            planet.shortages[c] = missing;
            if (missing > 0) shortageCount += 1;
        });
        if (shortageCount === 0) {
            planet.satisfaction = clampRange(planet.satisfaction + 3, 0, 100);
            if (planet.satisfaction >= 80 && Math.random() < 0.18) addFactionRep("colonists", 1, "well-supplied colony");
            return;
        }
        planet.satisfaction = clampRange(planet.satisfaction - shortageCount * 7, 0, 100);
        if (planet.satisfaction < 25) {
            const lost = Math.max(1, Math.floor(planet.colonists * 0.02));
            planet.colonists = Math.max(20, planet.colonists - lost);
            addWorldEvent({
                type: "colony_shortage", sectorId, factionId: planet.factionId || "colonists",
                text: `Colony S${sectorId} is undersupplied. Satisfaction fell to ${planet.satisfaction}, and ${lost} colonists left.`,
                importance: 3, alert: true
            });
        } else {
            addWorldEvent({
                type: "colony_shortage", sectorId, factionId: planet.factionId || "colonists",
                text: `Colony S${sectorId} reported shortages: ${COMMODITIES.filter(c => planet.shortages[c] > 0).map(c => `${formatCommodity(c)} ${planet.shortages[c]}`).join(", ")}.`,
                importance: 2, alert: false
            });
        }
    });
}

export function produceColonies() {
    Object.entries(state.planets).forEach(([sectorIdText, planet]) => {
        if (planet.owner !== "Player") return;
        const sectorId = Number(sectorIdText);
        const type = PLANET_TYPES[planet.typeKey];
        const habitat = planet.buildings.habitat;
        const capacity = Math.max(100, habitat * 250);
        let growthMultiplier = type.growth;
        if (planet.policy && planet.policy.registration === "informal") growthMultiplier *= 1.08;
        if (planet.policy && planet.policy.security === "sda_patrol") growthMultiplier *= 0.97;
        if (planet.factionId === "colonists") growthMultiplier *= 1 + getGuildTier("colonists") * 0.05;
        const growth = Math.floor((4 + habitat * 3) * growthMultiplier);
        planet.colonists = Math.min(capacity, planet.colonists + growth);
        const dominant = getDominantInfluence(sectorId);
        const hcIndustrialBonus = dominant === "hc" ? 1.08 : 1.0;
        const fuColonyBonus = dominant === "fu" ? 1.07 : 1.0;
        const vcShadowBonus = planet.policy && planet.policy.security === "cartel_protection" ? 1.06 : 1.0;
        planet.stock.ore += Math.floor((planet.buildings.mine * 14 + planet.colonists / 60) * type.ore * hcIndustrialBonus * vcShadowBonus * getColonyProductionMultiplier(planet, "ore"));
        planet.stock.org += Math.floor((planet.buildings.farm * 14 + planet.colonists / 70) * type.org * fuColonyBonus * getColonyProductionMultiplier(planet, "org"));
        planet.stock.eq += Math.floor((planet.buildings.factory * 10 + planet.colonists / 100) * type.eq * hcIndustrialBonus * getColonyProductionMultiplier(planet, "eq"));
        const major = planet.factionId && FACTIONS[planet.factionId] && FACTIONS[planet.factionId].majorAffinity ? FACTIONS[planet.factionId].majorAffinity : planet.factionId;
        if (["sda", "fu", "hc", "vc"].includes(major)) addSectorInfluence(sectorId, major, 1, "");
        if (planet.policy && planet.policy.security === "cartel_protection") addSectorInfluence(sectorId, "vc", 1, "");
    });
}
