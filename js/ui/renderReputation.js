import { state } from "../state.js";
import { FACTIONS, MAJOR_FACTIONS, BALANCE, PORT_TYPES, PLANET_TYPES, FACTION_INTERESTS, GUILD_REQUIREMENTS, DEBUG_MODE, GUILD_TIER_NAMES } from "../constants.js";
import { escapeHtml, formatCredits, formatTime, formatCommodity } from "../utils.js";
import { getSectorFactionId, getSectorStatusLabel, getInfluenceSpread } from "../core/influence.js";
import {
    ensureFactionState, getKnownFactionIds, getFactionRep, getPrivateFactionRep, getFactionTrust, getFactionHeat,
    getFactionLeverage, getFactionFavors, getFactionLabel, getGuildTier,
    getKnownContacts, getContactScore
} from "../core/factions.js";
import { renderCaptainsTab } from "./renderCaptains.js";
import { updateUI } from "./renderer.js";
import { getActiveIntel } from '../core/intel.js';

export function renderReputationScreen() {
    const { reputationTab } = state;
    ensureFactionState();
    let html = `<div class="screen-tabs">`;
    html += `<button class="${reputationTab === "factions" ? "active-tab" : ""}" data-action="setReputationTab" data-arg0="factions">Faction Standings</button>`;
    html += `<button class="${reputationTab === "captains" ? "active-tab" : ""}" data-action="setReputationTab" data-arg0="captains">Captains</button>`;
    html += `<button class="${reputationTab === "individuals" ? "active-tab" : ""}" data-action="setReputationTab" data-arg0="individuals">Contacts</button>`;
    html += `<button class="${reputationTab === "assets" ? "active-tab" : ""}" data-action="setReputationTab" data-arg0="assets">Starbases & Colonies</button>`;
    html += `<button class="${reputationTab === "politics" ? "active-tab" : ""}" data-action="setReputationTab" data-arg0="politics">Political Web</button>`;
    html += `<button class="${reputationTab === "asks" ? "active-tab" : ""}" data-action="setReputationTab" data-arg0="asks">Asks & Intel</button>`;
    html += `<button class="${reputationTab === "news" ? "active-tab" : ""}" data-action="setReputationTab" data-arg0="news">World News</button>`;
    if (DEBUG_MODE) html += `<button class="${reputationTab === "debug" ? "active-tab" : ""}" data-action="setReputationTab" data-arg0="debug">Debug</button>`;
    html += `</div>`;
    if (reputationTab === "factions") html += renderFactionStandingsTab();
    else if (reputationTab === "captains") html += renderCaptainsTab();
    else if (reputationTab === "individuals") html += renderIndividualsTab();
    else if (reputationTab === "assets") html += renderAssetsTab();
    else if (reputationTab === "politics") html += renderPoliticalWebTab();
    else if (reputationTab === "news") html += renderWorldNewsTab();
    else if (reputationTab === "debug" && DEBUG_MODE) html += renderDebugTab();
    else html += renderAsksIntelTab();
    document.getElementById("actions").innerHTML = html;
}

function renderFactionStandingsTab() {
    const known = getKnownFactionIds();
    let html = `<h4>Known Faction Standings</h4>`;
    html += `<div class="small muted">This page only shows factions the captain plausibly knows. Public standing, private standing, trust, heat, leverage, and favors can diverge.</div>`;
    html += `<div class="card-grid">`;
    known.forEach(id => {
        const faction = FACTIONS[id];
        const interest = FACTION_INTERESTS[id];
        const tier = faction.type === "guild" ? getGuildTier(id) : null;
        html += `<div class="card"><strong style="color:${faction.color}">${faction.icon} ${escapeHtml(faction.name)}</strong><br>`;
        html += `<span class="muted">${escapeHtml(faction.description)}</span>`;
        html += `<div class="stat-grid">`;
        html += `<div class="stat-pill">Public: ${getFactionLabel(getFactionRep(id))} (${getFactionRep(id)})</div>`;
        html += `<div class="stat-pill">Private: ${getPrivateFactionRep(id)}</div>`;
        html += `<div class="stat-pill">Trust: ${getFactionTrust(id)}</div>`;
        html += `<div class="stat-pill">Heat: ${getFactionHeat(id)}</div>`;
        html += `<div class="stat-pill">Leverage: ${getFactionLeverage(id)}</div>`;
        html += `<div class="stat-pill">Favors: ${getFactionFavors(id)}</div>`;
        if (tier !== null) html += `<div class="stat-pill">Membership: ${GUILD_TIER_NAMES[tier]}</div>`;
        html += `</div>`;
        if (interest) html += `<div class="small muted">Wants: ${escapeHtml(interest.wants)}. Dislikes: ${escapeHtml(interest.dislikes || "none listed")}.</div>`;
        if (faction.type === "guild") {
            const req = GUILD_REQUIREMENTS[id];
            if (tier <= 0) html += `<button data-action="joinGuild" data-arg0="${id}">Join</button> <span class="small muted">${escapeHtml(req.note)}</span>`;
            else if (tier < 3) html += `<button data-action="promoteGuild" data-arg0="${id}">Seek Promotion</button>`;
        }
        html += `</div>`;
    });
    html += `</div>`;
    return html;
}

function renderIndividualsTab() {
    const contacts = getKnownContacts();
    let html = `<h4>Relationships With Individuals</h4>`;
    html += `<div class="small muted">Individuals are not the same as their faction. A faction can approve of you while its local officer distrusts you, or the reverse.</div>`;
    if (contacts.length === 0) return html + `<div class="muted">No known individuals yet.</div>`;
    contacts.forEach(contact => {
        const faction = FACTIONS[contact.factionId];
        const contactState = state.player.factions.contacts[contact.id];
        const score = getContactScore(contact);
        html += `<div class="relationship-row">`;
        html += `<div><strong>${escapeHtml(contact.name)}</strong><br><span style="color:${faction.color}">${faction.icon} ${escapeHtml(faction.name)}</span><br><span class="muted">${escapeHtml(contact.role)}</span></div>`;
        html += `<div>Relationship: ${score}<br>Trust: ${contactState.trust || 0}<br>Leverage: ${contactState.leverage || 0}</div>`;
        html += `<div>${escapeHtml(contact.note)}<br><span class="small muted">Last interaction: ${escapeHtml(contactState.lastInteraction || "none")}. Location: ${escapeHtml(contact.location)}.</span></div>`;
        html += `</div>`;
    });
    return html;
}

function renderAssetsTab() {
    const { player, ports, planets, universe } = state;
    let html = `<h4>Starbases, Ports, and Colonies</h4>`;
    html += `<div class="small muted">Known assets are discovered through travel, survey, ownership, or faction access.</div>`;
    html += `<div class="commodity-row"><strong>Known Starbases & Ports</strong></div><div class="card-grid">`;
    Object.keys(ports).map(Number).filter(id => id === 1 || id === player.currentSector || universe[id].surveyed || universe[player.currentSector].warps.includes(id)).sort((a, b) => a - b).forEach(id => {
        const port = ports[id];
        const type = PORT_TYPES[port.typeKey];
        const faction = FACTIONS[port.factionId];
        html += `<div class="card"><strong>Sector ${id}: ${escapeHtml(type.name)}</strong><br>`;
        html += `<span style="color:${faction.color}">${faction.icon} ${escapeHtml(faction.name)}</span><br>`;
        html += `<span class="muted">${escapeHtml(type.description)}</span><br>`;
        html += `Sells: ${type.sells.map(formatCommodity).join(", ") || "nothing"}<br>Buys: ${type.buys.map(formatCommodity).join(", ") || "nothing"}<br>`;
        if (universe[id].front && universe[id].surveyed) html += `<span class="amber">Suspected front activity.</span><br>`;
        html += `<button data-action="selectSector" data-arg0="${id}">Inspect on Map</button>`;
        if (universe[player.currentSector].warps.includes(id)) html += `<button data-action="moveTo" data-arg0="${id}">Warp</button>`;
        html += `</div>`;
    });
    html += `</div>`;
    html += `<div class="commodity-row"><strong>Player Colonies & Known Planet Sites</strong></div><div class="card-grid">`;
    Object.keys(planets).map(Number).filter(id => planets[id].owner === "Player" || id === player.currentSector || universe[id].surveyed).sort((a, b) => a - b).forEach(id => {
        const planet = planets[id];
        const type = PLANET_TYPES[planet.typeKey];
        html += `<div class="card"><strong>Sector ${id}: ${escapeHtml(type.name)} Planet</strong><br>`;
        html += `Owner: ${escapeHtml(planet.owner || "Unclaimed")}<br>`;
        if (planet.factionId) html += `Alignment: ${FACTIONS[planet.factionId].icon} ${escapeHtml(FACTIONS[planet.factionId].name)}<br>`;
        html += `Colonists: ${planet.colonists}<br>Stock: Ore ${planet.stock.ore} / Org ${planet.stock.org} / Eq ${planet.stock.eq}<br>`;
        if (planet.policy) html += `Policy: ${escapeHtml(planet.policy.registration)}, ${escapeHtml(planet.policy.security)}<br>`;
        html += `<button data-action="selectSector" data-arg0="${id}">Inspect on Map</button>`;
        if (id === player.currentSector) html += `<button data-action="showScreen" data-arg0="colony">Open Colony</button>`;
        html += `</div>`;
    });
    html += `</div>`;
    return html;
}

function renderSectorInfluenceDetails(sectorId) {
    const sector = state.universe[sectorId];
    if (!sector) return `<span class="muted">No sector data.</span>`;
    const spread = getInfluenceSpread(sectorId);
    let html = `<div>Status: ${getSectorStatusLabel(sectorId)}</div>`;
    spread.forEach(item => {
        const faction = FACTIONS[item.id];
        html += `<div class="faction-line"><span style="color:${faction.color}">${faction.icon} ${faction.short}</span><span class="faction-bar"><span class="faction-fill" style="width:${item.value}%; background:${faction.color}"></span></span><span>${item.value}</span></div>`;
    });
    if (sector.front) {
        const publicFaction = FACTIONS[sector.front.publicFactionId];
        html += `<div class="small amber">Possible front: publicly ${publicFaction ? publicFaction.short : "unknown"}, suspicion ${sector.front.suspicion}.</div>`;
    }
    return html;
}

function renderPoliticalWebTab() {
    const { universe, missions } = state;
    let html = `<h4>Political Web</h4>`;
    html += `<div class="commodity-row"><strong>Current Sector Politics</strong><br>${renderSectorInfluenceDetails(state.player.currentSector)}</div>`;
    html += renderPoliticalSimulationSummary();
    html += `<div class="commodity-row"><strong>Major Relations</strong><br>`;
    const fr = (state.player && state.player.factionRelations) || {};
    MAJOR_FACTIONS.forEach(a => {
        MAJOR_FACTIONS.forEach(b => {
            if (a >= b || !fr[a] || typeof fr[a][b] !== "number") return;
            const color = fr[a][b] < -40 ? "red" : fr[a][b] > 20 ? "green" : "muted";
            html += `<span class="${color}">${FACTIONS[a].short} ↔ ${FACTIONS[b].short}: ${fr[a][b]}</span><br>`;
        });
    });
    html += `</div>`;
    html += `<div class="commodity-row"><strong>Sector Influence Index</strong><div class="card-grid">`;
    Object.keys(universe).map(Number).sort((a, b) => a - b).forEach(id => {
        const dominant = FACTIONS[getSectorFactionId(id)];
        html += `<div class="card"><strong>Sector ${id}</strong> <span class="muted">${escapeHtml(universe[id].region)}</span><br>`;
        html += `<span style="color:${dominant.color}">${dominant.icon} ${escapeHtml(dominant.name)}</span><br>Status: ${getSectorStatusLabel(id)}<br>`;
        html += `<span class="small muted">${getInfluenceSpread(id).map(item => `${FACTIONS[item.id].short}:${item.value}`).join(" | ")}</span><br>`;
        html += `<button data-action="selectSector" data-arg0="${id}">Inspect</button></div>`;
    });
    html += `</div></div>`;
    return html;
}

function renderPoliticalSimulationSummary() {
    const { universe, missions } = state;
    const contested = Object.values(universe).filter(s => getSectorStatusLabel(s.id) === "Contested");
    const fronts = Object.values(universe).filter(s => Boolean(s.front));
    const politicalMissions = missions.filter(m => m.kind === "political_contest" && (m.status === "available" || m.status === "accepted" || m.status === "captain_taken"));
    let html = `<div class="commodity-row"><strong>Political Simulation</strong><br>`;
    html += `<span class="sector-chip">Contested sectors: ${contested.length}</span>`;
    html += `<span class="sector-chip">Known/suspected fronts: ${fronts.length}</span>`;
    html += `<span class="sector-chip">Conflict missions: ${politicalMissions.length}</span>`;
    if (contested.length > 0) html += `<div class="small muted">Hot sectors: ${contested.slice(0, 8).map(s => `S${s.id} ${getInfluenceSpread(s.id).slice(0, 2).map(i => FACTIONS[i.id].short).join("/")}`).join(" | ")}</div>`;
    if (fronts.length > 0) html += `<div class="small amber">Front suspicion: ${fronts.slice(0, 6).map(s => `S${s.id} ${FACTIONS[s.front.hiddenFactionId].short} ${s.front.suspicion}`).join(" | ")}</div>`;
    html += `</div>`;
    return html;
}

function renderWorldNewsTab() {
    const { worldEvents, captains } = state;
    let html = `<h4>World News</h4>`;
    html += `<div class="small muted">A single ledger for consequences: captain actions, faction influence shifts, mission races, daily simulation ticks, and major player outcomes.</div>`;
    if (!worldEvents || worldEvents.length === 0) return html + `<div class="muted">No world events recorded yet.</div>`;
    worldEvents.slice(0, 35).forEach(event => {
        const faction = event.factionId && FACTIONS[event.factionId] ? FACTIONS[event.factionId] : null;
        const captain = event.captainId && captains[event.captainId] ? captains[event.captainId] : null;
        const stamp = `Day ${event.day}, ${formatTime(event.minute || 0)}`;
        html += `<div class="timeline-entry">`;
        html += `<strong>${stamp}</strong> `;
        if (faction) html += `<span style="color:${faction.color}">${faction.icon} ${faction.short}</span> `;
        if (captain) html += `<span class="captain-chip">${escapeHtml(captain.callsign)}</span> `;
        if (event.sectorId) html += `<span class="sector-chip">Sector ${event.sectorId}</span> `;
        html += `${escapeHtml(event.text)}`;
        html += `</div>`;
    });
    return html;
}

function renderDebugTab() {
    const { worldEvents, tradeRoutes, universe, missions, captains } = state;
    let html = `<h4>Simulation Debug</h4>`;
    html += `<div class="small muted">Use these while tuning the living economy.</div>`;
    html += `<div class="compact-actions">`;
    html += `<button data-action="debugAdvanceHours" data-arg0="6">Sim 6 Hours</button>`;
    html += `<button data-action="debugAdvanceDays" data-arg0="1">Sim 1 Day</button>`;
    html += `<button data-action="debugAdvanceDays" data-arg0="7">Sim 7 Days</button>`;
    html += `</div>`;
    html += `<div class="stat-grid">`;
    html += `<div class="stat-pill">World events: ${worldEvents.length}</div>`;
    html += `<div class="stat-pill">Trade routes: ${tradeRoutes.filter(r => r.status !== "closed").length}</div>`;
    html += `<div class="stat-pill">Contested sectors: ${Object.values(universe).filter(s => getSectorStatusLabel(s.id) === "Contested").length}</div>`;
    html += `<div class="stat-pill">Fronts: ${Object.values(universe).filter(s => Boolean(s.front)).length}</div>`;
    html += `<div class="stat-pill">Available missions: ${missions.filter(m => m.status === "available").length}</div>`;
    html += `<div class="stat-pill">Captain-taken missions: ${missions.filter(m => m.status === "captain_taken").length}</div>`;
    html += `<div class="stat-pill">Active captains: ${Object.values(captains).filter(c => c.status === "active").length}</div>`;
    html += `</div>`;
    return html;
}

function renderFactionAsks() {
    const { player } = state;
    ensureFactionState();
    const asks = player.factions.asks.filter(a => a.status === "available" || a.status === "accepted");
    if (asks.length === 0) return `<div class="muted">No current faction asks.</div>`;
    let html = "";
    asks.forEach(ask => {
        const faction = FACTIONS[ask.factionId];
        const statusLabel = ask.status === "accepted" ? "Accepted" : "Available";
        html += `<div class="mission"><strong style="color:${faction.color}">${faction.icon} ${escapeHtml(ask.title)}</strong><br>`;
        html += `${escapeHtml(ask.text)}<br>Status: ${statusLabel} | Expires: Day ${ask.expiresDay}`;
        if (typeof ask.progress === "number") html += ` | Progress: ${ask.progress}/${ask.amount}`;
        html += `<br>`;
        if (ask.status === "available") html += `<button data-action="acceptFactionAsk" data-arg0="${ask.id}">Accept</button>`;
        if (ask.status === "accepted") html += `<button data-action="completeFactionAsk" data-arg0="${ask.id}">Report Completion</button>`;
        html += `</div>`;
    });
    return html;
}

function renderIntelPanel() {
    ensureFactionState();
    const intel = getActiveIntel();
    if (intel.length === 0) return `<div class="muted">No actionable intel.</div>`;
    let html = "";
    intel.forEach(item => {
        const faction = item.factionId ? FACTIONS[item.factionId] : null;
        html += `<div class="mission">${faction ? `<span style="color:${faction.color}">${faction.icon}</span> ` : ""}${escapeHtml(item.text)}<br>`;
        html += `Sector ${item.sectorId} | Value ${item.value} | Expires Day ${item.expiresDay}<br>`;
        html += `<button data-action="sellIntel" data-arg0="${item.id}" data-arg1="sda">Give to SDA</button>`;
        html += `<button data-action="sellIntel" data-arg0="${item.id}" data-arg1="vc">Give to VC</button>`;
        html += `<button data-action="sellIntel" data-arg0="${item.id}" data-arg1="traders">Sell to Traders Guild</button>`;
        html += `</div>`;
    });
    return html;
}

function renderAsksIntelTab() {
    let html = `<h4>Political Asks & Intel</h4>`;
    html += `<div class="commodity-row"><strong>Faction Asks</strong>${renderFactionAsks()}</div>`;
    html += `<div class="commodity-row"><strong>Intel</strong>${renderIntelPanel()}</div>`;
    return html;
}
