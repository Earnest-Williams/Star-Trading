import { isObject } from './helpers.js';

export function apply(data) {
    if (!isObject(data)) return data;
    if (isObject(data.player)) delete data.player.factions;
    return data;
}
