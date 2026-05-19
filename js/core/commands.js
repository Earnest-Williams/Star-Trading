// =====================================================
// DOMAIN COMMAND LAYER
// Keeps UI events from calling simulation systems directly.
// =====================================================
const Actions = {};
const actionObservers = [];

export function commandOk(...slices) {
    return {
        ok: true,
        slices,
        invalidateAll: slices.length === 0,
        message: null
    };
}

export function commandFailed(message = null) {
    return { ok: false, slices: [], invalidateAll: false, message };
}

export function commandNoop() {
    return { ok: false, slices: [], invalidateAll: false, message: null, noop: true };
}

export function normaliseCommandResult(result) {
    if (result && typeof result === 'object' && typeof result.ok === 'boolean') {
        return {
            ok: result.ok,
            slices: Array.isArray(result.slices) ? result.slices : [],
            invalidateAll: Boolean(result.invalidateAll),
            message: result.message || null,
            noop: Boolean(result.noop)
        };
    }
    if (result === false) return commandNoop();
    if (Array.isArray(result)) return commandOk(...result);
    return commandOk();
}

export function registerAction(name, fn) {
    if (!name || typeof fn !== 'function') return false;
    Actions[name] = fn;
    return true;
}

export function unregisterAction(name) {
    if (!name || !Actions[name]) return false;
    delete Actions[name];
    return true;
}

export function resetActions() {
    Object.keys(Actions).forEach(name => delete Actions[name]);
    actionObservers.splice(0, actionObservers.length);
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
    if (!command || !command.type) return commandNoop();
    const fn = getAction(command.type);
    if (!fn) return commandNoop();
    const args = Array.isArray(command.args) ? command.args : [];
    const rawResult = fn.apply(null, args);
    const result = normaliseCommandResult(rawResult);
    actionObservers.forEach(observer => observer({
        type: command.type,
        args: args.slice(),
        result
    }));
    return result;
}
