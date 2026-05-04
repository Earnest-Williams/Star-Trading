import { state } from "../state.js";
import { FACTIONS, BALANCE, COMMODITIES, GUILD_FACTIONS, PLANET_TYPES, BUILDING_DEFS } from "../constants.js";
import { escapeHtml, formatCredits, formatCommodity } from "../utils.js";
import { getGuildTier } from "../core/factions.js";
import { renderPlanetSummary } from "./renderSector.js";

export function renderColonyPanel() {
    const { player, planets } = state;
    const planet = planets[player.currentSector];
    if (!planet) { console.log("No planet here."); return; }
    const type = PLANET_TYPES[planet.typeKey];
    let html = `<h4>${escapeHtml(type.name)} Planet</h4>`;
    html += renderPlanetSummary(planet);
    if (!planet.owner) {
        html += `<div class="commodity-row">Founding cost: 50 Organics, 20 Equipment, 2,500 credits, 8 hours.</div>`;
        html += `<button data-action="foundColony">Found Colony</button>`;
    } else {
        html += `<div class="commodity-row"><strong>Colony Politics</strong><br>`;
        html += `<button data-action="setColonyPolicy" data-arg0="registration" data-arg1="registered">Register with SDA</button>`;
        html += `<button data-action="setColonyPolicy" data-arg0="registration" data-arg1="informal">Keep Informal</button>`;
        html += `<button data-action="setColonyPolicy" data-arg0="security" data-arg1="sda_patrol">SDA Patrol Contract</button>`;
        html += `<button data-action="setColonyPolicy" data-arg0="security" data-arg1="local_militia">Local Militia</button>`;
        if (getGuildTier("smugglers") > 0) html += `<button data-action="setColonyPolicy" data-arg0="security" data-arg1="cartel_protection">Cartel Protection</button>`;
        html += `</div>`;
        html += `<div class="commodity-row"><strong>Colony Alignment</strong><br>`;
        GUILD_FACTIONS.forEach(guildId => {
            if (getGuildTier(guildId) > 0) html += `<button data-action="alignColony" data-arg0="${guildId}">Align ${FACTIONS[guildId].short}</button>`;
        });
        html += `</div>`;
        COMMODITIES.forEach(c => {
            html += `<div class="commodity-row"><strong>${formatCommodity(c)}</strong><br>`;
            html += `<button data-action="depositToColony" data-arg0="${c}">Deposit ${BALANCE.TRADE_BATCH}</button>`;
            html += `<button data-action="loadFromColony" data-arg0="${c}">Load ${BALANCE.TRADE_BATCH}</button></div>`;
        });
        html += `<div class="commodity-row"><strong>Build</strong><br>`;
        Object.keys(BUILDING_DEFS).forEach(key => {
            const def = BUILDING_DEFS[key];
            html += `<button data-action="buildColonyStructure" data-arg0="${key}">${escapeHtml(def.name)}</button>`;
        });
        html += `</div>`;
    }
    document.getElementById("actions").innerHTML = html;
}
