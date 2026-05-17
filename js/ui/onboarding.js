import { state } from "../state.js";
import { buildPriorityBriefing } from "../core/priorityBriefing.js";
import { escapeHtml } from "../utils.js";

function makeActionButton(item) {
    if (!item.action) return "";
    const args = (item.args || []).map((arg, index) => (
        ` data-arg${index}="${escapeHtml(String(arg))}"`
    )).join("");
    return `<button data-action="${escapeHtml(item.action)}"${args}>${escapeHtml(item.actionLabel)}</button>`;
}

function severityClass(severity) {
    return {
        safe: "priority-safe",
        caution: "priority-caution",
        urgent: "priority-urgent"
    }[severity] || "priority-info";
}

export function buildNextActionSuggestions() {
    return buildPriorityBriefing(state);
}

export function renderPriorityBriefingItems(items) {
    return items.map(item => `
        <div class="priority-briefing-item ${severityClass(item.severity)}">
            <div class="priority-briefing-signal">${escapeHtml(item.signal)}</div>
            <div class="priority-briefing-title">${escapeHtml(item.title)}</div>
            <div class="small">${escapeHtml(item.assessment)}</div>
            ${item.why ? `<div class="priority-briefing-why">${escapeHtml(item.why)}</div>` : ""}
            ${makeActionButton(item)}
        </div>
    `).join("");
}

export function renderNextStepsPanel() {
    const target = document.getElementById("nextStepsList");
    if (!target) return;

    const items = buildPriorityBriefing(state);
    if (items.length === 0) {
        target.innerHTML = `<div class="empty-state small muted">No priority signals. Continue scouting.</div>`;
        return;
    }

    target.innerHTML = renderPriorityBriefingItems(items);
}
