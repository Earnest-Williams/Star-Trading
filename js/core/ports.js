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

function sumCommodityValues(stock, maxStock, commodities) {
    return commodities.reduce(
        (total, commodity) => total
            + numericCommodityValue(stock, commodity)
            + numericCommodityValue(maxStock, commodity),
        0
    );
}

function inferPortTypeKeyFromInventory(port) {
    const stock = isObject(port?.stock) ? port.stock : null;
    const maxStock = isObject(port?.maxStock) ? port.maxStock : null;
    const raw = sumCommodityValues(stock, maxStock, ['ore', 'heavy_metals', 'rare_earths', 'water_ice']);
    const agricultural = sumCommodityValues(stock, maxStock, ['org', 'fertilizer', 'medical_supplies']);
    const industrial = sumCommodityValues(stock, maxStock, [
        'eq',
        'refined_metals',
        'polymers',
        'coolants',
        'machinery',
        'repair_parts',
        'electronics',
        'construction_kits',
        'pulse_canister',
        'heavy_pulse_module',
        'gate_coils',
        'control_cores'
    ]);

    if (raw <= 0 && agricultural <= 0 && industrial <= 0) return DEFAULT_PORT_TYPE_KEY;
    if (raw >= agricultural && raw >= industrial) return 'mining';
    if (agricultural >= raw && agricultural >= industrial) return 'agricultural';
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
