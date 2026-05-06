export const EventBus = (function() {
    const listeners = {};

    function off(event, fn) {
        const arr = listeners[event];
        if (!arr) return;
        const idx = arr.indexOf(fn);
        if (idx !== -1) arr.splice(idx, 1);
        if (arr.length === 0) delete listeners[event];
    }

    return {
        on(event, fn) {
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(fn);
            return function unsubscribe() {
                off(event, fn);
            };
        },
        off,
        emit(event, payload) {
            if (!listeners[event]) return;
            listeners[event].slice().forEach(fn => {
                try { fn(payload); } catch (e) { console.error(`Listener for ${event} failed:`, e); }
            });
        },
        reset(event) {
            if (typeof event === "string") {
                delete listeners[event];
                return;
            }
            Object.keys(listeners).forEach(key => delete listeners[key]);
        }
    };
})();
