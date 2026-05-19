import { state } from "../state.js";
import { FACTIONS, PLANET_TYPES } from "../constants.js";
import { getPortType } from "../core/ports.js";
import { getSectorFactionId, getSectorStatusLabel } from "../core/influence.js";
import { getCaptainsInSector } from "../systems/captains.js";
import { Renderer } from "./renderer.js";
import { StateSlice, stateChanged } from "./stateSlices.js";
import { getDirectCorridor, getSectorNeighbors } from "../core/navigation.js";
import { MAP_UI } from "../config/ui.js";
import { getSiteTypeLabel } from "../core/universe.js";
import { getFreshnessSummaryForSector } from "../core/dataCargo.js";
import { escapeHtml } from "../utils.js";
import { savePreferencePatch } from "../core/preferences.js";

const mapInteractionUnsubscribers = new WeakMap();
let mapProjectionSignature = '';
let mapProjectionUniverseRef = null;
let mapProjectionCache = {};
const MAP_LOGICAL_WIDTH = 700;
const MAP_LOGICAL_HEIGHT = 420;
const MAP_BACKGROUND = "#050b10";
const MAP_VIEWPORT_MIN_SCALE = 0.65;
const MAP_VIEWPORT_MAX_SCALE = 2.6;
const MAP_ZOOMED_OUT_NODE_SCALE = 0.85;
const MAP_CORRIDOR_HIT_RADIUS = 7;
const MAP_STAR_DEPTH_RATES = [0.08, 0.18, 0.32];
const MAP_TOOLTIP_OFFSET = 14;
const MAP_CAMERA_YAW_SENSITIVITY = 0.008;
const MAP_CAMERA_PITCH_SENSITIVITY = 0.006;
const MAP_CAMERA_MAX_TILT_RADIANS = Math.PI * 0.35;
const MAP_CAMERA_PITCH_MIN_RADIANS = -MAP_CAMERA_MAX_TILT_RADIANS;
const MAP_CAMERA_PITCH_MAX_RADIANS = MAP_CAMERA_MAX_TILT_RADIANS;
const MAP_CAMERA_SIGNATURE_PRECISION = 1000;
const MOUSE_BUTTON_LEFT = 0;
const MOUSE_BUTTON_MIDDLE = 1;
const MOUSE_BUTTON_RIGHT = 2;
const MAP_LAYER_DEFS = [
    { key: "systems", label: "Systems" },
    { key: "asteroids", label: "Asteroids" },
    { key: "influence", label: "Influence" },
    { key: "tradeRoutes", label: "Trade Routes" },
    { key: "contestedZones", label: "Contested Zones" },
    { key: "dataFreshness", label: "Data Freshness" }
];
let mapAnimationFrameId = 0;
let mapAnimationTime = 0;
let mapOverviewLastSig = '';

export function invalidateMapProjectionCache() {
    mapProjectionSignature = '';
    mapProjectionUniverseRef = null;
    mapProjectionCache = {};
    state.mapNodeCache = {};
}

function projectedCoord(site, sectorId, target = {}) {
    const { x = sectorId, y = 0, z = 0 } = site.coord ?? {};
    const camera = getMapCamera();
    const yawCos = Math.cos(camera.yaw);
    const yawSin = Math.sin(camera.yaw);
    const pitchCos = Math.cos(camera.pitch);
    const pitchSin = Math.sin(camera.pitch);
    const yawX = x * yawCos - z * yawSin;
    const yawZ = x * yawSin + z * yawCos;
    const pitchY = y * pitchCos - yawZ * pitchSin;
    const pitchZ = y * pitchSin + yawZ * pitchCos;
    target.x = yawX - pitchZ * MAP_UI.PROJECTION.Z_TO_X;
    target.y = pitchY + pitchZ * MAP_UI.PROJECTION.Z_TO_Y;
    return target;
}

function getVisibleMapSectorIds(universe) {
    return Object.keys(universe)
        .map(Number)
        .filter(id => universe[id].charted || id === state.player.currentSector);
}

function roundedCameraAngle(value) {
    return Math.round((Number(value) || 0) * MAP_CAMERA_SIGNATURE_PRECISION)
        / MAP_CAMERA_SIGNATURE_PRECISION;
}

function getMapProjectionSignature(ids) {
    const camera = getMapCamera();
    return [
        ids.join(','),
        roundedCameraAngle(camera.yaw),
        roundedCameraAngle(camera.pitch)
    ].join('|');
}

export function getMapNodes() {
    const universe = state.universe;
    const ids = getVisibleMapSectorIds(universe);
    const sig = getMapProjectionSignature(ids);
    if (mapProjectionUniverseRef === universe && sig === mapProjectionSignature) {
        state.mapNodeCache = mapProjectionCache;
        return mapProjectionCache;
    }

    const nodes = {};
    if (ids.length > 0) {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        const projected = ids.map(id => {
            const coord = projectedCoord(universe[id], id);
            if (coord.x < minX) minX = coord.x;
            if (coord.x > maxX) maxX = coord.x;
            if (coord.y < minY) minY = coord.y;
            if (coord.y > maxY) maxY = coord.y;
            return { id, coord };
        });
        const spanX = Math.max(1, maxX - minX);
        const spanY = Math.max(1, maxY - minY);
        projected.forEach(({ id, coord }) => {
            nodes[id] = {
                x: MAP_UI.LAYOUT.LEFT + ((coord.x - minX) / spanX) * MAP_UI.LAYOUT.WIDTH,
                y: MAP_UI.LAYOUT.TOP + ((coord.y - minY) / spanY) * MAP_UI.LAYOUT.HEIGHT
            };
        });
    }

    mapProjectionUniverseRef = universe;
    mapProjectionSignature = sig;
    mapProjectionCache = nodes;
    state.mapNodeCache = nodes;
    return nodes;
}

function getViewport() {
    if (!state.mapViewport) state.mapViewport = { scale: 1, offsetX: 0, offsetY: 0 };
    return state.mapViewport;
}

function getMapCamera() {
    if (!state.mapCamera) state.mapCamera = { yaw: 0, pitch: 0 };
    return state.mapCamera;
}

function getMapLayers() {
    return state.mapLayers;
}

function toggleMapLayer(layerKey) {
    const layer = MAP_LAYER_DEFS.find(def => def.key === layerKey);
    if (!layer) return;
    const layers = getMapLayers();
    layers[layerKey] = !layers[layerKey];
    savePreferencePatch(null, { mapLayers: layers });
    Renderer.sliceChanged(StateSlice.MAP_VIEW);
}

function setMapLayerPanelOpen(open) {
    state.mapLayersOpen = open;
    savePreferencePatch(null, { mapLayersOpen: open });
    Renderer.sliceChanged(StateSlice.MAP_VIEW);
}

function toggleMapLayerPanel() {
    setMapLayerPanelOpen(state.mapLayersOpen === false);
}

function setMapHelpOpen(open) {
    state.mapHelpOpen = open;
    Renderer.sliceChanged(StateSlice.MAP_VIEW);
}

function toggleMapHelp() {
    setMapHelpOpen(!state.mapHelpOpen);
}

function scheduleMapAnimationFrame() {
    if (mapAnimationFrameId) return;
    const raf = globalThis.requestAnimationFrame || (fn => globalThis.setTimeout(() => fn(Date.now()), 16));
    mapAnimationFrameId = raf(timestamp => {
        mapAnimationFrameId = 0;
        mapAnimationTime = typeof timestamp === "number" ? timestamp : Date.now();
        Renderer.invalidate("map");
    });
}

export function stopMapAnimation() {
    if (!mapAnimationFrameId) return;
    const cancel = globalThis.cancelAnimationFrame || globalThis.clearTimeout;
    cancel?.(mapAnimationFrameId);
    mapAnimationFrameId = 0;
}

function transformNode(node, target = {}) {
    const viewport = getViewport();
    target.x = node.x * viewport.scale + viewport.offsetX;
    target.y = node.y * viewport.scale + viewport.offsetY;
    return target;
}

function getMapCanvasRect(canvas) {
    if (typeof canvas.getBoundingClientRect === "function") {
        return canvas.getBoundingClientRect();
    }
    return { width: canvas.clientWidth || MAP_LOGICAL_WIDTH, height: canvas.clientHeight || MAP_LOGICAL_HEIGHT, left: 0, top: 0 };
}

function prepareMapCanvas(canvas, ctx) {
    const rect = getMapCanvasRect(canvas);
    const dpr = Math.max(1, globalThis.devicePixelRatio || 1);
    const backingWidth = Math.max(1, Math.round(rect.width * dpr));
    const backingHeight = Math.max(1, Math.round(rect.height * dpr));

    if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
        canvas.width = backingWidth;
        canvas.height = backingHeight;
    }

    if (typeof ctx.setTransform === "function") {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return rect;
}

function getPointerCanvasPosition(canvas, event) {
    const rect = getMapCanvasRect(canvas);
    return {
        x: event.clientX - (rect.left || 0),
        y: event.clientY - (rect.top || 0),
        clientX: event.clientX,
        clientY: event.clientY
    };
}

function getVisibleIds() {
    const { universe, player } = state;
    return Object.keys(universe)
        .map(Number)
        .filter(id => universe[id].charted || id === player.currentSector);
}

function getTransformedNodes() {
    const nodes = getMapNodes();
    const transformed = {};
    Object.entries(nodes).forEach(([id, node]) => {
        transformed[id] = transformNode(node, {});
    });
    return transformed;
}

function findNearestSectorAt(x, y) {
    const nodes = getTransformedNodes();
    let closestId = null;
    let closestDistance = Infinity;
    Object.entries(nodes).forEach(([id, node]) => {
        const dx = node.x - x;
        const dy = node.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < closestDistance) {
            closestDistance = distance;
            closestId = Number(id);
        }
    });
    return closestId !== null && closestDistance <= MAP_UI.NODES.CLICK_RADIUS
        ? { id: closestId, distance: closestDistance }
        : null;
}

function distanceToSegment(point, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared <= 0) return Math.sqrt((point.x - a.x) ** 2 + (point.y - a.y) ** 2);
    const rawT = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared;
    const t = Math.max(0, Math.min(1, rawT));
    const projectedX = a.x + t * dx;
    const projectedY = a.y + t * dy;
    return Math.sqrt((point.x - projectedX) ** 2 + (point.y - projectedY) ** 2);
}

function findNearestCorridorAt(x, y) {
    const nodes = getTransformedNodes();
    const point = { x, y };
    let closest = null;
    let closestDistance = Infinity;
    getVisibleIds().forEach(id => {
        getSectorNeighbors(id).forEach(target => {
            if (id >= target || !nodes[target]) return;
            const distance = distanceToSegment(point, nodes[id], nodes[target]);
            if (distance < closestDistance) {
                closestDistance = distance;
                closest = { from: id, to: target };
            }
        });
    });
    return closest && closestDistance <= MAP_CORRIDOR_HIT_RADIUS ? closest : null;
}

function rawCoordDistance(a, b) {
    const fromCoord = a.coord || { x: a.id, y: 0, z: 0 };
    const toCoord = b.coord || { x: b.id, y: 0, z: 0 };
    const dx = fromCoord.x - toCoord.x;
    const dy = fromCoord.y - toCoord.y;
    const dz = fromCoord.z - toCoord.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function corridorRisk(fromId, toId) {
    return [fromId, toId].reduce((sum, id) => {
        const sector = state.universe[id];
        if (!sector) return sum;
        let risk = sector.pirateThreat || 0;
        if (sector.region === "Badlands") risk += 1;
        return sum + Math.max(0, risk);
    }, 0);
}


function getMapFreshnessColor(label) {
    if (label === "current") return "#00ff88";
    if (label === "fresh") return "#66ffcc";
    if (label === "aging") return "#ffd166";
    if (label === "stale") return "#ff8844";
    if (label === "cold") return "#8a6cff";
    return "rgba(180, 190, 200, 0.55)";
}

function formatFreshnessTooltip(summary) {
    if (summary.liveLocal) return "Data: live local observation";
    if (!summary.known) return "Data: unknown";
    return `Data: ${summary.label} / observed Day ${summary.lastObservedDay} / delivered Day ${summary.deliveredDay} / known from S${summary.knownFromSectorId}`;
}

function renderTooltipGroup(title, chips) {
    if (chips.length === 0) return "";
    return `<div class="map-tooltip-group"><div class="map-tooltip-group-title">${escapeHtml(title)}</div><div class="map-tooltip-chips">${chips.map(chip => `<span class="sector-chip">${escapeHtml(chip)}</span>`).join("")}</div></div>`;
}

function sectorTooltipHtml(id) {
    const { universe, ports, planets, tradeRoutes } = state;
    const sector = universe[id];
    if (!sector) return "";
    const dominant = FACTIONS[getSectorFactionId(id)];
    const routeCount = tradeRoutes.filter(r => r.status !== "closed" && (r.originSector === id || r.destinationSector === id)).length;
    const identity = [];
    if (sector.coord) identity.push(`(${sector.coord.x}, ${sector.coord.y}, ${sector.coord.z})`);
    identity.push(getSiteTypeLabel(sector.siteType));
    identity.push(sector.region);
    identity.push(getSectorStatusLabel(id));
    if (dominant) identity.push(`${dominant.icon} ${dominant.short}`);
    if (sector.localAuthority) identity.push(state.polities?.[sector.localAuthority.polityId]?.name || sector.localAuthority.polityId);

    const economy = [];
    if (state.companyIdsBySector?.[id]?.length) economy.push(`Companies: ${state.companyIdsBySector[id].length}`);
    if (ports[id]) economy.push(`Port: ${getPortType(ports[id]).name}`);
    if (planets[id]) economy.push(`Planet: ${PLANET_TYPES[planets[id].typeKey].name}`);
    if (sector.asteroids) economy.push("Asteroids");
    if (routeCount > 0) economy.push(`Routes ${routeCount}`);

    const danger = [];
    if (sector.pirateThreat > 0) danger.push(`Pirates ${sector.pirateThreat}`);
    if (sector.front) danger.push(`Front suspicion ${sector.front.suspicion}`);
    if (danger.length === 0) danger.push("No flagged local threat");

    const freshness = getFreshnessSummaryForSector(id);
    return `<div class="map-tooltip-title"><strong>Site ${id}</strong> ${escapeHtml(sector.name || "Unknown")}</div>`
        + renderTooltipGroup("Identity", identity)
        + renderTooltipGroup("Local Economy", economy)
        + renderTooltipGroup("Danger", danger)
        + renderTooltipGroup("Freshness", [formatFreshnessTooltip(freshness)]);
}

function corridorTooltipHtml(corridor) {
    const { universe, player } = state;
    const from = universe[corridor.from];
    const to = universe[corridor.to];
    const gate = getDirectCorridor(corridor.from, corridor.to) || getDirectCorridor(corridor.to, corridor.from);
    const span = gate && typeof gate.effectiveSpanCost === "number" ? gate.effectiveSpanCost : null;
    const shear = ((from.metricShear || 0) + (to.metricShear || 0)) / 2;
    const distance = rawCoordDistance(from, to);
    const travelTime = player?.ship?.travelMinutesPerCorridor || 0;
    const risk = corridorRisk(corridor.from, corridor.to);
    return `<strong>Corridor ${corridor.from} ⇄ ${corridor.to}</strong><br>`
        + `<span class="sector-chip">raw ${distance.toFixed(2)}</span>`
        + `<span class="sector-chip">span ${span === null ? "?" : span.toFixed(2)}</span>`
        + `<span class="sector-chip">shear ${shear.toFixed(2)}</span>`
        + `<span class="sector-chip">travel ${travelTime}m</span>`
        + `<span class="sector-chip ${risk > 2 ? "red" : ""}">risk ${risk}</span>`;
}

function ensureMapTooltip() {
    let tooltip = document.getElementById("mapTooltip");
    if (tooltip) return tooltip;
    tooltip = document.createElement("div");
    tooltip.id = "mapTooltip";
    tooltip.className = "map-tooltip";
    document.body.appendChild(tooltip);
    return tooltip;
}


function setMapExpanded(expanded) {
    const canvas = document.getElementById("map");
    const mapWrap = canvas?.closest(".map-wrap");
    const expandButton = document.getElementById("btn-expand-map");
    if (!mapWrap) return;

    mapWrap.classList.toggle("map-expanded", expanded);
    document.body.classList.toggle("map-modal-open", expanded);
    if (expandButton) {
        expandButton.textContent = expanded ? "Collapse Map" : "Expand Map";
        expandButton.setAttribute("aria-expanded", expanded ? "true" : "false");
    }

    Renderer.invalidate("map");
}

function toggleMapExpanded() {
    const canvas = document.getElementById("map");
    const mapWrap = canvas?.closest(".map-wrap");
    if (!mapWrap) return;
    setMapExpanded(!mapWrap.classList.contains("map-expanded"));
}

function showMapTooltip(html, pointer) {
    const tooltip = ensureMapTooltip();
    tooltip.innerHTML = html;
    tooltip.style.left = `${pointer.clientX + MAP_TOOLTIP_OFFSET}px`;
    tooltip.style.top = `${pointer.clientY + MAP_TOOLTIP_OFFSET}px`;
    tooltip.classList.add("visible");
}

function hideMapTooltip() {
    const tooltip = document.getElementById("mapTooltip");
    if (!tooltip) return;
    tooltip.classList.remove("visible");
}

export function resetMapViewport() {
    state.mapViewport = { scale: 1, offsetX: 0, offsetY: 0 };
    state.mapCamera = { yaw: 0, pitch: 0 };
    state.hoveredSectorId = null;
    Renderer.invalidate("map");
}

function resetMapView() {
    const viewport = getViewport();
    viewport.scale = 1;
    viewport.offsetX = 0;
    viewport.offsetY = 0;
    Renderer.invalidate("map");
}

function getVisibleMapCenter() {
    const canvas = document.getElementById("map");
    const rect = canvas ? getMapCanvasRect(canvas) : null;
    return {
        x: (rect?.width || MAP_LOGICAL_WIDTH) / 2,
        y: (rect?.height || MAP_LOGICAL_HEIGHT) / 2
    };
}

export function centerMapOnSector(sectorId = state.player?.currentSector) {
    const nodes = getMapNodes();
    const node = nodes[sectorId];
    if (!node) return;

    const viewport = getViewport();
    const center = getVisibleMapCenter();

    viewport.offsetX = center.x - node.x * viewport.scale;
    viewport.offsetY = center.y - node.y * viewport.scale;

    Renderer.invalidate("map");
}


function renderMapToolbar() {
    const toolbar = document.getElementById("mapToolbar");
    if (!toolbar) return;
    const mapWrap = document.querySelector(".map-wrap");
    const mapExpanded = mapWrap?.classList.contains("map-expanded") ?? false;
    const layers = getMapLayers();
    const layerButtons = state.mapLayersOpen === false
        ? ""
        : MAP_LAYER_DEFS.map(layer => {
            const active = layers[layer.key] !== false;
            return `<button type="button" class="map-layer-toggle${active ? " is-active" : ""}" data-map-layer="${layer.key}" aria-pressed="${active ? "true" : "false"}">${escapeHtml(layer.label)}</button>`;
        }).join("");
    toolbar.classList.toggle("map-toolbar--collapsed", state.mapLayersOpen === false);
    toolbar.innerHTML = `<div class="map-toolbar-row map-toolbar-primary">`
        + `<button id="btn-center-map" type="button">Center</button>`
        + `<button id="btn-fit-map" type="button">Reset View</button>`
        + `<button id="btn-expand-map" type="button" aria-expanded="${mapExpanded ? "true" : "false"}">${mapExpanded ? "Collapse Map" : "Expand Map"}</button>`
        + `<button id="btn-collapse-map" type="button">Map Rail</button>`
        + `<button id="btn-toggle-map-layers" type="button" aria-expanded="${state.mapLayersOpen === false ? "false" : "true"}">Layers</button>`
        + `<button id="btn-map-help" type="button" aria-expanded="${state.mapHelpOpen ? "true" : "false"}">?</button>`
        + `</div>`
        + `<div class="map-toolbar-row map-layer-row">${layerButtons}</div>`;
}

function applyMapPanelMode() {
    const mapWrap = document.querySelector(".map-wrap");
    const viewport = document.querySelector(".main-viewport");
    if (!mapWrap || !viewport) return;
    mapWrap.classList.toggle("map-panel-rail", state.mapPanelMode === "rail");
    viewport.classList.toggle("main-map-rail", state.mapPanelMode === "rail");
    if (state.mapPanelMode === "rail") {
        setMapExpanded(false);
    }
}

function renderMapHelp() {
    const help = document.getElementById("mapShortcutHelp");
    if (!help) return;
    help.hidden = !state.mapHelpOpen;
    if (!state.mapHelpOpen) {
        help.innerHTML = "";
        return;
    }
    help.innerHTML = `<div class="map-help-title">Map Shortcuts</div>`
        + `<button id="btn-close-map-help" type="button" aria-label="Close map shortcuts">×</button>`
        + `<dl>`
        + `<dt>?</dt><dd>Toggle this help overlay</dd>`
        + `<dt>F</dt><dd>Reset map view</dd>`
        + `<dt>L</dt><dd>Show or hide layer toggles</dd>`
        + `<dt>1–7</dt><dd>Trigger visible sector hotbar actions</dd>`
        + `<dt>Esc</dt><dd>Close overlays or collapse expanded map</dd>`
        + `</dl>`;
}

function drawMapOverview(ids, rect) {
    const canvas = document.getElementById("mapOverview");
    if (!canvas) return;
    const viewport = getViewport();
    const rawNodes = getMapNodes();
    const sig = [viewport.scale, viewport.offsetX, viewport.offsetY, rect.width, rect.height, state.player.currentSector, state.selectedSectorId, ids.length, mapProjectionSignature].join(',');
    if (sig === mapOverviewLastSig) return;
    mapOverviewLastSig = sig;
    const ctx = canvas.getContext("2d");
    const overviewRect = prepareMapCanvas(canvas, ctx);
    ctx.clearRect(0, 0, overviewRect.width, overviewRect.height);
    ctx.fillStyle = "rgba(5, 11, 16, 0.92)";
    ctx.fillRect(0, 0, overviewRect.width, overviewRect.height);
    ctx.strokeStyle = "rgba(0, 204, 153, 0.45)";
    ctx.strokeRect(0.5, 0.5, overviewRect.width - 1, overviewRect.height - 1);

    if (ids.length === 0) return;
    const padding = 10;
    const scaleX = (overviewRect.width - padding * 2) / MAP_LOGICAL_WIDTH;
    const scaleY = (overviewRect.height - padding * 2) / MAP_LOGICAL_HEIGHT;
    const toOverview = node => ({
        x: padding + node.x * scaleX,
        y: padding + node.y * scaleY
    });

    ids.forEach(id => {
        const rawNode = rawNodes[id];
        if (!rawNode) return;
        const overviewNode = toOverview(rawNode);
        ctx.fillStyle = "rgba(180, 220, 255, 0.72)";
        if (id === state.player.currentSector) ctx.fillStyle = "#00ff88";
        if (id === state.selectedSectorId) ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(overviewNode.x, overviewNode.y, id === state.player.currentSector ? 3 : 2, 0, Math.PI * 2);
        ctx.fill();
    });

    const viewLeft = (-viewport.offsetX / viewport.scale) * scaleX + padding;
    const viewTop = (-viewport.offsetY / viewport.scale) * scaleY + padding;
    const viewWidth = (rect.width / viewport.scale) * scaleX;
    const viewHeight = (rect.height / viewport.scale) * scaleY;
    ctx.strokeStyle = "rgba(255, 209, 102, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(viewLeft, viewTop, viewWidth, viewHeight);
}

export function renderMapOverlay() {
    renderMapToolbar();
    renderMapHelp();
}

export function drawMap() {
    const canvas = document.getElementById("map");
    if (!canvas) return;
    const { universe, planets, ports, player, selectedSectorId, starField, hoveredSectorId } = state;
    const layers = getMapLayers();
    const ctx = canvas.getContext("2d");
    const viewport = getViewport();
    const rect = prepareMapCanvas(canvas, ctx);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = MAP_BACKGROUND;
    ctx.fillRect(0, 0, rect.width, rect.height);
    const twinkleTime = mapAnimationTime || Date.now();
    const starfieldWidth = Math.max(1, rect.width);
    const starfieldHeight = Math.max(1, rect.height);
    starField.forEach(star => {
        const depth = Number.isInteger(star.depth) ? star.depth : 0;
        const rate = MAP_STAR_DEPTH_RATES[depth] || MAP_STAR_DEPTH_RATES[0];
        const normalizedX = (star.x / MAP_LOGICAL_WIDTH) * starfieldWidth;
        const normalizedY = (star.y / MAP_LOGICAL_HEIGHT) * starfieldHeight;
        const x = ((normalizedX + viewport.offsetX * rate) % starfieldWidth + starfieldWidth) % starfieldWidth;
        const y = ((normalizedY + viewport.offsetY * rate) % starfieldHeight + starfieldHeight) % starfieldHeight;
        const pulse = 0.12 * Math.sin(twinkleTime / 900 + (star.twinkle || 0));
        ctx.globalAlpha = Math.max(0.25, Math.min(0.95, (star.alpha || 0.7) + pulse));
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x, y, star.size, star.size);
    });
    ctx.globalAlpha = 1;
    const nodes = getMapNodes();
    const screenNodes = {};
    Object.entries(nodes).forEach(([id, node]) => {
        screenNodes[id] = transformNode(node, {});
    });
    const ids = getVisibleIds();
    if (layers.tradeRoutes) {
        ctx.strokeStyle = "rgba(0, 204, 153, 0.45)";
        ctx.lineWidth = MAP_UI.LINKS.WIDTH;
        ids.forEach(id => {
            getSectorNeighbors(id).forEach(target => {
                if (id < target && screenNodes[target]) {
                    ctx.beginPath();
                    ctx.moveTo(screenNodes[id].x, screenNodes[id].y);
                    ctx.lineTo(screenNodes[target].x, screenNodes[target].y);
                    ctx.stroke();
                }
            });
        });
    }
    const nodeScale = viewport.scale < 1 ? MAP_ZOOMED_OUT_NODE_SCALE : 1;
    const nodeRadius = MAP_UI.NODES.RADIUS * nodeScale;
    const selectedRadius = MAP_UI.NODES.SELECTED_RADIUS * nodeScale;
    const freshnessBySector = new Map(ids.map(id => [id, getFreshnessSummaryForSector(id)]));
    ids.forEach(id => {
        const node = screenNodes[id];
        let fill = layers.systems ? "#8888ff" : "rgba(120, 140, 160, 0.35)";
        if (layers.asteroids && universe[id].asteroids) fill = "#cccccc";
        if (layers.systems && planets[id]) fill = "#44aaff";
        if (layers.systems && ports[id]) fill = "#ffaa00";
        if (layers.contestedZones && universe[id].pirateThreat > 0 && id !== player.currentSector) fill = "#ff4444";
        if (id === player.currentSector) fill = "#00ff88";
        const selected = id === selectedSectorId;
        const hovered = id === hoveredSectorId;
        if (hovered) {
            ctx.shadowColor = fill;
            ctx.shadowBlur = 15;
            ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(node.x, node.y, selectedRadius + 3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
        if (selected) {
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = MAP_UI.SELECTION.STROKE_WIDTH;
            ctx.beginPath();
            ctx.arc(node.x, node.y, selectedRadius, 0, Math.PI * 2);
            ctx.stroke();
        }
        const freshness = freshnessBySector.get(id) || { label: "unknown" };
        if (layers.dataFreshness) {
            ctx.strokeStyle = getMapFreshnessColor(freshness.label);
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(node.x, node.y, nodeRadius + 4, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);
        ctx.fill();
        if (layers.systems) {
            ctx.fillStyle = "#001122";
            ctx.font = MAP_UI.LABELS.ID_FONT;
            ctx.fillText(String(id), node.x + MAP_UI.LABELS.ID_OFFSET_X, node.y + MAP_UI.LABELS.ID_OFFSET_Y);
        }
        const faction = FACTIONS[getSectorFactionId(id)];
        if (layers.influence && faction) {
            ctx.fillStyle = faction.color;
            ctx.font = MAP_UI.LABELS.FACTION_FONT;
            ctx.fillText(faction.icon, node.x + MAP_UI.LABELS.FACTION_OFFSET_X, node.y + MAP_UI.LABELS.FACTION_OFFSET_Y);
        }
        const polity = universe[id].localAuthority ? state.polities?.[universe[id].localAuthority.polityId] : null;
        if (layers.influence && polity) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
            ctx.font = "9px monospace";
            ctx.fillText(polity.name.split(" ").map(part => part[0]).join("").slice(0, 3), node.x - nodeRadius - 6, node.y + nodeRadius + 12);
        }
        if (layers.dataFreshness) {
            ctx.fillStyle = getMapFreshnessColor(freshness.label);
            ctx.font = "10px monospace";
            const freshnessMarker = freshness.label === "current" ? "●" : (freshness.label || "unknown").charAt(0).toUpperCase();
            ctx.fillText(freshnessMarker, node.x - nodeRadius - 7, node.y - nodeRadius - 5);
        }
        const localCaptains = getCaptainsInSector(id, true);
        if (localCaptains.length > 0) {
            ctx.fillStyle = "#ffffff";
            ctx.font = MAP_UI.LABELS.CAPTAIN_FONT;
            ctx.fillText("C" + localCaptains.length, node.x + MAP_UI.LABELS.CAPTAIN_OFFSET_X, node.y + MAP_UI.LABELS.CAPTAIN_OFFSET_Y);
        }
    });
    drawMapOverview(ids, rect);
    if (starField.length > 0) scheduleMapAnimationFrame();
}

export function setupMapInteraction() {
    const canvas = document.getElementById("map");
    if (!canvas) return () => {};

    const existingUnsubscribe = mapInteractionUnsubscribers.get(canvas);
    if (existingUnsubscribe) return existingUnsubscribe;

    let dragging = false;
    let dragMoved = false;
    let dragMode = null;
    let lastPointer = null;

    const handleMapClick = event => {
        if (dragMoved) return;
        const pointer = getPointerCanvasPosition(canvas, event);
        const hit = findNearestSectorAt(pointer.x, pointer.y);
        if (!hit) return;
        const slices = selectSector(hit.id);
        if (slices) Renderer.sliceChanged(...slices);
    };

    const handleMapMove = event => {
        const pointer = getPointerCanvasPosition(canvas, event);
        if (dragging && lastPointer) {
            const dx = pointer.x - lastPointer.x;
            const dy = pointer.y - lastPointer.y;
            if (Math.abs(dx) + Math.abs(dy) > 1) dragMoved = true;
            if (dragMode === "orbit") {
                const camera = getMapCamera();
                camera.yaw += dx * MAP_CAMERA_YAW_SENSITIVITY;
                camera.pitch = Math.max(
                    MAP_CAMERA_PITCH_MIN_RADIANS,
                    Math.min(MAP_CAMERA_PITCH_MAX_RADIANS, camera.pitch - dy * MAP_CAMERA_PITCH_SENSITIVITY)
                );
            } else if (dragMode === "pan") {
                const viewport = getViewport();
                viewport.offsetX += dx;
                viewport.offsetY += dy;
            }
            lastPointer = pointer;
            Renderer.invalidate("map");
            return;
        }
        const sectorHit = findNearestSectorAt(pointer.x, pointer.y);
        const nextHoveredId = sectorHit ? sectorHit.id : null;
        if (state.hoveredSectorId !== nextHoveredId) {
            state.hoveredSectorId = nextHoveredId;
            Renderer.invalidate("map");
        }
        if (sectorHit) {
            showMapTooltip(sectorTooltipHtml(sectorHit.id), pointer);
            return;
        }
        const corridor = findNearestCorridorAt(pointer.x, pointer.y);
        if (corridor) {
            showMapTooltip(corridorTooltipHtml(corridor), pointer);
            return;
        }
        hideMapTooltip();
    };

    const handleMapLeave = () => {
        dragging = false;
        dragMode = null;
        lastPointer = null;
        if (state.hoveredSectorId !== null) {
            state.hoveredSectorId = null;
            Renderer.invalidate("map");
        }
        hideMapTooltip();
    };

    const handleMouseDown = event => {
        if (event.button === MOUSE_BUTTON_RIGHT) {
            event.preventDefault();
            return;
        }
        if (event.button !== MOUSE_BUTTON_LEFT && event.button !== MOUSE_BUTTON_MIDDLE) {
            return;
        }
        dragMode = event.button === MOUSE_BUTTON_MIDDLE ? "orbit" : "pan";
        event.preventDefault();
        dragging = true;
        dragMoved = false;
        lastPointer = getPointerCanvasPosition(canvas, event);
        canvas.classList.add("panning");
    };

    const handleMouseUp = () => {
        dragging = false;
        dragMode = null;
        lastPointer = null;
        canvas.classList.remove("panning");
    };

    const handleContextMenu = event => event.preventDefault();

    const handleWheel = event => {
        event.preventDefault();
        const pointer = getPointerCanvasPosition(canvas, event);
        const viewport = getViewport();
        const oldScale = viewport.scale;
        const zoom = event.deltaY < 0 ? 1.12 : 0.88;
        const newScale = Math.max(MAP_VIEWPORT_MIN_SCALE, Math.min(MAP_VIEWPORT_MAX_SCALE, oldScale * zoom));
        if (newScale === oldScale) return;
        const worldX = (pointer.x - viewport.offsetX) / oldScale;
        const worldY = (pointer.y - viewport.offsetY) / oldScale;
        viewport.scale = newScale;
        viewport.offsetX = pointer.x - worldX * newScale;
        viewport.offsetY = pointer.y - worldY * newScale;
        Renderer.invalidate("map");
    };

    canvas.dataset.bound = "1";
    const handleToolbarClick = event => {
        const layerButton = event.target.closest("[data-map-layer]");
        if (layerButton) {
            toggleMapLayer(layerButton.dataset.mapLayer);
            return;
        }
        if (event.target.closest("#btn-center-map")) {
            centerMapOnSector();
            return;
        }
        if (event.target.closest("#btn-fit-map")) {
            resetMapView();
            return;
        }
        if (event.target.closest("#btn-expand-map")) {
            toggleMapExpanded();
            return;
        }
        if (event.target.closest("#btn-collapse-map")) {
            state.mapPanelMode = state.mapPanelMode === "rail" ? "full" : "rail";
            applyMapPanelMode();
            Renderer.invalidate("map");
            return;
        }
        if (event.target.closest("#btn-toggle-map-layers")) {
            toggleMapLayerPanel();
            return;
        }
        if (event.target.closest("#btn-map-help") || event.target.closest("#btn-close-map-help")) {
            toggleMapHelp();
        }
    };

    canvas.addEventListener("click", handleMapClick);
    canvas.addEventListener("mousemove", handleMapMove);
    canvas.addEventListener("mouseleave", handleMapLeave);
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("contextmenu", handleContextMenu);
    globalThis.addEventListener("mouseup", handleMouseUp);
    const handleDoubleClick = () => centerMapOnSector();
    const toolbar = document.getElementById("mapToolbar");
    const shortcutHelp = document.getElementById("mapShortcutHelp");
    const railToggle = document.getElementById("mapRailToggle");
    const handleRailClick = () => {
        state.mapPanelMode = "full";
        applyMapPanelMode();
        Renderer.invalidate("map");
    };
    const handleResize = () => Renderer.invalidate("map");
    const handleKeyDown = event => {
        const target = event.target;
        const tagName = target?.tagName || "";
        if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || target?.isContentEditable) return;
        if (event.key === "Escape") {
            if (state.mapHelpOpen) {
                setMapHelpOpen(false);
                return;
            }
            setMapExpanded(false);
            return;
        }
        if (event.key === "?") {
            event.preventDefault();
            toggleMapHelp();
            return;
        }
        if (event.key.toLowerCase() === "f") {
            event.preventDefault();
            resetMapView();
            return;
        }
        if (event.key.toLowerCase() === "l") {
            event.preventDefault();
            toggleMapLayerPanel();
            return;
        }
        if (["1", "2", "3", "4", "5", "6", "7"].includes(event.key)) {
            const buttons = Array.from(document.querySelectorAll("#actionHotbar .action-hotbar-button:not(:disabled)"));
            const button = buttons[Number(event.key) - 1];
            if (button) {
                event.preventDefault();
                button.click();
            }
        }
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("dblclick", handleDoubleClick);
    toolbar?.addEventListener("click", handleToolbarClick);
    shortcutHelp?.addEventListener("click", handleToolbarClick);
    railToggle?.addEventListener("click", handleRailClick);
    globalThis.addEventListener("resize", handleResize);
    globalThis.addEventListener("keydown", handleKeyDown);

    const unsubscribe = () => {
        canvas.removeEventListener("click", handleMapClick);
        canvas.removeEventListener("mousemove", handleMapMove);
        canvas.removeEventListener("mouseleave", handleMapLeave);
        canvas.removeEventListener("mousedown", handleMouseDown);
        canvas.removeEventListener("contextmenu", handleContextMenu);
        globalThis.removeEventListener("mouseup", handleMouseUp);
        canvas.removeEventListener("wheel", handleWheel);
        canvas.removeEventListener("dblclick", handleDoubleClick);
        toolbar?.removeEventListener("click", handleToolbarClick);
        shortcutHelp?.removeEventListener("click", handleToolbarClick);
        railToggle?.removeEventListener("click", handleRailClick);
        globalThis.removeEventListener("resize", handleResize);
        globalThis.removeEventListener("keydown", handleKeyDown);
        setMapExpanded(false);
        delete canvas.dataset.bound;
        mapInteractionUnsubscribers.delete(canvas);
        hideMapTooltip();
    };
    applyMapPanelMode();
    mapInteractionUnsubscribers.set(canvas, unsubscribe);
    return unsubscribe;
}

export function selectSector(sectorId) {
    if (!state.universe[sectorId]) return false;
    state.selectedSectorId = sectorId;
    return stateChanged(StateSlice.SELECTED_SECTOR);
}
