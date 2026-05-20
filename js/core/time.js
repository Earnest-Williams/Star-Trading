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

function aggregateTickSummaries(summaries) {
    const changedSlices = new Set();
    let eventCount = 0;
    const warnings = [];
    summaries.forEach(summary => {
        if (!summary || typeof summary !== "object") return;
        if (Array.isArray(summary.changedSlices)) summary.changedSlices.forEach(slice => changedSlices.add(slice));
        eventCount += Number(summary.eventCount) || 0;
        if (Array.isArray(summary.warnings)) warnings.push(...summary.warnings);
    });
    return { changedSlices: Array.from(changedSlices), eventCount, warnings };
}

export function runDailyWorldTick(reason) {
    const summaries = [];
    for (const hook of dailyHooks) summaries.push(hook(reason));
    return aggregateTickSummaries(summaries);
}

export function runHourlyWorldTick(reason) {
    const summaries = [];
    for (const hook of hourlyHooks) summaries.push(hook(reason));
    return aggregateTickSummaries(summaries);
}

export function getAbsoluteMinute() {
    return (state.player.time.day - 1) * BALANCE.DAY_MINUTES + state.player.time.minuteOfDay;
}

export function setTimeFromAbsoluteMinute(absoluteMinute) {
    state.player.time.day = Math.floor(absoluteMinute / BALANCE.DAY_MINUTES) + 1;
    state.player.time.minuteOfDay = absoluteMinute % BALANCE.DAY_MINUTES;
}

export function canSpendTime(minutes) {
    if (!Number.isInteger(minutes) || minutes <= 0) {
        log("Time cost must be a positive integer number of minutes.");
        return false;
    }
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
    if (!Number.isInteger(minutes) || minutes <= 0) return null;
    const startAbsolute = getAbsoluteMinute();
    const endAbsolute = startAbsolute + minutes;
    let boundary;
    if (startAbsolute % MINUTES_PER_HOUR === 0) {
        boundary = startAbsolute + MINUTES_PER_HOUR;
    } else {
        boundary = Math.ceil(startAbsolute / MINUTES_PER_HOUR) * MINUTES_PER_HOUR;
    }
    const summaries = [];
    while (boundary <= endAbsolute) {
        setTimeFromAbsoluteMinute(boundary);
        if (state.player.time.minuteOfDay === 0) {
            summaries.push(runDailyWorldTick(reason));
        } else {
            summaries.push(runHourlyWorldTick(reason));
        }
        boundary += MINUTES_PER_HOUR;
    }
    setTimeFromAbsoluteMinute(endAbsolute);
    const tickSummary = aggregateTickSummaries(summaries);
    EventBus.emit("time_advanced", { tickSummary });
    return tickSummary;
}
