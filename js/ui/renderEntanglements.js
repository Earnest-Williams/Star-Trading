import { ENTANGLEMENTS } from '../config/entanglements.js';
import { getCaptainEntanglements } from '../systems/entanglements.js';
import { escapeHtml } from '../utils.js';

function labelForEntanglement(entanglement) {
    if (entanglement.kind === ENTANGLEMENTS.KINDS.ROMANCE) {
        const stage = entanglement.data?.stage || ENTANGLEMENTS.ROMANCE_STAGES.INTEREST;
        if (stage === ENTANGLEMENTS.ROMANCE_STAGES.COMMITTED) return "Committed Bond";
        if (stage === ENTANGLEMENTS.ROMANCE_STAGES.BOND) return "Personal Bond";
        if (stage === ENTANGLEMENTS.ROMANCE_STAGES.ESTRANGED) return "Estranged";
        return "Personal Interest";
    }
    if (entanglement.kind === ENTANGLEMENTS.KINDS.FAVOR) return "Favor Owed";
    if (entanglement.kind === ENTANGLEMENTS.KINDS.RIVALRY) return "Rivalry";
    if (entanglement.kind === ENTANGLEMENTS.KINDS.SECRET) return "Shared Secret";
    if (entanglement.kind === ENTANGLEMENTS.KINDS.SUCCESSION) return "Legacy Tie";
    return entanglement.kind;
}

export function renderCaptainEntanglementChips(captainId) {
    const entanglements = getCaptainEntanglements(captainId);
    if (entanglements.length === 0) return "";

    const chips = entanglements
        .slice()
        .sort((a, b) => (b.pressure || 0) - (a.pressure || 0))
        .map(entanglement => {
            const label = labelForEntanglement(entanglement);
            const pressure = entanglement.pressure || 0;
            return `<span class="sector-chip">${escapeHtml(label)} ${pressure >= 50 ? "!" : ""}</span>`;
        })
        .join(" ");

    return `<div class="small">${chips}</div>`;
}

export function renderCaptainEntanglementDetail(captainId) {
    const entanglements = getCaptainEntanglements(captainId);
    if (entanglements.length === 0) return "";

    let html = `<div class="commodity-row"><strong>Entanglements</strong>`;
    entanglements.forEach(entanglement => {
        html += `<div class="timeline-entry">`;
        html += `${escapeHtml(labelForEntanglement(entanglement))}`;
        html += ` | Strength ${entanglement.strength || 0}`;
        html += ` | Pressure ${entanglement.pressure || 0}`;
        if (entanglement.lastPressureReason) {
            html += `<br><span class="small muted">${escapeHtml(entanglement.lastPressureReason)}</span>`;
        }
        html += `</div>`;
    });
    html += `</div>`;

    return html;
}
