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


function asStringArray(value) {
    if (!Array.isArray(value)) return [];
    return value.filter((entry) => typeof entry === 'string');
}

function asNonNegativeNumber(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
}

function normaliseProfile(profile, sectorId) {
    if (!isObject(profile)) return null;
    const profileSectorId = Number.isFinite(Number(profile.sectorId))
        ? Number(profile.sectorId)
        : Number(sectorId);
    const generatedDay = Number.isFinite(Number(profile.generatedDay))
        ? Number(profile.generatedDay)
        : 1;
    const supplyWeight = asNonNegativeNumber(profile.supplyWeight) || 1.0;
    const demandWeight = asNonNegativeNumber(profile.demandWeight) || 1.0;

    return {
        sectorId: profileSectorId,
        generatedDay,
        roleTags: asStringArray(profile.roleTags),
        supplyWeight,
        demandWeight,
        extractionCapacity: asNonNegativeNumber(profile.extractionCapacity),
        populationDemand: asNonNegativeNumber(profile.populationDemand),
        likelyExports: asStringArray(profile.likelyExports),
        likelyImports: asStringArray(profile.likelyImports)
    };
}

function normaliseProfilesBySector(profilesBySector) {
    if (!isObject(profilesBySector)) return {};
    const normalised = {};
    Object.entries(profilesBySector).forEach(([sectorId, profile]) => {
        const next = normaliseProfile(profile, sectorId);
        if (next) normalised[sectorId] = next;
    });
    return normalised;
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
        profilesBySector: normaliseProfilesBySector(candidate.profilesBySector),
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
