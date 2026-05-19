import { state } from "../state.js";
import { FACTIONS, NPC_FINDABLE_PARTS, PLANET_TYPES, CONTACT_SERVICE_LABELS, UI_LABELS } from "../constants.js";
import { getPortType } from "../core/ports.js";
import { escapeHtml, makeStock } from "../utils.js";
import { getSectorFactionId, getSectorStatusLabel, getInfluenceSpread } from "../core/influence.js";
import { renderCaptainChipsForSector } from "./renderCaptains.js";
import { getOutboundJumpGates, getSectorNeighbors, getWayStationReserveState } from "../core/navigation.js";
import { getSiteTypeLabel, getRichnessLabel } from "../core/universe.js";
import { getFreshnessSummaryForSector } from "../core/dataCargo.js";
import { getContactDialogueActionState, MIN_DEEPEN_FAMILIARITY, normaliseDialogueRelationship } from "../systems/people.js";
import { savePreferencePatch } from "../core/preferences.js";
import { StateSlice, stateChanged } from "../core/state/index.js";


function renderLocalAuthorityLine(sector) {
    if (!sector.localAuthority) return "";
    const authority = sector.localAuthority;
    const polity = state.polities?.[authority.polityId];
    const faction = FACTIONS[authority.factionId];
    const factionLabel = faction ? `${faction.icon} ${escapeHtml(faction.short)}` : escapeHtml(authority.factionId || "Unknown");
    return `<div><strong>Local Authority:</strong> ${escapeHtml(authority.name)} (${escapeHtml(authority.type)}) | <strong>Polity:</strong> ${escapeHtml(polity?.name || authority.polityId || "Independent")} | ${factionLabel}</div>`;
}

function renderLocalCompanies(sectorId) {
    const ids = state.companyIdsBySector?.[sectorId] || [];
    if (ids.length === 0) return "";
    const labels = ids.map(id => {
        const company = state.companies[id];
        if (!company) return null;
        const faction = FACTIONS[company.factionId];
        const contactId = company.contactPersonIds?.[0];
        const contact = contactId ? state.people?.[contactId] : null;
        const contactLabel = contact ? ` / ${escapeHtml(contact.name)} (${escapeHtml(contact.role)})` : "";
        return `${escapeHtml(company.name)} (${escapeHtml(company.type)}${faction ? `, ${faction.short}` : ""}${contactLabel})`;
    }).filter(Boolean);
    return `<div><strong>Local Companies:</strong> ${labels.join(" | ")}</div>`;
}


function formatCommandActionButton(action) {
    const disabled = action.disabled ? " disabled" : "";
    const argAttributes = (action.args || [])
        .map((arg, index) => ` data-arg${index}="${escapeHtml(String(arg))}"`)
        .join("");
    return `<button data-action="${escapeHtml(action.action)}"${argAttributes}${disabled}>${escapeHtml(action.label)}</button>`;
}

function renderCommandAccordionSection(id, title, body, count = null) {
    const countBadge = count === null ? "" : `<span class="accordion-count">${count}</span>`;
    const existing = document.querySelector(`.accordion-section[data-accordion-id="${CSS.escape(id)}"]`);
    const isOpen = existing ? existing.classList.contains('is-open') : true;
    return `<section class="accordion-section${isOpen ? " is-open" : ""}" data-accordion-id="${escapeHtml(id)}">`
        + `<button class="accordion-header" type="button" data-accordion-toggle aria-expanded="${isOpen}">`
        + `<span>${escapeHtml(title)}</span>${countBadge}<span class="accordion-caret" aria-hidden="true">▾</span>`
        + `</button>`
        + `<div class="accordion-body"${isOpen ? "" : " hidden=\"\""}>${body}</div>`
        + `</section>`;
}

function renderLocalPeopleDialogueActions(sectorId) {
    const ids = state.peopleBySector?.[sectorId] || [];
    const people = ids.map(id => state.people?.[id]).filter(Boolean);
    if (people.length === 0) {
        return `<div class="muted small">No local contacts broadcasting availability.</div>`;
    }
    const defaultPartId = NPC_FINDABLE_PARTS[0] || "fujiwattit";
    const serviceButtons = [
        { service: "parts", label: "Source Part", arg2: defaultPartId },
        { service: "orders", label: "Arrange Order", arg2: "eq" },
        { service: "permits", label: "Request Permit", arg2: "local_access" },
        { service: "intel", label: "Ask for Intel", arg2: "local_activity" }
    ];
    return people.slice(0, 3).map(person => {
        const services = Array.isArray(person.services) ? person.services : [];
        const actions = serviceButtons
            .filter(button => services.includes(button.service))
            .map(button => {
                if (button.service === "parts") {
                    const actionState = getContactDialogueActionState(person.id, button.arg2);
                    const actionName = actionState.action || "requestContactService";
                    const itemId = actionState.itemId || button.arg2;
                    return {
                        action: actionName,
                        args: actionName === "requestContactService"
                            ? [person.id, "parts", itemId]
                            : [person.id, itemId],
                        disabled: actionState.disabled,
                        label: button.label
                    };
                }
                return {
                    action: "requestContactService",
                    args: [person.id, button.service, button.arg2],
                    disabled: false,
                    label: button.label
                };
            });
        const relationship = normaliseDialogueRelationship(person.relationships?.player || {});
        const canDeepen = relationship && relationship.familiarity >= MIN_DEEPEN_FAMILIARITY;
        actions.push({
            action: "startPersonalChat",
            args: [person.id],
            disabled: false,
            label: "Talk personally"
        });
        actions.push({
            action: "deepenRelationship",
            args: [person.id, "stories"],
            disabled: !canDeepen,
            label: "Talk more"
        });
        const primaryAction = actions.find(action => !action.disabled) || actions[0];
        const secondaryActions = actions.filter(action => action !== primaryAction);
        const company = person.companyId ? state.companies?.[person.companyId] : null;
        const roleLabel = company?.name || person.role || "Local contact";
        const chips = services.length > 0
            ? services.map(service => `<span class="service-chip">${escapeHtml(CONTACT_SERVICE_LABELS[service] || service)}</span>`).join("")
            : `<span class="service-chip muted">Unlisted</span>`;
        const secondaryHtml = secondaryActions.length > 0
            ? `<button class="contact-more-toggle" type="button" aria-expanded="false">More</button>`
                + `<div class="contact-secondary-actions" hidden>${secondaryActions.map(formatCommandActionButton).join("")}</div>`
            : "";
        return `<article class="contact-card">`
            + `<div class="contact-card-header"><strong>${escapeHtml(person.name)}</strong><span class="muted">${escapeHtml(roleLabel)}</span></div>`
            + `<div class="contact-service-chips">${chips}</div>`
            + `<div class="contact-actions primary-action">${formatCommandActionButton(primaryAction)}${secondaryHtml}</div>`
            + `</article>`;
    }).filter(Boolean).join("");
}


function renderDataFreshnessChip(sectorId) {
    const freshness = getFreshnessSummaryForSector(sectorId);
    if (freshness.liveLocal) {
        return `<span class="sector-chip">Data: live local</span>`;
    }
    if (!freshness.known) {
        return `<span class="sector-chip muted">Data: unknown</span>`;
    }
    const coldTitle = freshness.label === "stale" || freshness.label === "cold"
        ? ` title="Public data ${escapeHtml(freshness.label)}: last observed Day ${freshness.lastObservedDay}"`
        : "";
    return `<span class="sector-chip"${coldTitle}>Data: ${escapeHtml(freshness.label)} / D${freshness.lastObservedDay}</span>`;
}

function renderDataFreshnessLine(sectorId) {
    const freshness = getFreshnessSummaryForSector(sectorId);
    if (freshness.liveLocal) {
        return `<div class="small muted"><strong>Data freshness:</strong> live local observation</div>`;
    }
    if (!freshness.known) {
        return `<div class="small muted"><strong>Data freshness:</strong> unknown</div>`;
    }
    const coldTitle = freshness.label === "stale" || freshness.label === "cold"
        ? ` title="Public data ${escapeHtml(freshness.label)}: last observed Day ${freshness.lastObservedDay}"`
        : "";
    return `<div class="small muted"${coldTitle}><strong>Data freshness:</strong> ${escapeHtml(freshness.label)} | Last observed: Day ${freshness.lastObservedDay} | Delivered here: Day ${freshness.deliveredDay} | Known from: Sector ${freshness.knownFromSectorId}</div>`;
}

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
    html += renderLocalAuthorityLine(sector);
    html += renderLocalCompanies(player.currentSector);
    html += renderDataFreshnessLine(player.currentSector);
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
        const type = getPortType(port);
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
    const planetInfo = document.getElementById("planetInfo");
    if (planet && planetInfo) {
        const type = PLANET_TYPES[planet.typeKey];
        html += `<div class="blue"><strong>Planet:</strong> ${escapeHtml(type.name)} (${planet.owner ? "Colony founded" : "Unclaimed"})</div>`;
        planetInfo.style.display = "block";
        planetInfo.innerHTML = renderPlanetSummary(planet);
    } else if (planetInfo) {
        planetInfo.style.display = "none";
    }
    const sectorContents = document.getElementById("sectorContents");
    if (sectorContents) {
        sectorContents.innerHTML = html;
    }
}

export function renderSectorSummary() {
    const summary = document.getElementById("screenSummary");
    if (!summary || !state.player) return;
    const sector = state.universe[state.player.currentSector];
    if (!sector) {
        summary.innerHTML = "";
        return;
    }
    const port = state.ports[state.player.currentSector];
    const asteroids = sector.asteroids ? UI_LABELS.sectorSummaryAsteroids : UI_LABELS.sectorSummaryNoAsteroids;
    const planet = state.planets[state.player.currentSector] ? UI_LABELS.sectorSummaryPlanet : UI_LABELS.sectorSummaryNoPlanet;
    const risks = `Risk ${sector.pirateThreat || 0}`;
    const gates = getOutboundJumpGates(state.player.currentSector).length;
    const routes = state.tradeRoutes.filter(r => r.status !== "closed"
        && (r.originSector === state.player.currentSector || r.destinationSector === state.player.currentSector)).length;
    summary.innerHTML = `<div>${escapeHtml(getSiteTypeLabel(sector.siteType))} · ${escapeHtml(sector.name || UI_LABELS.sectorSummaryUnknownName)} · ${escapeHtml(getSectorStatusLabel(state.player.currentSector))}</div>`
        + `<div>${port ? UI_LABELS.sectorSummaryPortActive : UI_LABELS.sectorSummaryNoPort} · ${asteroids} · ${planet} · ${risks}</div>`
        + `<div>Gates ${gates} · Routes ${routes} · ${UI_LABELS.sectorSummaryPriority}</div>`;
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
        const shortages = planet.shortages || makeStock();
        html += `Satisfaction: ${planet.satisfaction || 0} | Shortages: Ore ${shortages.ore || 0} / Org ${shortages.org || 0} / Eq ${shortages.eq || 0}<br>`;
    }
    html += `Stock: Ore ${planet.stock.ore} / Org ${planet.stock.org} / Eq ${planet.stock.eq}<br>`;
    html += `Buildings: Hab ${planet.buildings.habitat}, Mine ${planet.buildings.mine}, Farm ${planet.buildings.farm}, Factory ${planet.buildings.factory}, Defense ${planet.buildings.defense}`;
    return html;
}

export function renderMenuPanel() {
    const { player, universe, ports, planets } = state;
    const outboundGates = getOutboundJumpGates(player.currentSector);
    const gateCards = outboundGates.map(gate => {
        const target = gate.destinationSectorId;
        const s = universe[target];
        if (!s) return "";
        const dominant = FACTIONS[getSectorFactionId(target)];
        const badges = [];
        if (ports[target]) badges.push(`<span class="sector-chip">Port</span>`);
        if (planets[target]) badges.push(`<span class="sector-chip">Planet</span>`);
        if (s.asteroids) badges.push(`<span class="sector-chip">Asteroids</span>`);
        if (s.pirateThreat > 0) badges.push(`<span class="sector-chip red">Pirates ${s.pirateThreat}</span>`);
        const gateLabel = escapeHtml(gate.id || gate.corridorId || `gate to ${target}`);
        const span = typeof gate.effectiveSpanCost === "number"
            ? `<span class="sector-chip">Span ${gate.effectiveSpanCost.toFixed(2)}</span>`
            : "";
        const factionLabel = dominant
            ? `<span class="sector-chip" style="color:${dominant.color}">${dominant.icon} ${escapeHtml(dominant.short)}</span>`
            : `<span class="sector-chip muted">Independent</span>`;
        return `<article class="nav-card gate-card">`
            + `<div class="gate-card-title"><strong>Site ${target}</strong><span class="muted">${escapeHtml(s.name || `Site ${target}`)}</span></div>`
            + `<div class="gate-meta"><span class="sector-chip">${escapeHtml(getSiteTypeLabel(s.siteType))}</span><span class="sector-chip">${escapeHtml(s.region)}</span>${factionLabel}</div>`
            + `<div class="gate-badges">${badges.join("") || `<span class="sector-chip muted">Deep Space</span>`}</div>`
            + `<div class="gate-id-row"><span class="sector-chip">Gate ${gateLabel}</span>${span}</div>`
            + `<div class="gate-actions"><button data-action="selectSector" data-arg0="${target}">Inspect</button>${player.ship ? `<button data-action="moveTo" data-arg0="${target}">Use Jump Gate</button>` : `<button type="button" disabled title="Assign a ship before using jump gates">No ship assigned</button>`}</div>`
            + `</article>`;
    }).filter(Boolean).join("");
    const gatesBody = gateCards || `<div class="muted small">No outbound jump gates registered.</div>`;

    const contactsBody = renderLocalPeopleDialogueActions(player.currentSector);

    const shortcuts = [
        { screen: "sector", label: "◎ Sector", highlight: false },
        { screen: "missions", label: "◇ Missions", highlight: false },
        { screen: "logistics", label: "⇄ Logistics", highlight: false },
        { screen: "reputation", label: "◬ Reputation", highlight: false }
    ];
    if (ports[player.currentSector]) shortcuts.push({ screen: "market", label: "◈ Market", highlight: true });
    if (planets[player.currentSector]) shortcuts.push({ screen: "colony", label: "⬡ Colony", highlight: true });
    if (state.world?.roles?.shipyardSiteId === player.currentSector) {
        shortcuts.push({ screen: "shipyard", label: "✚ Shipyard", highlight: true });
    }
    const menusBody = `<div class="menu-grid command-shortcuts">`
        + shortcuts.map(shortcut => {
            const activeClass = shortcut.highlight ? " shortcut-available" : "";
            return `<button class="shortcut-button${activeClass}" data-action="showScreen" data-arg0="${escapeHtml(shortcut.screen)}">${escapeHtml(shortcut.label)}</button>`;
        }).join("")
        + `</div>`;

    const html = renderCommandAccordionSection("outbound-gates", "Outbound Gates", gatesBody, outboundGates.length)
        + renderCommandAccordionSection("local-contacts", "Local Contacts", contactsBody, Math.min((state.peopleBySector?.[player.currentSector] || []).length, 3))
        + renderCommandAccordionSection("menus", "Menus", menusBody, shortcuts.length);
    document.getElementById("commandList").innerHTML = html;
}

export function toggleMapInspectorCompact() {
    state.mapInspectorCompact = !state.mapInspectorCompact;
    savePreferencePatch(null, { mapInspectorCompact: state.mapInspectorCompact });
    return stateChanged(StateSlice.MAP_VIEW);
}

export function renderMapInspector() {
    const { player, universe, ports, planets, tradeRoutes, selectedSectorId } = state;
    const el = document.getElementById("mapInspector");
    if (!el) return;
    const id = selectedSectorId || player.currentSector;
    const sector = universe[id];
    if (!sector) {
        el.classList.add("map-inspector--empty");
        el.classList.remove("map-inspector--compact");
        el.innerHTML = "";
        return;
    }
    el.classList.remove("map-inspector--empty");
    el.classList.toggle("map-inspector--compact", Boolean(state.mapInspectorCompact));
    const dominant = FACTIONS[getSectorFactionId(id)];
    const adjacent = getSectorNeighbors(player.currentSector).includes(id);
    const statusLabel = getSectorStatusLabel(id);
    const factChips = [];
    if (sector.coord) factChips.push(`<span class="sector-chip">(${sector.coord.x}, ${sector.coord.y}, ${sector.coord.z})</span>`);
    factChips.push(`<span class="sector-chip">${escapeHtml(getSiteTypeLabel(sector.siteType))}</span>`);
    factChips.push(`<span class="sector-chip">${escapeHtml(sector.region)}</span>`);
    if (dominant) factChips.push(`<span class="sector-chip" style="color:${dominant.color}">${dominant.icon} ${escapeHtml(dominant.short)}</span>`);
    if (sector.localAuthority) factChips.push(`<span class="sector-chip">${escapeHtml(state.polities?.[sector.localAuthority.polityId]?.name || sector.localAuthority.polityId)}</span>`);
    if (state.companyIdsBySector?.[id]?.length) factChips.push(`<span class="sector-chip">Companies ${state.companyIdsBySector[id].length}</span>`);
    if (ports[id]) factChips.push(`<span class="sector-chip">Port: ${escapeHtml(getPortType(ports[id]).name)}</span>`);
    if (sector.front) factChips.push(`<span class="sector-chip amber">Front suspicion ${sector.front.suspicion}</span>`);
    if (planets[id]) factChips.push(`<span class="sector-chip">Planet: ${escapeHtml(PLANET_TYPES[planets[id].typeKey].name)}</span>`);
    if (sector.asteroids) factChips.push(`<span class="sector-chip">Asteroids</span>`);
    if (sector.pirateThreat > 0) factChips.push(`<span class="sector-chip red">Pirates ${sector.pirateThreat}</span>`);
    const routeCount = tradeRoutes.filter(r => r.status !== "closed" && (r.originSector === id || r.destinationSector === id)).length;
    if (routeCount > 0) factChips.push(`<span class="sector-chip green">Routes ${routeCount}</span>`);
    factChips.push(renderDataFreshnessChip(id));

    const captainHtml = renderCaptainChipsForSector(id);
    let actionHtml = "";
    if (id === player.currentSector) {
        actionHtml = `<button data-action="showScreen" data-arg0="sector">Current Sector</button>`;
    } else if (adjacent && player.ship) {
        actionHtml = `<button data-action="moveTo" data-arg0="${id}">Transit Corridor (${player.ship.travelMinutesPerCorridor}m)</button>`;
    } else if (adjacent) {
        actionHtml = '<span class="muted">Direct corridor available, but you have no assigned ship.</span>';
    } else {
        actionHtml = `<span class="muted">No direct jump corridor. Connected corridors: ${getSectorNeighbors(id).join(", ")}</span>`;
    }

    const compactLabel = state.mapInspectorCompact ? "Expand" : "Compact";
    el.innerHTML = `<div class="map-inspector-title-row">`
        + `<div class="map-inspector-title"><strong>Site ${id} — ${escapeHtml(sector.name)}</strong></div>`
        + `<div class="map-inspector-controls"><span class="sector-chip map-inspector-status">${escapeHtml(statusLabel)}</span><button type="button" class="map-inspector-compact-button" data-action="toggleMapInspectorCompact" aria-pressed="${state.mapInspectorCompact ? "true" : "false"}">${compactLabel}</button></div>`
        + `</div>`
        + `<div class="map-inspector-facts">${factChips.join("")}</div>`
        + (captainHtml ? `<div class="map-inspector-captains">${captainHtml}</div>` : "")
        + `<div class="map-inspector-actions">${actionHtml}</div>`;
}
