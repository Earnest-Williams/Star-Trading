export const WORLDGEN_GEOMETRY = Object.freeze({
    CLUSTERS: Object.freeze({
        IRREGULAR_X_MIN: -16,
        IRREGULAR_X_SPAN: 32,
        IRREGULAR_Y_MIN: -12,
        IRREGULAR_Y_SPAN: 24,
        IRREGULAR_X_INDEX_DRIFT: 1.5,
        SPIRAL_RADIUS_BASE: 10,
        SPIRAL_RADIUS_STEP: 3.5,
        SPIRAL_RADIUS_JITTER: 5,
        SPIRAL_ANGLE_CURVE: 0.16
    }),
    SHEAR: Object.freeze({
        CENTRAL_RADIUS: 9,
        CENTRAL_MULTIPLIER: 1.18,
        OFF_PLANE_RELIEF_MAX: 0.12,
        OFF_PLANE_RELIEF_MULTIPLIER: 0.015,
        LUMPY_X_FREQUENCY: 0.31,
        LUMPY_Y_FREQUENCY: 0.27,
        LUMPY_Z_FREQUENCY: 0.73,
        LUMPY_MULTIPLIER: 0.045,
        BASELINE: 0.12,
        MIN: 0,
        MAX: 1.35
    }),
    CORRIDORS: Object.freeze({
        METRIC_SAMPLES: 5,
        NEAREST_NEIGHBORS: 3,
        SCHEDULED_RELAY_HOURS: 24
    }),
    SITE_PLACEMENT: Object.freeze({
        MAX_ATTEMPTS: 24,
        EARLY_SCALE: 3.8,
        MID_SCALE: 4.7,
        LATE_SCALE: 5.5,
        EARLY_SITE_LIMIT: 22,
        MID_SITE_LIMIT: 45,
        ACCEPTABLE_SHEAR: 0.9,
        FALLBACK_X_OFFSET_PER_INDEX: 1
    }),
    REGIONS: Object.freeze({
        CORE_FRACTION: 0.30,
        FRONTIER_FRACTION: 0.72,
        PIRATE_SAFE_SITE_LIMIT: 8,
        PIRATE_THREAT_CAPS: Object.freeze({ Core: 3, Frontier: 3, Badlands: 5 })
    })
});

export const WORLDGEN_SPAWN = Object.freeze({
    STARTER_PORTS: Object.freeze(["mining", "agricultural", "industrial", "consumer"]),
    RANDOM_PORT_TYPES: Object.freeze(["mining", "agricultural", "industrial", "consumer", "refinery"]),
    WAY_STATION_REFINERY_CHANCE: 0.7,
    PORT_CHANCE_BY_REGION: Object.freeze({ Core: 0.42, Frontier: 0.34, Badlands: 0.24 }),
    HIDDEN_BADLANDS_PORT_CHANCE: 0.18,
    PORT_INFLUENCE: 16,
    HIDDEN_PORT_INFLUENCE: 10,
    FRONT_SUSPICION_BASE: 10,
    FRONT_SUSPICION_SPAN: 25,
    PLANET_CHANCE_BY_REGION: Object.freeze({ Core: 0.24, Frontier: 0.32, Badlands: 0.32 }),
    ASTEROID_CHANCE_BY_REGION: Object.freeze({ Badlands: 0.55 }),
    ASTEROID_CHANCE_BY_SITE_TYPE: Object.freeze({ brown_dwarf_system: 0.42 }),
    ASTEROID_DEFAULT_CHANCE: 0.28,
    ASTEROID_ORE_BASE: 2500,
    ASTEROID_ORE_SPAN: 9000,
    ASTEROID_RICHNESS_BASE: 0.7,
    ASTEROID_RICHNESS_SPAN: 1.1,
    ASTEROID_BADLANDS_HAZARD_BASE: 0.12,
    ASTEROID_BADLANDS_HAZARD_SPAN: 0.18,
    ASTEROID_HAZARD_SPAN: 0.12,
    ASTEROID_HC_INFLUENCE: 5,
    ASTEROID_BADLANDS_VC_CHANCE: 0.4,
    ASTEROID_BADLANDS_VC_INFLUENCE: 5
});

export const PORT_DEFAULTS = Object.freeze({
    STOCK: Object.freeze({
        ORE_BASE: 1500,
        ORE_SPAN: 3500,
        ORG_BASE: 1200,
        ORG_SPAN: 3000,
        EQ_BASE: 800,
        EQ_SPAN: 2400
    }),
    MAX_STOCK: Object.freeze({
        ore: 6000,
        org: 5000,
        eq: 4000,
        pulse_canister: 120,
        heavy_pulse_module: 40
    }),
    BASE_PRICES: Object.freeze({
        ore: 80,
        org: 150,
        eq: 300,
        pulse_canister: 7,
        heavy_pulse_module: 26
    })
});

export const STARFIELD = Object.freeze({
    COUNT: 100,
    WIDTH: 700,
    HEIGHT: 420,
    SMALL_STAR_CHANCE: 0.85,
    SMALL_SIZE: 1,
    LARGE_SIZE: 2
});
