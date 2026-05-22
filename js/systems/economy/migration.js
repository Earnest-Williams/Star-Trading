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

function normaliseNumberMap(value) {
    if (!isObject(value)) return {};
    return Object.fromEntries(Object.entries(value).map(([key, amount]) => [key, asNonNegativeNumber(amount)]));
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
        likelyImports: asStringArray(profile.likelyImports),
        populationTier: asNonNegativeNumber(profile.populationTier),
        settlementRole: typeof profile.settlementRole === 'string' ? profile.settlementRole : null,
        baselineConsumption: normaliseNumberMap(profile.baselineConsumption),
        industrialConsumption: normaliseNumberMap(profile.industrialConsumption),
        serviceConsumption: normaliseNumberMap(profile.serviceConsumption),
        targetStock: normaliseNumberMap(profile.targetStock),
        strategicReserve: normaliseNumberMap(profile.strategicReserve),
        companyCapacity: asNonNegativeNumber(profile.companyCapacity),
        routeAccess: asNonNegativeNumber(profile.routeAccess),
        routeDependence: asNonNegativeNumber(profile.routeDependence)
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

function normalisePressureBySector(pressureBySector) {
    if (!isObject(pressureBySector)) return {};
    const normalised = {};
    Object.entries(pressureBySector).forEach(([sectorId, pressureMap]) => {
        if (!isObject(pressureMap)) return;
        const commodityMap = {};
        Object.entries(pressureMap).forEach(([commodity, record]) => {
            if (!isObject(record)) return;
            commodityMap[commodity] = {
                targetStock: asNonNegativeNumber(record.targetStock),
                currentStock: asNonNegativeNumber(record.currentStock),
                dailyConsumption: asNonNegativeNumber(record.dailyConsumption),
                dailyDemand: asNonNegativeNumber(record.dailyDemand),
                dailyProduction: asNonNegativeNumber(record.dailyProduction),
                unmetDemand: asNonNegativeNumber(record.unmetDemand),
                surplus: asNonNegativeNumber(record.surplus),
                shortageSeverity: asNonNegativeNumber(record.shortageSeverity),
                surplusSeverity: asNonNegativeNumber(record.surplusSeverity),
                confidence: asNonNegativeNumber(record.confidence),
                pricePressure: asNonNegativeNumber(record.pricePressure),
                stockRatio: asNonNegativeNumber(record.stockRatio),
                routeAccess: asNonNegativeNumber(record.routeAccess),
                lastUpdatedDay: asNullableNumber(record.lastUpdatedDay),
                primaryCause: typeof record.primaryCause === 'string' ? record.primaryCause : ''
            };
        });
        if (Object.keys(commodityMap).length > 0) normalised[sectorId] = commodityMap;
    });
    return normalised;
}

function normaliseRecentVolumeBySector(recentVolumeBySector) {
    if (!isObject(recentVolumeBySector)) return {};
    const normalised = {};
    Object.entries(recentVolumeBySector).forEach(([sectorId, volumeMap]) => {
        if (!isObject(volumeMap)) return;
        const commodityMap = {};
        Object.entries(volumeMap).forEach(([commodity, amount]) => {
            commodityMap[commodity] = asNonNegativeNumber(amount);
        });
        if (Object.keys(commodityMap).length > 0) normalised[sectorId] = commodityMap;
    });
    return normalised;
}

function normaliseContract(contract) {
    if (!isObject(contract)) return null;
    const rawId = typeof contract.id === 'string' && contract.id.trim().length > 0
        ? contract.id.trim()
        : Number(contract.id);
    if (typeof rawId !== 'string' && (!Number.isInteger(rawId) || rawId <= 0)) return null;
    const destinationSector = Number(contract.destinationSector ?? contract.destinationSectorId);
    if (!Number.isInteger(destinationSector) || destinationSector <= 0) return null;
    const commodity = typeof contract.commodity === 'string' ? contract.commodity : '';
    if (!commodity) return null;
    return {
        ...contract,
        id: rawId,
        destinationSector,
        destinationSectorId: destinationSector,
        commodity,
        amount: asNonNegativeNumber(contract.amount),
        remaining: asNonNegativeNumber(contract.remaining ?? contract.amount),
        reward: asNonNegativeNumber(contract.reward),
        unitReward: asNonNegativeNumber(contract.unitReward),
        postedDay: asNonNegativeNumber(contract.postedDay),
        expiresDay: asNonNegativeNumber(contract.expiresDay),
        sourceCandidates: Array.isArray(contract.sourceCandidates)
            ? contract.sourceCandidates.map(Number).filter(Number.isInteger)
            : [],
        delivered: asNonNegativeNumber(contract.delivered)
    };
}

function normaliseContracts(contracts) {
    if (!Array.isArray(contracts)) return [];
    return contracts.map(normaliseContract).filter(Boolean);
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
        generatedByVersion: INITIAL_ECONOMY_VERSION,
        universeBasePrices: {},
        priceDiagnostics: {},
        nodeMidPrices: {},
        spatialPriceDiagnostics: {},
        lastPriceCalibrationDay: null,
        lastSpatialPriceDay: null
    };
}

export function normaliseEconomyState(candidate) {
    const fallback = createInitialEconomyState();
    if (!isObject(candidate)) return fallback;

    return {
        version: asPositiveInteger(candidate.version, fallback.version),
        profilesBySector: normaliseProfilesBySector(candidate.profilesBySector),
        pressureBySector: normalisePressureBySector(candidate.pressureBySector),
        recentVolumeBySector: normaliseRecentVolumeBySector(candidate.recentVolumeBySector),
        contracts: normaliseContracts(candidate.contracts),
        nextContractId: asPositiveInteger(candidate.nextContractId, fallback.nextContractId),
        dailySummary: isObject(candidate.dailySummary) ? candidate.dailySummary : null,
        lastProfileBuildDay: asNullableNumber(candidate.lastProfileBuildDay),
        lastPressureDay: asNullableNumber(candidate.lastPressureDay),
        generatedByVersion: asPositiveInteger(candidate.generatedByVersion, fallback.generatedByVersion),
        universeBasePrices: isObject(candidate.universeBasePrices) ? candidate.universeBasePrices : fallback.universeBasePrices,
        priceDiagnostics: isObject(candidate.priceDiagnostics) ? candidate.priceDiagnostics : fallback.priceDiagnostics,
        nodeMidPrices: isObject(candidate.nodeMidPrices) ? candidate.nodeMidPrices : fallback.nodeMidPrices,
        spatialPriceDiagnostics: isObject(candidate.spatialPriceDiagnostics) ? candidate.spatialPriceDiagnostics : fallback.spatialPriceDiagnostics,
        lastPriceCalibrationDay: asNullableNumber(candidate.lastPriceCalibrationDay ?? fallback.lastPriceCalibrationDay),
        lastSpatialPriceDay: asNullableNumber(candidate.lastSpatialPriceDay ?? fallback.lastSpatialPriceDay)
    };
}
