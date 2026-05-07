import { EMPLOYER_LANES, PLATFORM_PACKAGES } from '../config/chargen.js';
import { getTraitDefinition } from '../config/traits.js';
import { state } from '../state.js';
import { escapeHtml } from '../utils.js';
import { describeActiveBonuses } from '../core/traitHooks.js';

function renderCharacterBlock(label, character, employment = null) {
    const stats = character?.stats || {};
    const platform = PLATFORM_PACKAGES[character?.platform?.type] || null;
    const employer = character?.platform?.employerLaneId
        ? EMPLOYER_LANES.find(lane => lane.id === character.platform.employerLaneId)
        : null;
    const traits = Array.isArray(character?.traits) ? character.traits : [];
    const bonuses = describeActiveBonuses(character);
    let html = `<div class="subpanel"><strong>${escapeHtml(label)}</strong>`;
    html += `<div>Nerve ${stats.nerve || 50} | Tradecraft ${stats.tradecraft || 50} | Fieldcraft ${stats.fieldcraft || 50} | Command ${stats.command || 50}</div>`;
    html += `<div>Platform: ${escapeHtml(platform ? platform.label : "Unknown")}</div>`;
    if (employer || employment) {
        html += `<div>Employer: ${escapeHtml(employer ? employer.label : employment?.laneId || "Assigned")} ${employment?.rank ? `(${escapeHtml(employment.rank)})` : ""}</div>`;
    }
    html += `<div>Traits: ${traits.length ? traits.map(traitId => escapeHtml(getTraitDefinition(traitId)?.name || traitId)).join(", ") : "None"}</div>`;
    html += `<div>Active effects: ${bonuses.length ? bonuses.map(escapeHtml).join("; ") : "Baseline"}</div>`;
    html += `</div>`;
    return html;
}

export function renderCharacterSheet() {
    let html = renderCharacterBlock("Player Captain", state.player.character, state.player.employment);
    const captains = Object.values(state.captains || {}).filter(captain => captain.known).slice(0, 6);
    if (captains.length > 0) {
        html += `<h4>Known Captains</h4>`;
        captains.forEach(captain => {
            html += renderCharacterBlock(captain.name, captain.character, captain.employment);
        });
    }
    return html;
}
