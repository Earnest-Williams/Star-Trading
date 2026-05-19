import { isObject } from './helpers.js';

export function apply(data) {
    if (!isObject(data)) return data;
    if (!Array.isArray(data.logisticsObjectives)) data.logisticsObjectives = [];
    if (typeof data.nextLogisticsObjectiveId !== 'number' || data.nextLogisticsObjectiveId < 1) data.nextLogisticsObjectiveId = 1;
    return data;
}
