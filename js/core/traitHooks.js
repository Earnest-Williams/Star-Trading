import { getTraitDefinition } from '../config/traits.js';

export function getCharacterTraits(character) {
    if (!character || !Array.isArray(character.traits)) return [];
    return character.traits
        .map(traitId => getTraitDefinition(traitId))
        .filter(Boolean);
}

export function getTraitBonus(character, bonusKey) {
    return getCharacterTraits(character).reduce((sum, trait) => {
        const value = trait.bonuses && typeof trait.bonuses[bonusKey] === "number"
            ? trait.bonuses[bonusKey]
            : 0;
        return sum + value;
    }, 0);
}

export function hasTrait(character, traitId) {
    return Boolean(character && Array.isArray(character.traits) && character.traits.includes(traitId));
}

export function describeActiveBonuses(character) {
    const bonuses = [];
    const miningYield = getTraitBonus(character, "miningYieldPercent");
    if (miningYield) bonuses.push(`Mining yield ${miningYield > 0 ? "+" : ""}${miningYield}%`);
    const inspection = getTraitBonus(character, "inspectionChanceMod");
    if (inspection) bonuses.push(`Inspection risk ${Math.round(inspection * 100)}%`);
    const routeReliability = getTraitBonus(character, "routeReliabilityBonus");
    if (routeReliability) bonuses.push(`Route reliability +${routeReliability}`);
    const colonyStability = getTraitBonus(character, "colonyStability");
    if (colonyStability) bonuses.push(`Colony stability +${colonyStability}`);
    return bonuses;
}
