export const TRAIT_CATEGORIES = Object.freeze({
    ORIGIN: "origin",
    CAREER: "career"
});

function traitPackage(definition) {
    return Object.freeze({
        selectableInChargen: true,
        bonuses: Object.freeze({}),
        statShifts: Object.freeze({}),
        startBenefits: Object.freeze({}),
        drawbacks: Object.freeze([]),
        exclusiveWith: Object.freeze([]),
        prereqs: Object.freeze({}),
        tags: Object.freeze([]),
        unlock: null,
        ...definition,
        bonuses: Object.freeze(definition.bonuses || {}),
        statShifts: Object.freeze(definition.statShifts || {}),
        startBenefits: Object.freeze(definition.startBenefits || {}),
        drawbacks: Object.freeze(definition.drawbacks || []),
        exclusiveWith: Object.freeze(definition.exclusiveWith || []),
        prereqs: Object.freeze(definition.prereqs || {}),
        tags: Object.freeze(definition.tags || [])
    });
}

export const TRAITS = Object.freeze({
    dockside_brokers_apprentice: traitPackage({
        id: "dockside_brokers_apprentice",
        name: "Dockside Broker's Apprentice",
        category: TRAIT_CATEGORIES.ORIGIN,
        chargenOnly: true,
        description: "Port-born familiarity with prices, favors, and cargo chatter.",
        statShifts: { tradecraft: 4, command: 1 },
        startBenefits: { credits: 500, contacts: ["traders_suri"] },
        drawbacks: ["Less practiced at vacuum work than belt-born crews."],
        bonuses: { marketInsight: 1, employerCommissionBonus: 0.02 },
        tags: ["origin", "market", "contacts"]
    }),
    raised_in_an_asteroid_mine: traitPackage({
        id: "raised_in_an_asteroid_mine",
        name: "Raised in an Asteroid Mine",
        category: TRAIT_CATEGORIES.ORIGIN,
        chargenOnly: true,
        description: "A lifetime around vacuum rigs and ore seams.",
        statShifts: { fieldcraft: 4, nerve: 1 },
        startBenefits: { cargo: { ore: 10 }, contacts: ["miners_brann"] },
        drawbacks: ["Dockside bargaining starts a little rough."],
        bonuses: { miningYieldPercent: 8 },
        tags: ["origin", "mining", "guild"]
    }),
    black_route_family: traitPackage({
        id: "black_route_family",
        name: "Black-Route Family",
        category: TRAIT_CATEGORIES.ORIGIN,
        chargenOnly: true,
        description: "Old kinship ties in unregistered freight lanes.",
        statShifts: { tradecraft: 3, nerve: 2 },
        startBenefits: { privateRep: { vc: 5 }, contacts: ["smugglers_nix"] },
        drawbacks: ["SDA files start with a few uncomfortable annotations."],
        bonuses: { inspectionChanceMod: -0.04, legalPaperworkHeatMod: 2 },
        tags: ["origin", "smuggling", "paperwork"]
    }),
    frontier_cartographer: traitPackage({
        id: "frontier_cartographer",
        name: "Frontier Cartographer",
        category: TRAIT_CATEGORIES.ORIGIN,
        chargenOnly: true,
        description: "Survey work, hazard charts, and a practiced eye for routes.",
        statShifts: { fieldcraft: 3, tradecraft: 1 },
        startBenefits: { equipment: ["survey_charts"] },
        bonuses: { surveyIntelChance: 0.12, routeRiskMod: -0.2, missionOutcomeBonus: 1 },
        tags: ["origin", "survey", "routes"]
    }),
    quartermasters_child: traitPackage({
        id: "quartermasters_child",
        name: "Quartermaster's Child",
        category: TRAIT_CATEGORIES.ORIGIN,
        chargenOnly: true,
        description: "You grew up counting crates and solving shortages.",
        statShifts: { command: 3, tradecraft: 1 },
        startBenefits: { cargo: { org: 8, eq: 4 } },
        bonuses: { shortageReliefPercent: 8, employerWageBonus: 20 },
        tags: ["origin", "logistics", "colony"]
    }),
    political_adjutant: traitPackage({
        id: "political_adjutant",
        name: "Political Adjutant",
        category: TRAIT_CATEGORIES.ORIGIN,
        chargenOnly: true,
        description: "Committee rooms, faction requests, and careful language.",
        statShifts: { command: 4, tradecraft: 1 },
        startBenefits: { publicRep: { sda: 3, fu: 3 }, contacts: ["sda_harrow"] },
        bonuses: { factionAskBonus: 1, politicalInfluenceBonus: 1 },
        tags: ["origin", "politics", "contacts"]
    }),

    portside_heir: traitPackage({
        id: "portside_heir",
        name: "Portside Heir",
        category: TRAIT_CATEGORIES.ORIGIN,
        chargenOnly: true,
        description: "You inherited ledgers, tenant grudges, and a few enforceable leases.",
        statShifts: { acumen: 4, command: 1 },
        startBenefits: { credits: 400, contacts: ["traders_suri"] },
        drawbacks: ["Old tenants know which promises your family broke."],
        bonuses: { propertyValuationBonus: 2, rentForecastAccuracy: 1 },
        tags: ["origin", "property", "finance"]
    }),
    habitat_superintendents_child: traitPackage({
        id: "habitat_superintendents_child",
        name: "Habitat Superintendent's Child",
        category: TRAIT_CATEGORIES.ORIGIN,
        chargenOnly: true,
        description: "Bulkheads, tenants, filters, and petty disputes were dinner-table talk.",
        statShifts: { fieldcraft: 2, command: 2, acumen: 1 },
        startBenefits: { equipment: ["maintenance_keys"] },
        bonuses: { propertyMaintenanceBonus: 2, tenantScreeningBonus: 1 },
        tags: ["origin", "property", "maintenance"]
    }),
    warehouse_bookkeeper: traitPackage({
        id: "warehouse_bookkeeper",
        name: "Warehouse Bookkeeper",
        category: TRAIT_CATEGORIES.ORIGIN,
        chargenOnly: true,
        description: "You learned freight value through invoices, shrinkage, and late fees.",
        statShifts: { acumen: 4, tradecraft: 1 },
        startBenefits: { cargo: { org: 4 }, contacts: ["traders_suri"] },
        bonuses: { storageYieldBonus: 2, rentForecastAccuracy: 1 },
        tags: ["origin", "warehouse", "finance"]
    }),
    dock_union_family: traitPackage({
        id: "dock_union_family",
        name: "Dock Union Family",
        category: TRAIT_CATEGORIES.ORIGIN,
        chargenOnly: true,
        description: "Local workers answer your calls before they answer official forms.",
        statShifts: { tradecraft: 2, command: 2, nerve: 1 },
        startBenefits: { publicRep: { traders: 4 } },
        bonuses: { tenantScreeningBonus: 1, propertyCrisisBonus: 1 },
        tags: ["origin", "dockside", "labor"]
    }),
    company_property_clerk: traitPackage({
        id: "company_property_clerk",
        name: "Company Property Clerk",
        category: TRAIT_CATEGORIES.ORIGIN,
        chargenOnly: true,
        description: "Contracts, concessions, and audit trails taught you institutional leverage.",
        statShifts: { acumen: 3, command: 2 },
        startBenefits: { paperwork: "legal" },
        bonuses: { propertyRefinanceBonus: 1, factionAskBonus: 1 },
        tags: ["origin", "property", "institutions"]
    }),
    backroom_rent_collector: traitPackage({
        id: "backroom_rent_collector",
        name: "Backroom Rent Collector",
        category: TRAIT_CATEGORIES.ORIGIN,
        chargenOnly: true,
        description: "You know which debts bend, which snap, and who notices collection pressure.",
        statShifts: { nerve: 3, tradecraft: 1, acumen: 1 },
        startBenefits: { privateRep: { vc: 3 } },
        drawbacks: ["Hard collections leave a longer political shadow."],
        bonuses: { propertyCrisisBonus: 2, rentCollectionBonus: 1, legalPaperworkHeatMod: 1 },
        tags: ["origin", "property", "pressure"]
    }),
    rent_roll_analyst: traitPackage({
        id: "rent_roll_analyst",
        name: "Rent Roll Analyst",
        category: TRAIT_CATEGORIES.CAREER,
        chargenOnly: false,
        description: "Vacancy, arrears, maintenance drag, and refinance risk fit on one clean sheet.",
        statShifts: { acumen: 4 },
        bonuses: { propertyValuationBonus: 3, rentForecastAccuracy: 2 },
        unlock: { type: "career_milestone", metric: "propertyIncome", amount: 2500 },
        tags: ["career", "property", "finance", "earnable"]
    }),
    hard_nosed_negotiator: traitPackage({
        id: "hard_nosed_negotiator",
        name: "Hard-Nosed Negotiator",
        category: TRAIT_CATEGORIES.CAREER,
        chargenOnly: false,
        description: "You preserve margin in lease renewals, service disputes, and collections.",
        statShifts: { tradecraft: 2, nerve: 2 },
        bonuses: { rentCollectionBonus: 2, tenantScreeningBonus: 1 },
        unlock: { type: "career_milestone", metric: "leaseDeals", amount: 6 },
        tags: ["career", "property", "leasing", "earnable"]
    }),
    beloved_proprietor: traitPackage({
        id: "beloved_proprietor",
        name: "Beloved Proprietor",
        category: TRAIT_CATEGORIES.CAREER,
        chargenOnly: false,
        description: "Tenants forgive delays because you solve visible problems first.",
        statShifts: { command: 2, tradecraft: 2 },
        bonuses: { occupancyStabilityBonus: 2, captainRelationBonus: 2 },
        unlock: { type: "career_milestone", metric: "tenantSatisfaction", amount: 5 },
        tags: ["career", "property", "community", "earnable"]
    }),
    deferred_maintenance_gambler: traitPackage({
        id: "deferred_maintenance_gambler",
        name: "Deferred Maintenance Gambler",
        category: TRAIT_CATEGORIES.CAREER,
        chargenOnly: false,
        description: "You can squeeze cash from tired infrastructure, but the bill comes due.",
        statShifts: { acumen: 2, nerve: 2 },
        bonuses: { upkeepDeferralBonus: 2, propertyCrisisBonus: -1 },
        drawbacks: ["Deferred upkeep creates sharper condition shocks."],
        unlock: { type: "career_milestone", metric: "deferredUpkeep", amount: 4 },
        tags: ["career", "property", "risk", "earnable"]
    }),
    warehouse_factor: traitPackage({
        id: "warehouse_factor",
        name: "Warehouse Factor",
        category: TRAIT_CATEGORIES.CAREER,
        chargenOnly: false,
        description: "Storage, bonded cargo, and import/export support become active profit centers.",
        statShifts: { acumen: 3, tradecraft: 1 },
        bonuses: { storageYieldBonus: 3, routeReliabilityBonus: 2 },
        unlock: { type: "career_milestone", metric: "storedCargo", amount: 300 },
        tags: ["career", "warehouse", "import_export", "earnable"]
    }),
    dock_concessionaire: traitPackage({
        id: "dock_concessionaire",
        name: "Dock Concessionaire",
        category: TRAIT_CATEGORIES.CAREER,
        chargenOnly: false,
        description: "Berths, service slots, queue favors, and dock politics are your leverage.",
        statShifts: { tradecraft: 2, command: 2 },
        bonuses: { serviceSlotYieldBonus: 2, factionAskBonus: 1 },
        unlock: { type: "career_milestone", metric: "dockServices", amount: 8 },
        tags: ["career", "property", "dockside", "earnable"]
    }),
    station_services_operator: traitPackage({
        id: "station_services_operator",
        name: "Station Services Operator",
        category: TRAIT_CATEGORIES.CAREER,
        chargenOnly: false,
        description: "Staffed services, repair queues, and concession scheduling run through you.",
        statShifts: { command: 3, acumen: 1 },
        bonuses: { serviceSlotYieldBonus: 2, propertyMaintenanceBonus: 1 },
        unlock: { type: "career_milestone", metric: "serviceContracts", amount: 6 },
        tags: ["career", "property", "services", "earnable"]
    }),
    district_power_broker: traitPackage({
        id: "district_power_broker",
        name: "District Power Broker",
        category: TRAIT_CATEGORIES.CAREER,
        chargenOnly: false,
        description: "Tenants, captains, officials, and creditors all need something from you.",
        statShifts: { command: 2, tradecraft: 1, acumen: 1 },
        bonuses: { politicalInfluenceBonus: 1, factionAskBonus: 1, propertyValuationBonus: 1 },
        unlock: { type: "career_milestone", metric: "districtDeals", amount: 5 },
        tags: ["career", "property", "politics", "earnable"]
    }),
    veteran_miner: traitPackage({
        id: "veteran_miner",
        name: "Veteran Miner",
        category: TRAIT_CATEGORIES.CAREER,
        chargenOnly: false,
        description: "Professional extraction discipline under bad conditions.",
        statShifts: { fieldcraft: 3, nerve: 2 },
        bonuses: { miningYieldPercent: 12, miningHazardChanceMod: -0.06, missionOutcomeBonus: 1 },
        drawbacks: ["Corporate inspectors expect you to know every mining rule."],
        unlock: { type: "career_milestone", metric: "minedOre", amount: 100 },
        tags: ["career", "mining", "earnable"]
    }),
    freight_dispatcher: traitPackage({
        id: "freight_dispatcher",
        name: "Freight Dispatcher",
        category: TRAIT_CATEGORIES.CAREER,
        chargenOnly: false,
        description: "You can make routine lanes run a little cleaner.",
        statShifts: { command: 2, tradecraft: 2 },
        bonuses: { routeReliabilityBonus: 4, routeRiskMod: -0.15, employerCommissionBonus: 0.03 },
        unlock: { type: "career_milestone", metric: "completedFreight", amount: 8 },
        tags: ["career", "freight", "earnable"]
    }),
    quiet_hands: traitPackage({
        id: "quiet_hands",
        name: "Quiet Hands",
        category: TRAIT_CATEGORIES.CAREER,
        chargenOnly: false,
        description: "Smuggling craft without a lot of ceremony.",
        statShifts: { tradecraft: 3, nerve: 1 },
        exclusiveWith: ["union_paperwork"],
        bonuses: { inspectionChanceMod: -0.08, captainRelationBonus: -2 },
        drawbacks: ["Lawful employers are slower to trust your paperwork."],
        unlock: { type: "career_milestone", metric: "smugglingRuns", amount: 5 },
        tags: ["career", "smuggling", "earnable"]
    }),
    long_range_ears: traitPackage({
        id: "long_range_ears",
        name: "Long-Range Ears",
        category: TRAIT_CATEGORIES.CAREER,
        chargenOnly: false,
        description: "Signal patience and a knack for finding what others miss.",
        statShifts: { fieldcraft: 3 },
        bonuses: { surveyIntelChance: 0.15, routeRiskMod: -0.1, missionOutcomeBonus: 1 },
        unlock: { type: "career_milestone", metric: "surveyFinds", amount: 6 },
        tags: ["career", "survey", "earnable"]
    }),
    settlement_organizer: traitPackage({
        id: "settlement_organizer",
        name: "Settlement Organizer",
        category: TRAIT_CATEGORIES.CAREER,
        chargenOnly: false,
        description: "People, habitats, schedules, and stability.",
        statShifts: { command: 3, fieldcraft: 1 },
        bonuses: { colonyStability: 8, shortageReliefPercent: 10, colonyActionBonus: 2 },
        unlock: { type: "career_milestone", metric: "colonySupport", amount: 4 },
        tags: ["career", "colony", "earnable"]
    }),
    manifest_forger: traitPackage({
        id: "manifest_forger",
        name: "Manifest Forger",
        category: TRAIT_CATEGORIES.CAREER,
        chargenOnly: false,
        description: "Paper trails that appear boring at exactly the right time.",
        statShifts: { tradecraft: 4 },
        exclusiveWith: ["union_paperwork"],
        bonuses: { inspectionChanceMod: -0.1, askQualityBonus: 1 },
        drawbacks: ["Legal offices react badly if the forgery is exposed."],
        unlock: { type: "career_milestone", metric: "paperworkJobs", amount: 4 },
        tags: ["career", "paperwork", "earnable"]
    }),
    rival_handler: traitPackage({
        id: "rival_handler",
        name: "Rival Handler",
        category: TRAIT_CATEGORIES.CAREER,
        chargenOnly: false,
        description: "You know when to placate, pressure, or redirect hostile operators.",
        statShifts: { command: 3, nerve: 1 },
        bonuses: { captainRelationBonus: 5, factionAskBonus: 1, captainActionBonus: 2 },
        unlock: { type: "career_milestone", metric: "captainDeals", amount: 5 },
        tags: ["career", "captains", "earnable"]
    }),
    union_paperwork: traitPackage({
        id: "union_paperwork",
        name: "Union Paperwork",
        category: TRAIT_CATEGORIES.CAREER,
        chargenOnly: false,
        description: "Official forms and labor protections that outlast angry foremen.",
        statShifts: { command: 2, tradecraft: 1 },
        exclusiveWith: ["quiet_hands", "manifest_forger"],
        bonuses: { colonyStability: 4, factionAskBonus: 1, shortageReliefPercent: 6, legalPaperworkHeatMod: -2 },
        unlock: { type: "career_milestone", metric: "legalContracts", amount: 5 },
        tags: ["career", "legal", "earnable"]
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
