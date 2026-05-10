export const Renderer = (function() {
    let dirty = new Set();
    let scheduled = false;

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
                console.error(`Render ${key} failed:`, e);
            }
        });

        if (dirty.size > 0) scheduleFlush();
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

        sliceChanged(slice) {
            const triggered = [];

            Object.entries(handlers).forEach(([key]) => {
                const deps = dependencies.get(key);
                if (deps && deps.has(slice)) {
                    dirty.add(key);
                    triggered.push(key);
                }
            });

            if (import.meta.env?.DEV) {
                console.log(`[UI] sliceChanged(${slice}) -> ${triggered.join(', ')}`);
            }

            scheduleFlush();
        }
    };
})();

export function updateUI() {
    Renderer.invalidateAll();
}
