import { isObject } from './helpers.js';

export function apply(data) {
    if (!isObject(data)) return data;
    if (!Array.isArray(data.captainEventLog)) data.captainEventLog = [];
    if (!Array.isArray(data.worldEvents)) data.worldEvents = [];
    return data;
}
