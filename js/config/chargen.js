import { STARTER_PLAYER, STARTER_SHIP } from './player.js';

export const CHAR_STATS = Object.freeze([
    "nerve",
    "tradecraft",
    "fieldcraft",
    "command",
    "acumen"
]);

export const CHAR_DEFAULTS = Object.freeze({
    STAT_BASE: 50,
    STAT_CAP: 100,
    STAT_CHARGEN_MIN: 50,
    CHARGEN_POINTS: 150,
    CAREER_TRAIT_COST: 50,
    CASH_PER_LEFTOVER_POINT: 100
});

export const STAT_BUY_CURVE = Object.freeze([
    { from: 1, to: 10, gain: 3 },
    { from: 11, to: 15, gain: 2 },
    { from: 16, to: 25, gain: 1 }
]);

export const DEFAULT_PLATFORM_TYPE = "ship_tier1_tramp";
export const DEFAULT_EMPLOYER_LANE_ID = "sda_auxiliary";
export const LEGACY_PLATFORM_TYPE_MAP = Object.freeze({
    ship_owned: DEFAULT_PLATFORM_TYPE,
    ship_rented: "rental_cutter_no_ship",
    employed_salary: "employer_salary_no_ship",
    employed_commission: "employer_commission_no_ship"
});

export function normalisePlatformType(platformType) {
    return LEGACY_PLATFORM_TYPE_MAP[platformType] || platformType || DEFAULT_PLATFORM_TYPE;
}

export const PLATFORM_PACKAGES = Object.freeze({
    ship_tier1_tramp: Object.freeze({
        id: "ship_tier1_tramp",
        label: "Tier 1 Tramp Freighter",
        category: "ship",
        tier: 1,
        cost: 50,
        runtimeType: "ship_owned",
        description: "Buy a modest independent hauler with room for early trading.",
        creditModifier: 0,
        ship: Object.freeze({ name: "Tramp Freighter", maxHolds: 70, maxFighters: 1400, miningPower: 4 }),
        employment: null
    }),
    ship_tier1_surveyor: Object.freeze({
        id: "ship_tier1_surveyor",
        label: "Tier 1 Survey Cutter",
        category: "ship",
        tier: 1,
        cost: 50,
        runtimeType: "ship_owned",
        description: "Buy a light cutter with better scanners and weaker cargo capacity.",
        creditModifier: -300,
        ship: Object.freeze({ name: "Survey Cutter", maxHolds: 55, scannerLevel: 2, maxFighters: 1200 }),
        employment: null
    }),
    ship_tier2_freighter: Object.freeze({
        id: "ship_tier2_freighter",
        label: "Tier 2 Guild Freighter",
        category: "ship",
        tier: 2,
        cost: 100,
        runtimeType: "ship_owned",
        description: "Spend heavily for a larger hull and stronger defenses.",
        creditModifier: -1000,
        ship: Object.freeze({ name: "Guild Freighter", maxHolds: 105, maxFighters: 2200, maxShields: 140, maxHull: 130 }),
        employment: null
    }),
    ship_tier2_prospector: Object.freeze({
        id: "ship_tier2_prospector",
        label: "Tier 2 Belt Prospector",
        category: "ship",
        tier: 2,
        cost: 100,
        runtimeType: "ship_owned",
        description: "Spend heavily for a mining-focused independent start.",
        creditModifier: -1200,
        ship: Object.freeze({ name: "Belt Prospector", maxHolds: 85, miningPower: 10, scannerLevel: 2, maxFighters: 1800 }),
        employment: null
    }),

    property_dockside_tenement: Object.freeze({
        id: "property_dockside_tenement",
        label: "Dockside Tenement",
        category: "property",
        tier: 1,
        cost: 50,
        runtimeType: "property_owned",
        description: "Own a rough residential rent roll near the docks instead of a ship.",
        creditModifier: -400,
        ship: null,
        employment: null,
        property: Object.freeze({
            kind: "tenement",
            siteRole: "homeSiteId",
            units: 18,
            condition: 64,
            occupancy: 0.82,
            rentDaily: 38,
            upkeepDaily: 145,
            tenantMix: "dockside_residential",
            storageCapacity: 20,
            serviceSlots: 1,
            debtDaily: 120,
            tags: Object.freeze(["housing", "dockside", "rent_roll"])
        })
    }),
    property_warehouse_leasehold: Object.freeze({
        id: "property_warehouse_leasehold",
        label: "Warehouse Leasehold",
        category: "property",
        tier: 1,
        cost: 50,
        runtimeType: "property_owned",
        description: "Control a cargo warehouse lease for storage, import support, and tenant services.",
        creditModifier: -300,
        ship: null,
        employment: null,
        property: Object.freeze({
            kind: "warehouse",
            siteRole: "homeSiteId",
            units: 8,
            condition: 70,
            occupancy: 0.76,
            rentDaily: 90,
            upkeepDaily: 180,
            tenantMix: "freight_storage",
            storageCapacity: 320,
            serviceSlots: 2,
            debtDaily: 150,
            tags: Object.freeze(["warehouse", "storage", "import_export"])
        })
    }),
    property_market_arcade: Object.freeze({
        id: "property_market_arcade",
        label: "Market Arcade",
        category: "property",
        tier: 1,
        cost: 60,
        runtimeType: "property_owned",
        description: "Operate small commercial stalls where contacts and foot traffic matter.",
        creditModifier: -700,
        ship: null,
        employment: null,
        property: Object.freeze({
            kind: "market_arcade",
            siteRole: "homeSiteId",
            units: 12,
            condition: 72,
            occupancy: 0.78,
            rentDaily: 62,
            upkeepDaily: 170,
            tenantMix: "small_merchants",
            storageCapacity: 85,
            serviceSlots: 2,
            debtDaily: 160,
            tags: Object.freeze(["retail", "market", "local_influence"])
        })
    }),
    property_berth_rights: Object.freeze({
        id: "property_berth_rights",
        label: "Berth Rights Concession",
        category: "property",
        tier: 1,
        cost: 45,
        runtimeType: "property_owned",
        description: "Hold scheduling rights for a few dock berths and charge service fees.",
        creditModifier: -250,
        ship: null,
        employment: null,
        property: Object.freeze({
            kind: "berth_rights",
            siteRole: "homeSiteId",
            units: 5,
            condition: 68,
            occupancy: 0.7,
            rentDaily: 110,
            upkeepDaily: 130,
            tenantMix: "short_stay_captains",
            storageCapacity: 45,
            serviceSlots: 3,
            debtDaily: 115,
            tags: Object.freeze(["berths", "dockside", "services"])
        })
    }),
    property_repair_bay_share: Object.freeze({
        id: "property_repair_bay_share",
        label: "Repair Bay Share",
        category: "property",
        tier: 1,
        cost: 55,
        runtimeType: "property_owned",
        description: "Own a share in a maintenance bay with service revenue and infrastructure risk.",
        creditModifier: -500,
        ship: null,
        employment: null,
        property: Object.freeze({
            kind: "repair_bay",
            siteRole: "shipyardSiteId",
            units: 4,
            condition: 74,
            occupancy: 0.72,
            rentDaily: 130,
            upkeepDaily: 210,
            tenantMix: "mechanics_and_factors",
            storageCapacity: 60,
            serviceSlots: 4,
            debtDaily: 175,
            tags: Object.freeze(["repair", "infrastructure", "services"])
        })
    }),
    employer_salary_no_ship: Object.freeze({
        id: "employer_salary_no_ship",
        label: "No-Ship Salaried Posting",
        category: "employer",
        tier: 0,
        cost: 0,
        runtimeType: "employed_salary",
        description: "Start without your own hull, flying assigned company work for a predictable wage.",
        creditModifier: -800,
        ship: Object.freeze({ name: "Company Courier", maxHolds: 55, maxFighters: 1200, maxShields: 90, maxHull: 90 }),
        employment: Object.freeze({ ownsShip: false, wageDaily: 180, commissionShare: 0, leaseDaily: 0 })
    }),
    employer_commission_no_ship: Object.freeze({
        id: "employer_commission_no_ship",
        label: "No-Ship Commission Posting",
        category: "employer",
        tier: 0,
        cost: 0,
        runtimeType: "employed_commission",
        description: "Start without your own hull, taking a low wage and a better cut of completed work.",
        creditModifier: -500,
        ship: Object.freeze({ name: "Commission Freight Runner", maxHolds: 65, maxFighters: 1400, maxShields: 95, maxHull: 95 }),
        employment: Object.freeze({ ownsShip: false, wageDaily: 60, commissionShare: 0.12, leaseDaily: 0 })
    }),
    rental_cutter_no_ship: Object.freeze({
        id: "rental_cutter_no_ship",
        label: "No-Ship Rental Cutter",
        category: "rental",
        tier: 0,
        cost: 0,
        runtimeType: "ship_rented",
        description: "Start without your own hull, renting a cutter with a daily lease obligation.",
        creditModifier: -1200,
        ship: Object.freeze({ name: "Rented Merchant Cutter", maxHolds: 60, maxFighters: 1600 }),
        employment: Object.freeze({ ownsShip: false, leaseDaily: 120, wageDaily: 0, commissionShare: 0 })
    })
});

export const PLATFORM_TYPES = Object.freeze(Object.fromEntries(
    Object.values(PLATFORM_PACKAGES).map(platform => [platform.id, { label: platform.label }])
));

export const EMPLOYER_LANES = Object.freeze([
    { id: "sda_auxiliary", label: "SDA Auxiliary", factionId: "sda", rank: "Auxiliary", access: ["patrol", "inspection"] },
    { id: "fu_courier", label: "FU Courier", factionId: "fu", rank: "Courier", access: ["express", "industrial"] },
    { id: "hc_extractor", label: "HC Extractor", factionId: "hc", rank: "Extractor", access: ["mining", "industrial"] },
    { id: "traders_guild_freight", label: "Traders Guild Freight House", factionId: "traders", rank: "Freight Clerk", access: ["freight", "market"] },
    { id: "colonists_logistics", label: "Colonists Logistics Office", factionId: "colonists", rank: "Logistics Liaison", access: ["colony", "relief"] },
    { id: "vc_runner", label: "VC Runner", factionId: "vc", rank: "Runner", access: ["black_route", "smuggling"] }
]);

export const START_PACKAGES = Object.freeze({
    guild_sponsorship_traders: Object.freeze({ id: "guild_sponsorship_traders", category: "sponsorship", label: "Traders Guild Sponsorship", cost: 25, benefits: Object.freeze({ memberships: { traders: 1 }, publicRep: { traders: 25 }, contacts: ["traders_suri"] }) }),
    trusted_contact_sda: Object.freeze({ id: "trusted_contact_sda", category: "contacts", label: "Trusted SDA Contact", cost: 15, benefits: Object.freeze({ contacts: ["sda_harrow"], contactTrust: 2 }) }),
    employer_rank_bump: Object.freeze({ id: "employer_rank_bump", category: "rank", label: "Employer Rank Bump", cost: 20, benefits: Object.freeze({ employerRankBonus: 1, wageBonus: 30, commissionBonus: 0.02 }) }),
    starter_equipment_cache: Object.freeze({ id: "starter_equipment_cache", category: "equipment", label: "Starter Equipment Cache", cost: 20, benefits: Object.freeze({ cargo: { org: 8, eq: 8 }, equipment: ["repair_kit", "survey_beacon"] }) }),
    legal_paperwork: Object.freeze({ id: "legal_paperwork", category: "paperwork", label: "Legal Paperwork", cost: 15, benefits: Object.freeze({ publicRep: { sda: 10 }, heat: { sda: -2 }, paperwork: "legal" }), exclusiveWith: ["illegal_paperwork"] }),
    illegal_paperwork: Object.freeze({ id: "illegal_paperwork", category: "paperwork", label: "Illegal Paperwork", cost: 15, benefits: Object.freeze({ privateRep: { vc: 8 }, heat: { sda: 3 }, paperwork: "illegal" }), exclusiveWith: ["legal_paperwork"] })
});

export const ARCHETYPE_PRESETS = Object.freeze({
    independent_hauler: Object.freeze({ label: "Independent Hauler", build: Object.freeze({ statSpend: { nerve: 0, tradecraft: 10, fieldcraft: 0, command: 5, acumen: 5 }, originTraitId: "dockside_brokers_apprentice", careerTraitIds: ["freight_dispatcher"], platform: { type: "ship_tier1_tramp", employerLaneId: null }, packageIds: ["starter_equipment_cache"] }) }),
    belt_prospector: Object.freeze({ label: "Belt Prospector", build: Object.freeze({ statSpend: { nerve: 5, tradecraft: 0, fieldcraft: 10, command: 0, acumen: 0 }, originTraitId: "raised_in_an_asteroid_mine", careerTraitIds: ["veteran_miner"], platform: { type: "ship_tier1_surveyor", employerLaneId: null }, packageIds: ["trusted_contact_sda"] }) }),
    company_operator: Object.freeze({ label: "Company Operator", build: Object.freeze({ statSpend: { nerve: 0, tradecraft: 5, fieldcraft: 0, command: 10, acumen: 5 }, originTraitId: "quartermasters_child", careerTraitIds: ["union_paperwork"], platform: { type: "employer_salary_no_ship", employerLaneId: "traders_guild_freight" }, packageIds: ["employer_rank_bump"] }) }),
    station_landlord: Object.freeze({ label: "Station Landlord", build: Object.freeze({ statSpend: { nerve: 0, tradecraft: 5, fieldcraft: 0, command: 5, acumen: 10 }, originTraitId: "portside_heir", careerTraitIds: ["rent_roll_analyst"], platform: { type: "property_dockside_tenement", employerLaneId: null }, packageIds: ["legal_paperwork"] }) }),
    warehouse_factor: Object.freeze({ label: "Warehouse Factor", build: Object.freeze({ statSpend: { nerve: 0, tradecraft: 6, fieldcraft: 2, command: 2, acumen: 10 }, originTraitId: "warehouse_bookkeeper", careerTraitIds: ["warehouse_factor"], platform: { type: "property_warehouse_leasehold", employerLaneId: null }, packageIds: ["trusted_contact_sda"] }) }),
    market_arcade_owner: Object.freeze({ label: "Market Arcade Owner", build: Object.freeze({ statSpend: { nerve: 2, tradecraft: 8, fieldcraft: 0, command: 4, acumen: 6 }, originTraitId: "dock_union_family", careerTraitIds: ["beloved_proprietor"], platform: { type: "property_market_arcade", employerLaneId: null }, packageIds: ["legal_paperwork"] }) }),
    berth_concessionaire: Object.freeze({ label: "Berth Concessionaire", build: Object.freeze({ statSpend: { nerve: 4, tradecraft: 7, fieldcraft: 1, command: 4, acumen: 4 }, originTraitId: "backroom_rent_collector", careerTraitIds: ["dock_concessionaire"], platform: { type: "property_berth_rights", employerLaneId: null }, packageIds: ["trusted_contact_sda"] }) }),
    property_clerk: Object.freeze({ label: "Property Clerk", build: Object.freeze({ statSpend: { nerve: 0, tradecraft: 4, fieldcraft: 2, command: 4, acumen: 10 }, originTraitId: "company_property_clerk", careerTraitIds: ["station_services_operator"], platform: { type: "property_repair_bay_share", employerLaneId: null }, packageIds: ["legal_paperwork"] }) })
});

export const DEFAULT_BUILD_SPEC = Object.freeze({
    statSpend: Object.freeze({ nerve: 0, tradecraft: 0, fieldcraft: 0, command: 0, acumen: 0 }),
    originTraitId: "dockside_brokers_apprentice",
    careerTraitIds: Object.freeze([]),
    platform: Object.freeze({ type: DEFAULT_PLATFORM_TYPE, employerLaneId: null }),
    packageIds: Object.freeze([])
});

export const DEBUG_FALLBACK_BUILD_SPEC = DEFAULT_BUILD_SPEC;

export function createStarterShipFromPlatform(platformPackage) {
    if (platformPackage?.ship === null) return null;
    return {
        name: STARTER_SHIP.NAME,
        maxHolds: STARTER_SHIP.MAX_HOLDS,
        travelMinutesPerCorridor: STARTER_SHIP.TRAVEL_MINUTES_PER_CORRIDOR,
        miningPower: STARTER_SHIP.MINING_POWER,
        scannerLevel: STARTER_SHIP.SCANNER_LEVEL,
        maxFighters: STARTER_SHIP.MAX_FIGHTERS,
        maxShields: STARTER_SHIP.MAX_SHIELDS,
        maxHull: STARTER_SHIP.MAX_HULL,
        ...(platformPackage?.ship || {})
    };
}

export function getStarterCredits(leftoverPoints, platformPackage, startBenefits = {}) {
    return Math.max(
        0,
        STARTER_PLAYER.CREDITS
            + leftoverPoints * CHAR_DEFAULTS.CASH_PER_LEFTOVER_POINT
            + (platformPackage?.creditModifier || 0)
            + (startBenefits.credits || 0)
    );
}
