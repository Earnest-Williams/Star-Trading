import { state } from '../state.js';
import { BALANCE, FACTIONS, COMMODITIES } from '../constants.js';
import { formatCommodity, formatCredits, getFreeHolds, log, random } from '../utils.js';
import { getDominantInfluence } from '../core/influence.js';
import { addSectorInfluence } from '../core/influence.js';
import { addWorldEvent } from '../core/worldEvents.js';
import { addFactionRep, addFactionTrust, addFactionHeat, applyPoliticalEffect, getMiningYieldMultiplier, ensureFactionState } from '../core/factions.js';
import { addIntel } from '../core/intel.js';
import { spendTime } from '../core/time.js';
import { applyShipDamage } from './combat.js';
import { updateFactionAskProgress } from './guilds.js';

export function mineAsteroids() {
    const sector = state.universe[state.player.currentSector];
    const asteroids = sector.asteroids;
    if (!asteroids) { log("No asteroid field here."); return; }
    if (asteroids.ore <= 0) { log("This asteroid field has been depleted."); return; }
    if (getFreeHolds() <= 0) { log("Your cargo holds are full."); return; }
    if (!spendTime(120)) return;
    const randomFactor = 0.80 + random() * 0.40;
    const influence = getDominantInfluence(state.player.currentSector);
    const influenceBoost = influence === "hc" ? 1.08 : influence === "vc" ? 1.03 : 1.0;
    const estimatedYield = Math.floor(state.player.ship.miningPower * getMiningYieldMultiplier() * influenceBoost * asteroids.richness * randomFactor);
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
    if (random() < asteroids.hazard) {
        const damage = 6 + Math.floor(random() * 22);
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
    if (!spendTime(60)) return;
    sector.surveyed = true;
    if (sector.asteroids) sector.asteroids.surveyed = true;
    log(`Surveyed sector ${sector.id}.`);
    updateFactionAskProgress("market_intel", 1);
    ensureFactionState();
    if (sector.front && random() < 0.45) {
        sector.front.suspicion = Math.min(100, sector.front.suspicion + 12);
        addIntel({
            type: "front",
            factionId: sector.front.hiddenFactionId,
            targetFactionId: sector.front.publicFactionId,
            sectorId: sector.id,
            value: 35 + sector.front.suspicion,
            expiresDay: state.player.time.day + 8,
            text: `Survey anomalies suggest ${FACTIONS[sector.front.hiddenFactionId].short} influence behind a public ${FACTIONS[sector.front.publicFactionId].short} operation in sector ${sector.id}.`
        });
    }
    if (sector.pirateThreat > 0) addFactionTrust("sda", 1, "useful patrol survey");
}
