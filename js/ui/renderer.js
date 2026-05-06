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
