import { state } from "../state.js";
import { FACTIONS, PORT_TYPES, PLANET_TYPES } from "../constants.js";
import { escapeHtml, makeStock } from "../utils.js";
import { getSectorFactionId, getSectorStatusLabel, getInfluenceSpread } from "../core/influence.js";
import { renderCaptainChipsForSector } from "./renderCaptains.js";
import { getOutboundJumpGates, getSectorNeighbors, getWayStationReserveState } from "../core/navigation.js";
import { getSiteTypeLabel, getRichnessLabel } from "../core/universe.js";

export function renderSectorContents() {
    const { player, universe, ports, planets, tradeRoutes } = state;
    const sector = universe[player.currentSector];
    const port = ports[player.currentSector];
    const planet = planets[player.currentSector];
    const influence = FACTIONS[getSectorFactionId(player.currentSector)];
    let html = `<div><strong>Site:</strong> ${escapeHtml(getSiteTypeLabel(sector.siteType))} | <strong>Richness:</strong> ${escapeHtml(getRichnessLabel(sector.richness))}</div>`;
    if (sector.coord) html += `<div><strong>Coordinate:</strong> (${sector.coord.x}, ${sector.coord.y}, ${sector.coord.z}) | <strong>Metric shear:</strong> ${(sector.metricShear || 0).toFixed(2)}</div>`;
    html += `<div><strong>Region:</strong> ${escapeHtml(sector.region)} | <strong>Status:</strong> ${escapeHtml(getSectorStatusLabel(player.currentSector))}</div>`;
    if (influence) html += `<div><strong>Dominant Influence:</strong> <span style="color:${influence.color}">${influence.icon} ${escapeHtml(influence.name)}</span></div>`;
    html += `<div class="small muted">${getInfluenceSpread(player.currentSector).map(item => `${FACTIONS[item.id].short}:${item.value}`).join(" | ")}</div>`;
    const outboundGates = getOutboundJumpGates(player.currentSector);
    const gateLabels = outboundGates.map(gate => {
        const gateId = escapeHtml(gate.id || "unknown gate");
        const corridorId = escapeHtml(gate.corridorId || "unknown corridor");
        const span = typeof gate.effectiveSpanCost === "number" ? `, span ${gate.effectiveSpanCost.toFixed(2)}` : "";
        return `${gateId} to site ${gate.destinationSectorId} (${corridorId}${span})`;
    });
    html += `<div><strong>Local Jump Gates:</strong> ${gateLabels.join(" | ") || "None"}</div>`;
    html += `<div><strong>Chart:</strong> ${sector.charted ? "Charted" : "Uncharted"} | <strong>Reach:</strong> ${sector.reachable ? "Scheduled" : "Not in regular service"} | <strong>Survey:</strong> ${sector.surveyed ? "Complete" : "Not surveyed"}</div>`;
    const reserveState = getWayStationReserveState(sector);
    if (reserveState) html += `<div class="amber"><strong>Way station reserve:</strong> ${escapeHtml(reserveState)} (${Math.floor(sector.station.pulseReserveCredits)}/${sector.station.pulseReserveMaxCredits} pulse credits)</div>`;
    const localRoutes = tradeRoutes.filter(r => r.status !== "closed" && (r.originSector === player.currentSector || r.destinationSector === player.currentSector));
    if (localRoutes.length > 0) html += `<div><strong>Routes:</strong> ${localRoutes.map(r => `${escapeHtml(r.name)} (${r.status})`).join(" | ")}</div>`;
    html += renderCaptainChipsForSector(player.currentSector);
    if (getSectorStatusLabel(player.currentSector) === "Contested") html += `<div class="amber"><strong>Political conflict:</strong> local factions are actively contesting control.</div>`;
    if (sector.front) html += `<div class="amber"><strong>Front suspicion:</strong> ${sector.front.suspicion}/100.</div>`;
    if (sector.pirateThreat > 0) html += `<div class="red"><strong>Pirate threat:</strong> ${sector.pirateThreat}</div>`;
    if (port) {
        const type = PORT_TYPES[port.typeKey];
        const faction = FACTIONS[port.factionId];
        html += `<div class="green"><strong>Port:</strong> ${escapeHtml(type.name)}</div>`;
        if (faction) html += `<div><strong>Public Authority:</strong> <span style="color:${faction.color}">${faction.icon} ${escapeHtml(faction.name)}</span></div>`;
        if (sector.front && sector.surveyed) {
            const hidden = FACTIONS[sector.front.hiddenFactionId];
            html += `<div class="amber"><strong>Rumors:</strong> front activity suspected${hidden ? ` (${hidden.short})` : ""}. Suspicion ${sector.front.suspicion}.</div>`;
        }
        html += `<div class="small muted">${escapeHtml(type.description)}</div>`;
    }
    if (sector.asteroids) {
        const a = sector.asteroids;
        if (a.surveyed) html += `<div class="amber"><strong>Asteroids:</strong> ${Math.floor(a.ore)} ore, richness ${a.richness.toFixed(2)}, hazard ${(a.hazard * 100).toFixed(0)}%</div>`;
        else html += `<div class="amber"><strong>Asteroids:</strong> detected, details unknown</div>`;
    }
    if (planet) {
        const type = PLANET_TYPES[planet.typeKey];
        html += `<div class="blue"><strong>Planet:</strong> ${escapeHtml(type.name)} (${planet.owner ? "Colony founded" : "Unclaimed"})</div>`;
        document.getElementById("planetInfo").style.display = "block";
        document.getElementById("planetInfo").innerHTML = renderPlanetSummary(planet);
    } else {
        document.getElementById("planetInfo").style.display = "none";
    }
    document.getElementById("sectorContents").innerHTML = html;
}

export function renderPlanetSummary(planet) {
    const type = PLANET_TYPES[planet.typeKey];
    let html = `<strong>${escapeHtml(type.name)} Planet</strong><br>`;
    html += `Owner: ${escapeHtml(planet.owner || "Unclaimed")}<br>`;
    if (planet.factionId) html += `Alignment: ${FACTIONS[planet.factionId].icon} ${escapeHtml(FACTIONS[planet.factionId].name)}<br>`;
    if (planet.policy) {
        html += `Policy: ${escapeHtml(planet.policy.registration)}, ${escapeHtml(planet.policy.economy)}, ${escapeHtml(planet.policy.security)}`;
        if (planet.policy.hiddenInfluence && planet.policy.hiddenInfluence.vc > 0) html += ` | Hidden VC ${planet.policy.hiddenInfluence.vc}`;
        html += `<br>`;
    }
    html += `Colonists: ${planet.colonists}<br>`;
    if (planet.owner === "Player") {
        const shortages = planet.shortages || makeStock(0, 0, 0);
        html += `Satisfaction: ${planet.satisfaction || 0} | Shortages: Ore ${shortages.ore || 0} / Org ${shortages.org || 0} / Eq ${shortages.eq || 0}<br>`;
    }
    html += `Stock: Ore ${planet.stock.ore} / Org ${planet.stock.org} / Eq ${planet.stock.eq}<br>`;
    html += `Buildings: Hab ${planet.buildings.habitat}, Mine ${planet.buildings.mine}, Farm ${planet.buildings.farm}, Factory ${planet.buildings.factory}, Defense ${planet.buildings.defense}`;
    return html;
}

export function renderMenuPanel() {
    const { player, universe, ports, planets } = state;
    let html = `<div><strong>Outbound Gates</strong></div>`;
    getOutboundJumpGates(player.currentSector).forEach(gate => {
        const target = gate.destinationSectorId;
        const s = universe[target];
        const dominant = FACTIONS[getSectorFactionId(target)];
        html += `<div class="nav-card"><strong>Site ${target}</strong> <span class="muted">${escapeHtml(getSiteTypeLabel(s.siteType))} / ${escapeHtml(s.region)}</span><br>`;
        if (dominant) html += `<span style="color:${dominant.color}">${dominant.icon} ${dominant.short}</span> `;
        if (ports[target]) html += `Port `;
        if (planets[target]) html += `Planet `;
        if (s.asteroids) html += `Asteroids `;
        if (s.pirateThreat > 0) html += `<span class="red">Pirates ${s.pirateThreat}</span>`;
        const gateLabel = escapeHtml(gate.id || gate.corridorId || `gate to ${target}`);
        const span = typeof gate.effectiveSpanCost === "number" ? ` | span ${gate.effectiveSpanCost.toFixed(2)}` : "";
        html += `<br><span class="muted">Gate ${gateLabel}${span}</span><br><button data-action="selectSector" data-arg0="${target}">Inspect</button><button data-action="moveTo" data-arg0="${target}">Use Jump Gate</button></div>`;
    });
    html += `<div class="commodity-row"><strong>Menus</strong><div class="menu-grid">`;
    html += `<button data-action="showScreen" data-arg0="sector">Sector</button>`;
    html += `<button data-action="showScreen" data-arg0="missions">Missions</button>`;
    html += `<button data-action="showScreen" data-arg0="logistics">Logistics</button>`;
    html += `<button data-action="showScreen" data-arg0="reputation">Reputation</button>`;
    if (ports[player.currentSector]) html += `<button data-action="showScreen" data-arg0="market">Market</button>`;
    if (planets[player.currentSector]) html += `<button data-action="showScreen" data-arg0="colony">Colony</button>`;
    if (state.world?.roles?.shipyardSiteId === player.currentSector) html += `<button data-action="showScreen" data-arg0="shipyard">Shipyard</button>`;
    html += `</div></div>`;
    document.getElementById("commandList").innerHTML = html;
}

export function renderMapInspector() {
    const { player, universe, ports, planets, tradeRoutes, selectedSectorId } = state;
    const el = document.getElementById("mapInspector");
    if (!el) return;
    const id = selectedSectorId || player.currentSector;
    const sector = universe[id];
    if (!sector) {
        el.innerHTML = `<span class="muted">Select a sector on the map.</span>`;
        return;
    }
    const dominant = FACTIONS[getSectorFactionId(id)];
    const adjacent = getSectorNeighbors(player.currentSector).includes(id);
    let html = `<strong>Selected Site ${id}</strong> - ${escapeHtml(sector.name)}<br>`;
    if (sector.coord) html += `<span class="sector-chip">(${sector.coord.x}, ${sector.coord.y}, ${sector.coord.z})</span>`;
    html += `<span class="sector-chip">${escapeHtml(getSiteTypeLabel(sector.siteType))}</span><span class="sector-chip">${escapeHtml(sector.region)}</span><span class="sector-chip">${escapeHtml(getSectorStatusLabel(id))}</span>`;
    if (dominant) html += `<span class="sector-chip" style="color:${dominant.color}">${dominant.icon} ${dominant.short}</span>`;
    if (ports[id]) html += `<span class="sector-chip">Port: ${escapeHtml(PORT_TYPES[ports[id].typeKey].name)}</span>`;
    if (getSectorStatusLabel(id) === "Contested") html += `<span class="sector-chip amber">Political contest</span>`;
    if (sector.front) html += `<span class="sector-chip amber">Front suspicion ${sector.front.suspicion}</span>`;
    if (planets[id]) html += `<span class="sector-chip">Planet: ${escapeHtml(PLANET_TYPES[planets[id].typeKey].name)}</span>`;
    if (sector.asteroids) html += `<span class="sector-chip">Asteroids</span>`;
    if (sector.pirateThreat > 0) html += `<span class="sector-chip red">Pirates ${sector.pirateThreat}</span>`;
    const routeCount = tradeRoutes.filter(r => r.status !== "closed" && (r.originSector === id || r.destinationSector === id)).length;
    if (routeCount > 0) html += `<span class="sector-chip green">Routes ${routeCount}</span>`;
    html += renderCaptainChipsForSector(id);
    html += `<div class="compact-actions">`;
    if (id === player.currentSector) html += `<button data-action="showScreen" data-arg0="sector">Current Sector</button>`;
    else if (adjacent) html += `<button data-action="moveTo" data-arg0="${id}">Transit Corridor (${player.ship.travelMinutesPerCorridor}m)</button>`;
    else html += `<span class="muted">No direct jump corridor. Connected corridors: ${getSectorNeighbors(id).join(", ")}</span>`;
    html += `</div>`;
    el.innerHTML = html;
}
