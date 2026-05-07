import { ARCHETYPE_PRESETS, CHAR_DEFAULTS, CHAR_STATS, EMPLOYER_LANES, PLATFORM_PACKAGES, START_PACKAGES } from '../config/chargen.js';
import { CAREER_TRAITS, ORIGIN_TRAITS, getTraitDefinition } from '../config/traits.js';
import { calcStatGain, getBuildSpend, maxStatSpend, validateBuild } from '../core/characterBuild.js';
import { getChargenBuild } from './chargenState.js';

function option(value, label, selected) {
    return `<option value="${value}"${selected ? " selected" : ""}>${label}</option>`;
}

function describeTrait(trait) {
    const shifts = Object.entries(trait.statShifts || {}).map(([stat, value]) => `${stat} ${value > 0 ? "+" : ""}${value}`).join(", ");
    const drawbacks = (trait.drawbacks || []).map(text => `<li>${text}</li>`).join("");
    return `<span class="small">${trait.description}${shifts ? ` Stats: ${shifts}.` : ""}</span>${drawbacks ? `<ul class="small red">${drawbacks}</ul>` : ""}`;
}

function packageSummary(packageId) {
    const startPackage = START_PACKAGES[packageId];
    if (!startPackage) return "";
    return `<label><input data-chargen-package type="checkbox" value="${packageId}"> ${startPackage.label} (${startPackage.cost} pts)<span class="small"> ${startPackage.category}</span></label>`;
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
        option(platform.id, `${platform.label} (${platform.cost} pts)`, build.platform.type === platform.id)
    )).join("");
    const employerOptions = EMPLOYER_LANES.map(lane => (
        option(lane.id, lane.label, build.platform.employerLaneId === lane.id)
    )).join("");
    const statControls = CHAR_STATS.map(stat => {
        const spent = Number(build.statSpend[stat] || 0);
        const value = CHAR_DEFAULTS.STAT_BASE + calcStatGain(spent);
        return `<label>${stat} <input id="chargen-${stat}" type="number" min="0" max="${maxStatSpend()}" value="${spent}"> <span>${value}</span></label>`;
    }).join("");
    const careerControls = CAREER_TRAITS.map(traitId => {
        const trait = getTraitDefinition(traitId);
        const checked = build.careerTraitIds.includes(traitId) ? " checked" : "";
        return `<label><input data-chargen-career type="checkbox" value="${traitId}"${checked}> ${trait.name} (${CHAR_DEFAULTS.CAREER_TRAIT_COST} pts) ${describeTrait(trait)}</label>`;
    }).join("");
    const packageControls = Object.keys(START_PACKAGES).map(packageId => {
        const html = packageSummary(packageId);
        return build.packageIds.includes(packageId)
            ? html.replace('type="checkbox"', 'type="checkbox" checked')
            : html;
    }).join("");
    const platform = PLATFORM_PACKAGES[build.platform.type] || PLATFORM_PACKAGES.ship_tier1_tramp;
    const selectedTraits = [build.originTraitId, ...build.careerTraitIds].map(getTraitDefinition).filter(Boolean);
    const drawbacks = selectedTraits.flatMap(trait => trait.drawbacks || []);
    const conflicts = validation.errors.filter(error => error.includes("exclusive"));
    const presetOptions = Object.entries(ARCHETYPE_PRESETS).map(([id, preset]) => option(id, preset.label, false)).join("");
    return `
        <div class="chargen-grid">
            <div><strong>Character Build</strong>${statControls}</div>
            <label>Archetype Preset <select id="chargen-preset"><option value="">Custom</option>${presetOptions}</select></label>
            <label>Origin <select id="chargen-origin">${originOptions}</select>${describeTrait(getTraitDefinition(build.originTraitId))}</label>
            <fieldset><legend>Career traits</legend>${careerControls}</fieldset>
            <fieldset><legend>Starting packages</legend>${packageControls}</fieldset>
            <label>Start Ship / Employer Package <select id="chargen-platform">${platformOptions}</select></label>
            <label>Employer Lane <select id="chargen-employer"><option value="">None</option>${employerOptions}</select></label>
            <div class="small">Point breakdown: stats ${spend.statPoints}, careers ${spend.careerPoints}, ship/employer ${spend.platformPoints}, packages ${spend.packagePoints}; spent ${spend.total}/${CHAR_DEFAULTS.CHARGEN_POINTS}; leftover ${spend.leftoverPoints}.</div>
            <div class="small">Start preview: ${platform.label}; ship ${platform.ship?.name || "none"}; cash modifier ${platform.creditModifier}; rank ${build.platform.employerLaneId || "independent"}; runtime ${platform.runtimeType}.</div>
            <div class="small">Summary: ${selectedTraits.map(trait => trait.name).join(", ") || "No traits"}; packages ${build.packageIds.join(", ") || "none"}.</div>
            ${drawbacks.length ? `<div class="small red">Drawbacks: ${drawbacks.join(" ")}</div>` : ""}
            ${conflicts.length ? `<div class="small red">Trait conflicts: ${conflicts.join(" ")}</div>` : ""}
            <div class="small ${validation.valid ? "green" : "red"}">${validation.valid ? "Build valid." : validation.reason}</div>
        </div>`;
}
