export const EventBus = (function() {
    const listeners = {};
    return {
        on(event, fn) {
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(fn);
            return function unsubscribe() {
                const arr = listeners[event];
                if (!arr) return;
                const idx = arr.indexOf(fn);
                if (idx !== -1) arr.splice(idx, 1);
            };
        },
        emit(event, payload) {
            if (!listeners[event]) return;
            listeners[event].forEach(fn => {
                try { fn(payload); } catch (e) { console.error(`Listener for ${event} failed:`, e); }
            });
        }
    };
})();
