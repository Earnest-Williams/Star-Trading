import { state } from "../state.js";
import { mapStateSlicesForInvalidation } from "../core/state/index.js";

export const Renderer = (function() {
    let dirty = new Set();
    let scheduled = false;
    const isDev = !!(import.meta.env?.DEV);

    const handlers = {};
    const dependencies = new Map();

    function flush() {
        scheduled = false;

        const toRender = Array.from(dirty);
        dirty.clear();

        toRender.forEach(key => {
            const fn = handlers[key];
            if (!fn) return;
            try {
                fn();
            } catch (e) {
                console.groupCollapsed(`Render failure: ${key}`);
                console.error("Error:", e);
                console.error("Diagnostics:", {
                    key,
                    currentScreen: state.currentScreen,
                    selectedSectorId: state.selectedSectorId,
                    appMode: state.appMode,
                    stack: e?.stack || null
                });
                console.groupEnd();
            }
        });
    }

    function scheduleFlush() {
        if (scheduled) return;
        scheduled = true;
        const raf = globalThis.requestAnimationFrame || (fn => globalThis.setTimeout(fn, 0));
        raf(flush);
    }

    function removeDependenciesForKey(key) {
        dependencies.delete(key);
    }

    return {
        register(key, fn, dependsOn = []) {
            handlers[key] = fn;
            dependencies.set(key, new Set(dependsOn));

            return function unregister() {
                if (handlers[key] === fn) {
                    delete handlers[key];
                    removeDependenciesForKey(key);
                    dirty.delete(key);
                }
            };
        },

        unregister(key, fn) {
            if (!handlers[key]) return false;
            if (fn && handlers[key] !== fn) return false;

            delete handlers[key];
            removeDependenciesForKey(key);
            dirty.delete(key);
            return true;
        },

        clear() {
            Object.keys(handlers).forEach(key => delete handlers[key]);
            dependencies.clear();
            dirty.clear();
            scheduled = false;
        },

        reset() {
            this.clear();
        },

        invalidate(key) {
            dirty.add(key);
            scheduleFlush();
        },

        invalidateAll() {
            Object.keys(handlers).forEach(k => dirty.add(k));
            scheduleFlush();
        },

        sliceChanged(...slices) {
            if (slices.length === 0) return;

            const triggered = isDev ? [] : null;
            const uniqueSlices = new Set(mapStateSlicesForInvalidation(...slices));
            let changed = false;

            dependencies.forEach((deps, key) => {
                for (const slice of uniqueSlices) {
                    if (!deps.has(slice)) continue;
                    dirty.add(key);
                    changed = true;
                    if (isDev) triggered.push(key);
                    break;
                }
            });

            if (isDev && triggered.length > 0) {
                console.log(`[UI] sliceChanged(${slices.join(', ')}) -> ${triggered.join(', ')}`);
            }

            if (changed) scheduleFlush();
        }
    };
})();

export function updateUI() {
    Renderer.invalidateAll();
}
