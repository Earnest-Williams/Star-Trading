import { PORT_TYPES } from '../constants.js';

export const DEFAULT_PORT_TYPE_KEY = 'consumer';

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isValidPortTypeKey(typeKey) {
    return typeof typeKey === 'string' && Object.hasOwn(PORT_TYPES, typeKey);
}

function numericCommodityValue(source, commodity) {
    if (!isObject(source) || typeof source[commodity] !== 'number') return 0;
    return Number.isFinite(source[commodity]) ? source[commodity] : 0;
}

function inferPortTypeKeyFromInventory(port) {
    const stock = isObject(port?.stock) ? port.stock : null;
    const maxStock = isObject(port?.maxStock) ? port.maxStock : null;
    const ore = numericCommodityValue(stock, 'ore') + numericCommodityValue(maxStock, 'ore');
    const org = numericCommodityValue(stock, 'org') + numericCommodityValue(maxStock, 'org');
    const eq = numericCommodityValue(stock, 'eq')
        + numericCommodityValue(stock, 'pulse_canister')
        + numericCommodityValue(stock, 'heavy_pulse_module')
        + numericCommodityValue(maxStock, 'eq')
        + numericCommodityValue(maxStock, 'pulse_canister')
        + numericCommodityValue(maxStock, 'heavy_pulse_module');

    if (ore <= 0 && org <= 0 && eq <= 0) return DEFAULT_PORT_TYPE_KEY;
    if (ore >= org && ore >= eq) return 'mining';
    if (org >= ore && org >= eq) return 'agricultural';
    return 'industrial';
}

export function normalisePortTypeKey(port) {
    if (!isObject(port)) return DEFAULT_PORT_TYPE_KEY;
    if (isValidPortTypeKey(port.typeKey)) return port.typeKey;
    port.typeKey = inferPortTypeKeyFromInventory(port);
    return port.typeKey;
}

export function getPortType(port) {
    return PORT_TYPES[normalisePortTypeKey(port)] || PORT_TYPES[DEFAULT_PORT_TYPE_KEY];
}

export function normalisePortTypeKeys(ports) {
    if (!isObject(ports)) return;
    Object.values(ports).forEach(port => normalisePortTypeKey(port));
}
