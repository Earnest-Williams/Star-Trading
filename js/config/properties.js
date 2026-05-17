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
