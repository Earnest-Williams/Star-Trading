export const PROPERTY_DEFAULTS = Object.freeze({
    CONDITION_MIN: 0,
    CONDITION_MAX: 100,
    OCCUPANCY_MIN: 0,
    OCCUPANCY_MAX: 1,
    BASE_VALUE_MULTIPLIER: 320,
    DAILY_CONDITION_DECAY: 0.08,
    HIGH_RENT_OCCUPANCY_DRAG: 0.012,
    LOW_RENT_OCCUPANCY_GAIN: 0.008
});

export const PROPERTY_ACTIONS = Object.freeze({
    setRentPosture: Object.freeze({ stat: "acumen", label: "Set rent posture" }),
    performMaintenance: Object.freeze({ stat: "fieldcraft", label: "Perform maintenance" }),
    screenTenants: Object.freeze({ stat: "tradecraft", label: "Screen tenants" }),
    changeTenantMix: Object.freeze({ stat: "tradecraft", label: "Change tenant mix" }),
    convertPropertyUse: Object.freeze({ stat: "acumen", label: "Convert property use" }),
    addService: Object.freeze({ stat: "command", label: "Add service" }),
    refinanceProperty: Object.freeze({ stat: "acumen", label: "Refinance property" }),
    hirePropertyManager: Object.freeze({ stat: "command", label: "Hire property manager" })
});

export const PROPERTY_ACTION_LIST = Object.freeze(Object.keys(PROPERTY_ACTIONS));


export const PROPERTY_TENANT_TYPES = Object.freeze({
    dockworkers: Object.freeze({ label: "Dockworkers", rentYield: 1.0, reliability: 62, disputeRisk: 0.22, serviceDemand: 0.45, tags: Object.freeze(["labor", "dockside"]) }),
    captains: Object.freeze({ label: "Captains", rentYield: 1.18, reliability: 58, disputeRisk: 0.28, serviceDemand: 0.7, tags: Object.freeze(["route", "contract_source"]) }),
    brokers: Object.freeze({ label: "Brokers", rentYield: 1.28, reliability: 52, disputeRisk: 0.36, serviceDemand: 0.35, tags: Object.freeze(["broker", "informant", "inspection_risk"]) }),
    merchants: Object.freeze({ label: "Merchants", rentYield: 1.16, reliability: 66, disputeRisk: 0.2, serviceDemand: 0.55, tags: Object.freeze(["commercial", "contract_source"]) }),
    mechanics: Object.freeze({ label: "Mechanics", rentYield: 1.08, reliability: 68, disputeRisk: 0.18, serviceDemand: 0.8, tags: Object.freeze(["repair", "emergency_service"]) }),
    guild_offices: Object.freeze({ label: "Guild Offices", rentYield: 1.22, reliability: 76, disputeRisk: 0.24, serviceDemand: 0.65, tags: Object.freeze(["guild", "political"]) }),
    company_agents: Object.freeze({ label: "Company Agents", rentYield: 1.3, reliability: 70, disputeRisk: 0.3, serviceDemand: 0.5, tags: Object.freeze(["company", "import_export", "contract_source"]) }),
    smugglers: Object.freeze({ label: "Smugglers", rentYield: 1.45, reliability: 42, disputeRisk: 0.55, serviceDemand: 0.4, tags: Object.freeze(["black_market", "informant", "inspection_risk"]) }),
    refugees: Object.freeze({ label: "Refugees", rentYield: 0.72, reliability: 55, disputeRisk: 0.18, serviceDemand: 0.75, tags: Object.freeze(["residential", "political_liability"]) }),
    clerks: Object.freeze({ label: "Clerks", rentYield: 0.94, reliability: 74, disputeRisk: 0.1, serviceDemand: 0.25, tags: Object.freeze(["paperwork", "inspection_buffer"]) }),
    data_operators: Object.freeze({ label: "Data Operators", rentYield: 1.2, reliability: 64, disputeRisk: 0.22, serviceDemand: 0.5, tags: Object.freeze(["data", "intel", "contract_source"]) })
});
