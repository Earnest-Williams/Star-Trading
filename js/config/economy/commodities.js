const withDefaults = (commodity) => Object.freeze({
    bulk: 1,
    basePrice: 100,
    volatility: 0.2,
    shortageSeverityScale: 1,
    inputs: Object.freeze({}),
    primarySources: Object.freeze([]),
    primaryConsumers: Object.freeze([]),
    isFinishedGood: false,
    storageClass: "bulk",
    decayRate: 0,
    ...commodity
});

const COMMODITY_REGISTRY = Object.freeze({
    ore: withDefaults({ id: 'ore', name: 'Common Ore', category: 'raw', tier: 'raw', bulk: 2, basePrice: 50, volatility: 0.12, primarySources: Object.freeze(['asteroid_mining']), primaryConsumers: Object.freeze(['smelters']) }),
    heavy_metals: withDefaults({ id: 'heavy_metals', name: 'Heavy Metals', category: 'raw', tier: 'raw', bulk: 2, basePrice: 82, volatility: 0.16, primarySources: Object.freeze(['deep_mining', 'ore_grading']), primaryConsumers: Object.freeze(['refineries', 'manufacturing']) }),
    rare_earths: withDefaults({ id: 'rare_earths', name: 'Rare Earths', category: 'raw', tier: 'raw', bulk: 1, basePrice: 120, volatility: 0.28, primarySources: Object.freeze(['asteroid_mining']), primaryConsumers: Object.freeze(['electronics_fabs']) }),
    water_ice: withDefaults({ id: 'water_ice', name: 'Water Ice', category: 'raw', tier: 'raw', bulk: 3, basePrice: 45, volatility: 0.18, storageClass: 'cold', decayRate: 0.04, primarySources: Object.freeze(['ice_harvest']), primaryConsumers: Object.freeze(['life_support', 'coolant_plants']) }),
    org: withDefaults({ id: 'org', name: 'Biomass', category: 'raw', tier: 'raw', bulk: 2, basePrice: 65, volatility: 0.22, storageClass: 'cold', decayRate: 0.05, primarySources: Object.freeze(['hydroponics', 'agri_outposts']), primaryConsumers: Object.freeze(['polymer_plants', 'fertilizer_plants']) }),
    refined_metals: withDefaults({ id: 'refined_metals', name: 'Refined Metals', category: 'processed', tier: 'processed', basePrice: 130, inputs: Object.freeze({ ore: 1, heavy_metals: 1 }), primarySources: Object.freeze(['smelters']), primaryConsumers: Object.freeze(['construction', 'machinery']), isFinishedGood: false }),
    polymers: withDefaults({ id: 'polymers', name: 'Polymers', category: 'processed', tier: 'processed', basePrice: 150, inputs: Object.freeze({ org: 1, water_ice: 1 }), primarySources: Object.freeze(['polymer_plants']), primaryConsumers: Object.freeze(['medical', 'repair']) }),
    coolants: withDefaults({ id: 'coolants', name: 'Coolants', category: 'processed', tier: 'processed', basePrice: 160, inputs: Object.freeze({ water_ice: 1, rare_earths: 1 }), primarySources: Object.freeze(['coolant_plants']), primaryConsumers: Object.freeze(['stations', 'gates']) }),
    fertilizer: withDefaults({ id: 'fertilizer', name: 'Fertilizer', category: 'processed', tier: 'processed', basePrice: 135, inputs: Object.freeze({ org: 1, water_ice: 1 }), primarySources: Object.freeze(['fertilizer_plants']), primaryConsumers: Object.freeze(['colonies']) }),
    eq: withDefaults({ id: 'eq', name: 'Equipment', category: 'manufactured', tier: 'manufactured', basePrice: 240, storageClass: 'secure', inputs: Object.freeze({ machinery: 1, electronics: 1 }), primaryConsumers: Object.freeze(['captains', 'colonies']), isFinishedGood: true }),
    machinery: withDefaults({ id: 'machinery', name: 'Machinery', category: 'manufactured', tier: 'manufactured', basePrice: 210, storageClass: 'secure', inputs: Object.freeze({ refined_metals: 1, electronics: 1 }), primaryConsumers: Object.freeze(['industry']), isFinishedGood: true }),
    repair_parts: withDefaults({ id: 'repair_parts', name: 'Repair Parts', category: 'manufactured', tier: 'manufactured', basePrice: 175, inputs: Object.freeze({ refined_metals: 1, polymers: 1 }), primaryConsumers: Object.freeze(['maintenance']), isFinishedGood: true }),
    electronics: withDefaults({ id: 'electronics', name: 'Electronics', category: 'manufactured', tier: 'manufactured', basePrice: 200, storageClass: 'secure', inputs: Object.freeze({ heavy_metals: 1, rare_earths: 1 }), primaryConsumers: Object.freeze(['stardocks', 'gates']), isFinishedGood: true }),
    medical_supplies: withDefaults({ id: 'medical_supplies', name: 'Medical Supplies', category: 'manufactured', tier: 'manufactured', basePrice: 210, storageClass: 'cold', decayRate: 0.02, inputs: Object.freeze({ polymers: 1, water_ice: 1 }), primaryConsumers: Object.freeze(['population_centers']), isFinishedGood: true }),
    construction_kits: withDefaults({ id: 'construction_kits', name: 'Construction Kits', category: 'manufactured', tier: 'manufactured', basePrice: 260, storageClass: 'secure', inputs: Object.freeze({ refined_metals: 1, machinery: 1 }), primaryConsumers: Object.freeze(['expansion_projects']), isFinishedGood: true }),
    pulse_canister: withDefaults({ id: 'pulse_canister', name: 'Pulse Canisters', category: 'pulse', tier: 'pulse', basePrice: 320, volatility: 0.35, storageClass: 'pulse', decayRate: 0.01, inputs: Object.freeze({ water_ice: 1, coolants: 1 }), primaryConsumers: Object.freeze(['way_stations', 'gate_hubs']), isFinishedGood: true }),
    heavy_pulse_module: withDefaults({ id: 'heavy_pulse_module', name: 'Heavy Pulse Modules', category: 'pulse', tier: 'pulse', basePrice: 420, storageClass: 'pulse', decayRate: 0.01, inputs: Object.freeze({ pulse_canister: 1, machinery: 1 }), isFinishedGood: true }),
    gate_coils: withDefaults({ id: 'gate_coils', name: 'Gate Coils', category: 'pulse', tier: 'pulse', basePrice: 460, storageClass: 'secure', inputs: Object.freeze({ heavy_metals: 1, electronics: 1 }), isFinishedGood: true }),
    control_cores: withDefaults({ id: 'control_cores', name: 'Control Cores', category: 'pulse', tier: 'pulse', basePrice: 500, storageClass: 'secure', inputs: Object.freeze({ electronics: 1, rare_earths: 1 }), isFinishedGood: true })
});

function idsByTier(tier) { return Object.freeze(Object.values(COMMODITY_REGISTRY).filter((c) => c.tier === tier).map((c) => c.id)); }
function idsByCategory(category) { return Object.freeze(Object.values(COMMODITY_REGISTRY).filter((c) => c.category === category).map((c) => c.id)); }

export { COMMODITY_REGISTRY };

export function getCommodityDef(id) {
    return COMMODITY_REGISTRY[id] || null;
}

export function getCommodityIdsByCategory(category) {
    return idsByCategory(category);
}
export const RAW_COMMODITIES = idsByTier('raw');
export const PROCESSED_COMMODITIES = idsByTier('processed');
export const MANUFACTURED_COMMODITIES = idsByTier('manufactured');
export const PULSE_COMMODITIES = idsByTier('pulse');
export const MARKET_COMMODITIES = Object.freeze(Object.values(COMMODITY_REGISTRY).map((commodity) => commodity.id));
export const CARGO_COMMODITIES = MARKET_COMMODITIES;
export const COMMODITY_NAMES = Object.freeze(Object.fromEntries(Object.values(COMMODITY_REGISTRY).map((commodity) => [commodity.id, commodity.name])));
export const COMMODITY_BASE_PRICES = Object.freeze(Object.fromEntries(Object.values(COMMODITY_REGISTRY).map((commodity) => [commodity.id, commodity.basePrice])));
