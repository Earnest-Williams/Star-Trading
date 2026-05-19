// @ts-check
// =====================================================
// DOMAIN COMMAND LAYER
// Keeps UI events from calling simulation systems directly.
// =====================================================
const Actions = {};
const actionObservers = [];
const actionManifest = {};

function parseIntegerArg(value, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
    if (typeof value === 'string' && value.trim().length === 0) {
        return { ok: false, reason: 'must not be empty' };
    }
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) return { ok: false, reason: 'must be an integer' };
    if (parsed < min || parsed > max) return { ok: false, reason: `must be between ${min} and ${max}` };
    return { ok: true, value: parsed };
}

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
    if (result === false) return commandFailed();
    if (Array.isArray(result)) return commandOk(...result);
    return commandOk();
}

export function registerAction(name, fn, meta = null) {
    if (!name || typeof fn !== 'function') return false;
    Actions[name] = fn;
    if (meta && typeof meta === 'object') actionManifest[name] = { ...meta };
    return true;
}

export function registerActionManifest(name, meta) {
    if (!name || !meta || typeof meta !== 'object') return false;
    actionManifest[name] = { ...meta };
    return true;
}

export function unregisterAction(name) {
    if (!name || !Actions[name]) return false;
    delete Actions[name];
    delete actionManifest[name];
    return true;
}

export function resetActions() {
    Object.keys(Actions).forEach(name => delete Actions[name]);
    Object.keys(actionManifest).forEach(name => delete actionManifest[name]);
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

function validateCommandArgs(type, args) {
    const meta = actionManifest[type];
    if (!meta) return { ok: true, args };
    const expectedArgs = Number.isInteger(meta.argCount) ? meta.argCount : null;
    if (expectedArgs !== null && args.length !== expectedArgs) {
        return { ok: false, message: `Invalid argument count for ${type}` };
    }
    const coercers = Array.isArray(meta.coercers) ? meta.coercers : [];
    const normalized = [];
    for (let index = 0; index < args.length; index += 1) {
        const coerce = coercers[index];
        if (!coerce) {
            normalized.push(args[index]);
            continue;
        }
        const parsed = coerce(args[index]);
        if (!parsed || !parsed.ok) {
            const reason = parsed && parsed.reason ? parsed.reason : 'invalid argument';
            return { ok: false, message: `Invalid argument ${index} for ${type}: ${reason}` };
        }
        normalized.push(parsed.value);
    }
    return { ok: true, args: normalized };
}

export function executeAction(command) {
    if (!command || !command.type) return commandNoop();
    const fn = getAction(command.type);
    if (!fn) return commandFailed(`Unknown action: ${command.type}`);
    const args = Array.isArray(command.args) ? command.args : [];
    const validation = validateCommandArgs(command.type, args);
    if (!validation.ok) return commandFailed(validation.message);
    const rawResult = fn.apply(null, validation.args);
    const result = normaliseCommandResult(rawResult);
    actionObservers.forEach(observer => observer({
        type: command.type,
        args: validation.args.slice(),
        result
    }));
    return result;
}

export { parseIntegerArg };
