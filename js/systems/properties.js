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

function propertyValueEstimate(property) {
    const gross = property.units * property.rentDaily * property.occupancy;
    const net = gross - property.upkeepDaily - property.debtDaily;
    const conditionFactor = 0.65 + property.condition / 200;
    return Math.max(0, Math.round((net + property.upkeepDaily) * PROPERTY_DEFAULTS.BASE_VALUE_MULTIPLIER * conditionFactor));
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

export function resolvePropertyAction(property, actionId, character, options = {}) {
    const action = PROPERTY_ACTIONS[actionId];
    if (!action) return { ok: false, reason: `Unknown property action '${actionId}'.` };
    const asset = normaliseProperty(property);
    const score = competency(character, action.stat, `${actionId}Bonus`);
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
        updated.manager = { quality: clamp(Math.round(score / 20), 1, 5), hiredDay: options.day || null };
        updated.upkeepDaily += 35;
        message = "Delegation quality is mediated by command.";
    } else if (actionId === "refinanceProperty") {
        const reduction = score >= 85 ? 0.12 : score >= 65 ? 0.06 : 0.02;
        updated.debtDaily = roundMoney(updated.debtDaily * (1 - reduction));
        message = "Refinance terms are estimated and negotiated through acumen.";
    } else if (actionId === "convertPropertyUse") {
        updated.storageCapacity += 40;
        updated.units = Math.max(1, updated.units - 1);
        updated.upkeepDaily += 20;
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

export function getPropertyRecommendation(property, character) {
    const asset = normaliseProperty(property);
    const economics = summarisePropertyEconomics(asset);
    const acumen = competency(character, "acumen", "rentForecastAccuracy");
    const skillGuidance = getSkillEffect(character, "conversionGuidance") + getSkillEffect(character, "rentForecastAccuracy");
    if (acumen >= 98 || skillGuidance >= 2) {
        const conversionGain = Math.round(Math.max(0, asset.storageCapacity * 0.18 + asset.serviceSlots * 14));
        return {
            quality: "max",
            estimateAccuracy: 0.98,
            actionId: conversionGain > 20 ? "convertPropertyUse" : "setRentPosture",
            text: `Best routine option: convert low-yield space to bonded storage; expected net improves by about ${conversionGain} credits/day with inspection exposure noted.`
        };
    }
    if (acumen >= 80) {
        return {
            quality: "high",
            estimateAccuracy: 0.9,
            actionId: asset.condition < 65 ? "performMaintenance" : "convertPropertyUse",
            text: "Converting low-yield units to bonded storage likely raises income, but deferred maintenance and inspections should be budgeted."
        };
    }
    if (acumen >= 62) {
        return {
            quality: "medium",
            estimateAccuracy: 0.7,
            actionId: economics.netIncome < 0 ? "setRentPosture" : "performMaintenance",
            text: "Expected net income is positive, but deferred maintenance may reduce yield."
        };
    }
    return {
        quality: "low",
        estimateAccuracy: 0.45,
        actionId: null,
        text: "This property appears profitable, but your estimate is uncertain. Hire help or gather better ledgers before committing major capital."
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
