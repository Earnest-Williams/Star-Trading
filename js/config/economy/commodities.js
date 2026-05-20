const COMMODITY_REGISTRY = Object.freeze({
    ore: Object.freeze({ id: "ore", name: "Common Ore", tier: "raw" }),
    heavy_metals: Object.freeze({ id: "heavy_metals", name: "Heavy Metals", tier: "raw" }),
    rare_earths: Object.freeze({ id: "rare_earths", name: "Rare Earths", tier: "raw" }),
    water_ice: Object.freeze({ id: "water_ice", name: "Water Ice", tier: "raw" }),
    org: Object.freeze({ id: "org", name: "Biomass", tier: "raw" }),
    refined_metals: Object.freeze({ id: "refined_metals", name: "Refined Metals", tier: "processed" }),
    polymers: Object.freeze({ id: "polymers", name: "Polymers", tier: "processed" }),
    coolants: Object.freeze({ id: "coolants", name: "Coolants", tier: "processed" }),
    fertilizer: Object.freeze({ id: "fertilizer", name: "Fertilizer", tier: "processed" }),
    eq: Object.freeze({ id: "eq", name: "Equipment", tier: "manufactured" }),
    machinery: Object.freeze({ id: "machinery", name: "Machinery", tier: "manufactured" }),
    repair_parts: Object.freeze({ id: "repair_parts", name: "Repair Parts", tier: "manufactured" }),
    electronics: Object.freeze({ id: "electronics", name: "Electronics", tier: "manufactured" }),
    medical_supplies: Object.freeze({ id: "medical_supplies", name: "Medical Supplies", tier: "manufactured" }),
    construction_kits: Object.freeze({ id: "construction_kits", name: "Construction Kits", tier: "manufactured" }),
    pulse_canister: Object.freeze({ id: "pulse_canister", name: "Pulse Canisters", tier: "pulse" }),
    heavy_pulse_module: Object.freeze({ id: "heavy_pulse_module", name: "Heavy Pulse Modules", tier: "pulse" }),
    gate_coils: Object.freeze({ id: "gate_coils", name: "Gate Coils", tier: "pulse" }),
    control_cores: Object.freeze({ id: "control_cores", name: "Control Cores", tier: "pulse" })
});

function idsByTier(tier) {
    return Object.freeze(
        Object.values(COMMODITY_REGISTRY)
            .filter((commodity) => commodity.tier === tier)
            .map((commodity) => commodity.id)
    );
}

export { COMMODITY_REGISTRY };

export const RAW_COMMODITIES = idsByTier("raw");
export const PROCESSED_COMMODITIES = idsByTier("processed");
export const MANUFACTURED_COMMODITIES = idsByTier("manufactured");
export const PULSE_COMMODITIES = idsByTier("pulse");

export const MARKET_COMMODITIES = Object.freeze([
    ...RAW_COMMODITIES,
    ...PROCESSED_COMMODITIES,
    ...MANUFACTURED_COMMODITIES,
    ...PULSE_COMMODITIES
]);

export const CARGO_COMMODITIES = MARKET_COMMODITIES;

export const COMMODITY_NAMES = Object.freeze(
    Object.fromEntries(Object.values(COMMODITY_REGISTRY).map((commodity) => [commodity.id, commodity.name]))
);
