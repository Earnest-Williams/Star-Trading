import { state } from "../state.js";
import { FACTIONS } from "../constants.js";
import { getSectorFactionId } from "../core/influence.js";
import { getCaptainsInSector } from "../systems/captains.js";
import { Renderer } from "./renderer.js";
import { getSectorNeighbors } from "../core/navigation.js";
import { MAP_UI } from "../config/ui.js";

const mapInteractionUnsubscribers = new WeakMap();
let mapProjectionHashPrimary = 0;
let mapProjectionHashSecondary = 0;
let mapProjectionVisibleCount = 0;
let mapProjectionUniverseRef = null;
let mapProjectionCache = {};
const MAP_HASH_OFFSET_BASIS = 2166136261;
const MAP_HASH_FNV_PRIME = 16777619;
const MAP_HASH_SECONDARY_PRIME = 2246822519;

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

export function drawMap() {
    const canvas = document.getElementById("map");
    if (!canvas) return;
    const { universe, planets, ports, player, selectedSectorId, starField } = state;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#112233";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    starField.forEach(star => ctx.fillRect(star.x, star.y, star.size, star.size));
    const nodes = getMapNodes();
    const ids = Object.keys(universe).map(Number).filter(id => universe[id].charted || id === player.currentSector);
    ctx.strokeStyle = "rgba(0, 204, 153, 0.45)";
    ctx.lineWidth = MAP_UI.LINKS.WIDTH;
    ids.forEach(id => {
        getSectorNeighbors(id).forEach(target => {
            if (id < target && nodes[target] && universe[target].charted) {
                ctx.beginPath();
                ctx.moveTo(nodes[id].x, nodes[id].y);
                ctx.lineTo(nodes[target].x, nodes[target].y);
                ctx.stroke();
            }
        });
    });
    ids.forEach(id => {
        let fill = "#8888ff";
        if (universe[id].asteroids) fill = "#cccccc";
        if (planets[id]) fill = "#44aaff";
        if (ports[id]) fill = "#ffaa00";
        if (universe[id].pirateThreat > 0 && id !== player.currentSector) fill = "#ff4444";
        if (id === player.currentSector) fill = "#00ff88";
        const selected = id === selectedSectorId;
        if (selected) {
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = MAP_UI.SELECTION.STROKE_WIDTH;
            ctx.beginPath();
            ctx.arc(nodes[id].x, nodes[id].y, MAP_UI.NODES.SELECTED_RADIUS, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(nodes[id].x, nodes[id].y, MAP_UI.NODES.RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#001122";
        ctx.font = MAP_UI.LABELS.ID_FONT;
        ctx.fillText(String(id), nodes[id].x + MAP_UI.LABELS.ID_OFFSET_X, nodes[id].y + MAP_UI.LABELS.ID_OFFSET_Y);
        const faction = FACTIONS[getSectorFactionId(id)];
        if (faction) {
            ctx.fillStyle = faction.color;
            ctx.font = MAP_UI.LABELS.FACTION_FONT;
            ctx.fillText(faction.icon, nodes[id].x + MAP_UI.LABELS.FACTION_OFFSET_X, nodes[id].y + MAP_UI.LABELS.FACTION_OFFSET_Y);
        }
        const localCaptains = getCaptainsInSector(id, true);
        if (localCaptains.length > 0) {
            ctx.fillStyle = "#ffffff";
            ctx.font = MAP_UI.LABELS.CAPTAIN_FONT;
            ctx.fillText("C" + localCaptains.length, nodes[id].x + MAP_UI.LABELS.CAPTAIN_OFFSET_X, nodes[id].y + MAP_UI.LABELS.CAPTAIN_OFFSET_Y);
        }
    });
}

export function setupMapInteraction() {
    const canvas = document.getElementById("map");
    if (!canvas) return () => {};

    const existingUnsubscribe = mapInteractionUnsubscribers.get(canvas);
    if (existingUnsubscribe) return existingUnsubscribe;

    const handleMapClick = event => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;
        const cache = state.mapNodeCache;
        const nodes = Object.keys(cache).length ? cache : getMapNodes();
        let closestId = null, closestDistance = Infinity;
        Object.entries(nodes).forEach(([id, node]) => {
            const dx = node.x - x, dy = node.y - y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < closestDistance) { closestDistance = distance; closestId = Number(id); }
        });
        if (closestId && closestDistance <= MAP_UI.NODES.CLICK_RADIUS) selectSector(closestId);
    };

    canvas.dataset.bound = "1";
    canvas.addEventListener("click", handleMapClick);

    const unsubscribe = () => {
        canvas.removeEventListener("click", handleMapClick);
        delete canvas.dataset.bound;
        mapInteractionUnsubscribers.delete(canvas);
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
