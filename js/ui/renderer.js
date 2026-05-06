export const Renderer = (function() {
    let dirty = new Set();
    let scheduled = false;
    const handlers = {};

    function flush() {
        scheduled = false;
        const toRender = Array.from(dirty);
        dirty.clear();
        toRender.forEach(key => {
            if (handlers[key]) {
                try { handlers[key](); } catch (e) { console.error(`Render ${key} failed:`, e); }
            }
        });
    }

    function scheduleFlush() {
        if (scheduled) return;
        scheduled = true;
        const raf = globalThis.requestAnimationFrame || (fn => globalThis.setTimeout(fn, 0));
        raf(flush);
    }

    return {
        register(key, fn) {
            handlers[key] = fn;
            return function unregister() {
                if (handlers[key] === fn) delete handlers[key];
            };
        },
        unregister(key, fn) {
            if (!handlers[key]) return false;
            if (fn && handlers[key] !== fn) return false;
            delete handlers[key];
            dirty.delete(key);
            return true;
        },
        clear() {
            Object.keys(handlers).forEach(key => delete handlers[key]);
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
        }
    };
})();

export function updateUI() { Renderer.invalidateAll(); }
