import { state } from "../state.js";
import { FACTIONS, PLANET_TYPES, PORT_TYPES } from "../constants.js";
import { getSectorFactionId, getSectorStatusLabel } from "../core/influence.js";
import { getCaptainsInSector } from "../systems/captains.js";
import { Renderer } from "./renderer.js";
import { getDirectCorridor, getSectorNeighbors } from "../core/navigation.js";
import { MAP_UI } from "../config/ui.js";
import { getSiteTypeLabel } from "../core/universe.js";
import { escapeHtml } from "../utils.js";

const mapInteractionUnsubscribers = new WeakMap();
let mapProjectionHashPrimary = 0;
let mapProjectionHashSecondary = 0;
let mapProjectionVisibleCount = 0;
let mapProjectionUniverseRef = null;
let mapProjectionCache = {};
const MAP_HASH_OFFSET_BASIS = 2166136261;
const MAP_HASH_FNV_PRIME = 16777619;
const MAP_HASH_SECONDARY_PRIME = 2246822519;
const MAP_VIEWPORT_MIN_SCALE = 0.65;
const MAP_VIEWPORT_MAX_SCALE = 2.6;
const MAP_CORRIDOR_HIT_RADIUS = 7;
const MAP_STAR_DEPTH_RATES = [0.08, 0.18, 0.32];
const MAP_TOOLTIP_OFFSET = 14;

export function invalidateMapProjectionCache() {
    mapProjectionHashPrimary = 0;
    mapProjectionHashSecondary = 0;
    mapProjectionVisibleCount = 0;
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

function getMapProjectionSignature(universe, ids) {
    let primary = MAP_HASH_OFFSET_BASIS;
    let secondary = MAP_HASH_FNV_PRIME;
    const projection = { x: 0, y: 0 };
    const hashProjectedValue = value => {
        const scaled = Math.round(value * 1000000);
        const lowBits = scaled | 0;
        const highBits = (scaled / 0x100000000) | 0;
        return (lowBits ^ highBits) >>> 0;
    };
    ids.forEach(id => {
        const site = universe[id];
        const coord = projectedCoord(site, id, projection);
        const charted = site.charted ? 1 : 0;
        const xHash = hashProjectedValue(coord.x);
        const yHash = hashProjectedValue(coord.y);

        primary = Math.imul(primary ^ id, MAP_HASH_FNV_PRIME);
        primary = Math.imul(primary ^ charted, MAP_HASH_FNV_PRIME);
        primary = Math.imul(primary ^ xHash, MAP_HASH_FNV_PRIME);
        primary = Math.imul(primary ^ yHash, MAP_HASH_FNV_PRIME);

        secondary = Math.imul(secondary ^ (Math.imul(id, 2) ^ charted), MAP_HASH_SECONDARY_PRIME);
        secondary = Math.imul(secondary ^ xHash, MAP_HASH_SECONDARY_PRIME);
        secondary = Math.imul(secondary ^ yHash, MAP_HASH_SECONDARY_PRIME);
    });
    return {
        primary: primary >>> 0,
        secondary: secondary >>> 0,
        visibleCount: ids.length
    };
}

export function getMapNodes() {
    const universe = state.universe;
    const ids = getVisibleMapSectorIds(universe);
    const signature = getMapProjectionSignature(universe, ids);
    if (
        mapProjectionUniverseRef === universe
        && signature.primary === mapProjectionHashPrimary
        && signature.secondary === mapProjectionHashSecondary
        && signature.visibleCount === mapProjectionVisibleCount
    ) {
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
    mapProjectionHashPrimary = signature.primary;
    mapProjectionHashSecondary = signature.secondary;
    mapProjectionVisibleCount = signature.visibleCount;
    mapProjectionCache = nodes;
    state.mapNodeCache = nodes;
    return nodes;
}

function getViewport() {
    if (!state.mapViewport) state.mapViewport = { scale: 1, offsetX: 0, offsetY: 0 };
    return state.mapViewport;
}

function transformNode(node, target = {}) {
    const viewport = getViewport();
    target.x = node.x * viewport.scale + viewport.offsetX;
    target.y = node.y * viewport.scale + viewport.offsetY;
    return target;
}

function getPointerCanvasPosition(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY,
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
    return closestId && closestDistance <= MAP_UI.NODES.CLICK_RADIUS
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
    const { universe } = state;
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

export function centerMapOnSector(sectorId = state.player?.currentSector) {
    const canvas = document.getElementById("map");
    const nodes = getMapNodes();
    const node = nodes[sectorId];
    if (!canvas || !node) return;
    const viewport = getViewport();
    viewport.offsetX = canvas.width / 2 - node.x * viewport.scale;
    viewport.offsetY = canvas.height / 2 - node.y * viewport.scale;
    Renderer.invalidate("map");
}

export function drawMap() {
    const canvas = document.getElementById("map");
    if (!canvas) return;
    const { universe, planets, ports, player, selectedSectorId, starField, hoveredSectorId } = state;
    const ctx = canvas.getContext("2d");
    const viewport = getViewport();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#112233";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    starField.forEach(star => {
        const depth = Number.isInteger(star.depth) ? star.depth : 0;
        const rate = MAP_STAR_DEPTH_RATES[depth] || MAP_STAR_DEPTH_RATES[0];
        const x = ((star.x + viewport.offsetX * rate) % canvas.width + canvas.width) % canvas.width;
        const y = ((star.y + viewport.offsetY * rate) % canvas.height + canvas.height) % canvas.height;
        const pulse = 0.12 * Math.sin(Date.now() / 900 + (star.twinkle || 0));
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
            if (id < target && screenNodes[target] && universe[target].charted) {
                ctx.beginPath();
                ctx.moveTo(screenNodes[id].x, screenNodes[id].y);
                ctx.lineTo(screenNodes[target].x, screenNodes[target].y);
                ctx.stroke();
            }
        });
    });
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
            ctx.arc(node.x, node.y, MAP_UI.NODES.SELECTED_RADIUS + 3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
        if (selected) {
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = MAP_UI.SELECTION.STROKE_WIDTH;
            ctx.beginPath();
            ctx.arc(node.x, node.y, MAP_UI.NODES.SELECTED_RADIUS, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(node.x, node.y, MAP_UI.NODES.RADIUS, 0, Math.PI * 2);
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
        const localCaptains = getCaptainsInSector(id, true);
        if (localCaptains.length > 0) {
            ctx.fillStyle = "#ffffff";
            ctx.font = MAP_UI.LABELS.CAPTAIN_FONT;
            ctx.fillText("C" + localCaptains.length, node.x + MAP_UI.LABELS.CAPTAIN_OFFSET_X, node.y + MAP_UI.LABELS.CAPTAIN_OFFSET_Y);
        }
    });
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

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("dblclick", handleDoubleClick);

    const unsubscribe = () => {
        canvas.removeEventListener("click", handleMapClick);
        canvas.removeEventListener("mousemove", handleMapMove);
        canvas.removeEventListener("mouseleave", handleMapLeave);
        canvas.removeEventListener("mousedown", handleMouseDown);
        globalThis.removeEventListener("mouseup", handleMouseUp);
        canvas.removeEventListener("wheel", handleWheel);
        canvas.removeEventListener("dblclick", handleDoubleClick);
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
