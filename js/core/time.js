import { state } from '../state.js';
import { BALANCE, MINUTES_PER_HOUR } from '../constants.js';
import { EventBus } from '../events.js';
import { log } from '../utils.js';


const dailyHooks = [];
const hourlyHooks = [];

function unregisterHook(hooks, fn) {
    const idx = hooks.indexOf(fn);
    if (idx !== -1) hooks.splice(idx, 1);
}

export function registerDailyHook(fn) {
    dailyHooks.push(fn);
    return function unregisterDailyHook() {
        unregisterHook(dailyHooks, fn);
    };
}

export function registerHourlyHook(fn) {
    hourlyHooks.push(fn);
    return function unregisterHourlyHook() {
        unregisterHook(hourlyHooks, fn);
    };
}

export function unregisterDailyHook(fn) { unregisterHook(dailyHooks, fn); }
export function unregisterHourlyHook(fn) { unregisterHook(hourlyHooks, fn); }
export function clearDailyHooks() { dailyHooks.length = 0; }
export function clearHourlyHooks() { hourlyHooks.length = 0; }
export function resetTimeHooks() {
    clearDailyHooks();
    clearHourlyHooks();
}

export function runDailyWorldTick(reason) {
    for (const hook of dailyHooks) hook(reason);
}

export function runHourlyWorldTick(reason) {
    for (const hook of hourlyHooks) hook(reason);
}

export function getAbsoluteMinute() {
    return (state.player.time.day - 1) * BALANCE.DAY_MINUTES + state.player.time.minuteOfDay;
}

export function setTimeFromAbsoluteMinute(absoluteMinute) {
    state.player.time.day = Math.floor(absoluteMinute / BALANCE.DAY_MINUTES) + 1;
    state.player.time.minuteOfDay = absoluteMinute % BALANCE.DAY_MINUTES;
}

export function canSpendTime(minutes) {
    if (state.player.time.minuteOfDay < state.player.time.wakeMinute || state.player.time.minuteOfDay >= state.player.time.sleepMinute) {
        log("Your useful day is over. Rest until morning before taking another action.");
        return false;
    }
    if (state.player.time.minuteOfDay + minutes > state.player.time.sleepMinute) {
        log("There is not enough useful time left today. Rest until morning or choose a shorter action.");
        return false;
    }
    return true;
}

export function spendTime(minutes, reason = "player action") {
    if (!canSpendTime(minutes)) return false;
    advanceTime(minutes, reason);
    return true;
}

export function advanceTime(minutes, reason = "time passes") {
    if (minutes <= 0) return;
    const startAbsolute = getAbsoluteMinute();
    const endAbsolute = startAbsolute + minutes;
    let boundary;
    if (startAbsolute % MINUTES_PER_HOUR === 0) {
        boundary = startAbsolute + MINUTES_PER_HOUR;
    } else {
        boundary = Math.ceil(startAbsolute / MINUTES_PER_HOUR) * MINUTES_PER_HOUR;
    }
    while (boundary <= endAbsolute) {
        setTimeFromAbsoluteMinute(boundary);
        if (state.player.time.minuteOfDay === 0) {
            runDailyWorldTick(reason);
        } else {
            runHourlyWorldTick(reason);
        }
        boundary += MINUTES_PER_HOUR;
    }
    setTimeFromAbsoluteMinute(endAbsolute);
    EventBus.emit("time_advanced");
}
