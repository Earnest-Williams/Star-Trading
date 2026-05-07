import {
    CHAR_DEFAULTS,
    CHAR_STATS,
    DEBUG_FALLBACK_BUILD_SPEC,
    DEFAULT_EMPLOYER_LANE_ID,
    DEFAULT_PLATFORM_TYPE,
    EMPLOYER_LANES,
    PLATFORM_PACKAGES,
    STAT_BUY_CURVE
} from '../config/chargen.js';
import { TRAIT_CATEGORIES, getTraitDefinition } from '../config/traits.js';

export function maxStatSpend() {
    return STAT_BUY_CURVE[STAT_BUY_CURVE.length - 1].to;
}

export function isPlatformEmployed(platformType) {
    return platformType === "employed_salary" || platformType === "employed_commission";
}

function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unique(values) {
    return [...new Set(values)];
}

export function calcStatGain(points) {
    let gain = 0;
    let spent = 0;
    for (const tier of STAT_BUY_CURVE) {
        if (spent >= points) break;
        const available = tier.to - tier.from + 1;
        const used = Math.min(available, points - spent);
        gain += used * tier.gain;
        spent += used;
    }
    return gain;
}

export function calcPointsForStatValue(targetValue) {
    const gain = targetValue - CHAR_DEFAULTS.STAT_BASE;
    if (gain < 0 || targetValue > CHAR_DEFAULTS.STAT_CAP) return null;
    if (gain === 0) return 0;
    let remaining = gain;
    let points = 0;
    for (const tier of STAT_BUY_CURVE) {
        if (remaining <= 0) break;
        const available = tier.to - tier.from + 1;
        const maxGainFromTier = available * tier.gain;
        if (remaining >= maxGainFromTier) {
            remaining -= maxGainFromTier;
            points += available;
        } else {
            const fullSteps = Math.floor(remaining / tier.gain);
            points += fullSteps;
            remaining -= fullSteps * tier.gain;
            if (remaining > 0) return null;
        }
    }
    return remaining === 0 ? points : null;
}

export function normaliseBuildSpec(buildSpec = DEBUG_FALLBACK_BUILD_SPEC) {
    const source = isObject(buildSpec) ? buildSpec : DEBUG_FALLBACK_BUILD_SPEC;
    const statSpend = {};
    CHAR_STATS.forEach(stat => {
        statSpend[stat] = Number(source.statSpend?.[stat] || 0);
    });
    const careerTraitIds = Array.isArray(source.careerTraitIds)
        ? source.careerTraitIds.slice()
        : [];
    const platform = isObject(source.platform) ? source.platform : {};
    return {
        statSpend,
        originTraitId: source.originTraitId || DEBUG_FALLBACK_BUILD_SPEC.originTraitId,
        careerTraitIds,
        platform: {
            type: platform.type || DEFAULT_PLATFORM_TYPE,
            employerLaneId: typeof platform.employerLaneId === "undefined"
                ? null
                : platform.employerLaneId
        }
    };
}

export function getBuildSpend(buildSpec) {
    const spec = normaliseBuildSpec(buildSpec);
    let statPoints = 0;
    CHAR_STATS.forEach(stat => {
        statPoints += Number(spec.statSpend[stat] || 0);
    });
    const careerPoints = spec.careerTraitIds.length * CHAR_DEFAULTS.CAREER_TRAIT_COST;
    const total = statPoints + careerPoints;
    return {
        statPoints,
        careerPoints,
        total,
        leftoverPoints: CHAR_DEFAULTS.CHARGEN_POINTS - total
    };
}

function validateTraitRules(spec, errors) {
    const origin = getTraitDefinition(spec.originTraitId);
    if (!origin) {
        errors.push(`Origin trait '${spec.originTraitId}' is not defined.`);
    } else if (origin.category !== TRAIT_CATEGORIES.ORIGIN || !origin.chargenOnly) {
        errors.push(`Trait '${spec.originTraitId}' is not a valid Origin trait for character generation.`);
    }

    if (unique(spec.careerTraitIds).length !== spec.careerTraitIds.length) {
        errors.push("Career traits must not contain duplicates.");
    }

    spec.careerTraitIds.forEach(traitId => {
        const trait = getTraitDefinition(traitId);
        if (!trait) {
            errors.push(`Career trait '${traitId}' is not defined.`);
            return;
        }
        if (trait.category !== TRAIT_CATEGORIES.CAREER || !trait.chargenOnly) {
            errors.push(`Trait '${traitId}' is not a valid Career trait for character generation.`);
        }
        const exclusiveWith = trait.exclusiveWith || [];
        exclusiveWith.forEach(otherId => {
            if (spec.careerTraitIds.includes(otherId)) {
                errors.push(`Career trait '${traitId}' is exclusive with '${otherId}'.`);
            }
        });
    });
}

function validatePlatformRules(spec, errors) {
    const platformType = spec.platform.type;
    if (!PLATFORM_PACKAGES[platformType]) {
        errors.push(`Platform '${platformType}' is not defined.`);
        return;
    }
    const isEmployed = isPlatformEmployed(platformType);
    if (isEmployed) {
        const laneId = spec.platform.employerLaneId || DEFAULT_EMPLOYER_LANE_ID;
        if (!EMPLOYER_LANES.some(lane => lane.id === laneId)) {
            errors.push(`Employer lane '${laneId}' is not defined.`);
        }
    } else if (spec.platform.employerLaneId !== null) {
        errors.push(`Platform '${platformType}' cannot select an employer lane.`);
    }
}

export function validateBuild(buildSpec) {
    if (!isObject(buildSpec)) {
        return { valid: false, reason: "buildSpec must be an object", errors: ["buildSpec must be an object"] };
    }
    const spec = normaliseBuildSpec(buildSpec);
    const errors = [];
    let totalStatPoints = 0;
    CHAR_STATS.forEach(stat => {
        const spent = Number(spec.statSpend[stat] || 0);
        if (!Number.isInteger(spent) || spent < 0) {
            errors.push(`Stat spend for '${stat}' must be a non-negative integer.`);
            return;
        }
        if (spent > maxStatSpend()) {
            errors.push(`Stat spend for '${stat}' exceeds the maximum of ${maxStatSpend()} points.`);
            return;
        }
        const resultStat = CHAR_DEFAULTS.STAT_BASE + calcStatGain(spent);
        if (resultStat > CHAR_DEFAULTS.STAT_CAP) {
            errors.push(`Stat '${stat}' would exceed the hard cap of ${CHAR_DEFAULTS.STAT_CAP}.`);
        }
        totalStatPoints += spent;
    });

    validateTraitRules(spec, errors);
    validatePlatformRules(spec, errors);

    const totalSpend = totalStatPoints + spec.careerTraitIds.length * CHAR_DEFAULTS.CAREER_TRAIT_COST;
    if (totalSpend > CHAR_DEFAULTS.CHARGEN_POINTS) {
        errors.push(`Total spend ${totalSpend} exceeds the chargen budget of ${CHAR_DEFAULTS.CHARGEN_POINTS}.`);
    }

    return errors.length === 0
        ? { valid: true, errors: [] }
        : { valid: false, reason: errors.join(" "), errors };
}

export function buildCharacterFromSpec(buildSpec) {
    const spec = normaliseBuildSpec(buildSpec);
    const stats = {};
    CHAR_STATS.forEach(stat => {
        const spent = Number(spec.statSpend[stat] || 0);
        stats[stat] = CHAR_DEFAULTS.STAT_BASE + calcStatGain(spent);
    });
    const spend = getBuildSpend(spec);
    return {
        character: {
            stats,
            traits: [spec.originTraitId, ...spec.careerTraitIds],
            originTraitId: spec.originTraitId,
            careerTraitIds: spec.careerTraitIds.slice(),
            platform: { ...spec.platform },
            contacts: []
        },
        leftoverPoints: spend.leftoverPoints
    };
}
