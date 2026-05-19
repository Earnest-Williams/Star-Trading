import { ARCHETYPE_PRESETS, CHAR_DEFAULTS, CHAR_STATS, EMPLOYER_LANES, PLATFORM_PACKAGES, START_PACKAGES } from '../config/chargen.js';
import { CAREER_TRAITS, ORIGIN_TRAITS, getTraitDefinition } from '../config/traits.js';
import { calcStatGain, getBuildSpend, isPlatformEmployed, maxStatSpend, normaliseBuildSpec, validateBuild } from '../core/characterBuild.js';
import { getChargenBuild } from './chargenState.js';
import { escapeHtml } from '../utils.js';

const BUILD_SIGNATURE_SEGMENT_SEPARATOR = '::';
const BUILD_SIGNATURE_FIELD_SEPARATOR = '|';
const BUILD_SIGNATURE_LIST_SEPARATOR = ',';

function option(value, label, selected) {
    return `<option value="${value}"${selected ? ' selected' : ''}>${label}</option>`;
}

function describeTrait(trait) {
    const shifts = Object.entries(trait.statShifts || {}).map(([stat, value]) => `${stat} ${value > 0 ? '+' : ''}${value}`).join(', ');
    const drawbacks = (trait.drawbacks || []).map(text => `<li>${text}</li>`).join('');
    return `<span class="small">${trait.description}${shifts ? ` Stats: ${shifts}.` : ''}</span>${drawbacks ? `<ul class="small red">${drawbacks}</ul>` : ''}`;
}

function formatBenefitMap(label, values) {
    if (!values) return null;
    const entries = Object.entries(values);
    if (entries.length === 0) return null;
    return `${label}: ${entries.map(([key, value]) => `${key} ${value > 0 ? '+' : ''}${value}`).join(', ')}`;
}

function packageBenefitSummary(packageId) {
    const startPackage = START_PACKAGES[packageId];
    if (!startPackage) return null;
    const benefits = startPackage.benefits || {};
    const parts = [
        formatBenefitMap('rep', benefits.publicRep),
        formatBenefitMap('private', benefits.privateRep),
        formatBenefitMap('guild', benefits.memberships),
        formatBenefitMap('cargo', benefits.cargo),
        formatBenefitMap('heat', benefits.heat)
    ].filter(Boolean);
    if (benefits.contacts) parts.push(`contacts ${benefits.contacts.length}`);
    if (benefits.equipment) parts.push(`equipment ${benefits.equipment.length}`);
    if (benefits.credits) parts.push(`credits +${benefits.credits}`);
    return parts.length ? `${startPackage.label}: ${parts.join('; ')}` : `${startPackage.label}: no direct start-state modifier`;
}

function buildMechanicalPreview(build, platform, spend) {
    const selectedPackages = build.packageIds.map(packageBenefitSummary).filter(Boolean);
    const ship = platform.ship || {};
    const shipStats = [
        ship.maxHolds ? `holds ${ship.maxHolds}` : null,
        ship.maxFighters ? `fighters ${ship.maxFighters}` : null,
        ship.maxShields ? `shields ${ship.maxShields}` : null,
        ship.maxHull ? `hull ${ship.maxHull}` : null
    ].filter(Boolean).join(' / ');
    const cash = (platform.creditModifier ?? 0) + spend.leftoverPoints * CHAR_DEFAULTS.CASH_PER_LEFTOVER_POINT;
    const packageText = selectedPackages.length ? selectedPackages.join(' | ') : 'No package modifiers selected.';
    const assetText = platform.property ? `property ${platform.property.kind}, units ${platform.property.units}, rent ${platform.property.rentDaily}/day` : `ship ${shipStats || 'baseline hull'}`;
    return `Cash delta ${cash >= 0 ? '+' : ''}${cash}; ${platform.label} gives ${assetText}. ${packageText}`;
}

/**
 * Build signatures are normalized string keys used to compare a mutable draft
 * build with preset builds. Segments use `::`, stat fields use `|`, and list
 * values use `,` so equivalent builds map to the same deterministic signature.
 */
function buildSignature(buildSpec) {
    const build = normaliseBuildSpec(buildSpec);
    const statSpend = CHAR_STATS.map(stat => `${stat}:${Number(build.statSpend?.[stat] || 0)}`).join(BUILD_SIGNATURE_FIELD_SEPARATOR);
    const careerTraitIds = [...(build.careerTraitIds || [])].sort().join(BUILD_SIGNATURE_LIST_SEPARATOR);
    const packageIds = [...(build.packageIds || [])].sort().join(BUILD_SIGNATURE_LIST_SEPARATOR);
    return [
        statSpend,
        build.originTraitId,
        careerTraitIds,
        `${build.platform.type}:${build.platform.employerLaneId || ''}`,
        packageIds
    ].join(BUILD_SIGNATURE_SEGMENT_SEPARATOR);
}

function getSelectedPresetId(build) {
    const signature = buildSignature(build);
    const entry = Object.entries(ARCHETYPE_PRESETS)
        .find(([, preset]) => buildSignature(preset.build) === signature);
    return entry ? entry[0] : '';
}

function listTraitConflicts(selectedTraitIds) {
    const conflicts = [];
    for (let index = 0; index < selectedTraitIds.length; index++) {
        for (let otherIndex = index + 1; otherIndex < selectedTraitIds.length; otherIndex++) {
            const traitId = selectedTraitIds[index];
            const otherTraitId = selectedTraitIds[otherIndex];
            const trait = getTraitDefinition(traitId);
            const otherTrait = getTraitDefinition(otherTraitId);
            if (!trait || !otherTrait) continue;
            const isExclusive = trait.exclusiveWith?.includes(otherTraitId) || otherTrait.exclusiveWith?.includes(traitId);
            if (isExclusive) {
                conflicts.push(`${trait.name} ↔ ${otherTrait.name}`);
            }
        }
    }
    return conflicts;
}

function packageSummary(packageId, checked) {
    const startPackage = START_PACKAGES[packageId];
    if (!startPackage) return '';
    return `<label class="chargen-compact-row"><input data-chargen-package type="checkbox" value="${packageId}"${checked ? ' checked' : ''}> ${startPackage.label} (${startPackage.cost} pts)<span class="small"> ${startPackage.category}</span></label>`;
}

export function renderChargenControls() {
    const build = getChargenBuild();
    const spend = getBuildSpend(build);
    const validation = validateBuild(build);
    const fieldError = field => validation.errors.some(error => error.toLowerCase().includes(field));
    const originOptions = ORIGIN_TRAITS.map(traitId => option(traitId, getTraitDefinition(traitId).name, build.originTraitId === traitId)).join('');
    const platformOptions = Object.values(PLATFORM_PACKAGES).map(platform => option(platform.id, `${platform.label} (${platform.cost} pts)`, build.platform.type === platform.id)).join('');
    const employerOptions = EMPLOYER_LANES.map(lane => option(lane.id, lane.label, build.platform.employerLaneId === lane.id)).join('');
    const statControls = CHAR_STATS.map(stat => {
        const spent = Number(build.statSpend[stat] || 0);
        const value = CHAR_DEFAULTS.STAT_BASE + calcStatGain(spent);
        return `<label class="chargen-field${fieldError(stat) ? ' field-invalid' : ''}">${stat} <input id="chargen-${stat}" type="number" min="0" max="${maxStatSpend()}" value="${spent}"> <span>${value}</span></label>`;
    }).join('');
    const careerControls = CAREER_TRAITS.map(traitId => {
        const trait = getTraitDefinition(traitId);
        const checked = build.careerTraitIds.includes(traitId) ? ' checked' : '';
        return `<details class="chargen-trait-row"><summary><label class="chargen-compact-row"><input data-chargen-career type="checkbox" value="${traitId}"${checked}> ${trait.name} (${CHAR_DEFAULTS.CAREER_TRAIT_COST} pts)</label></summary>${describeTrait(trait)}</details>`;
    }).join('');

    const packageGroups = Object.entries(START_PACKAGES).reduce((acc, [id, pkg]) => {
        const category = pkg.category || 'Misc';
        acc[category] = acc[category] || [];
        acc[category].push(packageSummary(id, build.packageIds.includes(id)));
        return acc;
    }, {});

    const packageControls = Object.entries(packageGroups).map(([category, rows]) => (
        `<details class="chargen-package-group" open><summary>${escapeHtml(category)}</summary>${rows.join('')}</details>`
    )).join('');

    const selectedPresetId = getSelectedPresetId(build);
    const platform = PLATFORM_PACKAGES[build.platform.type] || PLATFORM_PACKAGES.ship_tier1_tramp;
    const selectedTraits = [build.originTraitId, ...build.careerTraitIds].map(getTraitDefinition).filter(Boolean);
    const drawbacks = selectedTraits.flatMap(trait => trait.drawbacks || []);
    const conflicts = listTraitConflicts([build.originTraitId, ...build.careerTraitIds]);
    const mechanicalPreview = buildMechanicalPreview(build, platform, spend);
    const employedPlatform = isPlatformEmployed(build.platform.type);
    const validationList = validation.errors.length ? `<ul class="chargen-errors">${validation.errors.map(error => `<li>${error}</li>`).join('')}</ul>` : '';

    return `
    <div class="new-game-layout">
        <section class="new-game-panel galaxy-setup-panel">
            <h3>Galaxy Setup</h3>
            <label>Archetype Preset <select id="chargen-preset"><option value=""${selectedPresetId ? '' : ' selected'}>Custom</option>${Object.entries(ARCHETYPE_PRESETS).map(([id, preset]) => option(id, preset.label, selectedPresetId === id)).join('')}</select></label>
            <div class="chargen-random-actions"><button type="button" id="btn-random-preset">Random Preset</button><button type="button" id="btn-random-valid-build">Random Valid Build</button></div>
        </section>
        <section class="new-game-panel captain-build-panel">
            <h3>Captain Build</h3>
            <div>${statControls}</div>
            <label class="chargen-field${fieldError('origin') ? ' field-invalid' : ''}">Origin <select id="chargen-origin">${originOptions}</select>${describeTrait(getTraitDefinition(build.originTraitId))}</label>
        </section>
        <section class="new-game-panel background-panel">
            <h3>Background & Packages</h3>
            <fieldset><legend>Career Traits</legend>${careerControls}</fieldset>
            <fieldset><legend>Starting Packages</legend>${packageControls}</fieldset>
        </section>
        <section class="new-game-panel launch-summary-panel">
            <h3>Launch Summary</h3>
            <label class="chargen-field${fieldError('platform') ? ' field-invalid' : ''}">Starting Platform <select id="chargen-platform">${platformOptions}</select></label>
            <label class="chargen-field${employedPlatform ? '' : ' muted'}${fieldError('employer') ? ' field-invalid' : ''}">Employer Lane <select id="chargen-employer"${employedPlatform ? '' : ' disabled'}><option value="">None</option>${employerOptions}</select></label>
            <div class="small">Point breakdown: stats ${spend.statPoints}, careers ${spend.careerPoints}, ship/employer ${spend.platformPoints}, packages ${spend.packagePoints}; spent ${spend.total}/${CHAR_DEFAULTS.CHARGEN_POINTS}; leftover ${spend.leftoverPoints}.</div>
            <div class="small">Start preview: ${platform.label}; asset ${platform.ship?.name || platform.property?.kind || 'none'}; cash modifier ${platform.creditModifier}; rank ${build.platform.employerLaneId || 'independent'}; runtime ${platform.runtimeType}.</div>
            <div class="small blue">Mechanical preview: ${escapeHtml(mechanicalPreview)}</div>
            <div class="small">Summary: ${selectedTraits.map(trait => trait.name).join(', ') || 'No traits'}; packages ${build.packageIds.join(', ') || 'none'}.</div>
            ${drawbacks.length ? `<div class="small red">Drawbacks: ${drawbacks.join(' ')}</div>` : ''}
            ${conflicts.length ? `<div class="small red">Trait conflicts: ${conflicts.join(' ')}</div>` : ''}
            ${validationList}
            <div class="small ${validation.valid ? 'green' : 'red'}">${validation.valid ? 'Build valid.' : 'Build invalid — fix fields before launch.'}</div>
            <button id="btn-chargen-start" type="button">Start New Galaxy</button>
        </section>
    </div>`;
}
