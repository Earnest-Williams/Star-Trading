// @ts-check
import { BALANCE } from '../config/economy.js';
import { log } from '../utils.js';
import { Notifications } from '../ui/notifications.js';
import { addSimulationTraceEvent, normaliseSimulationTraceCauses } from './simulationTrace.js';
import { appendWorldEvent } from './state/index.js';
import { getPlayerTime } from './state/index.js';
import { state } from '../state.js';

export function addWorldEvent(event) {
    if (!event || !event.text) return;
    const time = getPlayerTime() || { day: 1, minuteOfDay: 0 };
    const causedBy = normaliseSimulationTraceCauses(event.causedBy);
    const worldEvent = {
        id: state.nextWorldEventId++,
        day: time.day, minute: time.minuteOfDay,
        type: event.type || 'news',
        sectorId: event.sectorId || null,
        factionId: event.factionId || null,
        captainId: event.captainId || null,
        routeId: event.routeId || null,
        missionId: event.missionId || null,
        text: event.text,
        importance: event.importance || 1,
        causedBy,
        payload: event.payload || {}
    };
    appendWorldEvent(worldEvent);
    addSimulationTraceEvent({
        eventType: worldEvent.type,
        sourceSystem: event.sourceSystem || 'world',
        actor: event.actor || null,
        subject: event.subject || null,
        sectorId: worldEvent.sectorId,
        factionId: worldEvent.factionId,
        captainId: worldEvent.captainId,
        routeId: worldEvent.routeId,
        missionId: worldEvent.missionId,
        worldEventId: worldEvent.id,
        causedBy: worldEvent.causedBy,
        summary: { text: worldEvent.text, importance: worldEvent.importance },
        payload: event.payload || {},
        timestamp: { day: worldEvent.day, minuteOfDay: worldEvent.minute }
    });
    state.worldEvents = state.worldEvents.slice(0, BALANCE.WORLD_EVENT_LIMIT);
    if (event.alert) {
        log(event.text);
        if (event.importance >= 3) Notifications.show(event.text, event.importance);
    }
    return worldEvent;
}
