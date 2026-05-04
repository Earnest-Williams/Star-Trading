import { state } from '../state.js';
import { BALANCE } from '../constants.js';
import { log } from '../utils.js';
import { Notifications } from '../ui/notifications.js';

export function addWorldEvent(event) {
    if (!event || !event.text) return;
    const time = state.player && state.player.time ? state.player.time : { day: 1, minuteOfDay: 0 };
    state.worldEvents.unshift({
        id: state.nextWorldEventId++,
        day: time.day, minute: time.minuteOfDay,
        type: event.type || "news",
        sectorId: event.sectorId || null,
        factionId: event.factionId || null,
        captainId: event.captainId || null,
        text: event.text,
        importance: event.importance || 1
    });
    state.worldEvents = state.worldEvents.slice(0, BALANCE.WORLD_EVENT_LIMIT);
    if (event.alert) {
        log(event.text);
        if (event.importance >= 3) Notifications.show(event.text, event.importance);
    }
}
