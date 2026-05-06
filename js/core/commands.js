// =====================================================
// DOMAIN COMMAND LAYER
// Keeps UI events from calling simulation systems directly.
// =====================================================
const Actions = {};
const actionObservers = [];

export function registerAction(name, fn) {
    if (!name || typeof fn !== 'function') return false;
    Actions[name] = fn;
    return true;
}

export function getAction(name) {
    return Actions[name] || null;
}

export function onActionExecuted(observer) {
    if (typeof observer !== 'function') return () => {};
    actionObservers.push(observer);
    return () => {
        const index = actionObservers.indexOf(observer);
        if (index >= 0) actionObservers.splice(index, 1);
    };
}

export function executeAction(command) {
    if (!command || !command.type) return false;
    const fn = getAction(command.type);
    if (!fn) return false;
    const args = Array.isArray(command.args) ? command.args : [];
    const result = fn.apply(null, args);
    actionObservers.forEach(observer => observer({
        type: command.type,
        args: args.slice(),
        result
    }));
    return result;
}
