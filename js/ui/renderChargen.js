import { CHAR_DEFAULTS, CHAR_STATS, EMPLOYER_LANES, PLATFORM_PACKAGES } from '../config/chargen.js';
import { CAREER_TRAITS, ORIGIN_TRAITS, getTraitDefinition } from '../config/traits.js';
import { calcStatGain, getBuildSpend, validateBuild } from '../core/characterBuild.js';
import { getChargenBuild } from './chargenState.js';

function option(value, label, selected) {
    return `<option value="${value}"${selected ? " selected" : ""}>${label}</option>`;
}

export function renderChargenControls() {
    const build = getChargenBuild();
    const spend = getBuildSpend(build);
    const validation = validateBuild(build);
    const originOptions = ORIGIN_TRAITS.map(traitId => {
        const trait = getTraitDefinition(traitId);
        return option(traitId, trait.name, build.originTraitId === traitId);
    }).join("");
    const platformOptions = Object.values(PLATFORM_PACKAGES).map(platform => (
        option(platform.id, platform.label, build.platform.type === platform.id)
    )).join("");
    const employerOptions = EMPLOYER_LANES.map(lane => (
        option(lane.id, lane.label, build.platform.employerLaneId === lane.id)
    )).join("");
    const statControls = CHAR_STATS.map(stat => {
        const spent = Number(build.statSpend[stat] || 0);
        const value = CHAR_DEFAULTS.STAT_BASE + calcStatGain(spent);
        return `<label>${stat} <input id="chargen-${stat}" type="number" min="0" max="25" value="${spent}"> <span>${value}</span></label>`;
    }).join("");
    const careerControls = CAREER_TRAITS.map(traitId => {
        const trait = getTraitDefinition(traitId);
        const checked = build.careerTraitIds.includes(traitId) ? " checked" : "";
        return `<label><input data-chargen-career type="checkbox" value="${traitId}"${checked}> ${trait.name}</label>`;
    }).join("");
    return `
        <div class="chargen-grid">
            <div><strong>Character Build</strong>${statControls}</div>
            <label>Origin <select id="chargen-origin">${originOptions}</select></label>
            <fieldset><legend>Career traits (${CHAR_DEFAULTS.CAREER_TRAIT_COST} pts each)</legend>${careerControls}</fieldset>
            <label>Start Platform <select id="chargen-platform">${platformOptions}</select></label>
            <label>Employer Lane <select id="chargen-employer"><option value="">None</option>${employerOptions}</select></label>
            <div class="small ${validation.valid ? "green" : "red"}">Spent ${spend.total}/${CHAR_DEFAULTS.CHARGEN_POINTS}; leftover ${spend.leftoverPoints} points. ${validation.valid ? "Build valid." : validation.reason}</div>
        </div>`;
}
