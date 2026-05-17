import { ARCHETYPE_PRESETS, CHAR_DEFAULTS, CHAR_STATS, EMPLOYER_LANES, PLATFORM_PACKAGES, START_PACKAGES } from '../config/chargen.js';
import { CAREER_TRAITS, ORIGIN_TRAITS, getTraitDefinition } from '../config/traits.js';
import { calcStatGain, getBuildSpend, isPlatformEmployed, maxStatSpend, validateBuild } from '../core/characterBuild.js';
import { getChargenBuild } from './chargenState.js';
import { escapeHtml } from '../utils.js';

function option(value, label, selected) {
    return `<option value="${value}"${selected ? " selected" : ""}>${label}</option>`;
}

function describeTrait(trait) {
    const shifts = Object.entries(trait.statShifts || {}).map(([stat, value]) => `${stat} ${value > 0 ? "+" : ""}${value}`).join(", ");
    const drawbacks = (trait.drawbacks || []).map(text => `<li>${text}</li>`).join("");
    return `<span class="small">${trait.description}${shifts ? ` Stats: ${shifts}.` : ""}</span>${drawbacks ? `<ul class="small red">${drawbacks}</ul>` : ""}`;
}


function summarizeBenefitMap(label, values) {
    if (!values) return null;
    const entries = Object.entries(values);
    if (entries.length === 0) return null;
    return `${label}: ${entries.map(([key, value]) => `${key} ${value > 0 ? "+" : ""}${value}`).join(", ")}`;
}

function packageBenefitSummary(packageId) {
    const startPackage = START_PACKAGES[packageId];
    if (!startPackage) return null;
    const benefits = startPackage.benefits || {};
    const parts = [
        summarizeBenefitMap("rep", benefits.publicRep),
        summarizeBenefitMap("private", benefits.privateRep),
        summarizeBenefitMap("guild", benefits.memberships),
        summarizeBenefitMap("cargo", benefits.cargo),
        summarizeBenefitMap("heat", benefits.heat)
    ].filter(Boolean);
    if (benefits.contacts) parts.push(`contacts ${benefits.contacts.length}`);
    if (benefits.equipment) parts.push(`equipment ${benefits.equipment.length}`);
    if (benefits.credits) parts.push(`credits +${benefits.credits}`);
    return parts.length ? `${startPackage.label}: ${parts.join("; ")}` : `${startPackage.label}: no direct start-state modifier`;
}

function buildMechanicalPreview(build, platform, spend) {
    const selectedPackages = build.packageIds.map(packageBenefitSummary).filter(Boolean);
    const ship = platform.ship || {};
    const shipStats = [
        ship.maxHolds ? `holds ${ship.maxHolds}` : null,
        ship.maxFighters ? `fighters ${ship.maxFighters}` : null,
        ship.maxShields ? `shields ${ship.maxShields}` : null,
        ship.maxHull ? `hull ${ship.maxHull}` : null
    ].filter(Boolean).join(" / ");
    const cash = platform.creditModifier + spend.leftoverPoints * CHAR_DEFAULTS.CASH_PER_LEFTOVER_POINT;
    const packageText = selectedPackages.length ? selectedPackages.join(" | ") : "No package modifiers selected.";
    const assetText = platform.property ? `property ${platform.property.kind}, units ${platform.property.units}, rent ${platform.property.rentDaily}/day` : `ship ${shipStats || "baseline hull"}`;
    return `Cash delta ${cash >= 0 ? "+" : ""}${cash}; ${platform.label} gives ${assetText}. ${packageText}`;
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
    const fieldError = field => validation.errors.some(error => error.toLowerCase().includes(field));
    const statControls = CHAR_STATS.map(stat => {
        const spent = Number(build.statSpend[stat] || 0);
        const value = CHAR_DEFAULTS.STAT_BASE + calcStatGain(spent);
        const invalidClass = fieldError(stat) ? " field-invalid" : "";
        return `<label class="chargen-field${invalidClass}">${stat} <input id="chargen-${stat}" type="number" min="0" max="${maxStatSpend()}" value="${spent}"> <span>${value}</span></label>`;
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
    const employedPlatform = isPlatformEmployed(build.platform.type);
    const employerDisabled = employedPlatform ? "" : " disabled";
    const employerClass = employedPlatform ? "" : " muted";
    const validationList = validation.errors.length
        ? `<ul class="chargen-errors">${validation.errors.map(error => `<li>${error}</li>`).join("")}</ul>`
        : "";
    const mechanicalPreview = buildMechanicalPreview(build, platform, spend);
    return `
        <div class="chargen-grid">
            <div><strong>Character Build</strong>${statControls}</div>
            <label>Archetype Preset <select id="chargen-preset"><option value="">Custom</option>${presetOptions}</select></label>
            <div class="chargen-random-actions"><button type="button" id="btn-random-preset">Random Preset</button><button type="button" id="btn-random-valid-build">Random Valid Build</button></div>
            <label class="chargen-field${fieldError("origin") ? " field-invalid" : ""}">Origin <select id="chargen-origin">${originOptions}</select>${describeTrait(getTraitDefinition(build.originTraitId))}</label>
            <fieldset><legend>Career traits</legend>${careerControls}</fieldset>
            <fieldset><legend>Starting packages</legend>${packageControls}</fieldset>
            <label class="chargen-field${fieldError("platform") ? " field-invalid" : ""}">Starting Platform <select id="chargen-platform">${platformOptions}</select></label>
            <label class="chargen-field${employerClass}${fieldError("employer") ? " field-invalid" : ""}">Employer Lane <select id="chargen-employer"${employerDisabled}><option value="">None</option>${employerOptions}</select></label>
            <div class="small">Point breakdown: stats ${spend.statPoints}, careers ${spend.careerPoints}, ship/employer ${spend.platformPoints}, packages ${spend.packagePoints}; spent ${spend.total}/${CHAR_DEFAULTS.CHARGEN_POINTS}; leftover ${spend.leftoverPoints}.</div>
            <div class="small">Start preview: ${platform.label}; asset ${platform.ship?.name || platform.property?.kind || "none"}; cash modifier ${platform.creditModifier}; rank ${build.platform.employerLaneId || "independent"}; runtime ${platform.runtimeType}.</div>
            <div class="small blue">Mechanical preview: ${escapeHtml(mechanicalPreview)}</div>
            <div class="small">Summary: ${selectedTraits.map(trait => trait.name).join(", ") || "No traits"}; packages ${build.packageIds.join(", ") || "none"}.</div>
            ${drawbacks.length ? `<div class="small red">Drawbacks: ${drawbacks.join(" ")}</div>` : ""}
            ${conflicts.length ? `<div class="small red">Trait conflicts: ${conflicts.join(" ")}</div>` : ""}
            ${validationList}
            <div class="small ${validation.valid ? "green" : "red"}">${validation.valid ? "Build valid." : "Build invalid — fix the highlighted fields before launch."}</div>
        </div>`;
}
