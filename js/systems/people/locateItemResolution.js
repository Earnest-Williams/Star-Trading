import { BALANCE, NPC_FINDABLE_PART_DEFS } from '../../constants.js';
import { state } from '../../state.js';
import { random } from '../../utils.js';
import { chooseStable } from './dialogueVoice.js';
import { LOCATE_ITEM_RESULT_MESSAGE_TEMPLATES } from './dialogueTemplates.js';
import { asNumber, asString, formatItemLabel, isObject } from './common.js';
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
const LOCATE_ITEM_BALANCE = BALANCE.DIALOGUE_LOCATE_ITEM;

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
        label: formatItemLabel(safeItemId),
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
    const sectorId = Number(person?.sectorId ?? state.player?.currentSector ?? 0);
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
    const relationshipBonus = clamp(
        relationTrust / LOCATE_ITEM_BALANCE.RELATIONSHIP_TRUST_DIVISOR,
        LOCATE_ITEM_BALANCE.RELATIONSHIP_TRUST_MIN_BONUS,
        LOCATE_ITEM_BALANCE.RELATIONSHIP_TRUST_MAX_BONUS
    ) + clamp(
        familiarity / LOCATE_ITEM_BALANCE.RELATIONSHIP_FAMILIARITY_DIVISOR,
        0,
        LOCATE_ITEM_BALANCE.RELATIONSHIP_FAMILIARITY_MAX_BONUS
    );
    const attemptBonus = Math.min(
        LOCATE_ITEM_BALANCE.ATTEMPT_SUCCESS_BONUS_CAP,
        Math.max(0, asNumber(task?.resolutionAttempts, 0)) * LOCATE_ITEM_BALANCE.ATTEMPT_SUCCESS_BONUS
    );
    const rarityPenalty = clamp(itemDef.rarity, 0, 1) * LOCATE_ITEM_BALANCE.RARITY_SUCCESS_PENALTY;
    const pirateThreatPenalty = Math.min(
        LOCATE_ITEM_BALANCE.PIRATE_THREAT_SUCCESS_PENALTY_CAP,
        context.pirateThreat * LOCATE_ITEM_BALANCE.PIRATE_THREAT_SUCCESS_PENALTY
    );
    let successChance = LOCATE_ITEM_BALANCE.BASE_SUCCESS_CHANCE
        + (favoredPort ? LOCATE_ITEM_BALANCE.FAVORED_PORT_SUCCESS_BONUS : 0)
        + (favoredRegion ? LOCATE_ITEM_BALANCE.FAVORED_REGION_SUCCESS_BONUS : 0)
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

    successChance = clamp(
        successChance,
        LOCATE_ITEM_BALANCE.MIN_SUCCESS_CHANCE,
        LOCATE_ITEM_BALANCE.MAX_SUCCESS_CHANCE
    );
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
    const rarityMultiplier = 1 + clamp(itemDef.rarity, 0, 1) * LOCATE_ITEM_BALANCE.RARITY_PRICE_MULTIPLIER;
    const portPressureMultiplier = richnessPricePressure(context.richness)
        + Math.min(
            LOCATE_ITEM_BALANCE.PIRATE_THREAT_PRICE_MULTIPLIER_CAP,
            context.pirateThreat * LOCATE_ITEM_BALANCE.PIRATE_THREAT_PRICE_MULTIPLIER
        )
        - (favoredPort ? LOCATE_ITEM_BALANCE.FAVORED_PORT_PRICE_DISCOUNT : 0)
        - (favoredRegion ? LOCATE_ITEM_BALANCE.FAVORED_REGION_PRICE_DISCOUNT : 0);
    const relationshipDiscount = clamp(
        1 - Math.max(0, relationTrust) / LOCATE_ITEM_BALANCE.RELATIONSHIP_DISCOUNT_DIVISOR,
        LOCATE_ITEM_BALANCE.RELATIONSHIP_DISCOUNT_MIN,
        LOCATE_ITEM_BALANCE.RELATIONSHIP_DISCOUNT_MAX
    );
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
    const templates = LOCATE_ITEM_RESULT_MESSAGE_TEMPLATES.success;
    if (condition === 'worn') {
        return (chooseStable(templates.worn, `${itemId}|${condition}|${source}`) || '')
            .replaceAll('{label}', label)
            .replaceAll('{source}', source);
    }
    if (condition === 'pristine') {
        return (chooseStable(templates.pristine, `${itemId}|${condition}|${source}`) || '')
            .replaceAll('{label}', label)
            .replaceAll('{source}', source);
    }
    return (chooseStable(templates.default, `${itemId}|${condition}|${source}`) || '')
        .replaceAll('{condition}', condition)
        .replaceAll('{label}', label)
        .replaceAll('{source}', source);
}

export function buildLocateItemFailureMessage(itemId, outcome) {
    const label = getItemDef(itemId).label;
    const tags = Array.isArray(outcome?.explanationTags) ? outcome.explanationTags : [];
    const templates = LOCATE_ITEM_RESULT_MESSAGE_TEMPLATES.failure;
    if (tags.includes('pirate_pressure')) {
        return (chooseStable(templates.pirate_pressure, `${itemId}|pirate_pressure`) || '')
            .replaceAll('{label}', label);
    }
    if (tags.includes('rare_item') || tags.includes('priced_high')) {
        return (chooseStable(templates.market_pressure, `${itemId}|market_pressure`) || '')
            .replaceAll('{label}', label);
    }
    return (chooseStable(templates.default, `${itemId}|default`) || '')
        .replaceAll('{label}', label);
}
