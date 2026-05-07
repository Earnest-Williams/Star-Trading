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
        + getTraitBonus(character, "factionAskBonus") * 3;
}

export function getRouteReliabilityAdjustment(character) {
    return Math.round(getStatDelta(character, "command") / 10)
        + getTraitBonus(character, "routeReliabilityBonus");
}

export function getRouteRiskAdjustment(character) {
    return -getStatDelta(character, "fieldcraft") / 100 + getTraitBonus(character, "routeRiskMod");
}
