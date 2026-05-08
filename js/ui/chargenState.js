import { ARCHETYPE_PRESETS, CHAR_DEFAULTS, CHAR_STATS, DEFAULT_BUILD_SPEC, EMPLOYER_LANES, PLATFORM_PACKAGES, START_PACKAGES } from '../config/chargen.js';
import { isPlatformEmployed, normaliseBuildSpec, validateBuild } from '../core/characterBuild.js';
import { CAREER_TRAITS, ORIGIN_TRAITS, getTraitDefinition } from '../config/traits.js';

let draftBuild = normaliseBuildSpec(DEFAULT_BUILD_SPEC);

export function getChargenBuild() {
    return normaliseBuildSpec(draftBuild);
}

export function setChargenBuild(buildSpec) {
    draftBuild = normaliseBuildSpec(buildSpec);
    return getChargenBuild();
}

export function readChargenBuildFromDom(documentRef = document) {
    const statSpend = {};
    ["nerve", "tradecraft", "fieldcraft", "command"].forEach(stat => {
        const input = documentRef.getElementById(`chargen-${stat}`);
        statSpend[stat] = input ? Number(input.value) : 0;
    });
    const origin = documentRef.getElementById("chargen-origin");
    const platform = documentRef.getElementById("chargen-platform");
    const employer = documentRef.getElementById("chargen-employer");
    const careerTraitIds = Array.from(documentRef.querySelectorAll('[data-chargen-career]:checked'))
        .map(input => input.value);
    const packageIds = Array.from(documentRef.querySelectorAll('[data-chargen-package]:checked'))
        .map(input => input.value);
    const platformType = platform ? platform.value : DEFAULT_BUILD_SPEC.platform.type;
    const employerLaneId = employer && employer.value && isPlatformEmployed(platformType) ? employer.value : null;
    return setChargenBuild({
        statSpend,
        originTraitId: origin ? origin.value : DEFAULT_BUILD_SPEC.originTraitId,
        careerTraitIds,
        packageIds,
        platform: {
            type: platformType,
            employerLaneId
        }
    });
}

function randomChoice(values) {
    return values[Math.floor(Math.random() * values.length)];
}

function shuffled(values) {
    return values
        .map(value => ({ value, rank: Math.random() }))
        .sort((a, b) => a.rank - b.rank)
        .map(item => item.value);
}

function randomInt(min, max) {
    if (max <= min) return min;
    return min + Math.floor(Math.random() * (max - min + 1));
}

function hasExclusiveConflict(selectedIds, candidateId, getDefinition) {
    const candidate = getDefinition(candidateId);
    return selectedIds.some(selectedId => {
        const selected = getDefinition(selectedId);
        return Boolean(
            candidate?.exclusiveWith?.includes(selectedId)
            || selected?.exclusiveWith?.includes(candidateId)
        );
    });
}

function buildRandomStatSpend(budget) {
    const statSpend = Object.fromEntries(CHAR_STATS.map(stat => [stat, 0]));
    const maxTotal = Math.min(CHAR_STATS.length * 25, Math.max(0, budget));
    let remaining = randomInt(0, maxTotal);
    const stats = shuffled(CHAR_STATS);
    stats.forEach((stat, index) => {
        const remainingSlots = stats.length - index - 1;
        const minSpend = Math.max(0, remaining - remainingSlots * 25);
        const maxSpend = Math.min(25, remaining);
        const spend = randomInt(minSpend, maxSpend);
        statSpend[stat] = spend;
        remaining -= spend;
    });
    return statSpend;
}

export function setRandomPresetBuild() {
    const presetIds = Object.keys(ARCHETYPE_PRESETS);
    const preset = ARCHETYPE_PRESETS[randomChoice(presetIds)];
    return setChargenBuild(preset.build);
}

export function setRandomValidBuild() {
    const platformIds = Object.keys(PLATFORM_PACKAGES);
    const packageIds = Object.keys(START_PACKAGES);
    const platformType = randomChoice(platformIds);
    const employerLaneId = isPlatformEmployed(platformType)
        ? randomChoice(EMPLOYER_LANES).id
        : null;
    let remainingBudget = CHAR_DEFAULTS.CHARGEN_POINTS - (PLATFORM_PACKAGES[platformType]?.cost || 0);
    const careerTraitIds = [];
    const maxCareerTraits = Math.min(2, Math.floor(remainingBudget / CHAR_DEFAULTS.CAREER_TRAIT_COST));
    const careerTarget = randomInt(0, maxCareerTraits);
    shuffled(CAREER_TRAITS).forEach(traitId => {
        if (careerTraitIds.length >= careerTarget) return;
        if (hasExclusiveConflict(careerTraitIds, traitId, getTraitDefinition)) return;
        careerTraitIds.push(traitId);
        remainingBudget -= CHAR_DEFAULTS.CAREER_TRAIT_COST;
    });
    const selectedPackages = [];
    shuffled(packageIds).forEach(packageId => {
        const startPackage = START_PACKAGES[packageId];
        if (!startPackage || selectedPackages.length >= 4) return;
        if (startPackage.cost > remainingBudget) return;
        if (startPackage.category === "rank" && !isPlatformEmployed(platformType)) return;
        if (hasExclusiveConflict(selectedPackages, packageId, id => START_PACKAGES[id])) return;
        if (Math.random() >= 0.5) return;
        selectedPackages.push(packageId);
        remainingBudget -= startPackage.cost;
    });
    const build = normaliseBuildSpec({
        statSpend: buildRandomStatSpend(remainingBudget),
        originTraitId: randomChoice(ORIGIN_TRAITS),
        careerTraitIds,
        packageIds: selectedPackages,
        platform: { type: platformType, employerLaneId }
    });
    if (validateBuild(build).valid) {
        return setChargenBuild(build);
    }
    return setRandomPresetBuild();
}

export function validateChargenDraft() {
    return validateBuild(getChargenBuild());
}
