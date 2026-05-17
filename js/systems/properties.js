import { PLATFORM_PACKAGES } from '../config/chargen.js';
import { PROPERTY_ACTIONS, PROPERTY_ACTION_LIST, PROPERTY_DEFAULTS } from '../config/properties.js';
import { CHAR_DEFAULTS } from '../config/characters.js';
import { getCharacterStat } from '../core/characterChecks.js';
import { getTraitBonus } from '../core/traitHooks.js';
import { getSkillEffect } from '../core/skillHooks.js';
import { state } from '../state.js';
import { addWorldEvent } from '../core/worldEvents.js';

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function roundMoney(value) {
    return Math.round(value * 100) / 100;
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
    const condition = clamp(Number(property.condition ?? 65), PROPERTY_DEFAULTS.CONDITION_MIN, PROPERTY_DEFAULTS.CONDITION_MAX);
    const occupancy = clamp(Number(property.occupancy ?? 0.75), PROPERTY_DEFAULTS.OCCUPANCY_MIN, PROPERTY_DEFAULTS.OCCUPANCY_MAX);
    const normalised = {
        id: property.id || `property-${property.kind || "asset"}`,
        siteId: property.siteId || 1,
        kind: property.kind || "tenement",
        label: property.label || "Local Property",
        condition,
        occupancy,
        units: Math.max(1, Number(property.units || 1)),
        rentDaily: Math.max(0, Number(property.rentDaily || 0)),
        upkeepDaily: Math.max(0, Number(property.upkeepDaily || 0)),
        tenantMix: property.tenantMix || "mixed",
        storageCapacity: Math.max(0, Number(property.storageCapacity || 0)),
        serviceSlots: Math.max(0, Number(property.serviceSlots || 0)),
        debtDaily: Math.max(0, Number(property.debtDaily || 0)),
        valueEstimate: Math.max(0, Number(property.valueEstimate || 0)),
        tags: Array.isArray(property.tags) ? property.tags.slice() : [],
        eventCooldowns: property.eventCooldowns && typeof property.eventCooldowns === "object" ? { ...property.eventCooldowns } : {},
        rentPosture: property.rentPosture || "market",
        manager: property.manager || null
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

export function summarisePropertyEconomics(property) {
    const asset = normaliseProperty(property);
    const grossRent = roundMoney(asset.units * asset.rentDaily * asset.occupancy);
    const upkeep = roundMoney(asset.upkeepDaily);
    const debt = roundMoney(asset.debtDaily);
    const netIncome = roundMoney(grossRent - upkeep - debt);
    return { grossRent, upkeep, debt, netIncome };
}

export function tickPropertyDaily(property) {
    const asset = normaliseProperty(property);
    const economics = summarisePropertyEconomics(asset);
    const rentPressure = asset.rentPosture === "high" ? PROPERTY_DEFAULTS.HIGH_RENT_OCCUPANCY_DRAG
        : asset.rentPosture === "low" ? -PROPERTY_DEFAULTS.LOW_RENT_OCCUPANCY_GAIN : 0;
    const conditionDecay = PROPERTY_DEFAULTS.DAILY_CONDITION_DECAY + Math.max(0, 70 - asset.condition) / 2000;
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

function estimateRentPosture(asset, economics) {
    if (asset.occupancy >= 0.88 && asset.condition >= 62) {
        return {
            actionId: "setRentPosture",
            score: Math.round(asset.units * asset.rentDaily * 0.06),
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

function estimateTenantMix(asset) {
    const vacancyPressure = Math.max(0, 0.82 - asset.occupancy) * 160;
    const commercialBonus = asset.tags.includes("retail") || asset.tags.includes("dockside") ? 14 : 0;
    return {
        actionId: asset.occupancy < 0.75 ? "screenTenants" : "changeTenantMix",
        score: Math.round(vacancyPressure + commercialBonus),
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

function estimateStorageConversion(asset) {
    const storageDemand = asset.tags.includes("warehouse") || asset.tags.includes("import_export") ? 38 : 12;
    const lowYieldUnits = Math.max(0, asset.units - Math.ceil(asset.units * asset.occupancy));
    const conversionGain = Math.round(storageDemand + asset.storageCapacity * 0.08 + lowYieldUnits * 18 - CONVERSION_UPKEEP_DAILY);
    return {
        actionId: "convertPropertyUse",
        score: asset.units > 1 ? conversionGain : -20,
        text: "convert low-yield units to bonded storage for income, accepting inspection exposure",
        pressure: "storage conversion",
        estimatedDelta: conversionGain
    };
}

function estimateServiceExpansion(asset) {
    const serviceDemand = asset.tags.includes("services") || asset.tags.includes("berths") || asset.tags.includes("repair") ? 42 : 16;
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
        "refinanceAccuracy"
    ]);
    const command = combinedCompetency(character, "command", [
        "serviceSlotYieldBonus",
        "occupancyStabilityBonus",
        "propertyManagementBonus"
    ]);
    const fieldcraft = combinedCompetency(character, "fieldcraft", [
        "propertyMaintenanceBonus",
        "conditionForecastAccuracy"
    ]);
    const tradecraft = combinedCompetency(character, "tradecraft", [
        "tenantScreeningBonus",
        "contractRiskVisibility",
        "brokerageBonus"
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

export function getPropertyRecommendation(property, character) {
    const asset = normaliseProperty(property);
    const economics = summarisePropertyEconomics(asset);
    const competencies = getPropertyCompetencies(character);
    const candidates = [
        estimateRentPosture(asset, economics),
        estimateMaintenance(asset),
        estimateTenantMix(asset),
        estimateDebtPressure(asset, economics),
        estimateStorageConversion(asset),
        estimateServiceExpansion(asset)
    ].sort((a, b) => b.score - a.score);
    const best = candidates[0];
    const quality = getRecommendationQuality(competencies);
    const estimateAccuracy = recommendationAccuracy(quality);
    if (quality === "max") {
        const routineText = best.actionId === "convertPropertyUse"
            ? `Best routine option: converting two low-yield units to bonded storage likely improves net income by about ${Math.max(1, best.estimatedDelta || best.score)} credits/day, but increases inspection exposure.`
            : `Best routine option: ${best.text}; expected pressure score ${Math.max(1, best.score)}.`;
        return {
            quality,
            estimateAccuracy,
            actionId: best.actionId,
            confidence: 0.96,
            pressure: best.pressure,
            competencies,
            candidates,
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
        text: "Vague warning: the ledgers, tenants, and building condition do not line up cleanly. Gather intel, screen tenants, or hire help before making a major property move."
    };
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
    state.player.properties[index] = result.property;
    state.player.credits = Math.max(0, Math.floor((state.player.credits || 0) + result.creditsDelta));
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
