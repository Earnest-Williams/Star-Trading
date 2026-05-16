import { state } from "../state.js";
import { MARKET_COMMODITIES, PORT_TYPES } from "../constants.js";
import { getSectorNeighbors } from "../core/navigation.js";
import { buildLogisticsSnapshot } from "../systems/tradeRoutes.js";
import { escapeHtml, formatCommodity, formatCredits } from "../utils.js";

const MAX_NEXT_ACTIONS = 4;

function hasCargoToSell(port) {
    if (!port) return false;
    const type = PORT_TYPES[port.typeKey];
    if (!type) return false;
    return MARKET_COMMODITIES.some(commodity => {
        const holdAmount = state.player?.cargo?.[commodity] || 0;
        return holdAmount > 0 && type.buys.includes(commodity);
    });
}

function hasGoodsToBuy(port) {
    if (!port) return false;
    const type = PORT_TYPES[port.typeKey];
    if (!type) return false;
    return MARKET_COMMODITIES.some(commodity => {
        const stock = port.stock?.[commodity] || 0;
        return stock > 0 && type.sells.includes(commodity);
    });
}

function getVisibleMissionCount(sectorId) {
    return state.missions.filter(mission => (
        mission.status === "available" && mission.originSector === sectorId
    )).length;
}

function findRouteSuggestion() {
    const snapshot = buildLogisticsSnapshot(state.player.currentSector);
    if (!snapshot.origin || snapshot.availableRouteOptions.length === 0) return null;
    const candidate = snapshot.availableRouteOptions[0];
    const option = candidate.commodities[0];
    if (!option) return null;
    return {
        title: "Create a standing trade route",
        text: `${candidate.destination.name} can use ${formatCommodity(option.commodity)}. Opening this route turns market knowledge into recurring logistics income.`,
        actionLabel: "Open logistics",
        action: "showScreen",
        args: ["logistics"],
        meta: `${candidate.hopCount} corridors · setup ${formatCredits(candidate.setupCost)}`
    };
}

function makeActionButton(suggestion) {
    if (!suggestion.action) return "";
    const args = (suggestion.args || []).map((arg, index) => (
        ` data-arg${index}="${escapeHtml(String(arg))}"`
    )).join("");
    return `<button data-action="${escapeHtml(suggestion.action)}"${args}>${escapeHtml(suggestion.actionLabel)}</button>`;
}

export function buildNextActionSuggestions() {
    if (!state.player) return [];

    const sectorId = state.player.currentSector;
    const port = state.ports[sectorId] || null;
    const neighbors = getSectorNeighbors(sectorId);
    const suggestions = [];

    if (state.selectedSectorId !== sectorId) {
        suggestions.push({
            title: "Inspect your current site",
            text: "Pin your current sector before acting so the map inspector explains local gates, authorities, risk, and services.",
            actionLabel: "Select current sector",
            action: "selectSector",
            args: [sectorId],
            meta: `Current sector ${sectorId}`
        });
    } else if (neighbors.length > 0) {
        suggestions.push({
            title: "Scout a direct jump corridor",
            text: "Move one hop to learn how corridor travel changes markets, missions, faction pressure, and local threats.",
            actionLabel: `Jump to sector ${neighbors[0]}`,
            action: "moveTo",
            args: [neighbors[0]],
            meta: `${neighbors.length} reachable corridors`
        });
    }

    if (port && hasGoodsToBuy(port)) {
        suggestions.push({
            title: "Check the market spread",
            text: "Ports buy and sell different goods. Buy surplus here, then look for a port or colony that needs it.",
            actionLabel: "Open market",
            action: "showScreen",
            args: ["market"],
            meta: `${PORT_TYPES[port.typeKey]?.name || "Port"} available`
        });
    } else if (port && hasCargoToSell(port)) {
        suggestions.push({
            title: "Sell cargo into demand",
            text: "This port buys at least one commodity in your hold. Selling frees hold space and reveals practical price signals.",
            actionLabel: "Open market",
            action: "showScreen",
            args: ["market"],
            meta: "Cargo sale available"
        });
    }

    const missionCount = getVisibleMissionCount(sectorId);
    if (missionCount > 0) {
        suggestions.push({
            title: "Take a local contract",
            text: "Contracts give a concrete destination and reward, making the first few jumps less ambiguous.",
            actionLabel: "Open missions",
            action: "showScreen",
            args: ["missions"],
            meta: `${missionCount} postings here`
        });
    }

    if (state.tradeRoutes.filter(route => route.status !== "closed").length === 0) {
        const routeSuggestion = findRouteSuggestion();
        if (routeSuggestion) suggestions.push(routeSuggestion);
    }

    if (suggestions.length < MAX_NEXT_ACTIONS && state.currentScreen !== "communications") {
        suggestions.push({
            title: "Review operational messages",
            text: "Comms collects intel, data cargo, secure courier work, and NPC dialogue so simulation events stay legible.",
            actionLabel: "Open comms",
            action: "showCommunications",
            args: [],
            meta: "Discoverability"
        });
    }

    return suggestions.slice(0, MAX_NEXT_ACTIONS);
}

export function renderNextStepsPanel() {
    const target = document.getElementById("nextStepsList");
    if (!target) return;
    const suggestions = buildNextActionSuggestions();
    if (suggestions.length === 0) {
        target.innerHTML = `<div class="small muted">Start a galaxy to get tactical suggestions.</div>`;
        return;
    }
    target.innerHTML = suggestions.map(suggestion => `
        <div class="next-step-item">
            <strong>${escapeHtml(suggestion.title)}</strong>
            <div class="small">${escapeHtml(suggestion.text)}</div>
            ${suggestion.meta ? `<div class="small muted">${escapeHtml(suggestion.meta)}</div>` : ""}
            ${makeActionButton(suggestion)}
        </div>
    `).join("");
}
