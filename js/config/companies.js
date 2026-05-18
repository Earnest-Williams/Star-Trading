import { MARKET_COMMODITIES } from '../constants.js';

export const COMPANY_SPAWN_RULES = Object.freeze({
    SHIP_REFITTER_CHANCE_BY_ANCHOR: Object.freeze({
        stardock: 1.0,
        station: 0.72,
        industrial: 0.36,
        refinery: 0.30,
        consumer: 0.24,
        planet: 0.20
    }),
    DOCKYARD: Object.freeze({
        STARDOCK_BASE_COUNT: 1,
        STARDOCK_SECOND_CHANCE: 0.18,
        STATION_FIRST_CHANCE: 0.78,
        STATION_SECOND_CHANCE: 0.10,
        PLANET_FIRST_CHANCE: 0.16,
        PLANET_SECOND_CHANCE: 0.05,
        PLANET_THIRD_CHANCE: 0.015,
        INDUSTRIAL_FIRST_CHANCE: 0.06,
        STATION_MAX: 2,
        PLANET_MAX: 3,
        PORT_MAX: 1
    })
});

export const RAW_GOOD_ORIGINS = Object.freeze({
    ore: Object.freeze(["mining_contractor"]),
    heavy_metals: Object.freeze(["mining_contractor"]),
    rare_earths: Object.freeze(["mining_contractor"]),
    water_ice: Object.freeze(["mining_contractor"]),
    org: Object.freeze(["agri_collective"])
});

export const VALUE_ADDED_GOOD_CHAINS = Object.freeze({
    refined_metals: Object.freeze({
        inputs: Object.freeze(["ore", "heavy_metals"]),
        originBusinesses: Object.freeze(["refinery_operator"])
    }),
    polymers: Object.freeze({
        inputs: Object.freeze(["org", "water_ice"]),
        originBusinesses: Object.freeze(["refinery_operator"])
    }),
    coolants: Object.freeze({
        inputs: Object.freeze(["water_ice", "rare_earths"]),
        originBusinesses: Object.freeze(["refinery_operator"])
    }),
    fertilizer: Object.freeze({
        inputs: Object.freeze(["org", "water_ice"]),
        originBusinesses: Object.freeze(["refinery_operator", "agri_collective"])
    }),
    eq: Object.freeze({
        inputs: Object.freeze(["refined_metals", "polymers", "electronics"]),
        originBusinesses: Object.freeze(["industrial_supplier"])
    }),
    machinery: Object.freeze({
        inputs: Object.freeze(["refined_metals", "polymers"]),
        originBusinesses: Object.freeze(["industrial_supplier"])
    }),
    repair_parts: Object.freeze({
        inputs: Object.freeze(["refined_metals", "electronics"]),
        originBusinesses: Object.freeze(["industrial_supplier", "ship_refitter"])
    }),
    electronics: Object.freeze({
        inputs: Object.freeze(["rare_earths", "polymers", "coolants"]),
        originBusinesses: Object.freeze(["industrial_supplier"])
    }),
    medical_supplies: Object.freeze({
        inputs: Object.freeze(["org", "polymers", "coolants"]),
        originBusinesses: Object.freeze(["agri_collective"])
    }),
    construction_kits: Object.freeze({
        inputs: Object.freeze(["refined_metals", "polymers", "machinery"]),
        originBusinesses: Object.freeze(["industrial_supplier", "ship_refitter", "dockyard"])
    }),
    pulse_canister: Object.freeze({
        inputs: Object.freeze(["coolants", "control_cores"]),
        originBusinesses: Object.freeze(["industrial_supplier", "refinery_operator"])
    }),
    heavy_pulse_module: Object.freeze({
        inputs: Object.freeze(["pulse_canister", "control_cores", "refined_metals"]),
        originBusinesses: Object.freeze(["refinery_operator", "dockyard"])
    }),
    gate_coils: Object.freeze({
        inputs: Object.freeze(["heavy_metals", "rare_earths", "refined_metals", "control_cores"]),
        originBusinesses: Object.freeze(["dockyard"])
    }),
    control_cores: Object.freeze({
        inputs: Object.freeze(["electronics", "rare_earths", "coolants"]),
        originBusinesses: Object.freeze(["industrial_supplier"])
    })
});

export const COMPANY_PRODUCTION_PROFILES = Object.freeze({
    import_export: Object.freeze({
        inputs: Object.freeze(MARKET_COMMODITIES.slice()),
        outputs: Object.freeze(MARKET_COMMODITIES.slice()),
        mode: "brokerage"
    }),
    haulage: Object.freeze({
        inputs: Object.freeze(["ore", "org", "water_ice"]),
        outputs: Object.freeze(["eq", "repair_parts"]),
        mode: "logistics"
    }),
    mining_contractor: Object.freeze({
        inputs: Object.freeze(["eq", "machinery", "repair_parts", "coolants", "medical_supplies", "pulse_canister"]),
        outputs: Object.freeze(["ore", "heavy_metals", "rare_earths", "water_ice"]),
        mode: "extraction"
    }),
    refinery_operator: Object.freeze({
        inputs: Object.freeze(["ore", "heavy_metals", "water_ice", "org", "rare_earths", "control_cores"]),
        outputs: Object.freeze(["refined_metals", "polymers", "coolants", "fertilizer", "pulse_canister", "heavy_pulse_module"]),
        mode: "processing"
    }),
    ship_refitter: Object.freeze({
        inputs: Object.freeze(["refined_metals", "polymers", "coolants", "electronics", "control_cores", "machinery"]),
        outputs: Object.freeze(["repair_parts", "construction_kits"]),
        mode: "refit"
    }),
    dockyard: Object.freeze({
        inputs: Object.freeze(["refined_metals", "heavy_metals", "rare_earths", "polymers", "electronics", "control_cores", "machinery", "repair_parts", "pulse_canister"]),
        outputs: Object.freeze(["construction_kits", "gate_coils", "heavy_pulse_module"]),
        mode: "shipyard"
    }),
    agri_collective: Object.freeze({
        inputs: Object.freeze(["eq", "machinery", "water_ice", "coolants", "polymers"]),
        outputs: Object.freeze(["org", "fertilizer", "medical_supplies"]),
        mode: "cultivation"
    }),
    industrial_supplier: Object.freeze({
        inputs: Object.freeze(["refined_metals", "polymers", "rare_earths", "coolants", "heavy_metals"]),
        outputs: Object.freeze(["eq", "machinery", "repair_parts", "electronics", "construction_kits", "control_cores", "pulse_canister"]),
        mode: "manufacturing"
    }),
    security_contractor: Object.freeze({
        inputs: Object.freeze(["refined_metals", "rare_earths", "polymers", "coolants"]),
        outputs: Object.freeze(["repair_parts", "electronics", "control_cores"]),
        mode: "security_fabrication"
    }),
    black_market_front: Object.freeze({
        inputs: Object.freeze(["ore", "org", "repair_parts"]),
        outputs: Object.freeze(["eq", "electronics", "pulse_canister"]),
        mode: "diversion"
    })
});

export const COMPANY_ARCHETYPES = Object.freeze({
    import_export: Object.freeze({
        label: "Import/Export House",
        exports: COMPANY_PRODUCTION_PROFILES.import_export.outputs.slice(),
        imports: COMPANY_PRODUCTION_PROFILES.import_export.inputs.slice(),
        missionTypes: ["delivery", "survey"]
    }),
    haulage: Object.freeze({
        label: "Haulage Line",
        exports: COMPANY_PRODUCTION_PROFILES.haulage.outputs.slice(),
        imports: COMPANY_PRODUCTION_PROFILES.haulage.inputs.slice(),
        missionTypes: ["delivery"]
    }),
    mining_contractor: Object.freeze({
        label: "Mining Contractor",
        exports: COMPANY_PRODUCTION_PROFILES.mining_contractor.outputs.slice(),
        imports: COMPANY_PRODUCTION_PROFILES.mining_contractor.inputs.slice(),
        missionTypes: ["mining", "delivery"]
    }),
    refinery_operator: Object.freeze({
        label: "Refinery Operator",
        exports: COMPANY_PRODUCTION_PROFILES.refinery_operator.outputs.slice(),
        imports: COMPANY_PRODUCTION_PROFILES.refinery_operator.inputs.slice(),
        missionTypes: ["delivery", "mining"]
    }),
    ship_refitter: Object.freeze({
        label: "Ship Refitter",
        exports: COMPANY_PRODUCTION_PROFILES.ship_refitter.outputs.slice(),
        imports: COMPANY_PRODUCTION_PROFILES.ship_refitter.inputs.slice(),
        missionTypes: ["delivery", "survey"]
    }),
    dockyard: Object.freeze({
        label: "Dockyard",
        exports: COMPANY_PRODUCTION_PROFILES.dockyard.outputs.slice(),
        imports: COMPANY_PRODUCTION_PROFILES.dockyard.inputs.slice(),
        missionTypes: ["delivery", "contest"]
    }),
    agri_collective: Object.freeze({
        label: "Agri Collective",
        exports: COMPANY_PRODUCTION_PROFILES.agri_collective.outputs.slice(),
        imports: COMPANY_PRODUCTION_PROFILES.agri_collective.inputs.slice(),
        missionTypes: ["delivery", "colony"]
    }),
    industrial_supplier: Object.freeze({
        label: "Industrial Supplier",
        exports: COMPANY_PRODUCTION_PROFILES.industrial_supplier.outputs.slice(),
        imports: COMPANY_PRODUCTION_PROFILES.industrial_supplier.inputs.slice(),
        missionTypes: ["delivery", "colony"]
    }),
    security_contractor: Object.freeze({
        label: "Security Contractor",
        exports: COMPANY_PRODUCTION_PROFILES.security_contractor.outputs.slice(),
        imports: COMPANY_PRODUCTION_PROFILES.security_contractor.inputs.slice(),
        missionTypes: ["contest", "survey"]
    }),
    black_market_front: Object.freeze({
        label: "Front Office",
        exports: COMPANY_PRODUCTION_PROFILES.black_market_front.outputs.slice(),
        imports: COMPANY_PRODUCTION_PROFILES.black_market_front.inputs.slice(),
        missionTypes: ["delivery", "survey"]
    })
});

export const COMPANY_NAME_PARTS = Object.freeze({
    prefixes: Object.freeze(["Aster", "Helion", "Orion", "Stardock", "Freehold", "Cinder", "Bluewake", "Kepler", "Vega", "Marrow"]),
    suffixes: Object.freeze(["Exchange", "Logistics", "Works", "Factors", "Combine", "Line", "Charter", "Holdings", "Supply", "Compact"])
});
