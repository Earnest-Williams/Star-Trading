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
    dockworkers: Object.freeze({ label: "Dockworkers", rentYield: 1.0, reliability: 62, disputeRisk: 0.22, serviceDemand: 0.45, inspectionRisk: 0.04, maintenanceLoad: 0.22, reputationEffect: 0.02, contractFlow: 0.18, commodityFocus: Object.freeze(["repair_parts", "eq", "water_ice"]), leasingNeeds: Object.freeze(["staff_housing", "berth_access"]), tags: Object.freeze(["labor", "dockside"]) }),
    captains: Object.freeze({ label: "Captains", rentYield: 1.18, reliability: 58, disputeRisk: 0.28, serviceDemand: 0.7, inspectionRisk: 0.08, maintenanceLoad: 0.28, reputationEffect: 0.04, contractFlow: 0.54, commodityFocus: Object.freeze(["ore", "org", "water_ice", "repair_parts"]), leasingNeeds: Object.freeze(["berth_access", "repair_access", "office_space"]), tags: Object.freeze(["route", "contract_source"]) }),
    brokers: Object.freeze({ label: "Brokers", rentYield: 1.28, reliability: 52, disputeRisk: 0.36, serviceDemand: 0.35, inspectionRisk: 0.22, maintenanceLoad: 0.12, reputationEffect: -0.02, contractFlow: 0.62, commodityFocus: Object.freeze(["electronics", "medical_supplies", "control_cores", "pulse_canister"]), leasingNeeds: Object.freeze(["office_space", "bonded_cargo_services"]), tags: Object.freeze(["broker", "informant", "inspection_risk"]) }),
    merchants: Object.freeze({ label: "Merchants", rentYield: 1.16, reliability: 66, disputeRisk: 0.2, serviceDemand: 0.55, inspectionRisk: 0.06, maintenanceLoad: 0.18, reputationEffect: 0.05, contractFlow: 0.48, commodityFocus: Object.freeze(["org", "water_ice", "eq", "medical_supplies", "electronics"]), leasingNeeds: Object.freeze(["office_space", "output_storage"]), tags: Object.freeze(["commercial", "contract_source"]) }),
    mechanics: Object.freeze({ label: "Mechanics", rentYield: 1.08, reliability: 68, disputeRisk: 0.18, serviceDemand: 0.8, inspectionRisk: 0.05, maintenanceLoad: 0.34, reputationEffect: 0.04, contractFlow: 0.36, commodityFocus: Object.freeze(["repair_parts", "electronics", "machinery", "construction_kits", "control_cores", "gate_coils"]), leasingNeeds: Object.freeze(["repair_access", "input_storage", "berth_access"]), tags: Object.freeze(["repair", "emergency_service"]) }),
    guild_offices: Object.freeze({ label: "Guild Offices", rentYield: 1.22, reliability: 76, disputeRisk: 0.24, serviceDemand: 0.65, inspectionRisk: 0.1, maintenanceLoad: 0.16, reputationEffect: 0.08, contractFlow: 0.44, commodityFocus: Object.freeze(["ore", "heavy_metals", "eq", "machinery"]), leasingNeeds: Object.freeze(["office_space", "staff_housing", "security"]), tags: Object.freeze(["guild", "political"]) }),
    company_agents: Object.freeze({ label: "Company Agents", rentYield: 1.3, reliability: 70, disputeRisk: 0.3, serviceDemand: 0.5, inspectionRisk: 0.12, maintenanceLoad: 0.18, reputationEffect: 0.06, contractFlow: 0.74, commodityFocus: Object.freeze(["ore", "heavy_metals", "water_ice", "refined_metals", "polymers", "coolants", "control_cores"]), leasingNeeds: Object.freeze(["office_space", "input_storage", "output_storage", "bonded_cargo_services"]), tags: Object.freeze(["company", "import_export", "contract_source"]) }),
    refinery_tenants: Object.freeze({ label: "Refinery Tenants", rentYield: 1.24, reliability: 64, disputeRisk: 0.26, serviceDemand: 0.64, inspectionRisk: 0.14, maintenanceLoad: 0.36, reputationEffect: 0.04, contractFlow: 0.58, commodityFocus: Object.freeze(["ore", "heavy_metals", "water_ice", "rare_earths", "control_cores", "refined_metals", "polymers", "coolants", "pulse_canister"]), leasingNeeds: Object.freeze(["input_storage", "output_storage", "coolant_logistics", "bonded_cargo_services"]), tags: Object.freeze(["company", "refinery", "contract_source", "industrial"]) }),
    dockyard_tenants: Object.freeze({ label: "Dockyard Tenants", rentYield: 1.32, reliability: 62, disputeRisk: 0.31, serviceDemand: 0.78, inspectionRisk: 0.16, maintenanceLoad: 0.42, reputationEffect: 0.06, contractFlow: 0.66, commodityFocus: Object.freeze(["heavy_metals", "gate_coils", "control_cores", "construction_kits", "repair_parts", "electronics", "machinery"]), leasingNeeds: Object.freeze(["berth_access", "repair_access", "input_storage", "security"]), tags: Object.freeze(["company", "dockyard", "repair", "route", "contract_source"]) }),
    agri_tenants: Object.freeze({ label: "Agri Tenants", rentYield: 1.08, reliability: 72, disputeRisk: 0.16, serviceDemand: 0.58, inspectionRisk: 0.05, maintenanceLoad: 0.24, reputationEffect: 0.07, contractFlow: 0.46, commodityFocus: Object.freeze(["water_ice", "machinery", "coolants", "polymers", "fertilizer", "org"]), leasingNeeds: Object.freeze(["input_storage", "output_storage", "staff_housing"]), tags: Object.freeze(["company", "agri", "commercial", "contract_source"]) }),
    smugglers: Object.freeze({ label: "Smugglers", rentYield: 1.45, reliability: 42, disputeRisk: 0.55, serviceDemand: 0.4, inspectionRisk: 0.52, maintenanceLoad: 0.2, reputationEffect: -0.14, contractFlow: 0.72, commodityFocus: Object.freeze(["electronics", "pulse_canister", "control_cores", "medical_supplies"]), leasingNeeds: Object.freeze(["discreet_storage", "forged_paperwork", "security"]), tags: Object.freeze(["black_market", "informant", "inspection_risk"]) }),
    black_market_tenants: Object.freeze({ label: "Black-Market Tenants", rentYield: 1.52, reliability: 38, disputeRisk: 0.62, serviceDemand: 0.48, inspectionRisk: 0.62, maintenanceLoad: 0.26, reputationEffect: -0.2, contractFlow: 0.82, commodityFocus: Object.freeze(["electronics", "control_cores", "pulse_canister", "heavy_pulse_module", "medical_supplies"]), leasingNeeds: Object.freeze(["discreet_storage", "forged_paperwork", "security", "bonded_cargo_services"]), tags: Object.freeze(["black_market", "inspection_risk", "informant", "contract_source"]) }),
    refugees: Object.freeze({ label: "Refugees", rentYield: 0.72, reliability: 55, disputeRisk: 0.18, serviceDemand: 0.75, inspectionRisk: 0.08, maintenanceLoad: 0.32, reputationEffect: 0.1, contractFlow: 0.08, commodityFocus: Object.freeze(["water_ice", "medical_supplies", "org"]), leasingNeeds: Object.freeze(["staff_housing"]), tags: Object.freeze(["residential", "political_liability"]) }),
    clerks: Object.freeze({ label: "Clerks", rentYield: 0.94, reliability: 74, disputeRisk: 0.1, serviceDemand: 0.25, inspectionRisk: -0.12, maintenanceLoad: 0.08, reputationEffect: 0.03, contractFlow: 0.22, commodityFocus: Object.freeze(["control_cores", "electronics"]), leasingNeeds: Object.freeze(["office_space", "forged_paperwork"]), tags: Object.freeze(["paperwork", "inspection_buffer"]) }),
    data_operators: Object.freeze({ label: "Data Operators", rentYield: 1.2, reliability: 64, disputeRisk: 0.22, serviceDemand: 0.5, inspectionRisk: 0.08, maintenanceLoad: 0.14, reputationEffect: 0.04, contractFlow: 0.5, commodityFocus: Object.freeze(["electronics", "control_cores"]), leasingNeeds: Object.freeze(["office_space", "security"]), tags: Object.freeze(["data", "intel", "contract_source"]) })
});
