export function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function asString(value, fallback = '') {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

export function asNumber(value, fallback = 0) {
    if (value === null || typeof value === 'undefined') return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

export function formatItemLabel(itemId) {
    return asString(itemId, 'part').replaceAll('_', ' ');
}

export function mergeFrozenStringTree(base = {}, additions = {}) {
    const baseSource = isObject(base) ? base : {};
    const additionSource = isObject(additions) ? additions : {};
    const keys = new Set([
        ...Object.keys(baseSource),
        ...Object.keys(additionSource)
    ]);
    const result = {};
    keys.forEach(key => {
        const baseValue = baseSource[key];
        const additionValue = additionSource[key];
        if (typeof additionValue === 'undefined') {
            result[key] = baseValue;
            return;
        }
        if (Array.isArray(additionValue)) {
            result[key] = Object.freeze([
                ...(Array.isArray(baseValue) ? baseValue : []),
                ...additionValue
            ]);
            return;
        }
        if (isObject(additionValue)) {
            result[key] = mergeFrozenStringTree(
                isObject(baseValue) ? baseValue : {},
                additionValue
            );
            return;
        }
        result[key] = additionValue;
    });
    return Object.freeze(result);
}
