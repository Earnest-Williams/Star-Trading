import { PLATFORM_PACKAGES } from '../config/chargen.js';
import { COMMODITY_NAMES, PORT_TYPES } from '../constants.js';
import { COMPANY_PRODUCTION_PROFILES } from '../config/companies.js';
import { getPortType, normalisePortTypeKey } from '../core/ports.js';
import {
    PROPERTY_ACTIONS,
    PROPERTY_ACTION_LIST,
    PROPERTY_DEFAULTS,
    PROPERTY_TENANT_TYPES
} from '../config/properties.js';
import { CHAR_DEFAULTS } from '../config/characters.js';
import { getCharacterStat } from '../core/characterChecks.js';
import { getTraitBonus } from '../core/traitHooks.js';
import { getSkillEffect } from '../core/skillHooks.js';
import { state } from '../state.js';
import { addWorldEvent } from '../core/worldEvents.js';
import {
    estimateRouteProfit,
    getRouteCommodityOptions,
    getRouteRiskForSectors
} from './tradeRoutes.js';

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function roundMoney(value) {
    return Math.round(value * 100) / 100;
}

function finiteNumber(value, fallback = 0) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : fallback;
}

function nonNegativeNumber(value, fallback = 0) {
    return Math.max(0, finiteNumber(value, fallback));
}

function normaliseStoredGoods(storedGoods = {}) {
    if (!storedGoods || typeof storedGoods !== "object") return {};
    return Object.fromEntries(
        Object.entries(storedGoods)
            .map(([commodity, amount]) => [commodity, nonNegativeNumber(amount)])
    );
}

function normaliseTenantEntity(tenant = {}, index = 0) {
    const source = tenant && typeof tenant === "object" ? tenant : {};
    const requestedType = typeof source.type === "string" ? source.type : "merchants";
    const type = PROPERTY_TENANT_TYPES[requestedType] ? requestedType : "merchants";
    const profile = PROPERTY_TENANT_TYPES[type];
    return {
        id: source.id || `tenant-${type}-${index + 1}`,
        type,
        label: source.label || profile.label,
        reliability: clamp(finiteNumber(source.reliability, profile.reliability), 0, 100),
        factionTie: source.factionTie || source.factionId || null,
        rentYield: nonNegativeNumber(source.rentYield, profile.rentYield),
        disputeRisk: clamp(finiteNumber(source.disputeRisk, profile.disputeRisk), 0, 1),
        serviceDemand: clamp(finiteNumber(source.serviceDemand, profile.serviceDemand), 0, 1),
        inspectionRisk: clamp(finiteNumber(source.inspectionRisk, profile.inspectionRisk || 0), -1, 1),
        maintenanceLoad: clamp(finiteNumber(source.maintenanceLoad, profile.maintenanceLoad || 0), 0, 1),
        reputationEffect: clamp(finiteNumber(source.reputationEffect, profile.reputationEffect || 0), -1, 1),
        contractFlow: clamp(finiteNumber(source.contractFlow, profile.contractFlow || 0), 0, 1),
        commodityFocus: Array.isArray(source.commodityFocus)
            ? source.commodityFocus.slice()
            : Array.from(profile.commodityFocus || []),
        leasingNeeds: Array.isArray(source.leasingNeeds)
            ? source.leasingNeeds.slice()
            : Array.from(profile.leasingNeeds || []),
        tags: Array.isArray(source.tags) ? source.tags.slice() : profile.tags.slice()
    };
}

const MANAGER_UPKEEP_DAILY = 35;
const CONVERSION_UPKEEP_DAILY = 20;
const PROPERTY_ACTION_BONUS_KEYS = Object.freeze({
    setRentPosture: "rentForecastAccuracy",
    performMaintenance: "propertyMaintenanceBonus",
    screenTenants: "tenantScreeningBonus",
    changeTenantMix: "tenantScreeningBonus",
    convertPropertyUse: "storageYieldBonus",
    addService: "serviceSlotYieldBonus",
    refinanceProperty: "propertyRefinanceBonus",
    hirePropertyManager: "propertyMaintenanceBonus"
});

function propertyValueEstimate(property) {
    const gross = property.units * property.rentDaily * property.occupancy;
    const noi = gross - property.upkeepDaily;
    const conditionFactor = 0.65 + property.condition / 200;
    return Math.max(0, Math.round(noi * PROPERTY_DEFAULTS.BASE_VALUE_MULTIPLIER * conditionFactor));
}

export function normaliseProperty(property = {}) {
    const source = property && typeof property === "object" ? property : {};
    const condition = clamp(finiteNumber(source.condition, 65), PROPERTY_DEFAULTS.CONDITION_MIN, PROPERTY_DEFAULTS.CONDITION_MAX);
    const occupancy = clamp(finiteNumber(source.occupancy, 0.75), PROPERTY_DEFAULTS.OCCUPANCY_MIN, PROPERTY_DEFAULTS.OCCUPANCY_MAX);
    const normalised = {
        id: source.id || `property-${source.kind || "asset"}`,
        siteId: source.siteId || 1,
        kind: source.kind || "tenement",
        label: source.label || "Local Property",
        condition,
        occupancy,
        units: Math.max(1, finiteNumber(source.units, 1)),
        rentDaily: nonNegativeNumber(source.rentDaily),
        upkeepDaily: nonNegativeNumber(source.upkeepDaily),
        tenantMix: source.tenantMix || "mixed",
        storageCapacity: nonNegativeNumber(source.storageCapacity),
        serviceSlots: nonNegativeNumber(source.serviceSlots),
        debtDaily: nonNegativeNumber(source.debtDaily),
        valueEstimate: nonNegativeNumber(source.valueEstimate),
        tags: Array.isArray(source.tags) ? source.tags.slice() : [],
        eventCooldowns: source.eventCooldowns && typeof source.eventCooldowns === "object" ? { ...source.eventCooldowns } : {},
        rentPosture: source.rentPosture || "market",
        manager: source.manager || null,
        tenants: Array.isArray(source.tenants)
            ? source.tenants.map((tenant, index) => normaliseTenantEntity(tenant, index))
            : [],
        storedGoods: normaliseStoredGoods(source.storedGoods)
    };
    if (!normalised.valueEstimate) normalised.valueEstimate = propertyValueEstimate(normalised);
    return normalised;
}

export function createPropertyFromPlatform(platformPackage, context = {}) {
    if (!platformPackage?.property) return null;
    const siteId = context.siteId || context.roles?.[platformPackage.property.siteRole] || context.roles?.homeSiteId || 1;
    return normaliseProperty({
        ...platformPackage.property,
        id: `${platformPackage.id}-${siteId}`,
        label: platformPackage.label,
        siteId
    });
}

export function createStartingProperties(platformType, context = {}) {
    const platform = PLATFORM_PACKAGES[platformType];
    const property = createPropertyFromPlatform(platform, context);
    return property ? [property] : [];
}

export function getPropertyTenantEconomicEffects(property) {
    const asset = normaliseProperty(property);
    if (asset.tenants.length === 0) {
        return {
            rentMultiplier: 1,
            serviceDemand: 0,
            maintenanceLoad: 0,
            inspectionRisk: 0,
            contractFlow: 0,
            reputationEffect: 0,
            upkeepDaily: 0
        };
    }
    const tenantCount = asset.tenants.length;
    const totals = asset.tenants.reduce((summary, tenant) => ({
        rentYield: summary.rentYield + tenant.rentYield,
        serviceDemand: summary.serviceDemand + tenant.serviceDemand,
        maintenanceLoad: summary.maintenanceLoad + tenant.maintenanceLoad,
        inspectionRisk: summary.inspectionRisk + tenant.inspectionRisk,
        contractFlow: summary.contractFlow + tenant.contractFlow,
        reputationEffect: summary.reputationEffect + tenant.reputationEffect
    }), {
        rentYield: 0,
        serviceDemand: 0,
        maintenanceLoad: 0,
        inspectionRisk: 0,
        contractFlow: 0,
        reputationEffect: 0
    });
    const serviceSlotBuffer = Math.min(tenantCount, asset.serviceSlots) * 0.08;
    const averageServiceDemand = totals.serviceDemand / tenantCount;
    const averageMaintenanceLoad = totals.maintenanceLoad / tenantCount;
    const upkeepDaily = roundMoney(
        tenantCount * 6
            + Math.max(0, averageServiceDemand - serviceSlotBuffer) * 18
            + averageMaintenanceLoad * Math.max(8, asset.units * 3)
    );
    return {
        rentMultiplier: clamp(totals.rentYield / tenantCount, 0.55, 1.8),
        serviceDemand: roundMoney(averageServiceDemand),
        maintenanceLoad: roundMoney(averageMaintenanceLoad),
        inspectionRisk: roundMoney(totals.inspectionRisk / tenantCount),
        contractFlow: roundMoney(totals.contractFlow / tenantCount),
        reputationEffect: roundMoney(totals.reputationEffect / tenantCount),
        upkeepDaily
    };
}

export function summarisePropertyEconomics(property) {
    const asset = normaliseProperty(property);
    const tenantEffects = getPropertyTenantEconomicEffects(asset);
    const grossRent = roundMoney(asset.units * asset.rentDaily * asset.occupancy * tenantEffects.rentMultiplier);
    const upkeep = roundMoney(asset.upkeepDaily + tenantEffects.upkeepDaily);
    const debt = roundMoney(asset.debtDaily);
    const netIncome = roundMoney(grossRent - upkeep - debt);
    return { grossRent, upkeep, debt, netIncome, tenantEffects };
}

export function tickPropertyDaily(property) {
    const asset = normaliseProperty(property);
    const economics = summarisePropertyEconomics(asset);
    const rentPressure = asset.rentPosture === "high" ? PROPERTY_DEFAULTS.HIGH_RENT_OCCUPANCY_DRAG
        : asset.rentPosture === "low" ? -PROPERTY_DEFAULTS.LOW_RENT_OCCUPANCY_GAIN : 0;
    const tenantEffects = economics.tenantEffects || getPropertyTenantEconomicEffects(asset);
    const tenantMaintenanceDecay = tenantEffects.maintenanceLoad * 0.025;
    const conditionDecay = PROPERTY_DEFAULTS.DAILY_CONDITION_DECAY
        + tenantMaintenanceDecay
        + Math.max(0, 70 - asset.condition) / 2000;
    const nextCondition = clamp(asset.condition - conditionDecay, PROPERTY_DEFAULTS.CONDITION_MIN, PROPERTY_DEFAULTS.CONDITION_MAX);
    const conditionOccupancyDrag = asset.condition < 45 ? 0.01 : asset.condition > 80 ? -0.004 : 0;
    const nextOccupancy = clamp(asset.occupancy - rentPressure - conditionOccupancyDrag, PROPERTY_DEFAULTS.OCCUPANCY_MIN, PROPERTY_DEFAULTS.OCCUPANCY_MAX);
    const events = [];
    if (asset.condition < 50 && !asset.eventCooldowns.maintenance_warning) {
        events.push({ type: "property_maintenance_warning", propertyId: asset.id, severity: "minor" });
        asset.eventCooldowns.maintenance_warning = 3;
    }
    Object.entries(asset.eventCooldowns).forEach(([key, value]) => {
        asset.eventCooldowns[key] = Math.max(0, Number(value || 0) - 1);
        if (asset.eventCooldowns[key] === 0) delete asset.eventCooldowns[key];
    });
    return {
        property: normaliseProperty({ ...asset, condition: nextCondition, occupancy: nextOccupancy }),
        creditsDelta: economics.netIncome,
        economics,
        events
    };
}

function competency(character, stat, effectKey) {
    return getCharacterStat(character, stat)
        + getTraitBonus(character, effectKey)
        + getSkillEffect(character, effectKey) * 4;
}

function combinedCompetency(character, stat, effectKeys = []) {
    return effectKeys.reduce((score, effectKey) => (
        score + getTraitBonus(character, effectKey) + getSkillEffect(character, effectKey) * 4
    ), getCharacterStat(character, stat));
}

function getPropertyActionOptions(actionId, property) {
    const asset = normaliseProperty(property);
    if (actionId === "setRentPosture") {
        if (asset.occupancy >= 0.88 && asset.condition >= 62) return { posture: "high" };
        if (asset.occupancy < 0.7 || asset.rentPosture === "high") return { posture: "low" };
        return { posture: "market" };
    }
    if (actionId === "performMaintenance") return { spend: 250 };
    if (actionId === "screenTenants") return {};
    if (actionId === "changeTenantMix") return { tenantMix: "screened_mixed" };
    if (actionId === "convertPropertyUse") return {};
    if (actionId === "addService") return {};
    if (actionId === "refinanceProperty") return {};
    if (actionId === "hirePropertyManager") return { day: state.player?.time?.day || null };
    return {};
}

export function resolvePropertyAction(property, actionId, character, options = {}) {
    const action = PROPERTY_ACTIONS[actionId];
    if (!action) return { ok: false, reason: `Unknown property action '${actionId}'.` };
    const asset = normaliseProperty(property);
    const score = competency(character, action.stat, PROPERTY_ACTION_BONUS_KEYS[actionId] || `${actionId}Bonus`);
    const margin = score - CHAR_DEFAULTS.STAT_BASE;
    const updated = { ...asset };
    let creditsDelta = 0;
    let message = `${action.label} attempted with ${action.stat}.`;
    if (actionId === "performMaintenance") {
        const spend = Math.max(0, Number(options.spend || 250));
        creditsDelta -= spend;
        updated.condition = clamp(updated.condition + 4 + Math.max(0, margin) / 6, 0, 100);
        message = "Maintenance priorities are resolved through fieldcraft and preparation.";
    } else if (actionId === "setRentPosture") {
        updated.rentPosture = ["low", "market", "high"].includes(options.posture) ? options.posture : "market";
        message = "Rent posture uses character valuation rather than manual accounting puzzles.";
    } else if (actionId === "screenTenants") {
        updated.occupancy = clamp(updated.occupancy + 0.01 + Math.max(0, margin) / 2500, 0, 1);
        creditsDelta -= 75;
        message = "Tenant screening improves information quality and occupancy risk.";
    } else if (actionId === "hirePropertyManager") {
        if (updated.manager === null || updated.manager === undefined) updated.upkeepDaily += MANAGER_UPKEEP_DAILY;
        updated.manager = { quality: clamp(Math.round(score / 20), 1, 5), hiredDay: options.day || null };
        message = "Delegation quality is mediated by command.";
    } else if (actionId === "refinanceProperty") {
        if ((updated.eventCooldowns?.refinanceProperty || 0) > 0) {
            return { ok: false, reason: "Refinance terms are already locked for today." };
        }
        const reduction = score >= 85 ? 0.12 : score >= 65 ? 0.06 : 0.02;
        updated.debtDaily = roundMoney(updated.debtDaily * (1 - reduction));
        updated.eventCooldowns = { ...updated.eventCooldowns, refinanceProperty: 1 };
        message = "Refinance terms are estimated and negotiated through acumen.";
    } else if (actionId === "convertPropertyUse") {
        if (updated.units <= 1) {
            return { ok: false, reason: "Cannot convert the last remaining residential unit." };
        }
        updated.storageCapacity += 40;
        updated.units -= 1;
        updated.upkeepDaily += CONVERSION_UPKEEP_DAILY;
        message = "Conversion planning recommends the routine profitable use when competency is high.";
    } else if (actionId === "addService") {
        updated.serviceSlots += 1;
        updated.upkeepDaily += 30;
        updated.rentDaily += 8;
        message = "Service staffing and institutional execution are command-mediated.";
    } else if (actionId === "changeTenantMix") {
        updated.tenantMix = options.tenantMix || updated.tenantMix;
        message = "Leasing terms and tenant targeting are tradecraft-mediated.";
    }
    updated.valueEstimate = propertyValueEstimate(updated);
    return { ok: true, property: normaliseProperty(updated), creditsDelta, score, message };
}

function getPropertyMarketContext(property, context = {}) {
    const asset = normaliseProperty(property);
    const source = context && typeof context === "object" ? context : {};
    const siteId = source.siteId || asset.siteId;
    const port = source.port || state.ports?.[siteId] || null;
    const sector = source.sector || state.universe?.[siteId] || null;
    const routes = Array.isArray(source.routes)
        ? source.routes
        : (Array.isArray(state.tradeRoutes) ? state.tradeRoutes : []);
    const marketCommodities = port
        ? Object.keys({ ...(port.stock || {}), ...(port.maxStock || {}) })
        : [];
    const stockRatios = marketCommodities.map(commodity => {
        const maxStock = Math.max(1, finiteNumber(port.maxStock?.[commodity], 1));
        return nonNegativeNumber(port.stock?.[commodity]) / maxStock;
    });
    const cargoOverflow = Math.max(0, Math.max(...stockRatios, 0) - 0.78);
    const shortagePressure = stockRatios.filter(ratio => ratio < 0.28).length;
    const localRoutes = routes.filter(route => (
        route
            && typeof route === "object"
            && (route.originSector === siteId || route.destinationSector === siteId)
    ));
    const routeOutages = localRoutes.filter(route => (
        route.status === "paused" || route.status === "closed" || nonNegativeNumber(route.starvedDays) > 0
    )).length;
    const piratePressure = Math.max(
        0,
        finiteNumber(source.piratePressure ?? sector?.pirateThreat, 0)
    );
    const highTradeVolume = Math.max(
        finiteNumber(source.highTradeVolume, 0),
        localRoutes.reduce((total, route) => total + nonNegativeNumber(route.amount), 0)
    );
    const demandScore = Math.round(
        cargoOverflow * 120
            + shortagePressure * 14
            + routeOutages * 18
            + piratePressure * 12
            + Math.min(40, highTradeVolume / 8)
    );
    return {
        siteId,
        port,
        sector,
        cargoOverflow,
        shortagePressure,
        routeOutages,
        piratePressure,
        highTradeVolume,
        demandScore,
        localRoutes
    };
}

function uniqueList(values) {
    return Array.from(new Set(values.filter(value => typeof value === "string" && value.length > 0)));
}

function intersectCount(left, right) {
    const rightSet = new Set(right);
    return uniqueList(left).filter(value => rightSet.has(value)).length;
}

function commodityLabel(commodity) {
    return COMMODITY_NAMES[commodity] || commodity.replaceAll("_", " ");
}

function getConnectedSiteIds(siteId, sector) {
    const gates = Array.isArray(sector?.jumpGates) ? sector.jumpGates : [];
    return Array.from(new Set(
        gates
            .map(gate => Number(gate.destinationSectorId))
            .concat([siteId])
            .filter(id => Number.isFinite(id))
    ));
}

function getLocalCompanies(siteId, sector, source) {
    if (Array.isArray(source.companies)) return source.companies.filter(Boolean);
    const companies = state.companies || {};
    const idsBySector = state.companyIdsBySector || {};
    const connectedSiteIds = getConnectedSiteIds(siteId, sector);
    const ids = connectedSiteIds.flatMap(id => idsBySector[id] || []);
    return ids.map(id => companies[id]).filter(Boolean);
}

function companyProductionProfile(company) {
    const profile = company?.orderProfile?.productionProfile;
    if (profile) {
        return {
            inputs: uniqueList(profile.inputs || []),
            outputs: uniqueList(profile.outputs || []),
            mode: profile.mode || COMPANY_PRODUCTION_PROFILES[company.type]?.mode || "commerce"
        };
    }
    const configured = COMPANY_PRODUCTION_PROFILES[company?.type] || COMPANY_PRODUCTION_PROFILES.import_export;
    return {
        inputs: uniqueList(configured.inputs || []),
        outputs: uniqueList(configured.outputs || []),
        mode: configured.mode || "commerce"
    };
}

export function getCompanyLeasingNeeds(company) {
    const profile = companyProductionProfile(company);
    const type = company?.type || "import_export";
    const needs = ["office_space"];
    if (profile.inputs.length > 0) needs.push("input_storage");
    if (profile.outputs.length > 0) needs.push("output_storage");
    if (["haulage", "import_export", "dockyard", "ship_refitter"].includes(type)) {
        needs.push("berth_access");
    }
    if (["haulage", "dockyard", "ship_refitter", "security_contractor"].includes(type)) {
        needs.push("repair_access");
    }
    if (["import_export", "black_market_front"].includes(type)) {
        needs.push("bonded_cargo_services");
    }
    if (["dockyard", "black_market_front", "security_contractor"].includes(type)) {
        needs.push("security");
    }
    needs.push("staff_housing");
    return {
        companyId: company?.id || null,
        companyName: company?.name || "Unlisted Company",
        companyType: type,
        productionMode: profile.mode,
        inputs: profile.inputs,
        outputs: profile.outputs,
        needs: uniqueList(needs)
    };
}

function getAssetCommodityFocus(asset, port, portTypeKey) {
    const portType = port ? getPortType(port) : PORT_TYPES[portTypeKey] || PORT_TYPES.consumer;
    let focus = [];
    if (asset.kind === "warehouse" || asset.tags.includes("warehouse")) {
        focus = focus.concat(portType.buys || [], portType.sells || []);
    }
    if (asset.kind === "repair_bay" || asset.tags.includes("repair")) {
        focus = focus.concat(["repair_parts", "electronics", "machinery", "construction_kits", "control_cores", "gate_coils"]);
    }
    if (asset.kind === "market_arcade" || asset.tags.includes("retail")) {
        focus = focus.concat(["medical_supplies", "eq", "electronics", "org", "water_ice"]);
    }
    if (asset.tags.includes("berths")) {
        focus = focus.concat(["repair_parts", "pulse_canister", "gate_coils", "control_cores"]);
    }
    if (asset.kind === "tenement" || asset.tags.includes("residential")) {
        focus = focus.concat(["water_ice", "org", "medical_supplies", "eq"]);
    }
    return uniqueList(focus.length > 0 ? focus : (portType.buys || []).concat(portType.sells || []));
}

function getShortageAndSurplus(port) {
    if (!port) return { shortages: [], surplus: [] };
    const commodities = uniqueList(Object.keys({ ...(port.stock || {}), ...(port.maxStock || {}) }));
    const shortages = [];
    const surplus = [];
    commodities.forEach(commodity => {
        const maxStock = Math.max(1, finiteNumber(port.maxStock?.[commodity], 1));
        const ratio = nonNegativeNumber(port.stock?.[commodity]) / maxStock;
        if (ratio < 0.32) shortages.push(commodity);
        if (ratio > 0.82) surplus.push(commodity);
    });
    return { shortages, surplus };
}

function routePressureCommodities(routes, siteId) {
    return uniqueList(routes
        .filter(route => route && (route.originSector === siteId || route.destinationSector === siteId))
        .filter(route => route.status === "paused" || route.status === "closed" || nonNegativeNumber(route.starvedDays) > 0)
        .map(route => route.commodity));
}

export function getPropertySupplyChainContext(property, context = {}) {
    const asset = normaliseProperty(property);
    const source = context && typeof context === "object" ? context : {};
    const market = source.market || getPropertyMarketContext(asset, source);
    const port = market.port;
    const portTypeKey = port ? normalisePortTypeKey(port) : "consumer";
    const portType = port ? getPortType(port) : PORT_TYPES[portTypeKey] || PORT_TYPES.consumer;
    const stock = getShortageAndSurplus(port);
    const routePressure = routePressureCommodities(market.localRoutes, market.siteId);
    const companies = getLocalCompanies(market.siteId, market.sector, source);
    const companyNeeds = companies.map(company => getCompanyLeasingNeeds(company));
    const companyInputs = uniqueList(companyNeeds.flatMap(need => need.inputs));
    const companyOutputs = uniqueList(companyNeeds.flatMap(need => need.outputs));
    const focusCommodities = getAssetCommodityFocus(asset, port, portTypeKey);
    const relevantShortages = uniqueList(stock.shortages.filter(commodity => focusCommodities.includes(commodity)));
    const relevantRoutePressure = uniqueList(routePressure.filter(commodity => focusCommodities.includes(commodity)));
    const companyStorageDemand = companyNeeds.reduce((total, need) => {
        const storageNeeds = intersectCount(need.needs, ["input_storage", "output_storage", "bonded_cargo_services"]);
        const commodityOverlap = intersectCount(focusCommodities, need.inputs.concat(need.outputs));
        return total + storageNeeds * 8 + commodityOverlap * 4;
    }, 0);
    const storagePressure = Math.round(
        relevantShortages.length * 14
            + relevantRoutePressure.length * 16
            + stock.surplus.filter(commodity => focusCommodities.includes(commodity)).length * 8
            + companyStorageDemand
    );
    return {
        portTypeKey,
        portTypeName: portType.name,
        buyLanes: (portType.buys || []).slice(),
        sellLanes: (portType.sells || []).slice(),
        shortages: stock.shortages,
        surplus: stock.surplus,
        routePressureCommodities: routePressure,
        focusCommodities,
        relevantShortages,
        relevantRoutePressure,
        companyNeeds,
        companyInputs,
        companyOutputs,
        storagePressure
    };
}

export function getPropertyDemandSignals(property, context = {}) {
    const market = getPropertyMarketContext(property, context);
    const supplyChain = getPropertySupplyChainContext(property, { ...context, market });
    const signals = [];
    if (market.cargoOverflow > 0) signals.push("cargo overflow");
    if (market.shortagePressure > 0) signals.push("local shortages");
    if (market.routeOutages > 0) signals.push("route outages");
    if (market.piratePressure > 0) signals.push("pirate pressure");
    if (market.highTradeVolume > 0) signals.push("trade volume");
    if (supplyChain.storagePressure > 0) signals.push("supply-chain storage pressure");
    if (supplyChain.companyNeeds.length > 0) signals.push("company leasing demand");
    return { ...market, supplyChain, signals };
}

function marketTenantBias(type, asset, market, context = {}) {
    const profile = PROPERTY_TENANT_TYPES[type];
    let score = 0;
    if (profile.tags.includes("route")) score += market.routeOutages * 14 + market.highTradeVolume / 12;
    if (profile.tags.includes("repair")) score += market.piratePressure * 16;
    if (profile.tags.includes("commercial")) score += market.shortagePressure * 8;
    if (profile.tags.includes("import_export")) score += market.demandScore / 2;
    if (profile.tags.includes("black_market")) score += market.shortagePressure * 16 + market.piratePressure * 4;
    const supplyChain = context.supplyChain || getPropertySupplyChainContext(asset, { ...context, market });
    score += intersectCount(profile.commodityFocus || [], supplyChain.focusCommodities) * 5;
    score += intersectCount(profile.commodityFocus || [], supplyChain.relevantShortages) * 7;
    score += intersectCount(profile.leasingNeeds || [], supplyChain.companyNeeds.flatMap(need => need.needs)) * 4;
    if (profile.tags.includes("paperwork")) score += (context.inspection || getPropertyInspectionExposure(asset, { market })).exposure * 0.4;
    if (asset.tags.includes("repair") && profile.tags.includes("repair")) score += 18;
    if (asset.tags.includes("warehouse") && profile.tags.includes("import_export")) score += 16;
    if (asset.tags.includes("berths") && profile.tags.includes("route")) score += 16;
    return score;
}

export function scorePropertyTenant(property, tenant, character, context = {}) {
    const asset = normaliseProperty(property);
    const market = context.market || getPropertyMarketContext(asset, context);
    const candidate = normaliseTenantEntity(tenant);
    const competencies = context.competencies || getPropertyCompetencies(character);
    const baseScore = candidate.rentYield * 35
        + candidate.reliability * 0.55
        + candidate.contractFlow * 18
        + candidate.reputationEffect * 20
        - candidate.disputeRisk * 55
        - candidate.maintenanceLoad * Math.max(0, 14 - asset.condition / 8)
        - candidate.serviceDemand * Math.max(0, 10 - asset.serviceSlots * 5);
    const inspectionPenalty = candidate.tags.includes("inspection_risk")
        ? getPropertyInspectionExposure(asset, { market }).exposure * 0.18
        : 0;
    const competencyClarity = (competencies.tradecraft + competencies.command) / 40;
    const score = Math.round(
        baseScore
            + marketTenantBias(candidate.type, asset, market, context)
            - inspectionPenalty
            + competencyClarity
    );
    const recommendation = score >= 72 ? "retain" : score >= 52 ? "screen" : "replace";
    return { tenant: candidate, score, recommendation, market, competencies };
}

export function recommendPropertyTenantMix(property, character, context = {}) {
    const asset = normaliseProperty(property);
    const market = context.market || getPropertyMarketContext(asset, context);
    const competencies = context.competencies || getPropertyCompetencies(character);
    const quality = getRecommendationQuality(competencies);
    const current = asset.tenants.map(tenant => scorePropertyTenant(
        asset,
        tenant,
        character,
        { ...context, market, competencies }
    ));
    const candidates = Object.keys(PROPERTY_TENANT_TYPES)
        .map(type => scorePropertyTenant(asset, { type }, character, { ...context, market, competencies }))
        .sort((a, b) => b.score - a.score);
    const weakTenant = current.find(result => result.recommendation === "replace");
    const best = candidates[0];
    const action = weakTenant ? "replace" : current.some(result => result.recommendation === "screen") ? "screen" : "retain";
    let text = "Tenant records are too noisy; screen leases before changing the mix.";
    if (quality === "max") {
        const bestTypes = candidates.slice(0, 3).map(result => result.tenant.label).join(", ");
        text = `Best tenant mix: ${bestTypes}. ${best.tenant.label} is the strongest current target at score ${best.score}.`;
    } else if (quality === "high") {
        text = `Prefer ${best.tenant.label}; the lease upside is visible but disputes still need monitoring.`;
    } else if (quality === "medium") {
        text = `Likely tenant pressure: ${best.tenant.label} looks useful, but screen the current ledger first.`;
    }
    return { quality, action, current, candidates, bestTenant: best.tenant, market, text };
}

export function getPropertyTenantHooks(property) {
    const asset = normaliseProperty(property);
    return asset.tenants.flatMap(tenant => {
        const hooks = [];
        if (tenant.tags.includes("contract_source")) {
            hooks.push({ tenantId: tenant.id, type: "contract_source", text: `${tenant.label} can source commercial contracts.` });
        }
        if (tenant.tags.includes("import_export")) {
            hooks.push({ tenantId: tenant.id, type: "import_export_contracts", text: `${tenant.label} can unlock import/export contracts.` });
        }
        if (tenant.tags.includes("emergency_service")) {
            hooks.push({ tenantId: tenant.id, type: "emergency_repairs", text: `${tenant.label} improves emergency repair access.` });
        }
        if (tenant.tags.includes("informant")) {
            hooks.push({ tenantId: tenant.id, type: "informant", text: `${tenant.label} can feed property and market intel.` });
        }
        if (tenant.tags.includes("political_liability") || tenant.tags.includes("black_market")) {
            hooks.push({ tenantId: tenant.id, type: "political_liability", text: `${tenant.label} can draw official or faction attention.` });
        }
        return hooks;
    });
}

export function getPropertyInspectionExposure(property, context = {}) {
    const asset = normaliseProperty(property);
    const source = context && typeof context === "object" ? context : {};
    const market = source.market || getPropertyMarketContext(asset, source);
    const tenantExposure = asset.tenants.reduce((total, tenant) => {
        const profileExposure = Math.round((tenant.inspectionRisk || 0) * 38);
        if (tenant.tags.includes("black_market")) return total + 34 + profileExposure;
        if (tenant.tags.includes("inspection_risk")) return total + 18 + profileExposure;
        if (tenant.tags.includes("paperwork")) return total - 10 + profileExposure;
        return total + profileExposure;
    }, 0);
    const storageExposure = asset.storageCapacity > 0 || asset.tags.includes("warehouse") ? 14 : 0;
    const bondedExposure = asset.tags.includes("bonded_storage") || asset.tags.includes("import_export") ? 16 : 0;
    const berthExposure = asset.tags.includes("berths") ? 10 : 0;
    const rentExposure = asset.rentPosture === "high" && asset.occupancy < 0.72 ? 14 : 0;
    const marketExposure = market.routeOutages * 4 + market.piratePressure * 5;
    const factionHeat = nonNegativeNumber(source.factionHeat);
    const lawMultiplier = 1 + clamp(finiteNumber(source.inspectionLevel, 0.35), 0, 1);
    const raw = (storageExposure + bondedExposure + berthExposure + rentExposure
        + tenantExposure + marketExposure + factionHeat) * lawMultiplier;
    const exposure = clamp(Math.round(raw), 0, 100);
    const band = exposure >= 70 ? "severe" : exposure >= 45 ? "elevated" : exposure >= 22 ? "routine" : "low";
    return { exposure, band, market };
}

export function resolvePropertyInspection(property, character, context = {}) {
    const asset = normaliseProperty(property);
    const exposure = getPropertyInspectionExposure(asset, context);
    const competencies = getPropertyCompetencies(character);
    const paperworkBuffer = asset.tenants.some(tenant => tenant.tags.includes("paperwork")) ? 8 : 0;
    const score = Math.round(
        competencies.tradecraft * 0.4
            + competencies.acumen * 0.32
            + competencies.nerve * 0.3
            + getTraitBonus(character, "legalPaperworkHeatMod")
            + paperworkBuffer
            - exposure.exposure * 0.45
    );
    if (score >= 44) {
        return { outcome: "managed_paperwork", exposure, score, heatDelta: 0, fine: 0, delayDays: 0, text: "Routine inspection converted into managed paperwork." };
    }
    if (score >= 26) {
        return { outcome: "warning", exposure, score, heatDelta: 2, fine: 0, delayDays: 1, text: "Inspectors leave a vague warning and a short administrative delay." };
    }
    if (score >= 8) {
        return { outcome: "fine", exposure, score, heatDelta: 5, fine: 180, delayDays: 2, text: "Inspection produces fines, delays, and sharper records." };
    }
    return { outcome: "tenant_loss", exposure, score, heatDelta: 9, fine: 320, delayDays: 4, text: "Inspection pressure causes fines, delays, tenant loss, and faction heat." };
}

export function evaluateDelegatedPropertyFreight(property, character, terms = {}) {
    const asset = normaliseProperty(property);
    const source = terms && typeof terms === "object" ? terms : {};
    const originSector = asset.siteId;
    const destinationSector = source.destinationSector || originSector;
    const commodity = source.commodity || Object.keys(asset.storedGoods)[0] || "ore";
    const amount = Math.max(1, finiteNumber(source.amount, asset.storedGoods[commodity] || 10));
    const riskPosture = ["cautious", "balanced", "aggressive"].includes(source.riskPosture)
        ? source.riskPosture
        : "balanced";
    const routeOptions = getRouteCommodityOptions(originSector, destinationSector);
    const routeViable = originSector !== destinationSector && routeOptions.includes(commodity);
    const routeRisk = routeViable ? getRouteRiskForSectors(originSector, destinationSector) : 0;
    const expectedProfit = routeViable ? estimateRouteProfit(originSector, destinationSector, commodity, amount) : 0;
    const captains = Object.values(state.captains || {}).filter(captain => {
        if (captain.status === "inactive") return false;
        return captain.known || captain.currentSector === state.player?.currentSector;
    });
    const selectedCaptain = source.captainId
        ? captains.find(captain => captain.id === source.captainId) || null
        : captains[0] || null;
    const relation = selectedCaptain?.relationshipToPlayer || { opinion: 0, trust: 0, rivalry: 0 };
    const carrierReliability = selectedCaptain
        ? clamp(55 + (relation.trust || 0) + (relation.opinion || 0) / 2 - (relation.rivalry || 0), 0, 100)
        : 35;
    const competencies = getPropertyCompetencies(character);
    const postureRisk = riskPosture === "cautious" ? -10 : riskPosture === "aggressive" ? 16 : 0;
    const evaluationScore = Math.round(
        competencies.command * 0.3
            + competencies.tradecraft * 0.25
            + competencies.acumen * 0.2
            + carrierReliability * 0.25
            - Number(routeRisk || 0) * 8
            - postureRisk
    );
    const outcome = !routeViable ? "unavailable"
        : evaluationScore >= 72 ? "strong_return"
            : evaluationScore >= 52 ? "acceptable"
                : evaluationScore >= 34 ? "risky"
                    : "poor";
    return {
        outcome,
        routeViable,
        originSector,
        destinationSector,
        commodity,
        amount,
        riskPosture,
        carrierId: selectedCaptain?.id || null,
        carrierReliability,
        routeRisk,
        expectedProfit,
        evaluationScore,
        competencies,
        text: routeViable
            ? `Delegated freight ${commodity} ${originSector}->${destinationSector}: ${outcome}.`
            : "No viable delegated freight route for those terms."
    };
}

function estimateRentPosture(asset, economics, market) {
    if (asset.occupancy >= 0.88 && asset.condition >= 62) {
        return {
            actionId: "setRentPosture",
            score: Math.round(asset.units * asset.rentDaily * 0.06 + market.highTradeVolume / 20),
            text: "raise rent posture toward high while monitoring vacancy drag",
            pressure: "rent posture"
        };
    }
    if (asset.occupancy < 0.68 || (asset.rentPosture === "high" && asset.occupancy < 0.78)) {
        return {
            actionId: "setRentPosture",
            score: Math.round(Math.max(20, Math.abs(economics.netIncome) * 0.12)),
            text: "ease rent posture to rebuild occupancy before chasing nominal rent",
            pressure: "rent posture"
        };
    }
    return {
        actionId: "setRentPosture",
        score: Math.round(Math.max(5, economics.grossRent * 0.02)),
        text: "hold market rent posture until another pressure dominates",
        pressure: "rent posture"
    };
}

function estimateMaintenance(asset) {
    const urgency = Math.max(0, 78 - asset.condition);
    const infrastructureRisk = asset.tags.includes("infrastructure") || asset.tags.includes("repair") ? 12 : 0;
    return {
        actionId: "performMaintenance",
        score: Math.round(urgency * 3 + infrastructureRisk),
        text: asset.condition < 55
            ? "fund maintenance now; condition risk is threatening occupancy and service reliability"
            : "schedule preventive maintenance before decay becomes a crisis",
        pressure: "maintenance urgency"
    };
}

function estimateTenantMix(asset, market, supplyChain = null) {
    const chain = supplyChain || getPropertySupplyChainContext(asset, { market });
    const vacancyPressure = Math.max(0, 0.82 - asset.occupancy) * 160;
    const commercialBonus = asset.tags.includes("retail") || asset.tags.includes("dockside") ? 14 : 0;
    const marketBonus = market.shortagePressure * 10 + market.highTradeVolume / 20;
    const companyBonus = chain.companyNeeds.length * 8 + chain.storagePressure / 8;
    return {
        actionId: asset.occupancy < 0.75 ? "screenTenants" : "changeTenantMix",
        score: Math.round(vacancyPressure + commercialBonus + marketBonus + companyBonus),
        text: asset.occupancy < 0.75
            ? "screen tenants and gather better arrears intel before changing lease terms"
            : "target a steadier tenant mix for fewer arrears and fewer disputes",
        pressure: "tenant mix"
    };
}

function estimateDebtPressure(asset, economics) {
    const debtShare = economics.grossRent > 0 ? asset.debtDaily / economics.grossRent : 1;
    return {
        actionId: "refinanceProperty",
        score: Math.round(debtShare * 80 + (economics.netIncome < 0 ? 30 : 0)),
        text: "refinance or restructure debt before daily income is trapped by creditors",
        pressure: "debt pressure"
    };
}

function estimateStorageConversion(asset, market, supplyChain = null) {
    const chain = supplyChain || getPropertySupplyChainContext(asset, { market });
    const storageDemand = (asset.tags.includes("warehouse") || asset.tags.includes("import_export") ? 38 : 12)
        + market.cargoOverflow * 120
        + market.shortagePressure * 12
        + market.routeOutages * 18
        + chain.storagePressure
        + Math.min(30, market.highTradeVolume / 12);
    const lowYieldUnits = Math.max(0, asset.units - Math.ceil(asset.units * asset.occupancy));
    const conversionGain = Math.round(storageDemand + asset.storageCapacity * 0.08 + lowYieldUnits * 18 - CONVERSION_UPKEEP_DAILY);
    return {
        actionId: "convertPropertyUse",
        score: asset.units > 1 ? conversionGain : -20,
        text: chain.relevantShortages.length > 0
            ? `convert low-yield units to bonded storage for ${chain.relevantShortages.map(commodityLabel).slice(0, 3).join(", ")} gaps`
            : "convert low-yield units to bonded storage for income, accepting inspection exposure",
        pressure: "storage conversion",
        estimatedDelta: conversionGain
    };
}

function estimateServiceExpansion(asset, market, supplyChain = null) {
    const chain = supplyChain || getPropertySupplyChainContext(asset, { market });
    const berthNeed = chain.companyNeeds.filter(need => need.needs.includes("berth_access")).length * 9;
    const repairNeed = chain.companyNeeds.filter(need => need.needs.includes("repair_access")).length * 11;
    const serviceDemand = (asset.tags.includes("services") || asset.tags.includes("berths") || asset.tags.includes("repair") ? 42 : 16)
        + market.piratePressure * 12
        + market.routeOutages * 10
        + berthNeed
        + repairNeed
        + Math.min(24, market.highTradeVolume / 16);
    return {
        actionId: "addService",
        score: Math.round(serviceDemand + asset.serviceSlots * 8 - 30),
        text: "add staffed services if management capacity can absorb the extra disputes",
        pressure: "service expansion"
    };
}

function getPropertyCompetencies(character) {
    const acumen = combinedCompetency(character, "acumen", [
        "rentForecastAccuracy",
        "propertyValuationBonus",
        "refinanceAccuracy",
        "debtPressureVisibility"
    ]);
    const command = combinedCompetency(character, "command", [
        "serviceSlotYieldBonus",
        "occupancyStabilityBonus",
        "propertyManagementBonus"
    ]);
    const fieldcraft = combinedCompetency(character, "fieldcraft", [
        "propertyMaintenanceBonus",
        "conditionForecastAccuracy",
        "infrastructureRiskReduction"
    ]);
    const tradecraft = combinedCompetency(character, "tradecraft", [
        "tenantScreeningBonus",
        "contractRiskVisibility",
        "brokerageBonus",
        "leaseTermAccuracy"
    ]);
    const nerve = combinedCompetency(character, "nerve", [
        "propertyCrisisBonus",
        "rentCollectionBonus",
        "upkeepDeferralBonus"
    ]);
    const average = Math.round((acumen + command + fieldcraft + tradecraft + nerve) / 5);
    const routineInsight = getSkillEffect(character, "propertyRoutineAutomation")
        + getSkillEffect(character, "conversionGuidance")
        + getSkillEffect(character, "storageDemandInsight");
    return { acumen, command, fieldcraft, tradecraft, nerve, average, routineInsight };
}

function getRecommendationQuality(competencies) {
    if (competencies.average >= 92 || competencies.routineInsight >= 3) return "max";
    if (competencies.average >= 78 || competencies.acumen >= 88) return "high";
    if (competencies.average >= 60 || competencies.acumen >= 66) return "medium";
    return "low";
}

function recommendationAccuracy(quality) {
    if (quality === "max") return 0.98;
    if (quality === "high") return 0.88;
    if (quality === "medium") return 0.68;
    return 0.42;
}

export function getPropertyRecommendation(property, character, context = {}) {
    const asset = normaliseProperty(property);
    const economics = summarisePropertyEconomics(asset);
    const competencies = getPropertyCompetencies(character);
    const market = getPropertyMarketContext(asset, context);
    const supplyChain = getPropertySupplyChainContext(asset, { ...context, market });
    const tenantPlan = recommendPropertyTenantMix(asset, character, { ...context, market, competencies, supplyChain });
    const candidates = [
        estimateRentPosture(asset, economics, market),
        estimateMaintenance(asset),
        estimateTenantMix(asset, market, supplyChain),
        estimateDebtPressure(asset, economics),
        estimateStorageConversion(asset, market, supplyChain),
        estimateServiceExpansion(asset, market, supplyChain)
    ].sort((a, b) => b.score - a.score);
    const best = candidates[0];
    const quality = getRecommendationQuality(competencies);
    const estimateAccuracy = recommendationAccuracy(quality);
    if (quality === "max") {
        const shortageText = supplyChain.relevantShortages.length > 0
            ? supplyChain.relevantShortages.map(commodityLabel).slice(0, 3).join(" and ")
            : supplyChain.focusCommodities.map(commodityLabel).slice(0, 2).join(" and ");
        const tenantText = tenantPlan.bestTenant?.label || "an import/export tenant";
        const routineText = best.actionId === "convertPropertyUse"
            ? `The local ${supplyChain.portTypeName} is short ${shortageText}. Converting vacant units to bonded storage and courting ${tenantText} is the best routine move.`
            : `Best routine option: ${best.text}; expected pressure score ${Math.max(1, best.score)}.`;
        return {
            quality,
            estimateAccuracy,
            actionId: best.actionId,
            confidence: 0.96,
            pressure: best.pressure,
            competencies,
            candidates,
            market,
            supplyChain,
            tenantPlan,
            inspection: getPropertyInspectionExposure(asset, { ...context, market }),
            tenantHooks: getPropertyTenantHooks(asset),
            text: routineText
        };
    }
    if (quality === "high") {
        return {
            quality,
            estimateAccuracy,
            actionId: best.actionId,
            confidence: 0.86,
            pressure: best.pressure,
            competencies,
            candidates,
            market,
            supplyChain,
            tenantPlan,
            inspection: getPropertyInspectionExposure(asset, { ...context, market }),
            tenantHooks: getPropertyTenantHooks(asset),
            text: `Practical course: ${best.text}. Net income is about ${economics.netIncome} credits/day before the tradeoff.`
        };
    }
    if (quality === "medium") {
        const secondary = candidates[1];
        return {
            quality,
            estimateAccuracy,
            actionId: best.actionId,
            confidence: 0.64,
            pressure: best.pressure,
            competencies,
            candidates,
            market,
            supplyChain,
            tenantPlan,
            inspection: getPropertyInspectionExposure(asset, { ...context, market }),
            tenantHooks: getPropertyTenantHooks(asset),
            text: `Likely issue: ${best.pressure}. Compare it against ${secondary.pressure} before committing capital.`
        };
    }
    return {
        quality,
        estimateAccuracy,
        actionId: "gather_intel",
        confidence: 0.36,
        pressure: "uncertain ledgers",
        competencies,
        candidates,
        market,
        supplyChain,
        tenantPlan,
        inspection: getPropertyInspectionExposure(asset, { ...context, market }),
        tenantHooks: getPropertyTenantHooks(asset),
        text: "Vague warning: the ledgers, tenant demand, and market snapshots do not line up cleanly. Gather intel, pull ledgers, buy fresher market snapshots, screen tenants, or hire help from a broker before making a major property move."
    };
}

function tenantTypeForCompany(companyType) {
    if (companyType === "refinery_operator") return "refinery_tenants";
    if (companyType === "dockyard" || companyType === "ship_refitter") return "dockyard_tenants";
    if (companyType === "agri_collective") return "agri_tenants";
    if (companyType === "black_market_front") return "black_market_tenants";
    if (companyType === "haulage") return "captains";
    return "company_agents";
}

function assetNeedCoverage(asset, needs) {
    let score = 0;
    if (needs.includes("input_storage") || needs.includes("output_storage")) {
        score += asset.storageCapacity > 0 || asset.tags.includes("warehouse") ? 22 : -8;
    }
    if (needs.includes("bonded_cargo_services")) {
        score += asset.tags.includes("bonded_storage") || asset.tags.includes("import_export") ? 18 : -4;
    }
    if (needs.includes("berth_access")) score += asset.tags.includes("berths") ? 20 : -5;
    if (needs.includes("repair_access")) score += asset.tags.includes("repair") ? 20 : -6;
    if (needs.includes("office_space")) score += asset.units > 0 ? 8 : 0;
    if (needs.includes("staff_housing")) score += asset.kind === "tenement" || asset.units > 2 ? 8 : 0;
    if (needs.includes("security")) score += asset.tags.includes("security") ? 10 : 0;
    return score;
}

export function getPropertyCompanyTenantMatches(property, character, context = {}) {
    const asset = normaliseProperty(property);
    const market = context.market || getPropertyMarketContext(asset, context);
    const supplyChain = context.supplyChain || getPropertySupplyChainContext(asset, { ...context, market });
    const competencies = context.competencies || getPropertyCompetencies(character);
    return supplyChain.companyNeeds.map(need => {
        const tenantType = tenantTypeForCompany(need.companyType);
        const tenantScore = scorePropertyTenant(
            asset,
            { type: tenantType },
            character,
            { ...context, market, supplyChain, competencies }
        );
        const commodityOverlap = intersectCount(
            supplyChain.focusCommodities,
            need.inputs.concat(need.outputs)
        );
        const score = Math.round(
            tenantScore.score
                + assetNeedCoverage(asset, need.needs)
                + commodityOverlap * 6
                + intersectCount(need.inputs, supplyChain.shortages) * 7
        );
        return {
            companyId: need.companyId,
            companyName: need.companyName,
            companyType: need.companyType,
            tenantType,
            tenantLabel: PROPERTY_TENANT_TYPES[tenantType].label,
            needs: need.needs,
            inputs: need.inputs,
            outputs: need.outputs,
            score,
            recommendation: score >= 96 ? "court" : score >= 72 ? "screen" : "wait"
        };
    }).sort((a, b) => b.score - a.score);
}

function contractScore(competencies, base, risk, exposure) {
    return Math.round(
        base
            + competencies.acumen * 0.28
            + competencies.tradecraft * 0.24
            + competencies.command * 0.2
            + competencies.nerve * 0.12
            - risk * 18
            - exposure * 0.16
    );
}

export function getStationaryPropertyContracts(property, character, context = {}) {
    const asset = normaliseProperty(property);
    const market = context.market || getPropertyMarketContext(asset, context);
    const supplyChain = context.supplyChain || getPropertySupplyChainContext(asset, { ...context, market });
    const competencies = context.competencies || getPropertyCompetencies(character);
    const inspection = getPropertyInspectionExposure(asset, { ...context, market });
    const matches = getPropertyCompanyTenantMatches(asset, character, { ...context, market, supplyChain, competencies });
    const primaryCommodity = supplyChain.relevantShortages[0]
        || supplyChain.routePressureCommodities[0]
        || supplyChain.focusCommodities[0]
        || "ore";
    const destinationRoute = market.localRoutes.find(route => route.commodity === primaryCommodity)
        || market.localRoutes[0]
        || null;
    const destinationSector = destinationRoute
        ? (destinationRoute.originSector === asset.siteId ? destinationRoute.destinationSector : destinationRoute.originSector)
        : asset.siteId;
    const opportunities = [];
    if (asset.storageCapacity > 0 || asset.tags.includes("warehouse")) {
        opportunities.push({
            type: "reserve_storage",
            label: "Reserve storage for a company",
            commodity: primaryCommodity,
            companyId: matches[0]?.companyId || null,
            capitalExposure: "low",
            termDays: 14,
            fallbackPlan: "release capacity to spot bonded cargo",
            score: contractScore(competencies, 42 + supplyChain.storagePressure, 0.18, inspection.exposure),
            text: `Reserve storage around ${commodityLabel(primaryCommodity)} pressure without personally flying freight.`
        });
        opportunities.push({
            type: "finance_input_shipment",
            label: "Finance an input shipment",
            commodity: primaryCommodity,
            companyId: matches[0]?.companyId || null,
            capitalExposure: "medium",
            termDays: 21,
            fallbackPlan: "sell financed cargo into the local buy lane",
            score: contractScore(competencies, 52 + supplyChain.relevantShortages.length * 14, 0.34, inspection.exposure),
            text: `Finance ${commodityLabel(primaryCommodity)} into a documented shortage, then let carriers move it.`
        });
    }
    opportunities.push({
        type: "host_office_tenant",
        label: "Host an office tenant",
        commodity: primaryCommodity,
        companyId: matches[0]?.companyId || null,
        capitalExposure: "low",
        termDays: 30,
        fallbackPlan: "convert lease to a screened merchant desk",
        score: contractScore(competencies, 38 + matches.length * 8, 0.12, inspection.exposure),
        text: "Host company paperwork and contract flow for remote brokerage income."
    });
    if (asset.tags.includes("berths")) {
        opportunities.push({
            type: "lease_berth_rights",
            label: "Lease berth rights to a haulage line",
            commodity: primaryCommodity,
            companyId: matches.find(match => match.companyType === "haulage")?.companyId || matches[0]?.companyId || null,
            capitalExposure: "medium",
            termDays: 20,
            fallbackPlan: "auction the slot to delayed route captains",
            score: contractScore(competencies, 48 + market.routeOutages * 16, 0.22, inspection.exposure),
            text: "Monetize berth scarcity created by delayed routes and carrier demand."
        });
    }
    if (destinationSector !== asset.siteId) {
        const delegated = evaluateDelegatedPropertyFreight(asset, character, {
            destinationSector,
            commodity: primaryCommodity,
            amount: Math.max(10, asset.storedGoods[primaryCommodity] || 10),
            riskPosture: context.riskPosture || "balanced"
        });
        opportunities.push({
            type: "delegated_logistics",
            label: "Contract a captain to move stored goods",
            commodity: primaryCommodity,
            companyId: matches[0]?.companyId || null,
            capitalExposure: "variable",
            termDays: 7,
            fallbackPlan: "hold inventory for the next buyer snapshot",
            delegated,
            score: contractScore(competencies, 34 + delegated.evaluationScore / 2, 0.3, inspection.exposure),
            text: delegated.text
        });
    }
    return opportunities.sort((a, b) => b.score - a.score);
}

export function applyPlayerPropertyAction(propertyId, actionId, options = {}) {
    if (!state.player || !Array.isArray(state.player.properties)) {
        return { ok: false, reason: "No player property ledger is available." };
    }
    const index = state.player.properties.findIndex(property => property.id === propertyId);
    if (index < 0) return { ok: false, reason: `Unknown owned property '${propertyId}'.` };
    const property = state.player.properties[index];
    const actionOptions = { ...getPropertyActionOptions(actionId, property), ...options };
    const result = resolvePropertyAction(
        property,
        actionId,
        state.player.character,
        actionOptions
    );
    if (!result.ok) return result;
    const currentCredits = state.player.credits || 0;
    if (result.creditsDelta < 0 && Math.abs(result.creditsDelta) > currentCredits) {
        return { ok: false, reason: `Insufficient credits to perform ${actionId}.` };
    }
    state.player.properties[index] = result.property;
    state.player.credits = Math.max(0, Math.floor(currentCredits + result.creditsDelta));
    return {
        ...result,
        propertyId,
        actionId,
        creditsAfter: state.player.credits
    };
}

export function getAvailablePropertyActions() {
    return PROPERTY_ACTION_LIST.slice();
}

export function runPlayerPropertiesDaily() {
    if (!state.player || !Array.isArray(state.player.properties)) return;
    let totalNet = 0;
    const emittedEvents = [];
    state.player.properties = state.player.properties.map(property => {
        const result = tickPropertyDaily(property);
        totalNet += result.creditsDelta;
        emittedEvents.push(...result.events);
        return result.property;
    });
    state.player.credits = Math.max(0, Math.floor((state.player.credits || 0) + totalNet));
    emittedEvents.forEach(event => {
        addWorldEvent({
            type: event.type,
            sectorId: state.player.currentSector,
            text: `Property ${event.propertyId} needs attention: ${event.severity}.`,
            importance: event.severity === "major" ? 4 : 2,
            alert: event.severity === "major"
        });
    });
}
