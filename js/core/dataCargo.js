import { state } from '../state.js';
import { MARKET_COMMODITIES } from '../constants.js';
import { EventBus } from '../events.js';
import { getDominantInfluence } from './influence.js';
import { getSectorStatusLabel } from './influence.js';
import { getRouteMarketValue } from '../systems/tradeRoutes.js';

function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function currentDay() {
    return state.player?.time?.day || 0;
}

function emptyDataCargoState() {
    return {
        sectorKnowledge: {},
        playerHold: { publicSnapshots: {} },
        ambientTransfers: []
    };
}

function copyScalars(source) {
    const copy = {};
    if (!isObject(source)) return copy;
    Object.entries(source).forEach(([key, value]) => {
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
            copy[key] = value;
        }
    });
    return copy;
}

function cloneSnapshot(snapshot) {
    return {
        sourceSectorId: Number(snapshot.sourceSectorId),
        observedDay: Number(snapshot.observedDay) || 0,
        deliveredDay: Number(snapshot.deliveredDay) || 0,
        portStock: copyScalars(snapshot.portStock),
        portPrices: {
            buy: copyScalars(snapshot.portPrices?.buy),
            sell: copyScalars(snapshot.portPrices?.sell)
        },
        pirateThreat: Number(snapshot.pirateThreat) || 0,
        factionStatus: copyScalars(snapshot.factionStatus)
    };
}

function isUsableSnapshot(snapshot) {
    return isObject(snapshot) && Number.isFinite(Number(snapshot.sourceSectorId));
}

function ensureSnapshotMap(container) {
    if (!isObject(container.publicSnapshots)) container.publicSnapshots = {};
    Object.entries(container.publicSnapshots).forEach(([key, snapshot]) => {
        if (!isUsableSnapshot(snapshot)) {
            delete container.publicSnapshots[key];
            return;
        }
        const normalised = cloneSnapshot(snapshot);
        container.publicSnapshots[String(normalised.sourceSectorId)] = normalised;
        if (String(normalised.sourceSectorId) !== key) delete container.publicSnapshots[key];
    });
}

function ensureSectorKnowledge(sectorId) {
    normaliseDataCargoState();
    const key = String(Number(sectorId));
    if (!isObject(state.dataCargo.sectorKnowledge[key])) {
        state.dataCargo.sectorKnowledge[key] = { publicSnapshots: {} };
    }
    ensureSnapshotMap(state.dataCargo.sectorKnowledge[key]);
    return state.dataCargo.sectorKnowledge[key];
}

function isNewerSnapshot(incoming, existing) {
    if (!existing) return true;
    if ((incoming.observedDay || 0) !== (existing.observedDay || 0)) {
        return (incoming.observedDay || 0) > (existing.observedDay || 0);
    }
    return (incoming.deliveredDay || 0) > (existing.deliveredDay || 0);
}

function rememberSnapshot(container, snapshot, deliveredDay) {
    const copy = cloneSnapshot(snapshot);
    copy.deliveredDay = deliveredDay;
    const key = String(copy.sourceSectorId);
    const existing = container.publicSnapshots[key];
    if (!isNewerSnapshot(copy, existing)) return false;
    container.publicSnapshots[key] = copy;
    return true;
}

export function normaliseDataCargoState() {
    if (!isObject(state.dataCargo)) state.dataCargo = emptyDataCargoState();
    if (!isObject(state.dataCargo.sectorKnowledge)) state.dataCargo.sectorKnowledge = {};
    if (!isObject(state.dataCargo.playerHold)) state.dataCargo.playerHold = { publicSnapshots: {} };
    ensureSnapshotMap(state.dataCargo.playerHold);
    Object.entries(state.dataCargo.sectorKnowledge).forEach(([sectorId, knowledge]) => {
        if (!Number.isFinite(Number(sectorId)) || !isObject(knowledge)) {
            delete state.dataCargo.sectorKnowledge[sectorId];
            return;
        }
        ensureSnapshotMap(knowledge);
    });
    if (!Array.isArray(state.dataCargo.ambientTransfers)) state.dataCargo.ambientTransfers = [];
}

export function buildSectorPublicSnapshot(sectorId) {
    normaliseDataCargoState();
    const sourceSectorId = Number(sectorId);
    const sector = state.universe?.[sourceSectorId] || {};
    const port = state.ports?.[sourceSectorId] || null;
    const portStock = {};
    const portPrices = { buy: {}, sell: {} };
    if (port) {
        MARKET_COMMODITIES.forEach(commodity => {
            portStock[commodity] = Number(port.stock?.[commodity]) || 0;
            portPrices.buy[commodity] = getRouteMarketValue(sourceSectorId, commodity, "buy");
            portPrices.sell[commodity] = getRouteMarketValue(sourceSectorId, commodity, "sell");
        });
    }
    return {
        sourceSectorId,
        observedDay: currentDay(),
        deliveredDay: currentDay(),
        portStock,
        portPrices,
        pirateThreat: Number(sector.pirateThreat) || 0,
        factionStatus: {
            dominantFactionId: getDominantInfluence(sourceSectorId),
            status: getSectorStatusLabel(sourceSectorId)
        }
    };
}

export function carryPublicSnapshotForPlayer(originSectorId) {
    normaliseDataCargoState();
    const hold = state.dataCargo.playerHold;
    let carriedCount = 0;
    if (rememberSnapshot(hold, buildSectorPublicSnapshot(originSectorId), currentDay())) {
        carriedCount += 1;
    }
    const originKnowledge = ensureSectorKnowledge(originSectorId);
    Object.values(originKnowledge.publicSnapshots).forEach(snapshot => {
        if (rememberSnapshot(hold, snapshot, currentDay())) carriedCount += 1;
    });
    return { carriedCount };
}

export function mergePublicSnapshotsOnArrival(destinationSectorId) {
    normaliseDataCargoState();
    const destination = ensureSectorKnowledge(destinationSectorId);
    let mergedCount = 0;
    Object.values(state.dataCargo.playerHold.publicSnapshots).forEach(snapshot => {
        if (rememberSnapshot(destination, snapshot, currentDay())) mergedCount += 1;
    });
    if (rememberSnapshot(destination, buildSectorPublicSnapshot(destinationSectorId), currentDay())) {
        mergedCount += 1;
    }
    if (mergedCount > 0) {
        EventBus.emit("data_cargo_changed", { sectorId: Number(destinationSectorId), mergedCount });
    }
    return { mergedCount };
}

function propagateRouteSnapshots(originSectorId, destinationSectorId, transfers) {
    const originKnowledge = ensureSectorKnowledge(originSectorId);
    const destinationKnowledge = ensureSectorKnowledge(destinationSectorId);
    const originSnapshot = buildSectorPublicSnapshot(originSectorId);
    const destinationSnapshot = buildSectorPublicSnapshot(destinationSectorId);
    const originMerged = rememberSnapshot(destinationKnowledge, originSnapshot, currentDay());
    const destinationMerged = rememberSnapshot(originKnowledge, destinationSnapshot, currentDay());
    if (!originMerged && !destinationMerged) return 0;
    transfers.push({
        day: currentDay(),
        originSectorId: Number(originSectorId),
        destinationSectorId: Number(destinationSectorId),
        ambientFlows: Number(state.ambientTrade?.flows) || 0
    });
    return Number(originMerged) + Number(destinationMerged);
}

export function runAmbientDataPropagationDaily() {
    normaliseDataCargoState();
    const transfers = [];
    let mergedCount = 0;
    (state.tradeRoutes || []).forEach(route => {
        if (route.status !== "active") return;
        mergedCount += propagateRouteSnapshots(route.originSector, route.destinationSector, transfers);
    });
    if (transfers.length > 0) {
        state.dataCargo.ambientTransfers = state.dataCargo.ambientTransfers.concat(transfers).slice(-50);
        EventBus.emit("data_cargo_changed", { mergedCount, ambientTransfers: transfers.length });
    }
    return { mergedCount, transferCount: transfers.length };
}

export function getSectorDataFreshness(sectorId, nowDay = state.player.time.day) {
    normaliseDataCargoState();
    const key = String(Number(sectorId));
    const snapshots = state.dataCargo.sectorKnowledge[key]?.publicSnapshots || {};
    const localSnapshot = snapshots[key];
    const externalSnapshots = Object.values(snapshots).filter(snapshot => String(snapshot.sourceSectorId) !== key);
    const ages = externalSnapshots.map(snapshot => Math.max(0, nowDay - (snapshot.observedDay || 0)));
    return {
        localDataCurrent: Number(sectorId) === state.player?.currentSector || localSnapshot?.observedDay === nowDay,
        knownExternalSnapshots: externalSnapshots.length,
        oldestAgeDays: ages.length > 0 ? Math.max(...ages) : null,
        newestAgeDays: ages.length > 0 ? Math.min(...ages) : null
    };
}
