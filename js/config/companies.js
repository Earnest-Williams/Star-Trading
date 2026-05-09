export const COMPANY_ARCHETYPES = Object.freeze({
    import_export: Object.freeze({
        label: "Import/Export House",
        exports: ["org", "eq"],
        imports: ["ore"],
        missionTypes: ["delivery", "survey"]
    }),
    haulage: Object.freeze({
        label: "Haulage Line",
        exports: ["eq"],
        imports: ["ore", "org"],
        missionTypes: ["delivery"]
    }),
    mining_contractor: Object.freeze({
        label: "Mining Contractor",
        exports: ["ore"],
        imports: ["eq"],
        missionTypes: ["mining", "delivery"]
    }),
    refinery_operator: Object.freeze({
        label: "Refinery Operator",
        exports: ["eq"],
        imports: ["ore"],
        missionTypes: ["delivery", "mining"]
    }),
    agri_collective: Object.freeze({
        label: "Agri Collective",
        exports: ["org"],
        imports: ["eq"],
        missionTypes: ["delivery", "colony"]
    }),
    industrial_supplier: Object.freeze({
        label: "Industrial Supplier",
        exports: ["eq"],
        imports: ["ore", "org"],
        missionTypes: ["delivery", "colony"]
    }),
    security_contractor: Object.freeze({
        label: "Security Contractor",
        exports: ["eq"],
        imports: ["org"],
        missionTypes: ["contest", "survey"]
    }),
    black_market_front: Object.freeze({
        label: "Front Office",
        exports: ["eq"],
        imports: ["ore", "org"],
        missionTypes: ["delivery", "survey"]
    })
});

export const COMPANY_NAME_PARTS = Object.freeze({
    prefixes: Object.freeze(["Aster", "Helion", "Orion", "Stardock", "Freehold", "Cinder", "Bluewake", "Kepler", "Vega", "Marrow"]),
    suffixes: Object.freeze(["Exchange", "Logistics", "Works", "Factors", "Combine", "Line", "Charter", "Holdings", "Supply", "Compact"])
});
