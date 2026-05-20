const INITIAL_ECONOMY_VERSION = 1;

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asNullableNumber(value) {
    return Number.isFinite(value) ? Number(value) : null;
}

function asPositiveInteger(value, fallback) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
    return parsed;
}

export function createInitialEconomyState() {
    return {
        version: INITIAL_ECONOMY_VERSION,
        profilesBySector: {},
        pressureBySector: {},
        recentVolumeBySector: {},
        contracts: [],
        nextContractId: 1,
        dailySummary: null,
        lastProfileBuildDay: null,
        lastPressureDay: null,
        generatedByVersion: INITIAL_ECONOMY_VERSION
    };
}

export function normaliseEconomyState(candidate) {
    const fallback = createInitialEconomyState();
    if (!isObject(candidate)) return fallback;

    return {
        version: asPositiveInteger(candidate.version, fallback.version),
        profilesBySector: isObject(candidate.profilesBySector) ? candidate.profilesBySector : {},
        pressureBySector: isObject(candidate.pressureBySector) ? candidate.pressureBySector : {},
        recentVolumeBySector: isObject(candidate.recentVolumeBySector) ? candidate.recentVolumeBySector : {},
        contracts: Array.isArray(candidate.contracts) ? candidate.contracts : [],
        nextContractId: asPositiveInteger(candidate.nextContractId, fallback.nextContractId),
        dailySummary: isObject(candidate.dailySummary) ? candidate.dailySummary : null,
        lastProfileBuildDay: asNullableNumber(candidate.lastProfileBuildDay),
        lastPressureDay: asNullableNumber(candidate.lastPressureDay),
        generatedByVersion: asPositiveInteger(candidate.generatedByVersion, fallback.generatedByVersion)
    };
}
