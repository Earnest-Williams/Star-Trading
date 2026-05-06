import { state } from "../state.js";
import { FACTIONS, PORT_TYPES, PLANET_TYPES } from "../constants.js";
import { getSectorFactionId } from "../core/influence.js";
import { getCaptainsInSector } from "../systems/captains.js";
import { Renderer } from "./renderer.js";
import { getSectorNeighbors } from "../core/navigation.js";

export function getMapNodes() {
    const universe = state.universe;
    const nodes = {};
    const ids = Object.keys(universe).map(Number);
    const angleStep = (2 * Math.PI) / ids.length;
    ids.forEach((id, idx) => {
        const radiusX = universe[id].region === "Core" ? 155 : universe[id].region === "Frontier" ? 220 : 280;
        const radiusY = universe[id].region === "Core" ? 105 : universe[id].region === "Frontier" ? 150 : 185;
        const x = 350 + Math.cos(idx * angleStep - Math.PI / 2) * radiusX;
        const y = 210 + Math.sin(idx * angleStep - Math.PI / 2) * radiusY;
        nodes[id] = { x, y };
    });
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
    const ids = Object.keys(universe).map(Number);
    ctx.strokeStyle = "rgba(0, 204, 153, 0.45)";
    ctx.lineWidth = 1;
    ids.forEach(id => {
        getSectorNeighbors(id).forEach(target => {
            if (id < target && nodes[target]) {
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
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(nodes[id].x, nodes[id].y, 17, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(nodes[id].x, nodes[id].y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#001122";
        ctx.font = "13px VT323";
        ctx.fillText(String(id), nodes[id].x - 6, nodes[id].y + 4);
        const faction = FACTIONS[getSectorFactionId(id)];
        if (faction) {
            ctx.fillStyle = faction.color;
            ctx.font = "14px VT323";
            ctx.fillText(faction.icon, nodes[id].x + 9, nodes[id].y - 9);
        }
        const localCaptains = getCaptainsInSector(id, true);
        if (localCaptains.length > 0) {
            ctx.fillStyle = "#ffffff";
            ctx.font = "13px VT323";
            ctx.fillText("C" + localCaptains.length, nodes[id].x - 18, nodes[id].y - 12);
        }
    });
}

export function setupMapInteraction() {
    const canvas = document.getElementById("map");
    if (!canvas || canvas.dataset.bound === "1") return;
    canvas.dataset.bound = "1";
    canvas.addEventListener("click", event => {
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
        if (closestId && closestDistance <= 24) selectSector(closestId);
    });
}

export function selectSector(sectorId) {
    if (!state.universe[sectorId]) return;
    state.selectedSectorId = sectorId;
    Renderer.invalidate("mapInspector");
    Renderer.invalidate("map");
}
