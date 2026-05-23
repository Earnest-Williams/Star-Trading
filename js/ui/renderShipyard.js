import { state } from "../state.js";
import { BALANCE } from '../config/economy.js';
import { UPGRADE_DEFS } from '../config/entities.js';
import { escapeHtml, formatCredits, log } from "../utils.js";
import { getGuildTier, applyPoliticalEffect, addFactionRep, addFactionHeat, getPrivateFactionRep } from "../core/factions.js";
import { spendTime } from "../core/time.js";
import { renderMissionBoard } from "./renderMissions.js";
import { updateUI } from "./renderer.js";

export function renderShipyardPanel() {
    const { player } = state;
    if (player.currentSector !== state.world?.roles?.shipyardSiteId) { console.log("Shipyard services are only available at StarDock."); return; }
    if (!player.ship) {
        document.getElementById("actions").innerHTML = '<h4>StarDock Shipyard</h4><div class="card">No assigned ship. Property and local careers remain available; acquiring a hull is follow-up work.</div>';
        return;
    }
    let html = `<h4>StarDock Shipyard</h4>`;
    html += `<button data-action="repairShip">Repair Hull/Shields</button>`;
    html += `<button data-action="buyFighters">Buy 10 Fighters</button>`;
    Object.keys(UPGRADE_DEFS).forEach(key => {
        const up = UPGRADE_DEFS[key];
        html += `<div class="commodity-row"><strong>${escapeHtml(up.name)}</strong><br>Cost: ${formatCredits(up.credits)} credits, ${up.minutes} minutes <button data-action="buyUpgrade" data-arg0="${key}">Buy</button></div>`;
    });
    html += renderMissionBoard();
    document.getElementById("actions").innerHTML = html;
}

export function buyUpgrade(key) {
    const { player } = state;
    const up = UPGRADE_DEFS[key];
    if (player.currentSector !== state.world?.roles?.shipyardSiteId || !player.ship || !up) return;
    let finalCost = up.credits;
    if (key === "mining") finalCost = Math.round(finalCost * (1 - getGuildTier("miners") * 0.05));
    if (key === "cargo" || key === "engine") finalCost = Math.round(finalCost * (1 - getGuildTier("traders") * 0.04));
    if (player.credits < finalCost) { log(`Not enough credits for that upgrade. Cost: ${formatCredits(finalCost)}.`); return; }
    if (!spendTime(up.minutes)) return;
    player.credits -= finalCost;
    if (key === "cargo") player.ship.maxHolds += 25;
    else if (key === "engine") player.ship.travelMinutesPerCorridor = Math.max(15, player.ship.travelMinutesPerCorridor - 5);
    else if (key === "scanner") player.ship.scannerLevel += 1;
    else if (key === "mining") player.ship.miningPower += 15;
    else if (key === "shields") { player.ship.maxShields += 100; player.shields = player.ship.maxShields; }
    else if (key === "fighters") player.ship.maxFighters += 500;
    applyPoliticalEffect({ factionId: "sda", publicRep: 1, trust: 1, sectorId: state.world?.roles?.shipyardSiteId || player.currentSector, influence: 1, reason: "licensed shipyard purchase" });
    if (key === "mining") addFactionRep("miners", 2, "mining upgrade purchase");
    if (key === "cargo" || key === "engine") addFactionRep("traders", 1, "commercial ship upgrade");
    log(`Installed upgrade: ${up.name}.`);
    updateUI();
}

export function repairShip() {
    const { player } = state;
    if (player.currentSector !== state.world?.roles?.shipyardSiteId || !player.ship) return;
    const shieldMissing = player.ship.maxShields - player.shields;
    const hullMissing = player.ship.maxHull - player.hull;
    const cost = Math.ceil(shieldMissing * BALANCE.REPAIR_SHIELD_COST + hullMissing * BALANCE.REPAIR_HULL_COST);
    if (cost <= 0) { log("Repairs are not needed."); return; }
    if (player.credits < cost) { log(`Full repairs cost ${formatCredits(cost)} credits.`); return; }
    if (!spendTime(120)) return;
    player.credits -= cost;
    player.shields = player.ship.maxShields;
    player.hull = player.ship.maxHull;
    addFactionRep("sda", 1, "registered repair work");
    log(`Completed repairs for ${formatCredits(cost)} credits.`);
    updateUI();
}

export function buyFighters() {
    const { player } = state;
    if (player.currentSector !== state.world?.roles?.shipyardSiteId || !player.ship) return;
    const amount = Math.min(10, player.ship.maxFighters - player.fighters);
    if (amount <= 0) { log("Your fighter bay is full."); return; }
    const cost = amount * BALANCE.FIGHTER_COST;
    if (player.credits < cost) { log(`Buying ${amount} fighters costs ${formatCredits(cost)} credits.`); return; }
    if (!spendTime(30)) return;
    player.credits -= cost;
    player.fighters += amount;
    addFactionHeat("sda", amount >= 10 && getPrivateFactionRep("vc") > 50 ? 1 : 0, "notable fighter purchase");
    log(`Bought ${amount} fighters for ${formatCredits(cost)} credits.`);
    updateUI();
}
