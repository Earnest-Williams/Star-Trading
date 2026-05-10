import { state } from '../../state.js';
import { BALANCE, MARKET_COMMODITIES } from '../../constants.js';
import { EventBus } from '../../events.js';
import { getDominantInfluence } from '../influence.js';
import { getSectorStatusLabel } from '../influence.js';
import { getRouteMarketValue } from '../../systems/tradeRoutes.js';
import { random, log } from '../../utils.js';
import { addFactionRep, addFactionTrust } from '../factions.js';
import { addWorldEvent } from '../worldEvents.js';
import { Notifications } from '../../ui/notifications.js';

function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function currentDay() {
    return state.player?.time?.day || 0;
}

function emptyDataCargoState() {
    return {
        sectorKnowledge: {},
        playerHold: { publicSnapshots: {}, privatePayloads: [], securePayloads: [] },
        secureContracts: [],
        ambientTransfers: [],
        nextPayloadId: 1,
        license: { secureCourier: false, issuedByFactionId: null, issuedDay: null }
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
    if (!isObject(state.dataCargo.playerHold)) {
        state.dataCargo.playerHold = { publicSnapshots: {}, privatePayloads: [], securePayloads: [] };
    }
    ensureSnapshotMap(state.dataCargo.playerHold);
    if (!Number.isFinite(Number(state.dataCargo.nextPayloadId))) state.dataCargo.nextPayloadId = 1;
    if (!Array.isArray(state.dataCargo.playerHold.privatePayloads)) {
        state.dataCargo.playerHold.privatePayloads = [];
    }
    state.dataCargo.playerHold.privatePayloads = state.dataCargo.playerHold.privatePayloads
        .filter(isObject)
        .map(normalisePrivatePayload);
    if (!Array.isArray(state.dataCargo.playerHold.securePayloads)) {
        state.dataCargo.playerHold.securePayloads = [];
    }
    state.dataCargo.playerHold.securePayloads = state.dataCargo.playerHold.securePayloads
        .filter(isObject)
        .map(payload => normaliseSecurePayload(payload));
    if (!Array.isArray(state.dataCargo.secureContracts)) state.dataCargo.secureContracts = [];
    state.dataCargo.secureContracts = state.dataCargo.secureContracts
        .filter(isObject)
        .map(contract => normaliseSecureContract(contract));
    if (!isObject(state.dataCargo.license)) state.dataCargo.license = {};
    state.dataCargo.license = {
        secureCourier: state.dataCargo.license.secureCourier === true,
        issuedByFactionId: state.dataCargo.license.issuedByFactionId || null,
        issuedDay: Number.isFinite(Number(state.dataCargo.license.issuedDay))
            && state.dataCargo.license.issuedDay !== null
            ? Number(state.dataCargo.license.issuedDay) : null
    };
    Object.entries(state.dataCargo.sectorKnowledge).forEach(([sectorId, knowledge]) => {
        if (!Number.isFinite(Number(sectorId)) || !isObject(knowledge)) {
            delete state.dataCargo.sectorKnowledge[sectorId];
            return;
        }
        ensureSnapshotMap(knowledge);
    });
    if (!Array.isArray(state.dataCargo.ambientTransfers)) state.dataCargo.ambientTransfers = [];
}

function normaliseSecureContract(contract) {
    const originSectorId = Number(contract.originSectorId || contract.sourceSectorId || state.player?.currentSector || 1);
    const destinationSectorId = Number(contract.destinationSectorId || contract.targetSectorId || state.player?.currentSector || originSectorId);
    const createdDay = Number(contract.createdDay || contract.acquiredDay || currentDay());
    const status = ['available', 'accepted', 'failed'].includes(contract.status) ? contract.status : 'available';
    return {
        id: String(contract.id || `secure-${state.dataCargo.nextPayloadId++}`),
        tier: 'secure',
        type: String(contract.type || 'diplomatic_packet'),
        originSectorId,
        destinationSectorId,
        factionId: contract.factionId || state.ports?.[originSectorId]?.factionId || null,
        targetFactionId: contract.targetFactionId || state.ports?.[destinationSectorId]?.factionId || null,
        createdDay,
        expiresDay: Number(contract.expiresDay || createdDay + BALANCE.DATA_CARGO.SECURE_DEFAULT_EXPIRY_DAYS),
        value: Math.max(1, Math.round(Number(contract.value) || BALANCE.DATA_CARGO.SECURE_BASE_VALUE)),
        risk: Math.max(1, Math.min(5, Math.round(Number(contract.risk) || 1))),
        status,
        text: String(contract.text || `Sealed courier packet bound for S${destinationSectorId}.`)
    };
}

function normaliseSecurePayload(payload) {
    return {
        ...normaliseSecureContract({ ...payload, status: payload.status || 'accepted' }),
        acquiredDay: Number(payload.acquiredDay || payload.createdDay || currentDay()),
        status: ['accepted', 'failed'].includes(payload.status) ? payload.status : 'accepted'
    };
}

function normalisePrivatePayload(payload) {
    const id = payload.id || `private-${state.dataCargo.nextPayloadId++}`;
    const sourceSectorId = Number(payload.sourceSectorId || state.player?.currentSector || 1);
    const targetSectorId = Number(payload.targetSectorId || state.player?.currentSector || sourceSectorId);
    const acquiredDay = Number(payload.acquiredDay || currentDay());
    return {
        id: String(id),
        tier: "private",
        type: payload.type || "manifest",
        sourceSectorId,
        targetSectorId,
        factionId: payload.factionId || state.ports?.[sourceSectorId]?.factionId || null,
        targetFactionId: payload.targetFactionId || state.ports?.[targetSectorId]?.factionId || null,
        acquiredDay,
        expiresDay: Number(payload.expiresDay || acquiredDay + BALANCE.DATA_CARGO.PRIVATE_DEFAULT_EXPIRY_DAYS),
        value: Math.max(1, Math.round(Number(payload.value) || BALANCE.DATA_CARGO.PRIVATE_BASE_VALUE)),
        text: String(payload.text || `Private intel from S${sourceSectorId} bound for S${targetSectorId}.`)
    };
}

function takePrivatePayload(payloadId) {
    normaliseDataCargoState();
    const id = String(payloadId);
    const payloads = state.dataCargo.playerHold.privatePayloads;
    const index = payloads.findIndex(payload => payload.id === id);
    if (index < 0) return null;
    const [payload] = payloads.splice(index, 1);
    EventBus.emit("data_cargo_changed", { privatePayloads: payloads.length });
    return payload;
}

export function createPrivatePayload(payload = {}) {
    normaliseDataCargoState();
    const id = payload.id || `private-${state.dataCargo.nextPayloadId++}`;
    return normalisePrivatePayload({ ...payload, id });
}

export function addPrivatePayloadToPlayerHold(payload) {
    normaliseDataCargoState();
    const privatePayload = createPrivatePayload(payload);
    state.dataCargo.playerHold.privatePayloads.push(privatePayload);
    addWorldEvent({
        type: "private_payload_acquired",
        sectorId: privatePayload.sourceSectorId,
        text: `Acquired private intel: ${privatePayload.text}`,
        importance: 1,
        alert: false
    });
    EventBus.emit("data_cargo_changed", { privatePayloads: state.dataCargo.playerHold.privatePayloads.length });
    return privatePayload;
}

export function getActivePrivatePayloads() {
    normaliseDataCargoState();
    const today = currentDay();
    return state.dataCargo.playerHold.privatePayloads
        .filter(payload => payload.expiresDay >= today)
        .slice()
        .sort((a, b) => a.expiresDay - b.expiresDay || a.id.localeCompare(b.id));
}

export function expirePrivatePayloads() {
    normaliseDataCargoState();
    const today = currentDay();
    const before = state.dataCargo.playerHold.privatePayloads.length;
    state.dataCargo.playerHold.privatePayloads = state.dataCargo.playerHold.privatePayloads
        .filter(payload => payload.expiresDay >= today);
    const expiredCount = before - state.dataCargo.playerHold.privatePayloads.length;
    if (expiredCount > 0) {
        addWorldEvent({
            type: "private_payload_expired",
            text: `${expiredCount} private intel payload${expiredCount === 1 ? "" : "s"} expired in your data hold.`,
            importance: 1,
            alert: false
        });
        EventBus.emit("data_cargo_changed", { expiredCount });
    }
    return { expiredCount };
}

export function sellPrivatePayload(payloadId, factionId = "traders") {
    const payload = takePrivatePayload(payloadId);
    if (!payload) return false;
    const buyerFactionId = String(factionId || "traders");
    state.player.credits = (Number(state.player.credits) || 0) + payload.value;
    addFactionRep(buyerFactionId, Math.max(1, Math.floor(payload.value / 25)), "sold private intel", "private");
    addFactionTrust(buyerFactionId, 1, "sold private intel");
    addWorldEvent({
        type: "private_payload_sold",
        sectorId: state.player.currentSector,
        factionId: buyerFactionId,
        text: `Sold private intel for ${payload.value} credits: ${payload.text}`,
        importance: 1,
        alert: false
    });
    log(`Sold private intel for ${payload.value} credits.`);
    Notifications.show(`Private intel sold: +${payload.value} credits`, 1);
    return true;
}

export function releasePrivatePayload(payloadId) {
    const payload = takePrivatePayload(payloadId);
    if (!payload) return false;
    const currentSectorId = Number(state.player.currentSector);
    const localKnowledge = ensureSectorKnowledge(currentSectorId);
    const publicSnapshot = buildSectorPublicSnapshot(payload.sourceSectorId);
    publicSnapshot.observedDay = payload.acquiredDay;
    const merged = rememberSnapshot(localKnowledge, publicSnapshot, currentDay());
    addWorldEvent({
        type: "private_payload_released",
        sectorId: currentSectorId,
        factionId: payload.targetFactionId || null,
        text: `Released private intel in S${currentSectorId}: ${payload.text}`,
        importance: 1,
        alert: false
    });
    log(`Released private intel into S${currentSectorId} public knowledge.`);
    Notifications.show("Private intel released", 1);
    return { merged };
}

export function discardPrivatePayload(payloadId) {
    const payload = takePrivatePayload(payloadId);
    if (!payload) return false;
    addWorldEvent({
        type: "private_payload_discarded",
        sectorId: state.player.currentSector,
        text: `Discarded private intel: ${payload.text}`,
        importance: 1,
        alert: false
    });
    return true;
}

function getPayloadTypeText(type) {
    if (type === "contract_tip") return "A quiet contract tip";
    if (type === "shortage_report") return "A suppressed shortage report";
    if (type === "faction_note") return "A faction back-channel note";
    return "A delayed cargo manifest";
}

export function maybeGeneratePrivatePayloadOnArrival(sectorId) {
    normaliseDataCargoState();
    const currentSectorId = Number(sectorId);
    if (!state.ports?.[currentSectorId]) return null;
    if (state.dataCargo.playerHold.privatePayloads.length >= BALANCE.DATA_CARGO.PRIVATE_MAX_PLAYER_PAYLOADS) return null;
    if (random() > 0.12) return null;
    const neighbors = Object.values(state.universe || {})
        .map(sector => Number(sector.id))
        .filter(id => id && id !== currentSectorId);
    const targetSectorId = neighbors.length > 0
        ? neighbors[Math.floor(random() * neighbors.length)]
        : currentSectorId;
    const types = ["manifest", "contract_tip", "shortage_report", "faction_note"];
    const type = types[Math.floor(random() * types.length)];
    const sourcePort = state.ports[currentSectorId];
    const targetPort = state.ports[targetSectorId] || {};
    const value = BALANCE.DATA_CARGO.PRIVATE_BASE_VALUE
        + Math.floor(random() * 26)
        + Math.max(0, Number(state.universe?.[targetSectorId]?.pirateThreat) || 0);
    const payload = addPrivatePayloadToPlayerHold({
        type,
        sourceSectorId: currentSectorId,
        targetSectorId,
        factionId: sourcePort.factionId || sourcePort.publicFactionId || null,
        targetFactionId: targetPort.factionId || targetPort.publicFactionId || null,
        acquiredDay: currentDay(),
        expiresDay: currentDay() + BALANCE.DATA_CARGO.PRIVATE_DEFAULT_EXPIRY_DAYS + Math.floor(random() * 2),
        value,
        text: `${getPayloadTypeText(type)} from S${currentSectorId} suggests exploitable conditions in S${targetSectorId}.`
    });
    log(`Acquired private intel payload: ${payload.text}`);
    Notifications.show("Private intel acquired", 1);
    return payload;
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
    if (carriedCount > 0) {
        EventBus.emit("data_cargo_changed", { reason: "public_snapshot_carried", carriedCount });
    }
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
    const culledCount = cullOldPublicSnapshots(destinationSectorId);
    if (mergedCount > 0 || culledCount > 0) {
        EventBus.emit("data_cargo_changed", { reason: "public_snapshot_merge", sectorId: Number(destinationSectorId), mergedCount, culledCount });
    }
    return { mergedCount, culledCount };
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
    const culledCount = 0;
    if (transfers.length > 0) {
        state.dataCargo.ambientTransfers = state.dataCargo.ambientTransfers.concat(transfers).slice(-50);
        EventBus.emit("data_cargo_changed", { mergedCount, ambientTransfers: transfers.length, culledCount });
    }
    return { mergedCount, transferCount: transfers.length, culledCount };
}


export function cullOldPublicSnapshots(onlySectorId = null) {
    normaliseDataCargoState();
    const maxSnapshots = BALANCE.DATA_CARGO.PUBLIC_MAX_SNAPSHOTS_PER_SECTOR;
    let culledCount = 0;
    const targetEntries = onlySectorId !== null
        ? [[String(Number(onlySectorId)), state.dataCargo.sectorKnowledge[String(Number(onlySectorId))]]]
        : Object.entries(state.dataCargo.sectorKnowledge);
    targetEntries.forEach(([sectorId, knowledge]) => {
        const snapshots = knowledge.publicSnapshots || {};
        const entries = Object.entries(snapshots);
        if (entries.length <= maxSnapshots) return;
        const localKey = String(Number(sectorId));
        const keep = new Set();
        if (snapshots[localKey]) keep.add(localKey);
        entries
            .filter(([key]) => key !== localKey)
            .sort(([, a], [, b]) => (Number(b.deliveredDay) || 0) - (Number(a.deliveredDay) || 0)
                || (Number(b.observedDay) || 0) - (Number(a.observedDay) || 0)
                || Number(b.sourceSectorId) - Number(a.sourceSectorId))
            .slice(0, Math.max(0, maxSnapshots - keep.size))
            .forEach(([key]) => keep.add(key));
        entries.forEach(([key]) => {
            if (keep.has(key)) return;
            delete snapshots[key];
            culledCount += 1;
        });
    });
    return culledCount;
}

export function getCurrentSectorKnowledge() {
    const sectorId = Number(state.player?.currentSector || 0);
    return getKnownPublicSnapshotsForSector(sectorId);
}

export function getKnownPublicSnapshotsForSector(sectorId) {
    const key = String(Number(sectorId));
    const snapshots = state.dataCargo?.sectorKnowledge?.[key]?.publicSnapshots || {};
    return Object.values(snapshots)
        .map(snapshot => cloneSnapshot(snapshot))
        .sort((a, b) => a.sourceSectorId - b.sourceSectorId);
}

export function getPlayerDataHoldSummary() {
    const hold = state.dataCargo?.playerHold || {};
    const privatePayloads = Array.isArray(hold.privatePayloads) ? hold.privatePayloads : [];
    const securePayloads = Array.isArray(hold.securePayloads) ? hold.securePayloads : [];
    return {
        publicSnapshotCount: Object.keys(hold.publicSnapshots || {}).length,
        privatePayloadCount: privatePayloads.length,
        securePayloadCount: securePayloads.length,
        publicSnapshots: Object.values(hold.publicSnapshots || {}).map(snapshot => cloneSnapshot(snapshot)),
        privatePayloads: privatePayloads.slice(),
        securePayloads: securePayloads.slice()
    };
}

export function getPublicSnapshotAge(snapshot, nowDay = state.player?.time?.day || 0) {
    if (!isObject(snapshot)) return null;
    const observedDay = Number(snapshot.observedDay);
    if (!Number.isFinite(observedDay)) return null;
    return Math.max(0, Number(nowDay) - observedDay);
}

export function getFreshnessLabel(age) {
    if (age === null || age === undefined || !Number.isFinite(Number(age))) return "unknown";
    const days = Math.max(0, Number(age));
    if (days < BALANCE.DATA_CARGO.PUBLIC_AGING_AFTER_DAYS) return "fresh";
    if (days < BALANCE.DATA_CARGO.PUBLIC_STALE_AFTER_DAYS) return "aging";
    if (days < BALANCE.DATA_CARGO.PUBLIC_COLD_AFTER_DAYS) return "stale";
    return "cold";
}

export function getFreshnessSummaryForSector(sectorId) {
    const localSectorId = Number(sectorId);
    const currentSectorId = Number(state.player?.currentSector || 0);
    if (localSectorId === currentSectorId) {
        const nowDay = Number(state.player?.time?.day || 0);
        return {
            sectorId: localSectorId,
            label: "current",
            age: 0,
            lastObservedDay: nowDay,
            deliveredDay: nowDay,
            knownFromSectorId: localSectorId,
            snapshot: null,
            liveLocal: true,
            known: true
        };
    }
    const rawSnapshot = state.dataCargo?.sectorKnowledge?.[String(currentSectorId)]?.publicSnapshots?.[String(localSectorId)];
    if (!rawSnapshot) {
        return {
            sectorId: localSectorId,
            label: "unknown",
            age: null,
            lastObservedDay: null,
            deliveredDay: null,
            knownFromSectorId: currentSectorId,
            snapshot: null,
            liveLocal: false,
            known: false
        };
    }
    const snapshot = cloneSnapshot(rawSnapshot);
    const age = getPublicSnapshotAge(snapshot);
    return {
        sectorId: localSectorId,
        label: getFreshnessLabel(age),
        age,
        lastObservedDay: snapshot.observedDay,
        deliveredDay: snapshot.deliveredDay,
        knownFromSectorId: currentSectorId,
        snapshot,
        liveLocal: false,
        known: true
    };
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

export function buildDataCargoDebugSummary() {
    normaliseDataCargoState();
    const currentSectorId = Number(state.player?.currentSector || 0);
    const chartedSectorIds = Object.values(state.universe || {})
        .filter(sector => sector?.charted || sector?.reachable || Number(sector?.id) === currentSectorId)
        .map(sector => Number(sector.id))
        .filter(Number.isFinite);
    const labels = chartedSectorIds.map(sectorId => getFreshnessSummaryForSector(sectorId).label);
    return {
        knownSectors: Object.keys(state.dataCargo.sectorKnowledge).length,
        totalPublicSnapshots: Object.values(state.dataCargo.sectorKnowledge)
            .reduce((total, knowledge) => total + Object.keys(knowledge.publicSnapshots || {}).length, 0),
        carriedPublicSnapshots: Object.keys(state.dataCargo.playerHold.publicSnapshots || {}).length,
        privatePayloads: state.dataCargo.playerHold.privatePayloads.length,
        securePayloads: state.dataCargo.playerHold.securePayloads.length,
        secureContracts: state.dataCargo.secureContracts.length,
        coldSectors: labels.filter(label => label === "cold").length,
        staleSectors: labels.filter(label => label === "stale").length
    };
}
