import { state } from '../../state.js';

function ensureStockBag(node) {
    if (!node.stock || typeof node.stock !== 'object') node.stock = {};
    return node.stock;
}

function ensureMaxStockBag(node) {
    if (!node.maxStock || typeof node.maxStock !== 'object') node.maxStock = {};
    return node.maxStock;
}

function ensureStationStock(site) {
    if (!site || typeof site !== 'object') return null;
    if (!site.station || typeof site.station !== 'object') return null;
    if (!site.station.stock || typeof site.station.stock !== 'object') {
        site.station.stock = { pulse_canister: 0, repair_parts: 0, coolants: 0 };
    }
    if (!site.station.maxStock || typeof site.station.maxStock !== 'object') {
        site.station.maxStock = { pulse_canister: 16, repair_parts: 12, coolants: 10 };
    }
    return site.station;
}

export function getEconomyNode(sectorId) {
    const port = state.ports?.[sectorId];
    if (port) {
        ensureStockBag(port);
        ensureMaxStockBag(port);
        return { sectorId: Number(sectorId), kind: 'port', node: port };
    }
    const planet = state.planets?.[sectorId];
    if (planet) {
        ensureStockBag(planet);
        ensureMaxStockBag(planet);
        return { sectorId: Number(sectorId), kind: 'planet', node: planet };
    }
    const site = state.universe?.[sectorId];
    const station = ensureStationStock(site);
    if (station) return { sectorId: Number(sectorId), kind: 'station', node: station };
    return null;
}
