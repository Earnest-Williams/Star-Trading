import { DEFAULT_BUILD_SPEC } from '../config/chargen.js';
import { normaliseBuildSpec, validateBuild } from '../core/characterBuild.js';

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
    return setChargenBuild({
        statSpend,
        originTraitId: origin ? origin.value : DEFAULT_BUILD_SPEC.originTraitId,
        careerTraitIds,
        packageIds,
        platform: {
            type: platform ? platform.value : DEFAULT_BUILD_SPEC.platform.type,
            employerLaneId: employer && employer.value ? employer.value : null
        }
    });
}

export function validateChargenDraft() {
    return validateBuild(getChargenBuild());
}
