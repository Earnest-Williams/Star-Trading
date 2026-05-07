export const TRAIT_CATEGORIES = Object.freeze({
    ORIGIN: "origin",
    CAREER: "career"
});

export const TRAITS = Object.freeze({
    dockside_brokers_apprentice: Object.freeze({
        id: "dockside_brokers_apprentice",
        name: "Dockside Broker's Apprentice",
        category: TRAIT_CATEGORIES.ORIGIN,
        chargenOnly: true,
        description: "Port-born familiarity with prices, favors, and cargo chatter.",
        bonuses: Object.freeze({ tradecraft: 4, marketInsight: 1 })
    }),
    raised_in_an_asteroid_mine: Object.freeze({
        id: "raised_in_an_asteroid_mine",
        name: "Raised in an Asteroid Mine",
        category: TRAIT_CATEGORIES.ORIGIN,
        chargenOnly: true,
        description: "A lifetime around vacuum rigs and ore seams.",
        bonuses: Object.freeze({ fieldcraft: 4, miningYieldPercent: 8 })
    }),
    black_route_family: Object.freeze({
        id: "black_route_family",
        name: "Black-Route Family",
        category: TRAIT_CATEGORIES.ORIGIN,
        chargenOnly: true,
        description: "Old kinship ties in unregistered freight lanes.",
        bonuses: Object.freeze({ tradecraft: 3, inspectionChanceMod: -0.04 })
    }),
    frontier_cartographer: Object.freeze({
        id: "frontier_cartographer",
        name: "Frontier Cartographer",
        category: TRAIT_CATEGORIES.ORIGIN,
        chargenOnly: true,
        description: "Survey work, hazard charts, and a practiced eye for routes.",
        bonuses: Object.freeze({ fieldcraft: 3, surveyIntelChance: 0.12, routeRiskMod: -0.2 })
    }),
    quartermasters_child: Object.freeze({
        id: "quartermasters_child",
        name: "Quartermaster's Child",
        category: TRAIT_CATEGORIES.ORIGIN,
        chargenOnly: true,
        description: "You grew up counting crates and solving shortages.",
        bonuses: Object.freeze({ command: 3, shortageReliefPercent: 8 })
    }),
    political_adjutant: Object.freeze({
        id: "political_adjutant",
        name: "Political Adjutant",
        category: TRAIT_CATEGORIES.ORIGIN,
        chargenOnly: true,
        description: "Committee rooms, faction requests, and careful language.",
        bonuses: Object.freeze({ command: 4, factionAskBonus: 1 })
    }),
    veteran_miner: Object.freeze({
        id: "veteran_miner",
        name: "Veteran Miner",
        category: TRAIT_CATEGORIES.CAREER,
        chargenOnly: true,
        description: "Professional extraction discipline under bad conditions.",
        bonuses: Object.freeze({ miningYieldPercent: 12, miningHazardChanceMod: -0.06 })
    }),
    freight_dispatcher: Object.freeze({
        id: "freight_dispatcher",
        name: "Freight Dispatcher",
        category: TRAIT_CATEGORIES.CAREER,
        chargenOnly: true,
        description: "You can make routine lanes run a little cleaner.",
        bonuses: Object.freeze({ routeReliabilityBonus: 4, routeRiskMod: -0.15 })
    }),
    quiet_hands: Object.freeze({
        id: "quiet_hands",
        name: "Quiet Hands",
        category: TRAIT_CATEGORIES.CAREER,
        chargenOnly: true,
        description: "Smuggling craft without a lot of ceremony.",
        exclusiveWith: Object.freeze(["union_paperwork"]),
        bonuses: Object.freeze({ inspectionChanceMod: -0.08 })
    }),
    long_range_ears: Object.freeze({
        id: "long_range_ears",
        name: "Long-Range Ears",
        category: TRAIT_CATEGORIES.CAREER,
        chargenOnly: true,
        description: "Signal patience and a knack for finding what others miss.",
        bonuses: Object.freeze({ surveyIntelChance: 0.15, routeRiskMod: -0.1 })
    }),
    settlement_organizer: Object.freeze({
        id: "settlement_organizer",
        name: "Settlement Organizer",
        category: TRAIT_CATEGORIES.CAREER,
        chargenOnly: true,
        description: "People, habitats, schedules, and stability.",
        bonuses: Object.freeze({ colonyStability: 8, shortageReliefPercent: 10 })
    }),
    manifest_forger: Object.freeze({
        id: "manifest_forger",
        name: "Manifest Forger",
        category: TRAIT_CATEGORIES.CAREER,
        chargenOnly: true,
        description: "Paper trails that appear boring at exactly the right time.",
        exclusiveWith: Object.freeze(["union_paperwork"]),
        bonuses: Object.freeze({ inspectionChanceMod: -0.1 })
    }),
    rival_handler: Object.freeze({
        id: "rival_handler",
        name: "Rival Handler",
        category: TRAIT_CATEGORIES.CAREER,
        chargenOnly: true,
        description: "You know when to placate, pressure, or redirect hostile operators.",
        bonuses: Object.freeze({ captainRelationBonus: 5, factionAskBonus: 1 })
    }),
    union_paperwork: Object.freeze({
        id: "union_paperwork",
        name: "Union Paperwork",
        category: TRAIT_CATEGORIES.CAREER,
        chargenOnly: true,
        description: "Official forms and labor protections that outlast angry foremen.",
        exclusiveWith: Object.freeze(["quiet_hands", "manifest_forger"]),
        bonuses: Object.freeze({ colonyStability: 4, factionAskBonus: 1, shortageReliefPercent: 6 })
    })
});

export const ORIGIN_TRAITS = Object.freeze(
    Object.values(TRAITS).filter(trait => trait.category === TRAIT_CATEGORIES.ORIGIN).map(trait => trait.id)
);

export const CAREER_TRAITS = Object.freeze(
    Object.values(TRAITS).filter(trait => trait.category === TRAIT_CATEGORIES.CAREER).map(trait => trait.id)
);

export function getTraitDefinition(traitId) {
    return TRAITS[traitId] || null;
}

export function getTraitsByCategory(category) {
    return Object.values(TRAITS).filter(trait => trait.category === category);
}
