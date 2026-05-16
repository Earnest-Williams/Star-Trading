import { BALANCE } from '../constants.js';
import { state } from '../state.js';

const DEFAULT_TRACE_LIMIT = 160;

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value, fallback = '') {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function asNullableString(value) {
    const text = asString(value, '');
    return text.length > 0 ? text : null;
}

function asInteger(value, fallback) {
    if (value === null || typeof value === 'undefined') return fallback;
    const number = Number(value);
    return Number.isInteger(number) ? number : fallback;
}

function asPositiveInteger(value, fallback) {
    const number = asInteger(value, fallback);
    return Number.isInteger(number) && number > 0 ? number : fallback;
}

function asNullableInteger(value) {
    const number = asInteger(value, null);
    return Number.isInteger(number) ? number : null;
}

function traceLimit() {
    return asPositiveInteger(BALANCE.SIMULATION_TRACE_LIMIT, DEFAULT_TRACE_LIMIT);
}

function currentTimestamp() {
    const day = asInteger(state.player?.time?.day, 1);
    const minuteOfDay = asInteger(state.player?.time?.minuteOfDay, 0);
    const absoluteMinute = ((day - 1) * BALANCE.DAY_MINUTES) + minuteOfDay;
    return { day, minuteOfDay, absoluteMinute };
}

function timestampMinuteOfDay(timestamp, fallback = 0) {
    if (!isObject(timestamp)) return fallback;
    const explicitMinute = asInteger(timestamp.minuteOfDay ?? timestamp.minute, null);
    if (Number.isInteger(explicitMinute)) return explicitMinute;
    const absoluteMinute = asInteger(timestamp.absoluteMinute, null);
    if (Number.isInteger(absoluteMinute)) return absoluteMinute % BALANCE.DAY_MINUTES;
    return fallback;
}

function timestampDay(timestamp, fallback = 1) {
    if (!isObject(timestamp)) return fallback;
    const explicitDay = asInteger(timestamp.day, null);
    if (Number.isInteger(explicitDay)) return explicitDay;
    const absoluteMinute = asInteger(timestamp.absoluteMinute, null);
    if (Number.isInteger(absoluteMinute)) {
        return Math.floor(absoluteMinute / BALANCE.DAY_MINUTES) + 1;
    }
    return fallback;
}

function absoluteMinuteFor(event) {
    const timestamp = isObject(event?.timestamp) ? event.timestamp : {};
    const day = asInteger(event?.day, timestampDay(timestamp));
    const minute = asInteger(
        event?.minute ?? event?.minuteOfDay,
        timestampMinuteOfDay(timestamp)
    );
    return ((day - 1) * BALANCE.DAY_MINUTES) + minute;
}

export function compareSimulationTraceEvents(a, b) {
    const minuteDiff = absoluteMinuteFor(a) - absoluteMinuteFor(b);
    if (minuteDiff !== 0) return minuteDiff;
    return asInteger(a?.id, 0) - asInteger(b?.id, 0);
}

function nextNumericIdForTrace(records) {
    return records.reduce((maxId, record) => {
        const id = asInteger(record?.id, 0);
        return Math.max(maxId, id);
    }, 0) + 1;
}

export function ensureSimulationTraceStorage(target = state) {
    if (!Array.isArray(target.simulationTrace)) target.simulationTrace = [];
    if (!Number.isInteger(target.nextSimulationTraceId) || target.nextSimulationTraceId < 1) {
        target.nextSimulationTraceId = nextNumericIdForTrace(target.simulationTrace);
    }
}

function normaliseCause(cause) {
    if (!isObject(cause)) return null;
    const traceId = asNullableInteger(cause.traceId);
    const eventId = asNullableInteger(
        cause.eventId
            ?? cause.worldEventId
            ?? cause.dialogueEventId
            ?? cause.captainEventId
            ?? (traceId === null ? cause.id : null)
    );
    const sourceSystem = asNullableString(cause.sourceSystem);
    const eventType = asNullableString(cause.eventType ?? cause.type);
    const label = asNullableString(cause.label ?? cause.summary ?? cause.text);
    const reference = {
        traceId,
        sourceSystem,
        eventType,
        eventId,
        label
    };
    if (
        reference.traceId === null
        && reference.sourceSystem === null
        && reference.eventType === null
        && reference.eventId === null
        && reference.label === null
    ) {
        return null;
    }
    return reference;
}

export function normaliseSimulationTraceCauses(causedBy) {
    if (Array.isArray(causedBy)) return causedBy.map(normaliseCause).filter(Boolean);
    const cause = normaliseCause(causedBy);
    return cause ? [cause] : [];
}

function takeNextId() {
    ensureSimulationTraceStorage();
    const id = state.nextSimulationTraceId;
    state.nextSimulationTraceId += 1;
    return id;
}

export function normaliseSimulationTraceEvent(event, fallbackId = 1) {
    const timestamp = isObject(event?.timestamp) ? event.timestamp : {};
    const day = asInteger(event?.day, timestampDay(timestamp));
    const minute = asInteger(
        event?.minute ?? event?.minuteOfDay,
        timestampMinuteOfDay(timestamp)
    );
    return {
        id: asPositiveInteger(event?.id, fallbackId),
        eventType: asString(event?.eventType ?? event?.type, 'simulation_event'),
        sourceSystem: asString(event?.sourceSystem, 'simulation'),
        day,
        minute,
        actor: asNullableString(event?.actor),
        subject: asNullableString(event?.subject),
        sectorId: asNullableInteger(event?.sectorId),
        factionId: asNullableString(event?.factionId),
        captainId: asNullableString(event?.captainId),
        routeId: asNullableInteger(event?.routeId),
        missionId: asNullableInteger(event?.missionId),
        conversationId: asNullableString(event?.conversationId),
        partId: asNullableInteger(event?.partId),
        worldEventId: asNullableInteger(event?.worldEventId),
        dialogueEventId: asNullableInteger(event?.dialogueEventId),
        causedBy: normaliseSimulationTraceCauses(event?.causedBy),
        summary: isObject(event?.summary) ? event.summary : {},
        payload: isObject(event?.payload) ? event.payload : {}
    };
}

export function normaliseSimulationTrace(target = state) {
    ensureSimulationTraceStorage(target);
    const normalisedTrace = target.simulationTrace
        .filter(isObject)
        .map((event, index) => normaliseSimulationTraceEvent(event, index + 1))
        .sort(compareSimulationTraceEvents);
    const nextId = nextNumericIdForTrace(normalisedTrace);
    target.simulationTrace = normalisedTrace.slice(-traceLimit());
    if (!Number.isInteger(target.nextSimulationTraceId) || target.nextSimulationTraceId < nextId) {
        target.nextSimulationTraceId = nextId;
    }
}

export function addSimulationTraceEvent({
    eventType,
    sourceSystem = 'simulation',
    actor = null,
    subject = null,
    sectorId = null,
    factionId = null,
    captainId = null,
    routeId = null,
    missionId = null,
    conversationId = null,
    partId = null,
    worldEventId = null,
    dialogueEventId = null,
    causedBy = [],
    summary = {},
    payload = {},
    timestamp = null
} = {}) {
    ensureSimulationTraceStorage();
    const ts = isObject(timestamp) ? timestamp : currentTimestamp();
    const day = timestampDay(ts);
    const minuteOfDay = timestampMinuteOfDay(ts);
    const event = normaliseSimulationTraceEvent({
        id: takeNextId(),
        eventType,
        sourceSystem,
        day,
        minute: minuteOfDay,
        actor,
        subject,
        sectorId,
        factionId,
        captainId,
        routeId,
        missionId,
        conversationId,
        partId,
        worldEventId,
        dialogueEventId,
        causedBy,
        summary,
        payload
    });
    const lastEvent = state.simulationTrace[state.simulationTrace.length - 1];
    if (!lastEvent || compareSimulationTraceEvents(event, lastEvent) >= 0) {
        state.simulationTrace.push(event);
    } else {
        const insertIndex = state.simulationTrace.findIndex(existingEvent => {
            return compareSimulationTraceEvents(event, existingEvent) < 0;
        });
        if (insertIndex === -1) state.simulationTrace.push(event);
        else state.simulationTrace.splice(insertIndex, 0, event);
    }
    if (state.simulationTrace.length > traceLimit()) {
        state.simulationTrace = state.simulationTrace.slice(-traceLimit());
    }
    return event;
}

export function getRecentSimulationTrace(limit = 12) {
    ensureSimulationTraceStorage();
    const safeLimit = Math.max(0, asInteger(limit, 12));
    return state.simulationTrace.slice().sort(compareSimulationTraceEvents).reverse().slice(0, safeLimit);
}

export function getSimulationTraceEvent(traceId) {
    ensureSimulationTraceStorage();
    const safeTraceId = asNullableInteger(traceId);
    if (safeTraceId === null) return null;
    return state.simulationTrace.find(event => event.id === safeTraceId) || null;
}

export function getSimulationTraceCauses(traceId) {
    const event = getSimulationTraceEvent(traceId);
    if (!event) return [];
    return event.causedBy.map(cause => {
        if (cause.traceId !== null) {
            return getSimulationTraceEvent(cause.traceId) || cause;
        }
        return cause;
    });
}

export function getSimulationTraceCausalChain(traceId, visited = new Set()) {
    const event = getSimulationTraceEvent(traceId);
    if (!event || visited.has(event.id)) return [];
    visited.add(event.id);
    const causes = event.causedBy.flatMap(cause => {
        if (cause.traceId === null) return [];
        return getSimulationTraceCausalChain(cause.traceId, visited);
    });
    return [...causes, event];
}
