import { isObject, ensureFactionRelationsOnPlayer } from './helpers.js';

export function apply(data) {
    if (!isObject(data)) return data;
    ensureFactionRelationsOnPlayer(data);
    return data;
}
