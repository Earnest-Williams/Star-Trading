import { STARTER_PLAYER, STARTER_SHIP } from './player.js';

export const CHAR_STATS = Object.freeze(["nerve", "tradecraft", "fieldcraft", "command"]);

export const CHAR_DEFAULTS = Object.freeze({
    STAT_BASE: 50,
    STAT_CAP: 100,
    STAT_CHARGEN_MIN: 50,
    CHARGEN_POINTS: 100,
    CAREER_TRAIT_COST: 50,
    CASH_PER_LEFTOVER_POINT: 100
});

export const STAT_BUY_CURVE = Object.freeze([
    { from: 1, to: 10, gain: 3 },
    { from: 11, to: 15, gain: 2 },
    { from: 16, to: 25, gain: 1 }
]);

export const DEFAULT_PLATFORM_TYPE = "ship_owned";
export const DEFAULT_EMPLOYER_LANE_ID = "sda_auxiliary";

export const PLATFORM_PACKAGES = Object.freeze({
    ship_owned: Object.freeze({
        id: "ship_owned",
        label: "Owned Ship",
        description: "Begin as an independent owner-operator with the standard starter ship.",
        creditModifier: 0,
        ship: Object.freeze({}),
        employment: null
    }),
    ship_rented: Object.freeze({
        id: "ship_rented",
        label: "Rented Ship",
        description: "Begin with a rented hull, lower cash, and a small daily lease obligation.",
        creditModifier: -1200,
        ship: Object.freeze({ name: "Rented Merchant Cutter", maxHolds: 60, maxFighters: 1600 }),
        employment: Object.freeze({ leaseDaily: 120 })
    }),
    employed_salary: Object.freeze({
        id: "employed_salary",
        label: "Salaried Employee",
        description: "Begin attached to an employer lane with a predictable wage.",
        creditModifier: -800,
        ship: Object.freeze({ name: "Company Courier", maxHolds: 55, maxFighters: 1200 }),
        employment: Object.freeze({ wageDaily: 180, commissionShare: 0 })
    }),
    employed_commission: Object.freeze({
        id: "employed_commission",
        label: "Commission Employee",
        description: "Begin attached to an employer lane with lower base cash but a better share.",
        creditModifier: -500,
        ship: Object.freeze({ name: "Commission Freight Runner", maxHolds: 65, maxFighters: 1400 }),
        employment: Object.freeze({ wageDaily: 60, commissionShare: 0.12 })
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

export const DEFAULT_BUILD_SPEC = Object.freeze({
    statSpend: Object.freeze({ nerve: 0, tradecraft: 0, fieldcraft: 0, command: 0 }),
    originTraitId: "dockside_brokers_apprentice",
    careerTraitIds: Object.freeze([]),
    platform: Object.freeze({ type: DEFAULT_PLATFORM_TYPE, employerLaneId: null })
});

export const DEBUG_FALLBACK_BUILD_SPEC = DEFAULT_BUILD_SPEC;

export function createStarterShipFromPlatform(platformPackage) {
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

export function getStarterCredits(leftoverPoints, platformPackage) {
    return Math.max(
        0,
        STARTER_PLAYER.CREDITS
            + leftoverPoints * CHAR_DEFAULTS.CASH_PER_LEFTOVER_POINT
            + (platformPackage?.creditModifier || 0)
    );
}
