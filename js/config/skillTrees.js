export const SKILL_TREES = Object.freeze({
    property_operator: Object.freeze({ id: "property_operator", label: "Property Operator" }),
    commercial_leasing: Object.freeze({ id: "commercial_leasing", label: "Commercial Leasing" }),
    maintenance_infrastructure: Object.freeze({ id: "maintenance_infrastructure", label: "Maintenance & Infrastructure" }),
    local_influence: Object.freeze({ id: "local_influence", label: "Local Influence" }),
    real_estate_finance: Object.freeze({ id: "real_estate_finance", label: "Real Estate Finance" }),
    warehousing_import_support: Object.freeze({ id: "warehousing_import_support", label: "Warehousing & Import Support" }),
    station_broker: Object.freeze({ id: "station_broker", label: "Station Broker" }),
    logistics_architect: Object.freeze({ id: "logistics_architect", label: "Logistics Architect" }),
    data_broker: Object.freeze({ id: "data_broker", label: "Data Broker" }),
    free_trader: Object.freeze({ id: "free_trader", label: "Free Trader" })
});

function skillNode(definition) {
    return Object.freeze({
        requires: Object.freeze([]),
        effects: Object.freeze({}),
        ...definition,
        requires: Object.freeze(definition.requires || []),
        effects: Object.freeze(definition.effects || {})
    });
}

export const SKILL_NODES = Object.freeze({
    rent_ledger_discipline: skillNode({
        id: "rent_ledger_discipline",
        treeId: "property_operator",
        tier: 1,
        cost: 1,
        label: "Rent Ledger Discipline",
        description: "Improves rent, arrears, upkeep, and occupancy forecasting.",
        effects: { rentForecastAccuracy: 1, arrearsVisibility: 1, propertyRoutineAutomation: 1 }
    }),
    vacancy_triage: skillNode({
        id: "vacancy_triage",
        treeId: "commercial_leasing",
        tier: 1,
        cost: 1,
        label: "Vacancy Triage",
        description: "Strongly guides routine rent and tenant screening decisions.",
        effects: { occupancyForecastAccuracy: 1, tenantScreeningBonus: 1, leaseTermAccuracy: 1 }
    }),
    pressure_valve_maintenance: skillNode({
        id: "pressure_valve_maintenance",
        treeId: "maintenance_infrastructure",
        tier: 1,
        cost: 1,
        label: "Pressure-Valve Maintenance",
        description: "Reduces routine condition decay and reveals repair priorities.",
        effects: { propertyMaintenanceBonus: 1, conditionForecastAccuracy: 1, infrastructureRiskReduction: 1 }
    }),
    favor_map: skillNode({
        id: "favor_map",
        treeId: "local_influence",
        tier: 1,
        cost: 1,
        label: "Favor Map",
        description: "Tracks useful local intermediaries for tenant and official problems.",
        effects: { localInfluenceBonus: 1, propertyCrisisBonus: 1 }
    }),
    debt_stack_modeling: skillNode({
        id: "debt_stack_modeling",
        treeId: "real_estate_finance",
        tier: 1,
        cost: 1,
        label: "Debt Stack Modeling",
        description: "Improves refinance estimates and routine valuation guidance.",
        effects: { propertyValuationBonus: 1, refinanceAccuracy: 1, debtPressureVisibility: 1 }
    }),
    bonded_storage_layout: skillNode({
        id: "bonded_storage_layout",
        treeId: "warehousing_import_support",
        tier: 1,
        cost: 1,
        label: "Bonded Storage Layout",
        description: "Finds better storage conversions without asking the player to solve the layout puzzle.",
        effects: { storageYieldBonus: 1, conversionGuidance: 1, storageDemandInsight: 1 }
    }),
    counterparty_read: skillNode({
        id: "counterparty_read",
        treeId: "station_broker",
        tier: 1,
        cost: 1,
        label: "Counterparty Read",
        description: "Improves deal quality and identifies routine traps in station brokerage.",
        effects: { brokerageBonus: 1, contractRiskVisibility: 1, leaseTermAccuracy: 1 }
    }),
    lane_capacity_model: skillNode({
        id: "lane_capacity_model",
        treeId: "logistics_architect",
        tier: 1,
        cost: 1,
        label: "Lane Capacity Model",
        description: "Connects property storage decisions to route pressure and service demand.",
        effects: { routeReliabilityBonus: 1, storageDemandInsight: 1, propertyRoutineAutomation: 1 }
    }),
    source_confidence_index: skillNode({
        id: "source_confidence_index",
        treeId: "data_broker",
        tier: 1,
        cost: 1,
        label: "Source Confidence Index",
        description: "Improves intel confidence and routine data-cargo appraisal.",
        effects: { intelConfidenceBonus: 1, valuationAccuracy: 1 }
    }),
    margin_habit: skillNode({
        id: "margin_habit",
        treeId: "free_trader",
        tier: 1,
        cost: 1,
        label: "Margin Habit",
        description: "Keeps routine trade math character-mediated and better explained.",
        effects: { marketInsight: 1, routeRiskVisibility: 1 }
    })
});
