export const ENTANGLEMENTS = Object.freeze({
    DAILY_EVENT_LIMIT: 2,

    KINDS: Object.freeze({
        FAVOR: "favor",
        RIVALRY: "rivalry",
        SECRET: "secret",
        ROMANCE: "romance",
        SUCCESSION: "succession",
        WINGMAN: "wingman"
    }),

    ROMANCE_STAGES: Object.freeze({
        INTEREST: "interest",
        BOND: "bond",
        COMMITTED: "committed",
        ESTRANGED: "estranged"
    }),

    ROMANCE: Object.freeze({
        MIN_OPINION: 24,
        MIN_TRUST: 12,
        INTEREST_STRENGTH: 18,
        BOND_STRENGTH: 45,
        COMMITTED_STRENGTH: 72,
        MIN_DAYS_BETWEEN_DEEPEN: 3,
        DEFAULT_DISCRETION: 65,
        OVERTURE_RELATION_BUMP: Object.freeze({ opinion: 2, trust: 1 }),
        DEEPEN_RELATION_BUMP: Object.freeze({ opinion: 1, trust: 2 })
    }),

    PRESSURE: Object.freeze({
        FAVOR_DEBT_MIN: 2,
        RIVALRY_MIN: 45,
        ROMANCE_CONFLICT_MIN: 25,
        SECRET_HEAT_MIN: 20,
        EVENT_PRESSURE_MIN: 55,
        PRESSURE_DECAY: 1,
        FAVOR_STRENGTH_DECAY: 8,
        FAVOR_PRESSURE_DECAY: 4,
        RIVALRY_STRENGTH_DECAY: 10
    }),

    MISSION: Object.freeze({
        EXPIRES_DAYS: 5,
        BASE_REWARD: 650,
        IMPORTANCE: 3,
        SOCIAL_OPERATION_MINUTES: 60
    })
});
