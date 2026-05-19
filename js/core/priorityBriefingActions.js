import { state } from "../state.js";
import { StateSlice, stateChanged } from "../core/state/index.js";
import { normalisePriorityBriefingState } from "./priorityBriefing.js";

export function dismissPriorityBriefing(id) {
    if (!id) return false;
    state.priorityBriefing = normalisePriorityBriefingState(state.priorityBriefing);
    state.priorityBriefing.dismissed[id] = true;
    return stateChanged(StateSlice.PRIORITY_BRIEFING);
}
