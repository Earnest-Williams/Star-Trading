import { BALANCE } from '../constants.js';

export const Notifications = (function() {
    const active = [];
    let nextId = 1;

    function show(text, priority = 1, action = null) {
        const doc = globalThis.document;
        if (!doc || typeof doc.getElementById !== "function" || typeof doc.createElement !== "function") return;
        const id = nextId++;
        const feed = doc.getElementById("notificationFeed");
        if (!feed) return;
        const el = doc.createElement("div");
        el.className = `notification priority-${priority}`;
        el.dataset.id = id;
        el.textContent = text;
        if (action) {
            el.addEventListener("click", () => { action(); dismiss(id); });
        } else {
            el.addEventListener("click", () => dismiss(id));
        }
        feed.appendChild(el);
        active.push({ id, el, priority });
        while (active.length > BALANCE.MAX_NOTIFICATIONS) {
            const old = active.shift();
            if (old.el.parentNode) old.el.parentNode.removeChild(old.el);
        }
        const lifetime = priority >= 3 ? BALANCE.NOTIFICATION_LIFETIME_MS * 1.5 : BALANCE.NOTIFICATION_LIFETIME_MS;
        setTimeout(() => {
            el.classList.add("fading");
            setTimeout(() => dismiss(id), 500);
        }, lifetime);
    }

    function dismiss(id) {
        const idx = active.findIndex(n => n.id === id);
        if (idx < 0) return;
        const n = active[idx];
        if (n.el.parentNode) n.el.parentNode.removeChild(n.el);
        active.splice(idx, 1);
    }

    return { show };
})();
