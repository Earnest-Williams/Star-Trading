import { state } from "../state.js";
import { FACTIONS, COMMODITIES } from "../constants.js";
import { escapeHtml, formatCredits, formatCommodity, makeStock } from "../utils.js";
import { getColonyDailyNeeds } from "../systems/colonies.js";
import { buildLogisticsSnapshot, getRouteEscortCandidates, routeExists } from "../systems/tradeRoutes.js";
import { captainDisplayName } from "../systems/captains.js";

export function renderLogisticsScreen() {
    const snapshot = buildLogisticsSnapshot();
    let html = `<h4>Explicit Trade Routes & Convoy Wings</h4>`;
    html += `<div class="small muted">Jump gates and corridors are infrastructure. Trade routes are explicit commercial plans operated by you or eligible captains. Ambient trade is aggregate background traffic and is not directly controllable.</div>`;
    html += renderRouteCreationPanel(snapshot);
    html += renderActiveRoutesPanel(snapshot);
    html += renderColonyNeedsPanel();
    return html;
}

function renderRouteCreationPanel(snapshot) {
    const { origin } = snapshot;
    let html = `<div class="commodity-row"><strong>Open Route From Current Sector</strong>`;
    if (!origin) return html + `<div class="muted">This sector needs a port or one of your colonies before it can anchor a persistent route.</div></div>`;
    html += `<div>Origin: ${escapeHtml(origin.name)}</div>`;
    let found = false;
    snapshot.candidates.forEach(candidate => {
        const commodities = candidate.commodities.filter(option => !state.tradeRoutes.some(route => {
            const routeOwnerId = typeof route.ownerId === "undefined" ? null : route.ownerId;
            return route.status !== "closed"
                && route.originSector === snapshot.originSector
                && route.destinationSector === candidate.destination.sectorId
                && route.commodity === option.commodity
                && (route.ownerType || "player") === "player"
                && routeOwnerId === null;
        }));
        if (commodities.length === 0) return;
        found = true;
        html += `<div class="mission"><strong>${escapeHtml(candidate.destination.name)}</strong> <span class="muted">${candidate.distance} corridors, risk ${candidate.risk}</span><br>`;
        commodities.forEach(option => {
            html += `<button data-action="createTradeRoute" data-arg0="${candidate.destination.sectorId}" data-arg1="${option.commodity}">Open ${formatCommodity(option.commodity)} Route (${formatCredits(candidate.setupCost)}c, est ${formatCredits(option.estimatedProfit)}c/day)</button>`;
        });
        html += `</div>`;
    });
    if (!found) html += `<div class="muted">No useful unscheduled flows from this sector. Try a port that exports goods, or build colony production first.</div>`;
    html += `</div>`;
    return html;
}

function renderActiveRoutesPanel(snapshot) {
    const { captains } = state;
    const active = snapshot.activeRoutes;
    let html = `<div class="commodity-row"><strong>Existing Routes</strong>`;
    if (active.length === 0) return html + `<div class="muted">No explicit trade routes yet. Ambient market traffic may still move small capped volumes in the background.</div></div>`;
    const escorts = getRouteEscortCandidates();
    active.forEach(entry => {
        const { route, origin, destination, risk } = entry;
        const faction = route.factionId && FACTIONS[route.factionId] ? FACTIONS[route.factionId] : null;
        const escort = route.escortCaptainId ? captains[route.escortCaptainId] : null;
        const owner = route.ownerType === "captain" && captains[route.ownerId] ? captainDisplayName(captains[route.ownerId]) : "Player";
        html += `<div class="card"><strong>${escapeHtml(route.name)}</strong> ${faction ? `<span style="color:${faction.color}">${faction.icon} ${faction.short}</span>` : ""}<br>`;
        html += `${origin ? escapeHtml(origin.name) : "Missing origin"} -> ${destination ? escapeHtml(destination.name) : "Missing destination"}<br>`;
        html += `Owner: ${escapeHtml(owner)} | Status: ${route.status} | Next run: Day ${route.nextRunDay} | Reliability ${route.reliability} | Heat ${route.heat}<br>`;
        html += `Runs ${route.runs} / Failures ${route.failures} / Lifetime profit ${formatCredits(route.profit)}<br>`;
        html += `Risk ${risk === null ? "disconnected" : risk.toFixed(1)} | Escort: ${escort ? escapeHtml(captainDisplayName(escort)) : "none"}<br>`;
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
    html += `<div class="small muted">Last ambient trade: ${state.ambientTrade ? state.ambientTrade.flows : 0} aggregate flows. These background haulers are capped by shortage, surplus, distance, and risk.</div>`;
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
