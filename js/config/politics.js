export const POLITICS = Object.freeze({
    CONTESTED: Object.freeze({
        MIN_FACTION_SPREAD: 2,
        PIRATE_SURGE_CAP: 6,
        PIRATE_SURGE_BASE_CHANCE: 0.14,
        PIRATE_SURGE_DAILY_CHANCE: 0.015,
        PIRATE_REDUCTION_CHANCE: 0.22,
        MISSION_SPONSOR_TOP_CHANCE: 0.58
    }),
    SECTOR_EFFECTS: Object.freeze({
        SDA_THRESHOLD: 55,
        SDA_MAX_REDUCTION_CHANCE: 0.45,
        SDA_CHANCE_OFFSET: 45,
        SDA_CHANCE_DIVISOR: 130,
        HC_THRESHOLD: 55,
        HC_REGEN_RATE: 0.035,
        HC_MIN_MAX_ORE: 2500,
        FU_THRESHOLD: 55,
        FU_GROWTH_CHANCE: 0.28,
        FU_COLONIST_GROWTH_RATE: 0.04,
        VC_PIRATE_THRESHOLD: 50,
        VC_PIRATE_MAX_CHANCE: 0.32,
        VC_PIRATE_CHANCE_OFFSET: 40,
        VC_PIRATE_CHANCE_DIVISOR: 150,
        VC_PIRATE_CAP: 6,
        VC_FRONT_THRESHOLD: 58,
        VC_FRONT_CHANCE: 0.055
    }),
    FRONTS: Object.freeze({
        SUSPICION_BASE_GAIN: 1,
        SUSPICION_INFLUENCE_DIVISOR: 30,
        HIDDEN_ADVANTAGE_THRESHOLD: 20,
        SURVEYED_BONUS: 2,
        UNSURVEYED_PENALTY: -1,
        PUBLIC_ADVANTAGE_CHANCE: 0.45,
        PUBLIC_ADVANTAGE_REDUCTION: 1,
        SURVEYED_EXPOSURE_CHANCE: 0.68,
        UNSURVEYED_EXPOSURE_CHANCE: 0.38,
        PUBLIC_INFLUENCE_ON_EXPOSED: 4,
        SDA_INFLUENCE_ON_VC_EXPOSED: 2,
        RELATION_ON_EXPOSED: -3,
        EVENT_IMPORTANCE: 4
    }),
    EXPANSION: Object.freeze({
        SOURCE_THRESHOLD: 58,
        CHANCE_DIVISOR: 260,
        SDA_CORE_BONUS: 0.025,
        FU_FRONTIER_BONUS: 0.035,
        HC_ASTEROID_BONUS: 0.025,
        VC_BADLANDS_BONUS: 0.055,
        STRONG_INFLUENCE_THRESHOLD: 82,
        STRONG_GAIN: 2,
        NORMAL_GAIN: 1
    }),
    CONTEST_MISSIONS: Object.freeze({
        EXPIRES_DAYS: 4,
        PIRATE_THREAT_REWARD: 220,
        SECTOR_REWARD: 12,
        TEMPLATES: Object.freeze({
            sda: Object.freeze({ verb: "Run patrol pressure", operation: "patrol", minutes: 90, reward: 1900 }),
            fu: Object.freeze({ verb: "Rally frontier support", operation: "rally", minutes: 75, reward: 1750 }),
            hc: Object.freeze({ verb: "Secure industrial claims", operation: "claims", minutes: 90, reward: 2050 }),
            vc: Object.freeze({ verb: "Disrupt official control", operation: "disrupt", minutes: 75, reward: 2200 })
        })
    })
});
