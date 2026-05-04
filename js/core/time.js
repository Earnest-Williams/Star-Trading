import { state } from '../state.js';
import { BALANCE } from '../constants.js';
import { EventBus } from '../events.js';
import { log } from '../utils.js';

const dailyHooks = [];
const hourlyHooks = [];

export function registerDailyHook(fn) { dailyHooks.push(fn); }
export function registerHourlyHook(fn) { hourlyHooks.push(fn); }

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
    if (startAbsolute % 60 === 0) {
        boundary = startAbsolute + 60;
    } else {
        boundary = Math.ceil(startAbsolute / 60) * 60;
    }
    while (boundary <= endAbsolute) {
        setTimeFromAbsoluteMinute(boundary);
        if (state.player.time.minuteOfDay === 0) {
            runDailyWorldTick(reason);
        } else {
            runHourlyWorldTick(reason);
        }
        boundary += 60;
    }
    setTimeFromAbsoluteMinute(endAbsolute);
    EventBus.emit("time_advanced");
}
