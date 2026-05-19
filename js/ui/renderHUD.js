import { state } from "../state.js";
import { getSectorNeighbors } from "../core/navigation.js";
import { FACTIONS, BALANCE, CARGO_COMMODITIES, GUILD_FACTIONS, GUILD_TIER_NAMES } from "../constants.js";
import { escapeHtml, formatCredits, formatTime, formatCommodity, getCargoUsed } from "../utils.js";
import { ensureFactionState, clampPlayerState, getKnownFactionIds, getFactionRep, getFactionHeat, getFactionBarPercent, getFactionLabel, getGuildTier } from "../core/factions.js";
import { Renderer } from "./renderer.js";
import { showScreen, setReputationTab } from "./ui.js";
import { getPlayerDataHoldSummary } from "../core/dataCargo.js";

const CARGO_MINI_LIST_LIMIT = 5;

export function getPriorityItems() {
    const { missions, planets, tradeRoutes, player, universe } = state;
    const items = [];
    missions.filter(m => m.status === "accepted").forEach(m => {
        const daysLeft = m.expiresDay - player.time.day;
        if (daysLeft <= 1) {
            items.push({
                text: `${m.title} expires ${daysLeft <= 0 ? "today" : "tomorrow"}`,
                urgent: daysLeft <= 0,
                action: () => Renderer.sliceChanged(...showScreen("missions")),
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
                action: () => {
                    player.currentSector = parseInt(sid, 10);
                    Renderer.sliceChanged(...showScreen("colony"));
                },
                priority: 9
            });
        }
    });
    tradeRoutes.filter(r => r.status === "active" && r.failures > r.runs * 0.4 && r.runs >= 3).forEach(r => {
        items.push({
            text: `Route "${r.name}" failing: ${r.failures}/${r.runs + r.failures}`,
            urgent: false,
            action: () => Renderer.sliceChanged(...showScreen("logistics")),
            priority: 5
        });
    });
    ensureFactionState();
    player.factions.asks.filter(a => a.status === "accepted" && a.expiresDay - player.time.day <= 1).forEach(a => {
        items.push({
            text: `Ask "${a.title}" expires soon`,
            urgent: a.expiresDay <= player.time.day,
            action: () => Renderer.sliceChanged(...setReputationTab("asks")),
            priority: 8
        });
    });
    if (getFactionHeat("sda") >= 60) {
        items.push({
            text: `SDA heat ${getFactionHeat("sda")} — inspections likely`,
            urgent: getFactionHeat("sda") >= 80,
            action: () => Renderer.sliceChanged(...setReputationTab("factions")),
            priority: 7
        });
    }
    if (player.ship && player.hull < player.ship.maxHull * 0.3) {
        items.push({
            text: `Hull damaged: ${player.hull}/${player.ship.maxHull}`,
            urgent: player.hull < player.ship.maxHull * 0.15,
            action: () => {
                if (player.currentSector === state.world?.roles?.shipyardSiteId) Renderer.sliceChanged(...showScreen("shipyard"));
                else console.log("Return to StarDock for repairs.");
            },
            priority: 9
        });
    }
    const sec = universe[player.currentSector];
    if (sec && sec.pirateThreat >= 3) {
        items.push({
            text: `Pirate threat ${sec.pirateThreat} in current sector`,
            urgent: sec.pirateThreat >= 5,
            action: () => Renderer.sliceChanged(...showScreen("sector")),
            priority: 6
        });
    }
    return items.sort((a, b) => b.priority - a.priority).slice(0, BALANCE.PRIORITY_FEED_LIMIT);
}

function setMeterPercent(id, current, max) {
    const meter = document.getElementById(id);
    if (!meter) return;
    const safeMax = Math.max(1, max || 0);
    const percent = Math.max(0, Math.min(100, (current / safeMax) * 100));
    meter.style.width = `${percent}%`;
}

function setRailMeterPercent(id, current, max) {
    const meter = document.getElementById(id);
    if (!meter) return;
    const safeMax = Math.max(1, max || 0);
    const percent = Math.max(0, Math.min(100, (current / safeMax) * 100));
    meter.style.height = `${percent}%`;
}

function commodityBadge(commodity) {
    return formatCommodity(commodity).slice(0, 2).toUpperCase();
}

function renderCargoMiniList(player, ship) {
    const maxHolds = ship ? ship.maxHolds : Math.max(1, getCargoUsed());
    const loaded = CARGO_COMMODITIES
        .map(commodity => ({
            commodity,
            label: formatCommodity(commodity),
            quantity: player.cargo[commodity] || 0
        }))
        .filter(item => item.quantity > 0);
    const visible = loaded.slice(0, CARGO_MINI_LIST_LIMIT);
    const hiddenLoaded = Math.max(0, loaded.length - visible.length);
    const emptyCount = CARGO_COMMODITIES.length - loaded.length;
    let html = "";
    visible.forEach(item => {
        const percent = Math.max(4, Math.min(100, (item.quantity / Math.max(1, maxHolds)) * 100));
        html += `<div class="cargo-row" title="${escapeHtml(item.label)}: ${item.quantity} holds">`;
        html += `<span class="cargo-icon">${escapeHtml(commodityBadge(item.commodity))}</span>`;
        html += `<span class="cargo-name">${escapeHtml(item.label)}</span>`;
        html += `<span class="cargo-bar"><span style="width:${percent}%"></span></span>`;
        html += `<span class="cargo-qty">${item.quantity}</span></div>`;
    });
    if (hiddenLoaded > 0) {
        html += `<div class="cargo-row muted"><span class="cargo-icon">+</span><span class="cargo-name">${hiddenLoaded} more loaded</span><span class="cargo-bar"><span></span></span><span class="cargo-qty">…</span></div>`;
    }
    if (emptyCount > 0) {
        const emptyText = loaded.length === 0 ? "empty" : `${emptyCount} empty`;
        html += `<div class="cargo-row muted"><span class="cargo-icon">--</span><span class="cargo-name">${emptyText}</span><span class="cargo-bar"><span></span></span><span class="cargo-qty">0</span></div>`;
    }
    html += `<button class="cargo-drilldown" data-action="showScreen" data-arg0="spreadsheet">Open Ledger</button>`;
    return html;
}

function updateCaptainRail(player, ship) {
    const railShip = document.getElementById("captainRailShip");
    if (railShip) {
        railShip.textContent = ship ? "◆" : "◇";
        railShip.title = ship ? ship.name : "No assigned ship";
    }
    const railCredits = document.getElementById("captainRailCredits");
    if (railCredits) {
        railCredits.textContent = formatCredits(player.credits);
        railCredits.title = `${formatCredits(player.credits)} credits`;
    }
    setRailMeterPercent("captainRailHull", ship ? player.hull : 0, ship ? ship.maxHull : 0);
    setRailMeterPercent("captainRailShields", ship ? player.shields : 0, ship ? ship.maxShields : 0);
    updateCaptainRailWarning();
}

function updateCaptainRailWarning(items) {
    const warning = document.getElementById("captainRailWarning");
    if (!warning) return;
    const list = items || getPriorityItems();
    const urgentItems = list.filter(item => item.urgent);
    warning.classList.toggle("active", urgentItems.length > 0);
    warning.title = urgentItems.length > 0 ? urgentItems[0].text : "No urgent priority items";
}

export function renderHeader() {
    const { player } = state;
    clampPlayerState();
    const sector = state.universe[player.currentSector];
    const ship = player.ship || null;
    document.getElementById("shipName").textContent = ship ? ship.name : "No assigned ship";
    document.getElementById("credits").textContent = formatCredits(player.credits);
    document.getElementById("dayTime").textContent = `Day ${player.time.day}, ${formatTime(player.time.minuteOfDay)}`;
    document.getElementById("sectorNum").textContent = player.currentSector;
    document.getElementById("sectorName").textContent = sector.name;
    const cs = document.getElementById("curSector");
    if (cs) cs.textContent = player.currentSector;
    document.getElementById("cargoSummary").innerHTML = renderCargoMiniList(player, ship);
    const cargoUsed = getCargoUsed();
    document.getElementById("holds").textContent = ship ? `${cargoUsed}/${ship.maxHolds}` : "0/0";
    document.getElementById("fighters").textContent = ship ? `${player.fighters}/${ship.maxFighters}` : "0/0";
    document.getElementById("shields").textContent = ship ? `${player.shields}/${ship.maxShields}` : "0/0";
    document.getElementById("hull").textContent = ship ? `${player.hull}/${ship.maxHull}` : "0/0";
    setMeterPercent("holdsMeter", cargoUsed, ship ? ship.maxHolds : 0);
    setMeterPercent("fightersMeter", ship ? player.fighters : 0, ship ? ship.maxFighters : 0);
    setMeterPercent("shieldsMeter", ship ? player.shields : 0, ship ? ship.maxShields : 0);
    setMeterPercent("hullMeter", ship ? player.hull : 0, ship ? ship.maxHull : 0);
    updateCaptainRail(player, ship);
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
        const heatLabel = heat > 30 ? ` H${heat}` : "";
        const tooltip = `${faction.name}: ${faction.description} | ${getFactionLabel(rep)}${heatLabel}. Click for Network.`;
        html += `<div class="faction-line faction-strip" role="button" tabindex="0" data-action="showScreen" data-arg0="reputation" title="${escapeHtml(tooltip)}">`;
        html += `<span class="faction-mark" style="color:${faction.color}"><span class="faction-icon">${faction.icon}</span>${faction.short}</span>`;
        html += `<span class="faction-bar"><span class="faction-fill" style="width:${getFactionBarPercent(rep)}%; background:${faction.color}"></span></span>`;
        html += `<span class="faction-label">${getFactionLabel(rep)}${heatLabel}</span></div>`;
    });
    const activeGuilds = GUILD_FACTIONS.filter(id => getGuildTier(id) > 0);
    if (activeGuilds.length > 0) {
        const guildSummary = activeGuilds.map(id => `${FACTIONS[id].short} ${GUILD_TIER_NAMES[getGuildTier(id)]}`).join(" | ");
        html += `<div class="political-meta" title="Guild standings">Guilds: ${escapeHtml(guildSummary)}</div>`;
    }
    const openAsks = player.factions.asks.filter(a => a.status === "available" || a.status === "accepted").length;
    const dataHold = getPlayerDataHoldSummary();
    html += `<div class="political-meta">Known ${known.length} | Asks ${openAsks} | Intel ${player.factions.intel.length}</div>`;
    html += `<div class="political-meta">Comms ${dataHold.privatePayloadCount}P / ${dataHold.securePayloadCount}S / ${dataHold.publicSnapshotCount}Pub</div>`;
    html += `<div class="political-actions"><button data-action="showScreen" data-arg0="reputation">Network</button>`;
    html += `<button data-action="showCommunications">Comms</button></div>`;
    document.getElementById("factionPanel").innerHTML = html;
}

export function renderAcceptedMissions() {
    const { missions } = state;
    const accepted = missions.filter(m => m.status === "accepted");
    const target = document.getElementById("acceptedMissions");
    if (!target) return;
    if (accepted.length === 0) {
        target.innerHTML = `
            <div class="muted">No accepted missions.</div>
            <div class="small muted">Open the Mission Board at ports to pick a destination, earn credits, and build faction reputation.</div>
            <button data-action="showScreen" data-arg0="missions">Open Mission Board</button>
        `;
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
    updateCaptainRailWarning(items);
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

function renderHotbarButton(item, shortcutNumber = null) {
    const attrs = [`class="action-hotbar-button${item.emphasis ? " is-primary" : ""}"`];
    if (item.action) attrs.push(`data-action="${escapeHtml(item.action)}"`);
    if (item.disabled) attrs.push("disabled");
    (item.args || []).slice(0, 5).forEach((arg, index) => {
        attrs.push(`data-arg${index}="${escapeHtml(String(arg))}"`);
    });
    const timeClass = `action-hotbar-time${item.time ? "" : " action-hotbar-slot-empty"}`;
    const shortcutClass = `action-hotbar-shortcut${Number.isInteger(shortcutNumber) ? "" : " action-hotbar-slot-empty"}`;
    const time = `<span class="${timeClass}">${item.time ? escapeHtml(item.time) : ""}</span>`;
    const shortcut = `<span class="${shortcutClass}" aria-hidden="true">${Number.isInteger(shortcutNumber) ? shortcutNumber : ""}</span>`;
    return `<button ${attrs.join(" ")}>`
        + shortcut
        + `<span class="action-hotbar-icon" aria-hidden="true">${escapeHtml(item.icon)}</span>`
        + `<span class="action-hotbar-copy"><span class="action-hotbar-label">${escapeHtml(item.label)}</span>`
        + `<span class="action-hotbar-subtitle">${escapeHtml(item.subtitle)}</span></span>`
        + time
        + `</button>`;
}

function getSectorHotbarItems() {
    const { player, universe, ports, planets, selectedSectorId } = state;
    const sector = universe[player.currentSector];
    if (!sector) return [];

    const neighbors = getSectorNeighbors(player.currentSector);
    const selectedAdjacent = neighbors.includes(selectedSectorId);
    const selectedSector = universe[selectedSectorId];
    const navigationItem = selectedAdjacent
        ? {
            icon: "⇢",
            label: `Gate S${selectedSectorId}`,
            subtitle: selectedSector ? `Use jump gate to ${selectedSector.name}` : "Use selected jump gate",
            time: player.ship ? `${player.ship.travelMinutesPerCorridor}m` : "No ship",
            action: player.ship ? "moveTo" : null,
            args: player.ship ? [selectedSectorId] : [],
            disabled: !player.ship,
            emphasis: Boolean(player.ship)
        }
        : {
            icon: "◎",
            label: "Navigation",
            subtitle: !player.ship
                ? "No assigned ship"
                : (neighbors.length > 0 ? "Pick a gate in the right console" : "No outbound gates"),
            action: null,
            disabled: neighbors.length === 0 || !player.ship,
            emphasis: true
        };

    const items = [
        navigationItem,
        {
            icon: "◌",
            label: "Survey",
            subtitle: "Reveal local intel",
            time: "60m",
            action: "surveySector"
        }
    ];

    if (ports[player.currentSector]) {
        items.push({
            icon: "◈",
            label: "Market",
            subtitle: "Port trading",
            action: "showScreen",
            args: ["market"]
        });
    }
    if (sector.asteroids) {
        items.push({
            icon: "◆",
            label: "Asteroids",
            subtitle: "Mine ore",
            time: "120m",
            action: "mineAsteroids"
        });
    }
    if (planets[player.currentSector]) {
        items.push({
            icon: "⬡",
            label: "Colony",
            subtitle: "Planet operations",
            action: "showScreen",
            args: ["colony"]
        });
    }
    if (player.currentSector === state.world?.roles?.shipyardSiteId) {
        items.push({
            icon: "✚",
            label: "Shipyard",
            subtitle: "Repairs & upgrades",
            action: "showScreen",
            args: ["shipyard"]
        });
    }

    const { getLogisticsNode } = _logisticsModule;
    if (getLogisticsNode && getLogisticsNode(player.currentSector)) {
        items.push({
            icon: "⇄",
            label: "Logistics",
            subtitle: "Routes & convoys",
            action: "showScreen",
            args: ["logistics"]
        });
    }
    if (sector.pirateThreat > 0) {
        items.push({
            icon: "⚔",
            label: "Pirates",
            subtitle: `Threat ${sector.pirateThreat}`,
            time: "60m",
            action: "fightPirates"
        });
    }

    return items;
}

export function renderActionHotbar() {
    const el = document.getElementById("actionHotbar");
    if (!el) return;
    if (state.appMode !== "inGame" || state.currentScreen !== "sector" || !state.player) {
        el.hidden = true;
        el.innerHTML = "";
        return;
    }

    const items = getSectorHotbarItems();
    if (items.length === 0) {
        el.hidden = true;
        el.innerHTML = "";
        return;
    }

    const primaryItems = items.slice(0, 7);
    const overflowItems = items.slice(7);
    const overflow = overflowItems.length > 0
        ? `<details class="action-hotbar-more"><summary>More</summary><div class="action-hotbar-more-list">${overflowItems.map(item => renderHotbarButton(item)).join("")}</div></details>`
        : "";

    el.hidden = false;
    el.innerHTML = `<div class="action-hotbar-header"><span>Action Hotbar</span><span class="muted">Sector ${escapeHtml(String(state.player.currentSector))}</span></div>`
        + `<div class="action-hotbar-list">${primaryItems.map((item, index) => {
            const enabledBefore = primaryItems.slice(0, index).filter(candidate => !candidate.disabled).length;
            const shortcutNumber = item.disabled ? null : enabledBefore + 1;
            return renderHotbarButton(item, shortcutNumber);
        }).join("")}${overflow}</div>`;
}

export function renderSectorActionMenu() {
    return `<div class="sector-actions-note small muted">Primary sector actions are available in the bottom hotbar. Use the right command console for exact outbound gate selection and local contacts.</div>`;
}

// Injected by main.js to avoid circular: renderHUD.js → tradeRoutes → market → guilds → ...
const _logisticsModule = { getLogisticsNode: null };
export function injectLogisticsModule(mod) { _logisticsModule.getLogisticsNode = mod.getLogisticsNode; }
