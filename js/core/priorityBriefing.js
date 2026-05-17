import { MARKET_COMMODITIES, PORT_TYPES } from "../constants.js";
import { buildLogisticsSnapshot } from "../systems/tradeRoutes.js";
import { formatCommodity, formatCredits } from "../utils.js";

const MAX_BRIEFING_ITEMS = 4;
const PIRATE_PRESSURE_THRESHOLD = 50;

export const PRIORITY_SEVERITY = Object.freeze({
    INFO: "info",
    SAFE: "safe",
    CAUTION: "caution",
    URGENT: "urgent"
});

function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function makeBriefingItem({
    id,
    signal,
    title,
    assessment,
    actionLabel,
    action,
    args = [],
    why,
    severity = PRIORITY_SEVERITY.INFO,
    rank = 100
}) {
    return {
        id,
        signal,
        title,
        assessment,
        actionLabel,
        action,
        args,
        why,
        severity,
        rank
    };
}

export function normalisePriorityBriefingState(priorityBriefing) {
    const dismissed = isObject(priorityBriefing?.dismissed)
        ? { ...priorityBriefing.dismissed }
        : {};
    return { dismissed };
}

export function hasCargoToSell(port, cargo = {}) {
    if (!port) return false;
    const type = PORT_TYPES[port.typeKey];
    if (!type) return false;
    return MARKET_COMMODITIES.some(commodity => {
        const holdAmount = cargo?.[commodity] || 0;
        return holdAmount > 0 && type.buys.includes(commodity);
    });
}

export function hasGoodsToBuy(port) {
    if (!port) return false;
    const type = PORT_TYPES[port.typeKey];
    if (!type) return false;
    return MARKET_COMMODITIES.some(commodity => {
        const stock = port.stock?.[commodity] || 0;
        return stock > 0 && type.sells.includes(commodity);
    });
}

export function getVisibleMissionCount(missions, sectorId) {
    return (missions || []).filter(mission => (
        mission.status === "available" && mission.originSector === sectorId
    )).length;
}

export function getSectorNeighborsForState(briefingState, sectorId) {
    const sector = briefingState.universe?.[sectorId];
    if (!sector || !Array.isArray(sector.jumpGates)) return [];
    return sector.jumpGates
        .filter(gate => (
            gate
            && gate.status !== "closed"
            && briefingState.universe?.[gate.destinationSectorId]
        ))
        .map(gate => gate.destinationSectorId)
        .filter((id, index, list) => list.indexOf(id) === index)
        .sort((a, b) => a - b);
}

export function suggestThreatBriefing(briefingState, sector) {
    if (!sector) return null;

    const piratePressure = Number(sector.piratePressure || sector.pirateThreat || 0);
    if (piratePressure < PIRATE_PRESSURE_THRESHOLD) return null;

    return makeBriefingItem({
        id: "pirate-pressure-local",
        signal: "THREAT",
        title: "Pirate pressure elevated",
        assessment: "Local threat conditions may affect travel, contracts, and route safety.",
        actionLabel: "Open Sector",
        action: "showScreen",
        args: ["sector"],
        why: `Pirate pressure ${piratePressure}. Consider scouting safer corridors first.`,
        severity: PRIORITY_SEVERITY.URGENT,
        rank: 5
    });
}

export function suggestCorridorBriefing(briefingState, neighbors) {
    const sectorId = briefingState.player?.currentSector;
    if (!sectorId) return null;

    if (briefingState.selectedSectorId !== sectorId) {
        return makeBriefingItem({
            id: "inspect-current-site",
            signal: "CORRIDOR",
            title: "Current site not pinned",
            assessment: "Pin the current site before committing fuel, cargo, or contracts.",
            actionLabel: "Pin Site",
            action: "selectSector",
            args: [sectorId],
            why: "Inspector data exposes gates, authorities, local risk, and services.",
            severity: PRIORITY_SEVERITY.INFO,
            rank: 10
        });
    }

    if (neighbors.length > 0) {
        return makeBriefingItem({
            id: "scout-direct-corridor",
            signal: "CORRIDOR",
            title: "Direct jump available",
            assessment: "One-hop scouting can reveal nearby prices, contracts, and pressure fronts.",
            actionLabel: `Jump ${neighbors[0]}`,
            action: "moveTo",
            args: [neighbors[0]],
            why: `${neighbors.length} reachable corridor candidates from this site.`,
            severity: PRIORITY_SEVERITY.SAFE,
            rank: 30
        });
    }

    return null;
}

export function suggestMarketBriefing(briefingState, port) {
    if (!port) return null;

    if (hasCargoToSell(port, briefingState.player?.cargo || {})) {
        return makeBriefingItem({
            id: "sell-demand-cargo",
            signal: "MARKET",
            title: "Buyer found for held cargo",
            assessment: "This port buys at least one commodity in your hold.",
            actionLabel: "Open Market",
            action: "showScreen",
            args: ["market"],
            why: "Selling frees hold space and converts scouting into liquidity.",
            severity: PRIORITY_SEVERITY.SAFE,
            rank: 15
        });
    }

    if (hasGoodsToBuy(port)) {
        return makeBriefingItem({
            id: "check-local-surplus",
            signal: "MARKET",
            title: "Local surplus available",
            assessment: "This port has stock that may support a first arbitrage run.",
            actionLabel: "Open Market",
            action: "showScreen",
            args: ["market"],
            why: "Buy surplus here, then use corridor scouting to locate demand.",
            severity: PRIORITY_SEVERITY.INFO,
            rank: 25
        });
    }

    return null;
}

export function suggestContractBriefing(briefingState, sectorId) {
    const missionCount = getVisibleMissionCount(briefingState.missions, sectorId);
    if (missionCount <= 0) return null;

    return makeBriefingItem({
        id: "local-contracts-posted",
        signal: "CONTRACT",
        title: "Local contract postings",
        assessment: `${missionCount} available contract${missionCount === 1 ? "" : "s"} at this site.`,
        actionLabel: "Open Missions",
        action: "showScreen",
        args: ["missions"],
        why: "Contracts give the first route a destination, reward, and risk frame.",
        severity: PRIORITY_SEVERITY.SAFE,
        rank: 20
    });
}

export function suggestLogisticsBriefing(briefingState, logisticsSnapshotBuilder = buildLogisticsSnapshot) {
    const openRoutes = (briefingState.tradeRoutes || [])
        .filter(route => route.status !== "closed");
    if (openRoutes.length > 0) return null;

    const sectorId = briefingState.player?.currentSector;
    if (!sectorId) return null;

    const snapshot = logisticsSnapshotBuilder(sectorId);
    if (!snapshot.origin || snapshot.availableRouteOptions.length === 0) return null;

    const candidate = snapshot.availableRouteOptions[0];
    const option = candidate.commodities[0];
    if (!option) return null;

    return makeBriefingItem({
        id: "standing-route-candidate",
        signal: "LOGISTICS",
        title: "Standing route candidate",
        assessment: `${candidate.destination.name} can use ${formatCommodity(option.commodity)}.`,
        actionLabel: "Open Logistics",
        action: "showScreen",
        args: ["logistics"],
        why: `${candidate.hopCount} corridors. Setup ${formatCredits(candidate.setupCost)}.`,
        severity: PRIORITY_SEVERITY.SAFE,
        rank: 40
    });
}

export function countCommsSignals(briefingState) {
    return [
        ...(briefingState.dialogueMessages || []),
        ...(briefingState.dialogueOffers || []),
        ...(briefingState.dataCargo?.playerHold?.privatePayloads || []),
        ...(briefingState.dataCargo?.secureContracts || [])
    ].length;
}

export function suggestCommsBriefing(briefingState) {
    if (briefingState.currentScreen === "communications") return null;

    const count = countCommsSignals(briefingState);
    return makeBriefingItem({
        id: count > 0 ? "unreviewed-comms" : "open-comms-console",
        signal: "COMMS",
        title: count > 0 ? "Unreviewed operational traffic" : "Comms console idle",
        assessment: count > 0
            ? `${count} comms-linked item${count === 1 ? "" : "s"} need review.`
            : "Comms collects intel, data cargo, courier work, and NPC dialogue.",
        actionLabel: "Open Comms",
        action: "showCommunications",
        args: [],
        why: "Information freshness should be visible before route commitments.",
        severity: count > 0 ? PRIORITY_SEVERITY.CAUTION : PRIORITY_SEVERITY.INFO,
        rank: count > 0 ? 12 : 90
    });
}

export function sortBriefingItems(items) {
    return items
        .filter(Boolean)
        .sort((a, b) => a.rank - b.rank)
        .slice(0, MAX_BRIEFING_ITEMS);
}

export function buildPriorityBriefing(briefingState, options = {}) {
    if (!briefingState.player) return [];

    const sectorId = briefingState.player.currentSector;
    const port = briefingState.ports?.[sectorId] || null;
    const sector = briefingState.universe?.[sectorId] || null;
    const neighbors = options.neighbors || getSectorNeighborsForState(briefingState, sectorId);
    const logisticsSnapshotBuilder = options.logisticsSnapshotBuilder || buildLogisticsSnapshot;
    const dismissed = briefingState.priorityBriefing?.dismissed || {};

    const candidates = [
        suggestThreatBriefing(briefingState, sector),
        suggestCorridorBriefing(briefingState, neighbors),
        suggestMarketBriefing(briefingState, port),
        suggestContractBriefing(briefingState, sectorId),
        suggestLogisticsBriefing(briefingState, logisticsSnapshotBuilder),
        suggestCommsBriefing(briefingState)
    ].filter(item => item && !dismissed[item.id]);

    return sortBriefingItems(candidates);
}
