export const EventBus = (function() {
    const listeners = {};
    return {
        on(event, fn) {
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(fn);
        },
        emit(event, payload) {
            if (!listeners[event]) return;
            listeners[event].forEach(fn => {
                try { fn(payload); } catch (e) { console.error(`Listener for ${event} failed:`, e); }
            });
        }
    };
})();

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

    return {
        register(key, fn) { handlers[key] = fn; },
        invalidate(key) {
            dirty.add(key);
            if (!scheduled) {
                scheduled = true;
                requestAnimationFrame(flush);
            }
        },
        invalidateAll() {
            Object.keys(handlers).forEach(k => dirty.add(k));
            if (!scheduled) {
                scheduled = true;
                requestAnimationFrame(flush);
            }
        }
    };
})();

export function updateUI() { Renderer.invalidateAll(); }
