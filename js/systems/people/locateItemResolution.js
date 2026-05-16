import { NPC_FINDABLE_PART_DEFS } from '../../constants.js';
import { state } from '../../state.js';
import { random } from '../../utils.js';
import { getDialogueRelationship } from './relationships.js';

export const LOCATE_ITEM_CONDITIONS = Object.freeze([
    'worn',
    'serviceable',
    'refurbished',
    'pristine'
]);

export const LOCATE_ITEM_SOURCE_FLAVORS = Object.freeze([
    'local yard',
    'passing hauler',
    'port broker',
    'back-room supplier'
]);

const MIN_LOCATED_ITEM_PRICE = 50;
const DEFAULT_LOCATED_ITEM_PRICE = 450;

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value, fallback = '') {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function asNumber(value, fallback = 0) {
    if (value === null || typeof value === 'undefined') return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
}

function pushTag(tags, tag) {
    if (!tags.includes(tag)) tags.push(tag);
}

function getItemDef(itemId) {
    const safeItemId = asString(itemId, 'unknown_part');
    const knownDef = NPC_FINDABLE_PART_DEFS[safeItemId];
    if (knownDef) return knownDef;
    return {
        id: safeItemId,
        label: safeItemId.replaceAll('_', ' '),
        basePrice: DEFAULT_LOCATED_ITEM_PRICE,
        rarity: 0.5,
        favoredPortTypes: [],
        favoredRegions: []
    };
}

function richnessPricePressure(richness) {
    const value = asString(richness, 'developing');
    if (value === 'hub') return 0.92;
    if (value === 'strategic') return 0.96;
    if (value === 'rich') return 0.98;
    if (value === 'sparse') return 1.16;
    return 1;
}

function richnessAvailabilityBonus(richness) {
    const value = asString(richness, 'developing');
    if (value === 'hub') return 0.06;
    if (value === 'strategic' || value === 'rich') return 0.04;
    if (value === 'sparse') return -0.05;
    return 0;
}

function roleServiceBonus(person) {
    const services = Array.isArray(person?.services) ? person.services : [];
    let bonus = services.includes('parts') ? 0.08 : 0;
    if (services.includes('discounts')) bonus += 0.03;
    if (services.includes('intel')) bonus += 0.03;
    const role = asString(person?.role, '');
    if (role === 'fixer' || role === 'factor' || role === 'dockmaster') bonus += 0.04;
    return bonus;
}

function chooseCondition({ successChance, pirateThreat, richness, relationship }) {
    const trust = asNumber(relationship?.trust, 0);
    if (successChance >= 0.76 && pirateThreat <= 1 && trust >= 12) return 'pristine';
    if (successChance >= 0.62 && pirateThreat <= 3) return 'refurbished';
    if (successChance >= 0.34 || richness === 'hub') return 'serviceable';
    return 'worn';
}

function conditionMultiplier(condition) {
    if (condition === 'worn') return 0.78;
    if (condition === 'refurbished') return 1.12;
    if (condition === 'pristine') return 1.35;
    return 1;
}

function chooseSourceFlavor({ portType, pirateThreat, person, relationship }) {
    const services = Array.isArray(person?.services) ? person.services : [];
    const trust = asNumber(relationship?.trust, 0);
    if (pirateThreat >= 5 || asString(person?.role, '') === 'fixer') return 'back-room supplier';
    if (portType && services.includes('discounts')) return 'port broker';
    if (trust >= 10 || services.includes('intel')) return 'passing hauler';
    return portType ? 'local yard' : 'passing hauler';
}

function riskLevelForThreat(pirateThreat) {
    if (pirateThreat >= 5) return 'high';
    if (pirateThreat >= 2) return 'medium';
    return 'low';
}

function priceTag(priceMultiplier) {
    if (priceMultiplier >= 1.22) return 'priced_high';
    if (priceMultiplier <= 0.9) return 'relationship_discount';
    return null;
}

export function normaliseLocateItemResolutionPolicy(policy) {
    const source = isObject(policy) ? policy : {};
    const forceResult = asString(source.forceResult, '');
    const safePolicy = {};
    if (forceResult === 'success' || forceResult === 'failure') {
        safePolicy.forceResult = forceResult;
    }
    if (Number.isFinite(Number(source.successChance))) {
        safePolicy.successChance = clamp(Number(source.successChance), 0, 1);
    }
    if (Number.isFinite(Number(source.price))) {
        safePolicy.price = Math.max(MIN_LOCATED_ITEM_PRICE, Math.round(Number(source.price)));
    }
    return safePolicy;
}

export function buildLocateItemResolutionContext(task) {
    const ownerPersonId = asString(task?.ownerPersonId, 'unknown-person');
    const person = state.people?.[ownerPersonId] || null;
    const sectorId = Number(person?.sectorId || state.player?.currentSector || 0);
    const sector = state.universe?.[sectorId] || null;
    const port = state.ports?.[sectorId] || null;
    const relationship = getDialogueRelationship(ownerPersonId) || {};
    return {
        person,
        sectorId,
        sector,
        port,
        portType: asString(port?.typeKey, ''),
        region: asString(sector?.region, ''),
        richness: asString(sector?.richness, 'developing'),
        pirateThreat: Math.max(0, asNumber(sector?.pirateThreat, 0)),
        relationship
    };
}

export function scoreLocateItemResolution(task, context) {
    const itemDef = getItemDef(task?.itemId);
    const policy = normaliseLocateItemResolutionPolicy(task?.resolutionPolicy);
    const explanationTags = [];
    const favoredPort = itemDef.favoredPortTypes.includes(context.portType);
    const favoredRegion = itemDef.favoredRegions.includes(context.region);
    const relationTrust = asNumber(context.relationship?.trust, 0);
    const familiarity = asNumber(context.relationship?.familiarity, 0);
    const relationshipBonus = clamp(relationTrust / 250, -0.08, 0.12)
        + clamp(familiarity / 400, 0, 0.05);
    const attemptBonus = Math.min(0.14, Math.max(0, asNumber(task?.resolutionAttempts, 0)) * 0.04);
    const rarityPenalty = clamp(itemDef.rarity, 0, 1) * 0.22;
    const pirateThreatPenalty = Math.min(0.24, context.pirateThreat * 0.035);
    let successChance = 0.45
        + (favoredPort ? 0.12 : 0)
        + (favoredRegion ? 0.08 : 0)
        + richnessAvailabilityBonus(context.richness)
        + relationshipBonus
        + roleServiceBonus(context.person)
        + attemptBonus
        - rarityPenalty
        - pirateThreatPenalty;

    if (favoredPort) pushTag(explanationTags, 'favored_port');
    if (favoredRegion) pushTag(explanationTags, 'favored_region');
    if (relationshipBonus > 0.04) pushTag(explanationTags, 'trusted_contact');
    if (roleServiceBonus(context.person) > 0) pushTag(explanationTags, 'contact_network');
    if (attemptBonus > 0) pushTag(explanationTags, 'widened_search');
    if (rarityPenalty >= 0.12) pushTag(explanationTags, 'rare_item');
    if (pirateThreatPenalty >= 0.11) pushTag(explanationTags, 'pirate_pressure');

    successChance = clamp(successChance, 0.08, 0.92);
    if (Number.isFinite(Number(policy.successChance))) {
        successChance = policy.successChance;
        pushTag(explanationTags, 'policy_chance_override');
    }

    const riskLevel = riskLevelForThreat(context.pirateThreat);
    const condition = chooseCondition({
        successChance,
        pirateThreat: context.pirateThreat,
        richness: context.richness,
        relationship: context.relationship
    });
    const sourceFlavor = chooseSourceFlavor({
        portType: context.portType,
        pirateThreat: context.pirateThreat,
        person: context.person,
        relationship: context.relationship
    });
    const rarityMultiplier = 1 + clamp(itemDef.rarity, 0, 1) * 0.55;
    const portPressureMultiplier = richnessPricePressure(context.richness)
        + Math.min(0.25, context.pirateThreat * 0.035)
        - (favoredPort ? 0.06 : 0)
        - (favoredRegion ? 0.03 : 0);
    const relationshipDiscount = clamp(1 - Math.max(0, relationTrust) / 400, 0.82, 1.08);
    let priceMultiplier = rarityMultiplier
        * conditionMultiplier(condition)
        * portPressureMultiplier
        * relationshipDiscount;
    priceMultiplier = Math.max(0.1, priceMultiplier);
    let price = Math.max(
        MIN_LOCATED_ITEM_PRICE,
        Math.round(asNumber(itemDef.basePrice, DEFAULT_LOCATED_ITEM_PRICE) * priceMultiplier)
    );
    if (Number.isFinite(Number(policy.price))) {
        price = policy.price;
        pushTag(explanationTags, 'policy_price_override');
    }
    const tag = priceTag(priceMultiplier);
    if (tag) pushTag(explanationTags, tag);

    return {
        itemId: itemDef.id,
        price,
        condition,
        sourceFlavor,
        successChance,
        priceMultiplier,
        riskLevel,
        explanationTags
    };
}

export function resolveLocateItemOutcome(task, reason) {
    const context = buildLocateItemResolutionContext(task);
    const scored = scoreLocateItemResolution(task, context);
    const policy = normaliseLocateItemResolutionPolicy(task?.resolutionPolicy);
    let outcome = policy.forceResult;
    if (outcome !== 'success' && outcome !== 'failure') {
        outcome = random() < scored.successChance ? 'success' : 'failure';
    }
    return {
        ...scored,
        outcome,
        reason: asString(reason, 'hourly tick')
    };
}

export function buildLocateItemSuccessMessage(itemId, outcome) {
    const label = getItemDef(itemId).label;
    const condition = asString(outcome?.condition, 'serviceable');
    const source = asString(outcome?.sourceFlavor, 'port broker');
    if (condition === 'worn') {
        return `I found a worn ${label} from a ${source}. It is not pretty, but it will hold.`;
    }
    if (condition === 'pristine') {
        return `I found a pristine ${label} through a ${source}. It is clean stock and ready for trade.`;
    }
    return `I found a ${condition} ${label} through a ${source}. It is available for trade when you are ready.`;
}

export function buildLocateItemFailureMessage(itemId, outcome) {
    const label = getItemDef(itemId).label;
    const tags = Array.isArray(outcome?.explanationTags) ? outcome.explanationTags : [];
    if (tags.includes('pirate_pressure')) {
        return `No luck on the ${label}. The routes are hot and suppliers are holding stock back.`;
    }
    if (tags.includes('rare_item') || tags.includes('priced_high')) {
        return `No luck on the ${label}. The local brokers are dry and prices are moving against us.`;
    }
    return `No luck on the ${label}. I did not find a lead worth putting aside.`;
}
