import { FACTIONS, COMMODITIES } from "../constants.js";
import { escapeHtml, formatCredits, formatCommodity, makeStock } from "../utils.js";
import { getColonyDailyNeeds } from "../systems/colonies.js";
import { buildLogisticsSnapshot, getRouteEscortCandidates } from "../systems/tradeRoutes.js";
import { buildLogisticsObjectivesSnapshot, describeObjectiveCommodityProgress } from "../systems/logisticsObjectives.js";
import { captainDisplayName } from "../systems/captains.js";

export function renderLogisticsScreen() {
    const snapshot = buildLogisticsSnapshot();
    let html = `<h4>Explicit Trade Routes & Convoy Wings</h4>`;
    html += `<div class="small muted">Jump gates and corridors are infrastructure. Trade routes are explicit commercial plans operated by you or eligible captains. Ambient trade is aggregate background traffic and is not directly controllable.</div>`;
    html += renderRouteCreationPanel(snapshot);
    html += renderLogisticsObjectivesPanel();
    html += renderActiveRoutesPanel(snapshot);
    html += renderColonyNeedsPanel(snapshot);
    return html;
}

function renderRouteCreationPanel(snapshot) {
    const { origin } = snapshot;
    let html = `<div class="commodity-row"><strong>Open Route From Current Sector</strong>`;
    if (!origin) return html + `<div class="muted">This sector needs a port or one of your colonies before it can anchor a persistent route.</div></div>`;
    html += `<div>Origin: ${escapeHtml(origin.name)}</div>`;
    let found = false;
    snapshot.availableRouteOptions.forEach(candidate => {
        const { commodities } = candidate;
        found = true;
        const span = candidate.totalEffectiveSpan === null ? "n/a" : candidate.totalEffectiveSpan.toFixed(1);
        const surcharge = candidate.surcharge ? `, surcharge ${(candidate.surcharge * 100).toFixed(0)}%` : "";
        html += `<div class="mission"><strong>${escapeHtml(candidate.destination.name)}</strong> <span class="muted">${candidate.hopCount} corridors, span ${span}, risk ${candidate.risk}${surcharge}</span><br>`;
        commodities.forEach(option => {
            const marginBand = `${formatCredits(option.low)}c - ${formatCredits(option.high)}c`;
            const riskLabel = candidate.risk === null
                ? "disconnected"
                : candidate.risk >= 7
                    ? "high risk"
                    : candidate.risk >= 4
                        ? "elevated risk"
                        : "manageable risk";
            html += `<button data-action="createTradeRoute" data-arg0="${candidate.destination.sectorId}" data-arg1="${option.commodity}">Open ${formatCommodity(option.commodity)} Route (${formatCredits(candidate.setupCost)}c, est ${formatCredits(option.estimatedProfit)}c/day)</button>`;
            html += `<div class="small muted">Opportunity: ${formatCommodity(option.commodity)} route projects ${marginBand} per day with ${riskLabel}. Corridor span ${span} across ${candidate.hopCount} hops.</div>`;
        });
        html += `</div>`;
    });
    if (!found) html += `<div class="muted">No useful unscheduled flows from this sector. Try a port that exports goods, or build colony production first.</div>`;
    html += `</div>`;
    return html;
}

function renderLogisticsObjectivesPanel() {
    const entries = buildLogisticsObjectivesSnapshot();
    let html = `<div class="commodity-row"><strong>Logistics Objectives & Sector Campaigns</strong>`;
    if (entries.length === 0) return html + `<div class="muted">No faction logistics objectives are currently visible.</div></div>`;
    entries.forEach(entry => {
        const { objective, recommendations, forecastQuality } = entry;
        const faction = objective.sponsorFactionId && FACTIONS[objective.sponsorFactionId]
            ? FACTIONS[objective.sponsorFactionId]
            : null;
        const progressText = describeObjectiveCommodityProgress(objective) || "No cargo quota";
        html += `<div class="card"><strong>${escapeHtml(objective.title)}</strong> ${faction ? `<span style="color:${faction.color}">${faction.icon} ${faction.short}</span>` : ""}<br>`;
        html += `<span class="small muted">${escapeHtml(objective.description)}</span><br>`;
        html += `Status: ${objective.status} | Target S${objective.targetSectorId} | Deadline Day ${objective.deadlineDay} | Forecast quality: ${forecastQuality}<br>`;
        html += `<progress max="100" value="${Math.round(objective.progress.percent)}"></progress> ${Math.round(objective.progress.percent)}% | Score ${objective.progress.score}<br>`;
        html += `Cargo: ${progressText} | Route runs ${objective.progress.routeRuns} | Failed runs ${objective.progress.failedRuns}<br>`;
        if (objective.stageDefinitions.length > 0) {
            const stage = objective.stageDefinitions[objective.progress.activeStageIndex];
            html += `Campaign stage: ${stage ? escapeHtml(stage.label) : "Political effects pending/complete"}<br>`;
        }
        html += `<span class="small muted">Consequence: ${escapeHtml(objective.politicalConsequence || "Local pressure shifts with delivery outcomes.")}</span><br>`;
        if (objective.status === "available") html += `<button data-action="acceptLogisticsObjective" data-arg0="${objective.id}">Accept</button>`;
        if (objective.status === "active") html += `<button data-action="abandonLogisticsObjective" data-arg0="${objective.id}">Abandon</button>`;
        if (recommendations.length > 0) {
            html += `<div class="small"><strong>Route recommendations:</strong>`;
            recommendations.forEach(option => {
                const routeLabel = option.routeId ? `Route #${option.routeId}` : `new route ${formatCredits(option.setupCost)}c setup`;
                html += `<div>${routeLabel}: S${option.originSectorId} → S${option.targetSectorId} ${formatCommodity(option.commodity)}, risk ${option.projectedRisk}, reliability ${option.reliability}, est margin ${formatCredits(option.profit)}c/day</div>`;
            });
            html += `</div>`;
        } else {
            html += `<div class="small muted">No valid real corridor recommendation. If connectivity breaks, progress will stall until the route graph is restored.</div>`;
        }
        html += `</div>`;
    });
    html += `</div>`;
    return html;
}

function renderActiveRoutesPanel(snapshot) {
    const captains = snapshot.captains || {};
    const active = snapshot.activeRouteSummaries;
    let html = `<div class="commodity-row"><strong>Existing Routes</strong>`;
    if (active.length === 0) return html + `<div class="muted">No explicit trade routes yet. Ambient market traffic may still move small capped volumes in the background.</div></div>`;
    const escorts = getRouteEscortCandidates();
    active.forEach(entry => {
        const { route, origin, destination, risk, metrics } = entry;
        const faction = route.factionId && FACTIONS[route.factionId] ? FACTIONS[route.factionId] : null;
        const escort = route.escortCaptainId ? captains[route.escortCaptainId] : null;
        const owner = route.ownerType === "captain" && captains[route.ownerId] ? captainDisplayName(captains[route.ownerId]) : "Player";
        html += `<div class="card"><strong>${escapeHtml(route.name)}</strong> ${faction ? `<span style="color:${faction.color}">${faction.icon} ${faction.short}</span>` : ""}<br>`;
        html += `${origin ? escapeHtml(origin.name) : "Missing origin"} -> ${destination ? escapeHtml(destination.name) : "Missing destination"}<br>`;
        html += `Owner: ${escapeHtml(owner)} | Status: ${route.status} | Next run: Day ${route.nextRunDay} | Reliability ${route.reliability} | Heat ${route.heat}<br>`;
        html += `Runs ${route.runs} / Failures ${route.failures} / Lifetime profit ${formatCredits(route.profit)}<br>`;
        const routeSpan = metrics && metrics.totalEffectiveSpan !== null ? metrics.totalEffectiveSpan.toFixed(1) : "n/a";
        html += `Risk ${risk === null ? "disconnected" : risk.toFixed(1)} | Span ${routeSpan} | Escort: ${escort ? escapeHtml(captainDisplayName(escort)) : "none"}<br>`;
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
    html += `<div class="small muted">Last ambient trade: ${snapshot.ambientTradeFlows} aggregate flows. These background haulers are capped by shortage, surplus, distance, and risk.</div>`;
    return html;
}

function renderColonyNeedsPanel(snapshot) {
    const playerColonies = Object.entries(snapshot.playerColonies);
    let html = `<div class="commodity-row"><strong>Colony Supply Needs</strong>`;
    if (playerColonies.length === 0) return html + `<div class="muted">Found a colony to unlock supply pressure.</div></div>`;
    playerColonies.forEach(([sectorIdText, planet]) => {
        const needs = getColonyDailyNeeds(planet);
        const shortages = planet.shortages || makeStock();
        html += `<div class="mission"><strong>Colony S${sectorIdText}</strong> Satisfaction ${planet.satisfaction || 0}<br>`;
        html += `Daily needs: ${COMMODITIES.map(c => `${formatCommodity(c)} ${needs[c]}`).join(" / ")}<br>`;
        html += `Stock: ${COMMODITIES.map(c => `${formatCommodity(c)} ${planet.stock[c] || 0}`).join(" / ")}<br>`;
        html += `Shortages: ${COMMODITIES.map(c => `${formatCommodity(c)} ${shortages[c] || 0}`).join(" / ")}</div>`;
    });
    html += `</div>`;
    return html;
}
