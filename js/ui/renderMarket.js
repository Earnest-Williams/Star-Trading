import { state } from "../state.js";
import { FACTIONS, BALANCE, MARKET_COMMODITIES } from "../constants.js";
import { escapeHtml, formatCommodity } from "../utils.js";
import { getFactionRep, getFactionLabel } from "../core/factions.js";
import { getPortPrice } from "../systems/market.js";
import { renderMissionBoard } from "./renderMissions.js";
import { getPortType } from "../core/ports.js";

export function renderMarketPanel() {
    const { player, ports } = state;
    const port = ports[player.currentSector];
    if (!port) { console.log("No port here."); return; }
    const type = getPortType(port);
    const faction = FACTIONS[port.factionId];
    let html = `<h4>${escapeHtml(type.name)}</h4>`;
    if (faction) html += `<div>Authority: <span style="color:${faction.color}">${faction.icon} ${escapeHtml(faction.name)}</span> (${getFactionLabel(getFactionRep(faction.id))}, rep ${getFactionRep(faction.id)})</div>`;
    if (port.typeKey === "stardock") {
        html += `<div>StarDock handles upgrades, repairs, fighters, and mission brokerage.</div>`;
        html += `<button data-action="showScreen" data-arg0="shipyard">Open Shipyard</button>`;
    }
    MARKET_COMMODITIES.forEach(c => {
        const canBuy = type.sells.includes(c);
        const canSell = type.buys.includes(c);
        html += `<div class="commodity-row"><strong>${formatCommodity(c)}</strong>: stock ${port.stock[c] || 0}/${port.maxStock[c] || 0}<br>`;
        if (canBuy) {
            const price = getPortPrice(port, c, "buy");
            html += `Buy price: ${price} each <button data-action="tradeCommodity" data-arg0="${c}" data-arg1="buy">Buy ${BALANCE.TRADE_BATCH}</button> `;
        }
        if (canSell) {
            const price = getPortPrice(port, c, "sell");
            html += `Sell price: ${price} each <button data-action="tradeCommodity" data-arg0="${c}" data-arg1="sell">Sell ${BALANCE.TRADE_BATCH}</button>`;
        }
        if (!canBuy && !canSell) html += `<span class="muted">No trade in this commodity.</span>`;
        html += `</div>`;
    });
    html += renderMissionBoard();
    document.getElementById("actions").innerHTML = html;
}
