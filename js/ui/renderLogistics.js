import { state } from "../state.js";
import { FACTIONS, COMMODITIES } from "../constants.js";
import { escapeHtml, formatCredits, formatCommodity, makeStock } from "../utils.js";
import { getColonyDailyNeeds } from "../systems/colonies.js";
import { getLogisticsNode, getAllLogisticsNodes, getRouteCommodityOptions, routeExists, getRouteDistance, getRouteRiskForSectors, getRouteSetupCost, estimateRouteProfit, getRouteRisk, getRouteEscortCandidates, normaliseTradeRoutes } from "../systems/tradeRoutes.js";
import { captainDisplayName } from "../systems/captains.js";

export function renderLogisticsScreen() {
    normaliseTradeRoutes();
    let html = `<h4>Trade Routes & Convoy Wings</h4>`;
    html += `<div class="small muted">Persistent routes turn one-off trades into lane control. They move stock daily, earn passive income, feed colonies, shift sector influence, and create convoy work for named captains.</div>`;
    html += renderRouteCreationPanel();
    html += renderActiveRoutesPanel();
    html += renderColonyNeedsPanel();
    return html;
}

function renderRouteCreationPanel() {
    const { player } = state;
    const origin = getLogisticsNode(player.currentSector);
    let html = `<div class="commodity-row"><strong>Open Route From Current Sector</strong>`;
    if (!origin) return html + `<div class="muted">This sector needs a port or one of your colonies before it can anchor a persistent route.</div></div>`;
    html += `<div>Origin: ${escapeHtml(origin.name)}</div>`;
    const candidates = getAllLogisticsNodes().filter(n => n.sectorId !== player.currentSector);
    let found = false;
    candidates.forEach(node => {
        const commodities = getRouteCommodityOptions(player.currentSector, node.sectorId).filter(c => !routeExists(player.currentSector, node.sectorId, c));
        if (commodities.length === 0) return;
        found = true;
        const distance = getRouteDistance(player.currentSector, node.sectorId);
        const risk = getRouteRiskForSectors(player.currentSector, node.sectorId);
        html += `<div class="mission"><strong>${escapeHtml(node.name)}</strong> <span class="muted">${distance} jumps, risk ${risk}</span><br>`;
        commodities.forEach(commodity => {
            const cost = getRouteSetupCost(player.currentSector, node.sectorId);
            const profit = estimateRouteProfit(player.currentSector, node.sectorId, commodity);
            html += `<button data-action="createTradeRoute" data-arg0="${node.sectorId}" data-arg1="${commodity}">Open ${formatCommodity(commodity)} Route (${formatCredits(cost)}c, est ${formatCredits(profit)}c/day)</button>`;
        });
        html += `</div>`;
    });
    if (!found) html += `<div class="muted">No useful unscheduled flows from this sector. Try a port that exports goods, or build colony production first.</div>`;
    html += `</div>`;
    return html;
}

function renderActiveRoutesPanel() {
    const { tradeRoutes, captains } = state;
    const active = tradeRoutes.filter(r => r.status !== "closed");
    let html = `<div class="commodity-row"><strong>Existing Routes</strong>`;
    if (active.length === 0) return html + `<div class="muted">No persistent routes yet.</div></div>`;
    const escorts = getRouteEscortCandidates();
    active.forEach(route => {
        const origin = getLogisticsNode(route.originSector);
        const destination = getLogisticsNode(route.destinationSector);
        const faction = route.factionId && FACTIONS[route.factionId] ? FACTIONS[route.factionId] : null;
        const escort = route.escortCaptainId ? captains[route.escortCaptainId] : null;
        html += `<div class="card"><strong>${escapeHtml(route.name)}</strong> ${faction ? `<span style="color:${faction.color}">${faction.icon} ${faction.short}</span>` : ""}<br>`;
        html += `${origin ? escapeHtml(origin.name) : "Missing origin"} -> ${destination ? escapeHtml(destination.name) : "Missing destination"}<br>`;
        html += `Status: ${route.status} | Next run: Day ${route.nextRunDay} | Reliability ${route.reliability} | Heat ${route.heat}<br>`;
        html += `Runs ${route.runs} / Failures ${route.failures} / Lifetime profit ${formatCredits(route.profit)}<br>`;
        html += `Risk ${getRouteRisk(route).toFixed(1)} | Escort: ${escort ? escapeHtml(captainDisplayName(escort)) : "none"}<br>`;
        html += `<button data-action="toggleTradeRoute" data-arg0="${route.id}">${route.status === "active" ? "Pause" : "Resume"}</button>`;
        html += `<button data-action="closeTradeRoute" data-arg0="${route.id}">Close</button>`;
        if (escort) html += `<button data-action="unassignRouteEscort" data-arg0="${route.id}">Release Escort</button>`;
        html += `<div class="compact-actions">`;
        escorts.slice(0, 5).forEach(captain => {
            if (route.escortCaptainId === captain.id) return;
            html += `<button data-action="assignCaptainToRoute" data-arg0="${route.id}" data-arg1="${captain.id}">Hire ${escapeHtml(captain.callsign)}</button>`;
        });
        html += `</div></div>`;
    });
    html += `</div>`;
    return html;
}

function renderColonyNeedsPanel() {
    const { planets } = state;
    const playerColonies = Object.entries(planets).filter(([, p]) => p.owner === "Player");
    let html = `<div class="commodity-row"><strong>Colony Supply Needs</strong>`;
    if (playerColonies.length === 0) return html + `<div class="muted">Found a colony to unlock supply pressure.</div></div>`;
    playerColonies.forEach(([sectorIdText, planet]) => {
        const needs = getColonyDailyNeeds(planet);
        const shortages = planet.shortages || makeStock(0, 0, 0);
        html += `<div class="mission"><strong>Colony S${sectorIdText}</strong> Satisfaction ${planet.satisfaction || 0}<br>`;
        html += `Daily needs: ${COMMODITIES.map(c => `${formatCommodity(c)} ${needs[c]}`).join(" / ")}<br>`;
        html += `Stock: ${COMMODITIES.map(c => `${formatCommodity(c)} ${planet.stock[c] || 0}`).join(" / ")}<br>`;
        html += `Shortages: ${COMMODITIES.map(c => `${formatCommodity(c)} ${shortages[c] || 0}`).join(" / ")}</div>`;
    });
    html += `</div>`;
    return html;
}
