import { state } from '../state.js';
import { escapeHtml, formatCredits } from '../utils.js';
import {
    getAvailablePropertyActions,
    getPropertyRecommendation,
    summarisePropertyEconomics
} from '../systems/properties.js';

function percent(value) {
    return `${Math.round(value * 100)}%`;
}

function actionLabel(actionId) {
    return [...actionId].map((char, index) => {
        const separator = index > 0 && char >= "A" && char <= "Z" ? " " : "";
        const labelChar = index === 0 ? char.toUpperCase() : char;
        return `${separator}${labelChar}`;
    }).join("");
}

export function renderPropertyScreen() {
    const properties = Array.isArray(state.player?.properties) ? state.player.properties : [];
    if (properties.length === 0) {
        return '<div class="card"><strong>No owned property</strong><br><span class="muted">Ships, jobs, and routes are still available. Property starts and purchases will appear here.</span></div>';
    }
    const actions = getAvailablePropertyActions();
    return properties.map(property => {
        const economics = summarisePropertyEconomics(property);
        const recommendation = getPropertyRecommendation(property, state.player.character);
        return `<div class="card property-card">
            <strong>${escapeHtml(property.label)}</strong>
            <div class="small muted">${escapeHtml(property.kind)} at site ${escapeHtml(String(property.siteId))}</div>
            <div>Gross rent ${formatCredits(economics.grossRent)} | Upkeep ${formatCredits(economics.upkeep)} | Debt ${formatCredits(economics.debt)} | Net ${formatCredits(economics.netIncome)}</div>
            <div>Condition ${Math.round(property.condition)} | Occupancy ${percent(property.occupancy)} | Tenant mix ${escapeHtml(property.tenantMix)}</div>
            <div>Storage ${property.storageCapacity} | Service slots ${property.serviceSlots} | Value estimate ${formatCredits(property.valueEstimate)}</div>
            <div class="small blue">Recommended action: ${escapeHtml(recommendation.text)}</div>
            <div class="small muted">Recommendation quality ${escapeHtml(recommendation.quality)}; estimate accuracy about ${percent(recommendation.estimateAccuracy)}.</div>
            <div class="compact-actions">${actions.map(action => `<button data-action="propertyAction" data-arg0="${escapeHtml(property.id)}" data-arg1="${escapeHtml(action)}">${escapeHtml(actionLabel(action))}</button>`).join('')}</div>
        </div>`;
    }).join('');
}
