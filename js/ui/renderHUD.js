import { state } from "../state.js";
import { getSectorNeighbors } from "../core/navigation.js";
import { FACTIONS, BALANCE, CARGO_COMMODITIES, GUILD_FACTIONS, GUILD_TIER_NAMES } from "../constants.js";
import { escapeHtml, formatCredits, formatTime, formatCommodity, getCargoUsed } from "../utils.js";
import { ensureFactionState, clampPlayerState, getKnownFactionIds, getFactionRep, getFactionHeat, getFactionBarPercent, getFactionLabel, getGuildTier } from "../core/factions.js";
import { showScreen, setReputationTab } from "./ui.js";
import { getPlayerDataHoldSummary } from "../core/dataCargo.js";

export function getPriorityItems() {
    const { missions, planets, tradeRoutes, player, universe } = state;
    const items = [];
    missions.filter(m => m.status === "accepted").forEach(m => {
        const daysLeft = m.expiresDay - player.time.day;
        if (daysLeft <= 1) {
            items.push({
                text: `${m.title} expires ${daysLeft <= 0 ? "today" : "tomorrow"}`,
                urgent: daysLeft <= 0,
                action: () => showScreen("missions"),
                priority: 10 - daysLeft
            });
        }
    });
    Object.entries(planets).forEach(([sid, planet]) => {
        if (planet.owner !== "Player") return;
        if (planet.satisfaction < 40) {
            items.push({
                text: `Colony S${sid} satisfaction critical: ${planet.satisfaction}`,
                urgent: planet.satisfaction < 25,
                action: () => { player.currentSector = parseInt(sid, 10); showScreen("colony"); },
                priority: 9
            });
        }
    });
    tradeRoutes.filter(r => r.status === "active" && r.failures > r.runs * 0.4 && r.runs >= 3).forEach(r => {
        items.push({
            text: `Route "${r.name}" failing: ${r.failures}/${r.runs + r.failures}`,
            urgent: false,
            action: () => showScreen("logistics"),
            priority: 5
        });
    });
    ensureFactionState();
    player.factions.asks.filter(a => a.status === "accepted" && a.expiresDay - player.time.day <= 1).forEach(a => {
        items.push({
            text: `Ask "${a.title}" expires soon`,
            urgent: a.expiresDay <= player.time.day,
            action: () => { setReputationTab("asks"); },
            priority: 8
        });
    });
    if (getFactionHeat("sda") >= 60) {
        items.push({
            text: `SDA heat ${getFactionHeat("sda")} — inspections likely`,
            urgent: getFactionHeat("sda") >= 80,
            action: () => setReputationTab("factions"),
            priority: 7
        });
    }
    if (player.hull < player.ship.maxHull * 0.3) {
        items.push({
            text: `Hull damaged: ${player.hull}/${player.ship.maxHull}`,
            urgent: player.hull < player.ship.maxHull * 0.15,
            action: () => { if (player.currentSector === state.world?.roles?.shipyardSiteId) showScreen("shipyard"); else console.log("Return to StarDock for repairs."); },
            priority: 9
        });
    }
    const sec = universe[player.currentSector];
    if (sec && sec.pirateThreat >= 3) {
        items.push({
            text: `Pirate threat ${sec.pirateThreat} in current sector`,
            urgent: sec.pirateThreat >= 5,
            action: () => showScreen("sector"),
            priority: 6
        });
    }
    return items.sort((a, b) => b.priority - a.priority).slice(0, BALANCE.PRIORITY_FEED_LIMIT);
}

export function renderHeader() {
    const { player } = state;
    clampPlayerState();
    const sector = state.universe[player.currentSector];
    document.getElementById("shipName").textContent = player.ship.name;
    document.getElementById("credits").textContent = formatCredits(player.credits);
    document.getElementById("dayTime").textContent = `Day ${player.time.day}, ${formatTime(player.time.minuteOfDay)}`;
    document.getElementById("sectorNum").textContent = player.currentSector;
    document.getElementById("sectorName").textContent = sector.name;
    const cs = document.getElementById("curSector");
    if (cs) cs.textContent = player.currentSector;
    document.getElementById("cargoSummary").textContent = CARGO_COMMODITIES.map(c => `${formatCommodity(c)} ${player.cargo[c] || 0}`).join(" / ");
    document.getElementById("holds").textContent = `${getCargoUsed()}/${player.ship.maxHolds}`;
    document.getElementById("fighters").textContent = `${player.fighters}/${player.ship.maxFighters}`;
    document.getElementById("shields").textContent = `${player.shields}/${player.ship.maxShields}`;
    document.getElementById("hull").textContent = `${player.hull}/${player.ship.maxHull}`;
}

export function renderFactionPanel() {
    const { player } = state;
    ensureFactionState();
    const known = getKnownFactionIds();
    const publicKnown = known.filter(id => FACTIONS[id].type === "major").slice(0, 4);
    let html = `<div class="faction-title">POLITICAL READOUT</div>`;
    publicKnown.forEach(id => {
        const faction = FACTIONS[id];
        const rep = getFactionRep(id);
        const heat = getFactionHeat(id);
        html += `<div class="faction-line" title="${escapeHtml(faction.name)}: ${escapeHtml(faction.description)}">`;
        html += `<span style="color:${faction.color}">${faction.icon} ${faction.short}</span>`;
        html += `<span class="faction-bar"><span class="faction-fill" style="width:${getFactionBarPercent(rep)}%; background:${faction.color}"></span></span>`;
        html += `<span>${getFactionLabel(rep)}${heat > 30 ? " H" + heat : ""}</span></div>`;
    });
    const activeGuilds = GUILD_FACTIONS.filter(id => getGuildTier(id) > 0);
    if (activeGuilds.length > 0) html += `<div class="small muted">Guilds: ${activeGuilds.map(id => `${FACTIONS[id].short} ${GUILD_TIER_NAMES[getGuildTier(id)]}`).join(" | ")}</div>`;
    const openAsks = player.factions.asks.filter(a => a.status === "available" || a.status === "accepted").length;
    const dataHold = getPlayerDataHoldSummary();
    html += `<div class="small muted">Known factions: ${known.length} | Asks: ${openAsks} | Intel: ${player.factions.intel.length}</div>`;
    html += `<div class="small muted">Comms: ${dataHold.privatePayloadCount} private / ${dataHold.securePayloadCount} secure / ${dataHold.publicSnapshotCount} public</div>`;
    html += `<button data-action="showScreen" data-arg0="reputation">Open Network</button>`;
    html += `<button data-action="showCommunications">Comms</button>`;
    document.getElementById("factionPanel").innerHTML = html;
}

export function renderAcceptedMissions() {
    const { missions } = state;
    const accepted = missions.filter(m => m.status === "accepted");
    const target = document.getElementById("acceptedMissions");
    if (!target) return;
    if (accepted.length === 0) {
        target.innerHTML = `<span class="muted">No accepted missions.</span>`;
        return;
    }
    let html = "";
    accepted.forEach(m => {
        const faction = FACTIONS[m.factionId] || null;
        const prefix = faction ? `<span class="faction-icon" style="color:${faction.color}">${faction.icon}</span> ` : "";
        html += `<div class="mission"><strong>${prefix}${escapeHtml(m.title)}</strong><br>${escapeHtml(missionDescription(m))}<br>`;
        html += `Expires: Day ${m.expiresDay} | Reward: ${formatCredits(m.rewardCredits)} credits`;
        if (faction) html += ` | ${faction.short} +${m.rewardRep}`;
        html += `<br>`;
        if (m.type === "mining") html += `Progress: ${m.progress}/${m.amount} ore<br>`;
        html += `<button data-action="completeMission" data-arg0="${m.id}">Complete</button></div>`;
    });
    target.innerHTML = html;
}

function missionDescription(m) {
    if (m.type === "delivery") return `Pickup/source: sector ${m.originSector}. Deliver ${m.amount} ${formatCommodity(m.commodity)} to sector ${m.destinationSector}.`;
    if (m.type === "mining") return `Mine ${m.amount} Ore, then report back to sector ${m.originSector}.`;
    if (m.type === "survey") return `Survey sector ${m.targetSector}, then report back to sector ${m.originSector}.`;
    if (m.type === "colony") return `Found a colony in sector ${m.targetSector}, then report back to sector ${m.originSector}.`;
    if (m.type === "contest") return `${m.context || "Political conflict contract."} Travel to sector ${m.targetSector}, spend ${m.operationMinutes || 90} minutes on the operation, then report the result.`;
    return "Mission details unavailable.";
}

export function renderPriorityFeed() {
    const items = getPriorityItems();
    const list = document.getElementById("priorityList");
    if (!list) return;
    if (items.length === 0) {
        list.innerHTML = `<div class="small muted">All clear.</div>`;
        return;
    }
    list.innerHTML = "";
    items.forEach(item => {
        const div = document.createElement("div");
        div.className = "priority-item" + (item.urgent ? " urgent" : "");
        div.textContent = item.text;
        div.addEventListener("click", item.action);
        list.appendChild(div);
    });
}

export function renderSectorActionMenu() {
    const { player, universe, ports, planets } = state;
    const sector = universe[player.currentSector];
    const hasPort = Boolean(ports[player.currentSector]);
    const hasPlanet = Boolean(planets[player.currentSector]);
    let html = `<h4>Available Actions</h4><div class="card-grid">`;
    html += `<div class="card"><strong>Navigation</strong><br><span class="muted">Choose a direct jump corridor from the right panel or click the map.</span><br>${getSectorNeighbors(player.currentSector).map(target => `<button data-action="moveTo" data-arg0="${target}">Use Jump Gate ${target} (${player.ship.travelMinutesPerCorridor}m)</button>`).join("")}</div>`;
    html += `<div class="card"><strong>Survey</strong><br>Reveal hidden fronts, precise asteroid data, and better map intel.<br><button data-action="surveySector">Survey Sector (60m)</button></div>`;
    if (hasPort) html += `<div class="card"><strong>Port</strong><br>Trade, missions, and local faction pressure.<br><button data-action="showScreen" data-arg0="market">Open Market</button></div>`;
    if (sector.asteroids) html += `<div class="card"><strong>Asteroids</strong><br>Mine ore and shift industrial influence.<br><button data-action="mineAsteroids">Mine Asteroids (120m)</button></div>`;
    if (hasPlanet) html += `<div class="card"><strong>Planet</strong><br>Found or manage colony politics and production.<br><button data-action="showScreen" data-arg0="colony">Open Colony Menu</button></div>`;
    if (sector.pirateThreat > 0) html += `<div class="card"><strong>Pirates</strong><br>Clear threats, gain SDA favor, anger the Cartel.<br><button data-action="fightPirates">Fight Pirates (60m)</button></div>`;
    if (player.currentSector === state.world?.roles?.shipyardSiteId) html += `<div class="card"><strong>Shipyard</strong><br>Upgrade, repair, and resupply.<br><button data-action="showScreen" data-arg0="shipyard">Open Shipyard</button></div>`;

    // Lazy import for logistics check to avoid circular
    const { getLogisticsNode } = _logisticsModule;
    if (getLogisticsNode && getLogisticsNode(player.currentSector)) {
        html += `<div class="card"><strong>Logistics</strong><br>Create persistent supply routes and hire convoy escorts.<br><button data-action="showScreen" data-arg0="logistics">Open Logistics</button></div>`;
    }
    html += `</div>`;
    return html;
}

// Injected by main.js to avoid circular: renderHUD.js → tradeRoutes → market → guilds → ...
const _logisticsModule = { getLogisticsNode: null };
export function injectLogisticsModule(mod) { _logisticsModule.getLogisticsNode = mod.getLogisticsNode; }
