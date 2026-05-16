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
