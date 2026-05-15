import { state } from '../state.js';
import { BALANCE, FACTIONS } from '../constants.js';
import { getFreeHolds, log, random } from '../utils.js';
import { getDominantInfluence } from '../core/influence.js';
import { addSectorInfluence } from '../core/influence.js';
import { addFactionTrust, addFactionHeat, applyPoliticalEffect, getMiningYieldMultiplier, ensureFactionState } from '../core/factions.js';
import { addIntel } from '../core/intel.js';
import { spendTime } from '../core/time.js';
import { applyShipDamage } from './combat.js';
import { updateFactionAskProgress } from './guilds.js';
import { getMiningHazardChanceMod, getMiningYieldMultiplier as getCharacterMiningYieldMultiplier, getSurveyEfficiency } from '../core/characterChecks.js';
import { getTraitBonus } from '../core/traitHooks.js';

export function mineAsteroids() {
    const sector = state.universe[state.player.currentSector];
    const asteroids = sector.asteroids;
    if (!asteroids) { log("No asteroid field here."); return; }
    if (asteroids.ore <= 0) { log("This asteroid field has been depleted."); return; }
    if (getFreeHolds() <= 0) { log("Your cargo holds are full."); return; }
    if (!spendTime(BALANCE.MINING.OPERATION_TIME_MINUTES)) return;
    const randomFactor = BALANCE.MINING.YIELD_RANDOM_MIN + random() * BALANCE.MINING.YIELD_RANDOM_SPREAD;
    const influence = getDominantInfluence(state.player.currentSector);
    const influenceBoost = influence === "hc" ? BALANCE.MINING.HC_INFLUENCE_YIELD_MULTIPLIER : influence === "vc" ? BALANCE.MINING.VC_INFLUENCE_YIELD_MULTIPLIER : BALANCE.MINING.DEFAULT_INFLUENCE_YIELD_MULTIPLIER;
    const characterYieldBoost = getCharacterMiningYieldMultiplier(state.player.character);
    const estimatedYield = Math.floor(state.player.ship.miningPower * getMiningYieldMultiplier() * influenceBoost * asteroids.richness * randomFactor * characterYieldBoost);
    const mined = Math.min(estimatedYield, asteroids.ore, getFreeHolds());
    asteroids.ore -= mined;
    state.player.cargo.ore += mined;
    log(`Mined ${mined} Ore in sector ${sector.id}. Mining took 2 hours.`);
    if (mined > 0) {
        applyPoliticalEffect({ factionId: "miners", publicRep: 1, trust: 1, sectorId: state.player.currentSector, influence: 2, reason: "asteroid extraction", memoryKey: "reliableJobs" });
        addSectorInfluence(state.player.currentSector, "hc", 1, "industrial extraction");
        updateFactionAskProgress("ore_quota", mined);
        state.missions.filter(m => m.status === "accepted" && m.type === "mining").forEach(m => {
            m.progress = Math.min(m.amount, m.progress + mined);
        });
    }
    const hazardChance = Math.max(BALANCE.MINING.MIN_HAZARD_CHANCE, asteroids.hazard + getMiningHazardChanceMod(state.player.character));
    if (random() < hazardChance) {
        const damage = BALANCE.MINING.HAZARD_DAMAGE_BASE + Math.floor(random() * BALANCE.MINING.HAZARD_DAMAGE_RANDOM);
        applyShipDamage(damage);
        addFactionHeat("sda", 1, "hazard beacon traffic");
        log(`Mining debris hit the ship for ${damage} damage.`);
    }
}

export function surveySector() {
    const sector = state.universe[state.player.currentSector];
    if (sector.surveyed && (!sector.asteroids || sector.asteroids.surveyed)) {
        log("This sector is already surveyed.");
        return;
    }
    const surveyMinutes = Math.max(BALANCE.MINING.SURVEY_MIN_MINUTES, Math.round(BALANCE.MINING.SURVEY_BASE_MINUTES / getSurveyEfficiency(state.player.character)));
    if (!spendTime(surveyMinutes)) return;
    sector.surveyed = true;
    if (sector.asteroids) sector.asteroids.surveyed = true;
    log(`Surveyed sector ${sector.id}. Survey took ${surveyMinutes} minutes.`);
    updateFactionAskProgress("market_intel", 1);
    ensureFactionState();
    const surveyIntelChance = Math.min(BALANCE.MINING.SURVEY_INTEL_MAX_CHANCE, BALANCE.MINING.SURVEY_INTEL_BASE_CHANCE + getTraitBonus(state.player.character, "surveyIntelChance"));
    if (sector.front && random() < surveyIntelChance) {
        sector.front.suspicion = Math.min(BALANCE.MINING.FRONT_SUSPICION_MAX, sector.front.suspicion + BALANCE.MINING.FRONT_SUSPICION_GAIN);
        addIntel({
            type: "front",
            factionId: sector.front.hiddenFactionId,
            targetFactionId: sector.front.publicFactionId,
            sectorId: sector.id,
            value: BALANCE.MINING.FRONT_INTEL_VALUE_BASE + sector.front.suspicion,
            expiresDay: state.player.time.day + BALANCE.MINING.FRONT_INTEL_EXPIRY_DAYS,
            text: `Survey anomalies suggest ${FACTIONS[sector.front.hiddenFactionId].short} influence behind a public ${FACTIONS[sector.front.publicFactionId].short} operation in sector ${sector.id}.`
        });
    }
    if (sector.pirateThreat > 0) addFactionTrust("sda", 1, "useful patrol survey");
}
