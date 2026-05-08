import { ARCHETYPE_PRESETS, CHAR_STATS, DEFAULT_BUILD_SPEC, EMPLOYER_LANES, PLATFORM_PACKAGES, START_PACKAGES } from '../config/chargen.js';
import { isPlatformEmployed, normaliseBuildSpec, validateBuild } from '../core/characterBuild.js';
import { CAREER_TRAITS, ORIGIN_TRAITS } from '../config/traits.js';

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

export function setRandomPresetBuild() {
    const presetIds = Object.keys(ARCHETYPE_PRESETS);
    const preset = ARCHETYPE_PRESETS[randomChoice(presetIds)];
    return setChargenBuild(preset.build);
}

export function setRandomValidBuild() {
    const platformIds = Object.keys(PLATFORM_PACKAGES);
    const packageIds = Object.keys(START_PACKAGES);
    for (let attempt = 0; attempt < 300; attempt++) {
        const platformType = randomChoice(platformIds);
        const employerLaneId = isPlatformEmployed(platformType)
            ? randomChoice(EMPLOYER_LANES).id
            : null;
        const statSpend = {};
        let remainingStatPool = 25 + Math.floor(Math.random() * 31);
        shuffled(CHAR_STATS).forEach(stat => {
            const spend = Math.min(25, Math.floor(Math.random() * Math.min(remainingStatPool + 1, 16)));
            statSpend[stat] = spend;
            remainingStatPool -= spend;
        });
        const careerTraitIds = shuffled(CAREER_TRAITS).slice(0, Math.floor(Math.random() * 3));
        const selectedPackages = shuffled(packageIds).slice(0, Math.floor(Math.random() * 4));
        const build = normaliseBuildSpec({
            statSpend,
            originTraitId: randomChoice(ORIGIN_TRAITS),
            careerTraitIds,
            packageIds: selectedPackages,
            platform: { type: platformType, employerLaneId }
        });
        if (validateBuild(build).valid) return setChargenBuild(build);
    }
    return setRandomPresetBuild();
}

export function validateChargenDraft() {
    return validateBuild(getChargenBuild());
}
