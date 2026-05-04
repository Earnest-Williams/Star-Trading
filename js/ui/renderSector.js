import { state } from "../state.js";
import { FACTIONS, PORT_TYPES, PLANET_TYPES, COMMODITIES } from "../constants.js";
import { escapeHtml, makeStock } from "../utils.js";
import { getSectorFactionId, getSectorStatusLabel, getInfluenceSpread } from "../core/influence.js";
import { renderCaptainChipsForSector } from "./renderCaptains.js";

export function renderSectorContents() {
    const { player, universe, ports, planets, tradeRoutes } = state;
    const sector = universe[player.currentSector];
    const port = ports[player.currentSector];
    const planet = planets[player.currentSector];
    const influence = FACTIONS[getSectorFactionId(player.currentSector)];
    let html = `<div><strong>Region:</strong> ${escapeHtml(sector.region)} | <strong>Status:</strong> ${escapeHtml(getSectorStatusLabel(player.currentSector))}</div>`;
    if (influence) html += `<div><strong>Dominant Influence:</strong> <span style="color:${influence.color}">${influence.icon} ${escapeHtml(influence.name)}</span></div>`;
    html += `<div class="small muted">${getInfluenceSpread(player.currentSector).map(item => `${FACTIONS[item.id].short}:${item.value}`).join(" | ")}</div>`;
    html += `<div><strong>Warps to:</strong> ${sector.warps.join(", ")}</div>`;
    html += `<div><strong>Survey:</strong> ${sector.surveyed ? "Complete" : "Not surveyed"}</div>`;
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
    const sector = universe[player.currentSector];
    let html = `<div><strong>Current links</strong></div>`;
    sector.warps.forEach(target => {
        const s = universe[target];
        const dominant = FACTIONS[getSectorFactionId(target)];
        html += `<div class="nav-card"><strong>Sector ${target}</strong> <span class="muted">${escapeHtml(s.region)}</span><br>`;
        if (dominant) html += `<span style="color:${dominant.color}">${dominant.icon} ${dominant.short}</span> `;
        if (ports[target]) html += `Port `;
        if (planets[target]) html += `Planet `;
        if (s.asteroids) html += `Asteroids `;
        if (s.pirateThreat > 0) html += `<span class="red">Pirates ${s.pirateThreat}</span>`;
        html += `<br><button data-action="selectSector" data-arg0="${target}">Inspect</button><button data-action="moveTo" data-arg0="${target}">Warp</button></div>`;
    });
    html += `<div class="commodity-row"><strong>Menus</strong><div class="menu-grid">`;
    html += `<button data-action="showScreen" data-arg0="sector">Sector</button>`;
    html += `<button data-action="showScreen" data-arg0="missions">Missions</button>`;
    html += `<button data-action="showScreen" data-arg0="logistics">Logistics</button>`;
    html += `<button data-action="showScreen" data-arg0="reputation">Reputation</button>`;
    if (ports[player.currentSector]) html += `<button data-action="showScreen" data-arg0="market">Market</button>`;
    if (planets[player.currentSector]) html += `<button data-action="showScreen" data-arg0="colony">Colony</button>`;
    if (player.currentSector === 1) html += `<button data-action="showScreen" data-arg0="shipyard">Shipyard</button>`;
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
    const adjacent = universe[player.currentSector].warps.includes(id);
    let html = `<strong>Selected Sector ${id}</strong> - ${escapeHtml(sector.name)}<br>`;
    html += `<span class="sector-chip">${escapeHtml(sector.region)}</span><span class="sector-chip">${escapeHtml(getSectorStatusLabel(id))}</span>`;
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
    else if (adjacent) html += `<button data-action="moveTo" data-arg0="${id}">Warp Here (${player.ship.travelMinutesPerWarp}m)</button>`;
    else html += `<span class="muted">Not directly adjacent. Warps: ${sector.warps.join(", ")}</span>`;
    html += `</div>`;
    el.innerHTML = html;
}
