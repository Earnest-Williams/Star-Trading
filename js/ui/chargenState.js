import { ARCHETYPE_PRESETS, CHAR_DEFAULTS, CHAR_STATS, DEFAULT_BUILD_SPEC, EMPLOYER_LANES, PLATFORM_PACKAGES, START_PACKAGES } from '../config/chargen.js';
import { isPlatformEmployed, normaliseBuildSpec, validateBuild } from '../core/characterBuild.js';
import { CAREER_TRAITS, ORIGIN_TRAITS, getTraitDefinition } from '../config/traits.js';

let draftBuild = normaliseBuildSpec(DEFAULT_BUILD_SPEC);
const MAX_CHARGEN_STAT_SPEND = 25;
const PACKAGE_SELECTION_CHANCE = 0.5;
const RANDOM_BUFFER = new Uint32Array(1);

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
    return values[Math.floor(randomUnit() * values.length)];
}

function shuffled(values) {
    return values
        .map(value => ({ value, rank: randomUnit() }))
        .sort((a, b) => a.rank - b.rank)
        .map(item => item.value);
}

function randomUnit() {
    const cryptoRef = globalThis.crypto;
    if (!cryptoRef?.getRandomValues) throw new Error("Secure random source unavailable for chargen generation.");
    cryptoRef.getRandomValues(RANDOM_BUFFER);
    return RANDOM_BUFFER[0] / 0x100000000;
}

function randomInt(min, max) {
    if (max < min) throw new RangeError(`randomInt expected min <= max, got ${min} > ${max}`);
    if (max === min) return min;
    return min + Math.floor(randomUnit() * (max - min + 1));
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
    const maxStatBudget = Math.min(CHAR_STATS.length * MAX_CHARGEN_STAT_SPEND, Math.max(0, budget));
    let remaining = randomInt(0, maxStatBudget);
    const stats = shuffled(CHAR_STATS);
    stats.forEach((stat, index) => {
        const remainingSlots = stats.length - index - 1;
        const minSpend = Math.max(0, remaining - remainingSlots * MAX_CHARGEN_STAT_SPEND);
        const maxSpend = Math.min(MAX_CHARGEN_STAT_SPEND, remaining);
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
    const platformPackage = PLATFORM_PACKAGES[platformType];
    if (!platformPackage) return setRandomPresetBuild();
    const employerLaneId = isPlatformEmployed(platformType)
        ? randomChoice(EMPLOYER_LANES).id
        : null;
    let remainingBudget = CHAR_DEFAULTS.CHARGEN_POINTS - platformPackage.cost;
    const careerTraitIds = [];
    const maxCareerTraits = Math.min(2, Math.floor(remainingBudget / CHAR_DEFAULTS.CAREER_TRAIT_COST));
    const targetCareerTraitCount = randomInt(0, maxCareerTraits);
    shuffled(CAREER_TRAITS).forEach(traitId => {
        if (careerTraitIds.length >= targetCareerTraitCount) return;
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
        if (randomUnit() >= PACKAGE_SELECTION_CHANCE) return;
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
