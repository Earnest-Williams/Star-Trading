import { state } from "../state.js";
import { FACTIONS, PLANET_TYPES, PORT_TYPES } from "../constants.js";
import { getSectorFactionId, getSectorStatusLabel } from "../core/influence.js";
import { getCaptainsInSector } from "../systems/captains.js";
import { Renderer } from "./renderer.js";
import { getDirectCorridor, getSectorNeighbors } from "../core/navigation.js";
import { MAP_UI } from "../config/ui.js";
import { getSiteTypeLabel } from "../core/universe.js";
import { getFreshnessSummaryForSector } from "../core/dataCargo.js";
import { escapeHtml } from "../utils.js";

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
let mapAnimationFrameId = 0;
let mapAnimationTime = 0;

export function invalidateMapProjectionCache() {
    mapProjectionSignature = '';
    mapProjectionUniverseRef = null;
    mapProjectionCache = {};
    state.mapNodeCache = {};
}

function projectedCoord(site, sectorId, target = {}) {
    const { x = sectorId, y = 0, z = 0 } = site.coord ?? {};
    target.x = x - z * MAP_UI.PROJECTION.Z_TO_X;
    target.y = y + z * MAP_UI.PROJECTION.Z_TO_Y;
    return target;
}

function getVisibleMapSectorIds(universe) {
    return Object.keys(universe)
        .map(Number)
        .filter(id => universe[id].charted || id === state.player.currentSector);
}

export function getMapNodes() {
    const universe = state.universe;
    const ids = getVisibleMapSectorIds(universe);
    const sig = ids.join(',');
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

function sectorTooltipHtml(id) {
    const { universe, ports, planets, tradeRoutes } = state;
    const sector = universe[id];
    if (!sector) return "";
    const dominant = FACTIONS[getSectorFactionId(id)];
    const routeCount = tradeRoutes.filter(r => r.status !== "closed" && (r.originSector === id || r.destinationSector === id)).length;
    const chips = [];
    if (sector.coord) chips.push(`(${sector.coord.x}, ${sector.coord.y}, ${sector.coord.z})`);
    chips.push(getSiteTypeLabel(sector.siteType));
    chips.push(sector.region);
    chips.push(getSectorStatusLabel(id));
    if (dominant) chips.push(`${dominant.icon} ${dominant.short}`);
    if (ports[id]) chips.push(`Port: ${PORT_TYPES[ports[id].typeKey].name}`);
    if (planets[id]) chips.push(`Planet: ${PLANET_TYPES[planets[id].typeKey].name}`);
    if (sector.asteroids) chips.push("Asteroids");
    if (sector.pirateThreat > 0) chips.push(`Pirates ${sector.pirateThreat}`);
    if (routeCount > 0) chips.push(`Routes ${routeCount}`);
    const freshness = getFreshnessSummaryForSector(id);
    chips.push(formatFreshnessTooltip(freshness));
    return `<strong>Site ${id}</strong> ${escapeHtml(sector.name || "Unknown")}<br>${chips.map(chip => `<span class="sector-chip">${escapeHtml(chip)}</span>`).join("")}`;
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
        expandButton.setAttribute("aria-label", expanded ? "Collapse map" : "Expand map");
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
    state.hoveredSectorId = null;
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

export function drawMap() {
    const canvas = document.getElementById("map");
    if (!canvas) return;
    const { universe, planets, ports, player, selectedSectorId, starField, hoveredSectorId } = state;
    const ctx = canvas.getContext("2d");
    const viewport = getViewport();
    const rect = prepareMapCanvas(canvas, ctx);
    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.fillStyle = MAP_BACKGROUND;
    ctx.fillRect(0, 0, rect.width, rect.height);
    const twinkleTime = mapAnimationTime || Date.now();
    starField.forEach(star => {
        const depth = Number.isInteger(star.depth) ? star.depth : 0;
        const rate = MAP_STAR_DEPTH_RATES[depth] || MAP_STAR_DEPTH_RATES[0];
        const x = ((star.x + viewport.offsetX * rate) % MAP_LOGICAL_WIDTH + MAP_LOGICAL_WIDTH) % MAP_LOGICAL_WIDTH;
        const y = ((star.y + viewport.offsetY * rate) % MAP_LOGICAL_HEIGHT + MAP_LOGICAL_HEIGHT) % MAP_LOGICAL_HEIGHT;
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
    const nodeScale = viewport.scale < 1 ? MAP_ZOOMED_OUT_NODE_SCALE : 1;
    const nodeRadius = MAP_UI.NODES.RADIUS * nodeScale;
    const selectedRadius = MAP_UI.NODES.SELECTED_RADIUS * nodeScale;
    const freshnessBySector = new Map(ids.map(id => [id, getFreshnessSummaryForSector(id)]));
    ids.forEach(id => {
        const node = screenNodes[id];
        let fill = "#8888ff";
        if (universe[id].asteroids) fill = "#cccccc";
        if (planets[id]) fill = "#44aaff";
        if (ports[id]) fill = "#ffaa00";
        if (universe[id].pirateThreat > 0 && id !== player.currentSector) fill = "#ff4444";
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
        ctx.strokeStyle = getMapFreshnessColor(freshness.label);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeRadius + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#001122";
        ctx.font = MAP_UI.LABELS.ID_FONT;
        ctx.fillText(String(id), node.x + MAP_UI.LABELS.ID_OFFSET_X, node.y + MAP_UI.LABELS.ID_OFFSET_Y);
        const faction = FACTIONS[getSectorFactionId(id)];
        if (faction) {
            ctx.fillStyle = faction.color;
            ctx.font = MAP_UI.LABELS.FACTION_FONT;
            ctx.fillText(faction.icon, node.x + MAP_UI.LABELS.FACTION_OFFSET_X, node.y + MAP_UI.LABELS.FACTION_OFFSET_Y);
        }
        ctx.fillStyle = getMapFreshnessColor(freshness.label);
        ctx.font = "10px monospace";
        const freshnessMarker = freshness.label === "current" ? "●" : (freshness.label || "unknown").charAt(0).toUpperCase();
        ctx.fillText(freshnessMarker, node.x - nodeRadius - 7, node.y - nodeRadius - 5);
        const localCaptains = getCaptainsInSector(id, true);
        if (localCaptains.length > 0) {
            ctx.fillStyle = "#ffffff";
            ctx.font = MAP_UI.LABELS.CAPTAIN_FONT;
            ctx.fillText("C" + localCaptains.length, node.x + MAP_UI.LABELS.CAPTAIN_OFFSET_X, node.y + MAP_UI.LABELS.CAPTAIN_OFFSET_Y);
        }
    });
    if (starField.length > 0) scheduleMapAnimationFrame();
}

export function setupMapInteraction() {
    const canvas = document.getElementById("map");
    if (!canvas) return () => {};

    const existingUnsubscribe = mapInteractionUnsubscribers.get(canvas);
    if (existingUnsubscribe) return existingUnsubscribe;

    let dragging = false;
    let dragMoved = false;
    let lastPointer = null;

    const handleMapClick = event => {
        if (dragMoved) return;
        const pointer = getPointerCanvasPosition(canvas, event);
        const hit = findNearestSectorAt(pointer.x, pointer.y);
        if (hit) selectSector(hit.id);
    };

    const handleMapMove = event => {
        const pointer = getPointerCanvasPosition(canvas, event);
        if (dragging && lastPointer) {
            const viewport = getViewport();
            const dx = pointer.x - lastPointer.x;
            const dy = pointer.y - lastPointer.y;
            if (Math.abs(dx) + Math.abs(dy) > 1) dragMoved = true;
            viewport.offsetX += dx;
            viewport.offsetY += dy;
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
        lastPointer = null;
        if (state.hoveredSectorId !== null) {
            state.hoveredSectorId = null;
            Renderer.invalidate("map");
        }
        hideMapTooltip();
    };

    const handleMouseDown = event => {
        dragging = true;
        dragMoved = false;
        lastPointer = getPointerCanvasPosition(canvas, event);
        canvas.classList.add("panning");
    };

    const handleMouseUp = () => {
        dragging = false;
        lastPointer = null;
        canvas.classList.remove("panning");
    };

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
    canvas.addEventListener("click", handleMapClick);
    canvas.addEventListener("mousemove", handleMapMove);
    canvas.addEventListener("mouseleave", handleMapLeave);
    canvas.addEventListener("mousedown", handleMouseDown);
    globalThis.addEventListener("mouseup", handleMouseUp);
    const handleDoubleClick = () => centerMapOnSector();
    const expandButton = document.getElementById("btn-expand-map");
    const handleExpandClick = () => toggleMapExpanded();
    const handleResize = () => Renderer.invalidate("map");
    const handleKeyDown = event => {
        if (event.key === "Escape") setMapExpanded(false);
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("dblclick", handleDoubleClick);
    expandButton?.addEventListener("click", handleExpandClick);
    globalThis.addEventListener("resize", handleResize);
    globalThis.addEventListener("keydown", handleKeyDown);

    const unsubscribe = () => {
        canvas.removeEventListener("click", handleMapClick);
        canvas.removeEventListener("mousemove", handleMapMove);
        canvas.removeEventListener("mouseleave", handleMapLeave);
        canvas.removeEventListener("mousedown", handleMouseDown);
        globalThis.removeEventListener("mouseup", handleMouseUp);
        canvas.removeEventListener("wheel", handleWheel);
        canvas.removeEventListener("dblclick", handleDoubleClick);
        expandButton?.removeEventListener("click", handleExpandClick);
        globalThis.removeEventListener("resize", handleResize);
        globalThis.removeEventListener("keydown", handleKeyDown);
        setMapExpanded(false);
        delete canvas.dataset.bound;
        mapInteractionUnsubscribers.delete(canvas);
        hideMapTooltip();
    };
    mapInteractionUnsubscribers.set(canvas, unsubscribe);
    return unsubscribe;
}

export function selectSector(sectorId) {
    if (!state.universe[sectorId]) return;
    state.selectedSectorId = sectorId;
    Renderer.invalidate("mapInspector");
    Renderer.invalidate("map");
}
