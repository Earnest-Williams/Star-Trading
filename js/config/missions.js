export const MISSION_TUNING = Object.freeze({
    BASE: Object.freeze({
        REWARD_REP: 2,
        OPERATION_MINUTES: 30,
        CONTEST_OPERATION_MINUTES: 90,
        DOMINANT_FACTION_CHANCE: 0.25,
        HIDDEN_FACTION_CHANCE: 0.12
    }),
    DELIVERY: Object.freeze({
        AMOUNTS: Object.freeze([10, 20, 30]),
        DISTANCE_BASELINE: 1,
        DISTANCE_REWARD: 180,
        BASE_REWARD: 600,
        EXPIRES_BASE_DAYS: 4,
        EXPIRES_DISTANCE_DIVISOR: 6,
        COMPLETION_MINUTES: 30,
        INFLUENCE_REWARD: 2
    }),
    MINING: Object.freeze({
        AMOUNTS: Object.freeze([30, 40, 50, 60, 70]),
        ORE_REWARD_PER_UNIT: 95,
        BASE_REWARD: 700,
        EXPIRES_DAYS: 5,
        COMPLETION_MINUTES: 30
    }),
    SURVEY: Object.freeze({
        BASE_REWARD: 1200,
        TARGET_REWARD_MULTIPLIER: 25,
        EXPIRES_DAYS: 5,
        COMPLETION_MINUTES: 30,
        INTEL_CHANCE: 0.35,
        INTEL_VALUE: 25,
        INTEL_EXPIRES_DAYS: 7
    }),
    COLONY: Object.freeze({
        REWARD: 4500,
        EXPIRES_DAYS: 8,
        COMPLETION_MINUTES: 30
    }),
    POOL: Object.freeze({
        DEFAULT_COUNT: 10,
        REFILL_TARGET: 6,
        DELIVERY_ROLL: 0.45,
        MINING_ROLL: 0.70,
        SURVEY_ROLL: 0.88
    }),
    VISIBILITY: Object.freeze({
        GUILD_REP: 50,
        GUILD_TRUST: 25,
        PRIVATE_REP: 25,
        HOSTILE_REP_FLOOR: -250
    })
});
