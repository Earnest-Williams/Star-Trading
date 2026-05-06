import { state } from './state.js';
import { COMMODITIES, COMMODITY_NAMES } from './constants.js';

/**
 * Mulberry32 seedable PRNG.  Returns a function that produces a uniform
 * float in [0, 1) — a drop-in replacement for Math.random().
 *
 * @param {number} seed  Any 32-bit unsigned integer.
 * @returns {() => number}
 */
export function seededRng(seed) {
    let s = seed >>> 0;
    return function() {
        s |= 0; s = s + 0x6D2B79F5 | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
    };
}

let sessionRng = null;

export function initSessionRng(seed, calls = 0) {
    const safeSeed = Number.isFinite(Number(seed)) ? Number(seed) >>> 0 : Date.now() >>> 0;
    const safeCalls = Math.max(0, Math.floor(Number(calls) || 0));
    sessionRng = seededRng(safeSeed);
    state.rng = { seed: safeSeed, calls: safeCalls };
    for (let i = 0; i < safeCalls; i++) sessionRng();
}

export function restoreSessionRng(rngState, fallbackSeed) {
    if (rngState && Number.isFinite(Number(rngState.seed))) {
        initSessionRng(rngState.seed, rngState.calls);
        return;
    }
    initSessionRng(fallbackSeed);
}

export function random() {
    if (!sessionRng || !state.rng) {
        const seed = state.rng && Number.isFinite(Number(state.rng.seed))
            ? state.rng.seed
            : state.player && state.player.seed;
        const calls = state.rng && Number.isFinite(Number(state.rng.calls)) ? state.rng.calls : 0;
        initSessionRng(seed, calls);
    }
    state.rng.calls += 1;
    return sessionRng();
}

export function escapeHtml(s) {
    if (s === null || s === undefined) return "";
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

export function clampRange(value, min, max) { return Math.max(min, Math.min(max, Math.round(value))); }
export function makeStock(ore, org, eq) { return { ore, org, eq }; }
export function formatCredits(value) { return Math.floor(value).toLocaleString(); }
export function formatCommodity(commodity) { return COMMODITY_NAMES[commodity] || commodity; }
export function formatTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function getCargoUsed() { return COMMODITIES.reduce((sum, c) => sum + state.player.cargo[c], 0); }
export function getFreeHolds() { return Math.max(0, state.player.ship.maxHolds - getCargoUsed()); }

export function hasCargo(cost) {
    if (!cost) return true;
    return COMMODITIES.every(c => (state.player.cargo[c] || 0) >= (cost[c] || 0));
}

export function removeCargo(cost) {
    if (!cost) return;
    COMMODITIES.forEach(c => { state.player.cargo[c] = Math.max(0, (state.player.cargo[c] || 0) - (cost[c] || 0)); });
}

export function addCargo(commodity, amount) {
    const free = getFreeHolds();
    if (free <= 0) { log("No free hold space."); return 0; }
    const actual = Math.min(amount, free);
    state.player.cargo[commodity] = (state.player.cargo[commodity] || 0) + actual;
    return actual;
}

export function describeCargo() {
    return COMMODITIES.map(c => `${formatCommodity(c)} ${state.player.cargo[c]}`).join(" / ");
}

export function describeCost(cost) {
    return COMMODITIES.filter(c => (cost[c] || 0) > 0).map(c => `${cost[c]} ${formatCommodity(c)}`).join(", ") || "none";
}

export function log(msg) {
    const doc = globalThis.document;
    if (!doc || typeof doc.getElementById !== "function" || typeof doc.createElement !== "function") {
        return;
    }
    const logEl = doc.getElementById("log");
    if (!logEl) return;
    const line = doc.createElement("div");
    line.innerHTML = `&gt; ${escapeHtml(msg)}`;
    logEl.appendChild(line);
    while (logEl.childNodes.length > 200) logEl.removeChild(logEl.firstChild);
    logEl.scrollTop = logEl.scrollHeight;
}
