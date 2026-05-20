import { state } from "../state.js";
import { FACTIONS, BALANCE, MARKET_COMMODITIES } from "../constants.js";
import { escapeHtml, formatCommodity } from "../utils.js";
import { getFactionRep, getFactionLabel } from "../core/factions.js";
import { getPortPrice } from "../systems/market.js";
import { renderMissionBoard } from "./renderMissions.js";
import { getPortType } from "../core/ports.js";
import { getMarketContractsForSector } from "../systems/economy/contracts.js";
import { describeAmbientTradeSummary } from "../systems/ambientTrade.js";

function renderPressurePanel(sectorId) {
    const pressure = state.economy?.pressureBySector?.[String(sectorId)];
    let html = `<h4>Market Pressure</h4>`;
    if (!pressure || typeof pressure !== "object") {
        return `${html}<div class="muted">No pressure telemetry recorded for this site yet.</div>`;
    }
    MARKET_COMMODITIES.forEach((commodity) => {
        const signal = pressure[commodity];
        if (!signal) return;
        const shortage = Math.round(Math.max(0, Number(signal.shortageSeverity || 0)) * 100);
        const surplus = Math.round(Math.max(0, Number(signal.surplusSeverity || 0)) * 100);
        const stockRatio = Math.round(Math.max(0, Number(signal.stockRatio || 0)) * 100);
        html += `<div class="small"><strong>${escapeHtml(formatCommodity(commodity))}</strong>: stock ${stockRatio}% | shortage ${shortage}% | surplus ${surplus}%</div>`;
    });
    return html;
}

function renderSiteEconomySummary(sectorId) {
    const profile = state.economy?.profilesBySector?.[sectorId];
    const volume = state.economy?.recentVolumeBySector?.[String(sectorId)] || {};
    const deliveredSummary = Object.entries(volume)
        .filter(([, amount]) => Number(amount) > 0)
        .map(([commodity, amount]) => `${formatCommodity(commodity)} ${Math.round(Number(amount))}`)
        .join(", ");
    if (!profile && !deliveredSummary) {
        return `<h4>Site Economy Summary</h4><div class="muted">Economic profile data is still being compiled.</div>`;
    }
    let html = `<h4>Site Economy Summary</h4>`;
    if (profile) {
        html += `<div class="small">Demand index ${Math.round(Number(profile.populationDemand || 0))} |`
            + ` Extraction index ${Math.round(Number(profile.extractionCapacity || 0))}</div>`;
    }
    html += `<div class="small muted">Recent delivered contract volume: ${escapeHtml(deliveredSummary || "none")}.</div>`;
    return html;
}

function renderEconomyContractBoard(sectorId) {
    const contracts = getMarketContractsForSector(sectorId);
    let html = '<h4>Economy Contracts</h4>';
    if (contracts.length <= 0) return `${html}<div class="muted">No pressure-driven contracts posted here.</div>`;
    contracts.forEach((contract) => {
        const today = Number(state.player?.time?.day || 0);
        const daysLeft = Math.max(0, Number(contract.expiresDay || today) - today);
        const statusText = contract.status === 'accepted' ? `Accepted · remaining ${contract.remaining}` : 'Available';
        const action = contract.status === 'available'
            ? `<button data-action="acceptEconomyContract" data-arg0="${contract.id}">Accept</button>`
            : '<span class="small muted">Deliver by selling commodity in this market.</span>';
        html += `<div class="mission-row"><strong>${escapeHtml(contract.reason)}</strong><br>`
            + `${escapeHtml(formatCommodity(contract.commodity))}: ${contract.amount} units, reward ${contract.reward} credits (${contract.unitReward}/unit), expires in ${daysLeft} day(s)<br>`
            + `<span class="small muted">${statusText}</span><br>${action}</div>`;
    });
    return html;
}

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
    html += renderPressurePanel(player.currentSector);
    html += renderSiteEconomySummary(player.currentSector);
    html += renderEconomyContractBoard(player.currentSector);
    html += `<div class="small muted">${escapeHtml(describeAmbientTradeSummary())}</div>`;
    html += renderMissionBoard();
    document.getElementById("actions").innerHTML = html;
}
