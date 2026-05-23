import { CHAR_DEFAULTS } from '../config/chargen.js';
import { getTraitBonus } from './traitHooks.js';

export function getCharacterStat(character, stat) {
    const value = character && character.stats && typeof character.stats[stat] === "number"
        ? character.stats[stat]
        : CHAR_DEFAULTS.STAT_BASE;
    return Math.max(CHAR_DEFAULTS.STAT_CHARGEN_MIN, Math.min(CHAR_DEFAULTS.STAT_CAP, value));
}

export function getStatDelta(character, stat) {
    return getCharacterStat(character, stat) - CHAR_DEFAULTS.STAT_BASE;
}

export function getSurveyEfficiency(character) {
    return 1 + getStatDelta(character, "fieldcraft") / 250;
}

export function getMiningYieldMultiplier(character) {
    return 1 + getStatDelta(character, "fieldcraft") / 400 + getTraitBonus(character, "miningYieldPercent") / 100;
}

export function getMiningHazardChanceMod(character) {
    return -getStatDelta(character, "nerve") / 1000 + getTraitBonus(character, "miningHazardChanceMod");
}

export function getInspectionChanceMod(character) {
    return -getStatDelta(character, "tradecraft") / 1000 + getTraitBonus(character, "inspectionChanceMod");
}

export function getCaptainMissionScore(character, mission) {
    const type = mission?.type || "delivery";
    const stat = type === "survey" ? "fieldcraft"
        : type === "contest" ? "command"
            : type === "mining" ? "fieldcraft"
                : "tradecraft";
    return getStatDelta(character, stat) / 2
        + getTraitBonus(character, "captainRelationBonus")
        + getTraitBonus(character, "factionAskBonus") * 3
        + getTraitBonus(character, "missionOutcomeBonus") * 4;
}

export function getMissionOutcomeBand(character, mission) {
    const score = getCaptainMissionScore(character, mission);
    if (score >= 30) return { band: "exceptional", rewardMultiplier: 1.15, influenceBonus: 2, trustBonus: 1 };
    if (score >= 12) return { band: "strong", rewardMultiplier: 1.08, influenceBonus: 1, trustBonus: 0 };
    if (score <= -12) return { band: "rough", rewardMultiplier: 0.95, influenceBonus: 0, trustBonus: 0 };
    return { band: "standard", rewardMultiplier: 1, influenceBonus: 0, trustBonus: 0 };
}

export function getFactionAskCompletionQuality(character, ask) {
    const stat = ask?.type === "frontier_charter" ? "command"
        : ask?.type === "ore_quota" ? "fieldcraft"
            : "tradecraft";
    const score = Math.floor(getStatDelta(character, stat) / 12)
        + getTraitBonus(character, "factionAskBonus")
        + getTraitBonus(character, "askQualityBonus");
    return { score, trustBonus: Math.max(0, Math.min(2, score)), favorBonus: score >= 2 ? 1 : 0 };
}

export function getCaptainRelationshipActionAdjustment(character) {
    return Math.round(getStatDelta(character, "command") / 15)
        + getTraitBonus(character, "captainRelationBonus")
        + getTraitBonus(character, "captainActionBonus");
}

export function getEmploymentTerms(character, employment) {
    if (!employment) return null;
    return {
        ...employment,
        wageDaily: Math.max(0, (employment.wageDaily || 0) + getTraitBonus(character, "employerWageBonus")),
        commissionShare: Math.max(0, (employment.commissionShare || 0) + getTraitBonus(character, "employerCommissionBonus")),
        leaseDaily: Math.max(0, (employment.leaseDaily || 0) - Math.max(0, getStatDelta(character, "tradecraft")))
    };
}

export function getColonyActionAdjustment(character) {
    return Math.round(getStatDelta(character, "command") / 10)
        + getTraitBonus(character, "colonyActionBonus")
        + Math.round(getTraitBonus(character, "colonyStability") / 4);
}

export function getPoliticalActionAdjustment(character) {
    return Math.round(getStatDelta(character, "command") / 12)
        + getTraitBonus(character, "politicalInfluenceBonus")
        + getTraitBonus(character, "factionAskBonus");
}

export function getRouteReliabilityAdjustment(character) {
    return Math.round(getStatDelta(character, "command") / 10)
        + getTraitBonus(character, "routeReliabilityBonus");
}

export function getRouteRiskAdjustment(character) {
    return -getStatDelta(character, "fieldcraft") / 100 + getTraitBonus(character, "routeRiskMod");
}

export function getScanResolutionScore(character) {
    return Math.floor(getStatDelta(character, "fieldcraft") / 4);
}

export function getDeepScanRiskAdjustment(character) {
    return -getStatDelta(character, "nerve") / 100;
}

export function getAnomalyInterpretationScore(character) {
    return Math.floor(getStatDelta(character, "fieldcraft") / 6);
}
