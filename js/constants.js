export const MINUTES_PER_HOUR = 60;
export const HOURS_PER_DAY = 24;

export const BALANCE = {
    DAY_MINUTES: HOURS_PER_DAY * MINUTES_PER_HOUR,
    DEFAULT_WAKE: 8 * MINUTES_PER_HOUR,
    DEFAULT_SLEEP: HOURS_PER_DAY * MINUTES_PER_HOUR,
    CAPTAIN_HOURLY_ACTION_CHANCE: 0.045,
    CAPTAIN_MISSION_INTEREST_THRESHOLD: 28,
    CAPTAIN_MISSION_TAKE_THRESHOLD: 55,
    TRADE_BATCH: 10,
    MIN_TRADE_PRICE: 5,
    TRADE_TIME_MINUTES: 30,
    TRADE_ROUTE_BASE_COST: 1200,
    TRADE_ROUTE_INTERVAL_DAYS: 1,
    TRADE_ROUTE_BASE_AMOUNT: 12,
    AMBIENT_TRADE: {
        MAX_SEARCH_DISTANCE: 5,
        MAX_DAILY_FILL_SHARE: 0.28,
        MAX_DAILY_EXPORT_SHARE: 0.18,
        BASE_FLOW: 22,
        DISTANCE_PENALTY: 0.45,
        RISK_PENALTY: 0.28,
        JITTER: 0.18,
        MIN_MARGIN: 10,
        NODE_TARGETS: {
            SELLER_SURPLUS_FLOOR: 0.25,
            NONSELLER_SURPLUS_FLOOR: 0.55,
            BUYER_SHORTAGE_TARGET: 0.62,
            NONBUYER_SHORTAGE_TARGET: 0.35
        },
        DEFAULT_MAX_STOCK_CAP: 9999,
        DISTANCE_BASELINE: 1
    },
    CAPTAIN_ROUTE: {
        EVALUATION_INTERVAL_DAYS: 3,
        MIN_MARGIN: 16,
        MAX_OWNED_ROUTES: 2,
        BAD_ROUTE_FAILURES: 4
    },
    CONTRABAND: {
        RECEIVER_FACTION_ID: "vc",
        INSPECTOR_FACTION_ID: "sda",
        BASE_HIDDEN_HOLD_FRACTION: 0.18,
        MIN_HIDDEN_HOLD_CAPACITY: 4,
        SCANNER_HIDDEN_HOLD_BONUS: 1,
        SMUGGLER_TIER_HIDDEN_HOLD_BONUS: 2,
        BADLANDS_SOURCE_BONUS: 12,
        RECEIVER_SOURCE_BONUS: 25,
        RECEIVER_DEMAND_BONUS: 35,
        PIRATE_SOURCE_MULT: 7,
        PIRATE_DEMAND_MULT: 5,
        SDA_SOURCE_PRESSURE_MULT: 0.25,
        VC_DEMAND_MULT: 0.7,
        SOURCE_QUANTITY_DIVISOR: 18,
        DEMAND_QUANTITY_DIVISOR: 16,
        INSPECTION_BASE_CHANCE: 0.08,
        INSPECTION_MIN_CHANCE: 0.03,
        INSPECTION_MAX_CHANCE: 0.85,
        INSPECTION_HEAT_MULT: 0.015,
        INSPECTION_SCANNER_MITIGATION: 0.04,
        INSPECTION_FORGED_MITIGATION_CAP: 0.12,
        INSPECTION_FACTION_HEAT_PRESSURE: 0.0025,
        INSPECTION_SDA_INFLUENCE_PRESSURE: 0.0015,
        INSPECTION_PIRATE_NOISE: 0.01,
        ROUTE_RISK_REWARD_MULT: 0.04,
        ROUTE_RISK_REWARD_CAP: 0.5,
        DEMAND_REWARD_DIVISOR: 80,
        DEMAND_REWARD_CAP: 0.3,
        RELATIONSHIP_REWARD_DIVISOR: 2500,
        RELATIONSHIP_REWARD_CAP: 0.12,
        PICKUP_MIN_REP: 1,
        PICKUP_REP_DIVISOR: 5,
        PICKUP_TRUST_GAIN: 1,
        DELIVERY_MIN_REP: 2,
        DELIVERY_REP_DIVISOR: 3,
        DELIVERY_TRUST_GAIN: 2,
        MAX_BUST_HEAT: 25,
        BUST_BASE_HEAT: 5,
        MAX_BUST_REP_LOSS: 8,
        MAX_DELIVERY_HEAT: 10,
        DELIVERY_BASE_HEAT: 1,
        DELIVERY_HEAT_DIVISOR: 4,
        ACQUIRED_EVENT_IMPORTANCE: 2,
        BUST_EVENT_IMPORTANCE: 4,
        DELIVERED_EVENT_IMPORTANCE: 3,
        TYPES: {
            black_market_eq: {
                id: "black_market_eq",
                name: "Black-Market Equipment",
                value: 220,
                heat: 4,
                bulk: 1,
                sourceWeight: { industrial: 3, refinery: 2, stardock: 1 },
                demandWeight: { mining: 2, agricultural: 1, consumer: 2 }
            },
            forged_manifests: {
                id: "forged_manifests",
                name: "Forged Manifests",
                value: 140,
                heat: 2,
                bulk: 1,
                inspectionMitigation: 0.03,
                sourceWeight: { stardock: 3, consumer: 2, refinery: 1 },
                demandWeight: { industrial: 2, mining: 1, agricultural: 1 }
            },
            restricted_meds: {
                id: "restricted_meds",
                name: "Restricted Meds",
                value: 180,
                heat: 3,
                bulk: 1,
                sourceWeight: { agricultural: 2, consumer: 2, stardock: 1 },
                demandWeight: { mining: 2, refinery: 2, industrial: 1 }
            }
        }
    },
    FRONT_EXPOSURE_THRESHOLD: 88,
    FACTION_EXPANSION_MIN_INFLUENCE: 68,
    POLITICAL_INTEL_BASE_CHANCE: 0.06,
    POLITICAL_MISSION_LIMIT: 14,
    CONTESTED_GAP: 8,
    WORLD_EVENT_LIMIT: 90,
    NOTIFICATION_LIFETIME_MS: 8000,
    MAX_NOTIFICATIONS: 5,
    PRIORITY_FEED_LIMIT: 8,
    LEGACY_SECTOR_COUNT: 30,
    SECTOR_COUNT: 60,
    WORLDGEN: {
        DEFAULT_OCCUPIED_SITES: 60,
        SITE_COUNT_PRESETS: [60, 90, 120, 150],
        MAX_OCCUPIED_SITES: 150,
        DEFAULT_ARCHETYPE: "barred_spiral",
        DEFAULT_ROUTE_DENSITY: 1.0,
        DEFAULT_CHARTED_FRACTION: 0.28,
        DEFAULT_REACHABLE_CHARTED_FRACTION: 0.75,
        WAY_STATION_MAX_FRACTION: 0.08,
        SITE_TYPE_MIX: {
            stellar_system: 0.62,
            brown_dwarf_system: 0.14,
            circumbinary_system: 0.06,
            multiple_star_system: 0.07,
            rogue_system: 0.04,
            white_dwarf_remnant: 0.02,
            way_station: 0.04,
            exotic_remnant: 0.01
        },
        RICHNESS_MIX: {
            barren: 0.18,
            sparse: 0.24,
            developing: 0.22,
            settled: 0.20,
            hub: 0.10,
            strategic: 0.06
        },
        ARCHETYPES: {
            barred_spiral: { name: "Barred Spiral", armCount: 2, clusterJitter: 3.8, zScale: 3.0 },
            four_arm_spiral: { name: "Four-Arm Spiral", armCount: 4, clusterJitter: 3.2, zScale: 3.4 },
            dwarf_irregular: { name: "Dwarf Irregular", armCount: 0, clusterJitter: 5.0, zScale: 4.5 }
        }
    },
    GATE_PHYSICS: {
        VACUUM_SPAN: 6.0,
        SHEAR_AVG_MULT: 0.35,
        SHEAR_PEAK_MULT: 0.20,
        ROUTE_SURCHARGE_BY_WAY_STATIONS: [0, 0.08, 0.25, 0.60, 1.20],
        ENERGY: {
            CREDIT_PER_TJ: 1,
            REFERENCE_SHIP_PRICE: 100,
            REFERENCE_APERTURE_DIAMETER_M: 4,
            REFERENCE_HOLD_SECONDS: 12,
            SOURCE_BASE_TJ: 4.0,
            SOURCE_RANGE_MULT: 1.6,
            SOURCE_DIAMETER_EXPONENT: 2.4,
            SOURCE_HOLD_GRACE_SECONDS: 18,
            SOURCE_HOLD_EXP_SECONDS: 22,
            ANCHOR_BASE_TJ: 0.8,
            ANCHOR_RANGE_MULT: 0.4,
            ANCHOR_DIAMETER_EXPONENT: 1.2,
            ANCHOR_HOLD_GRACE_SECONDS: 18,
            ANCHOR_HOLD_EXP_SECONDS: 40
        },
        WAY_STATION: {
            BASELINE_POWER_CREDITS_PER_HOUR: 0.02,
            ORDINARY_RESERVE_MIN: 18,
            ORDINARY_RESERVE_MAX: 36,
            FRONTIER_RESERVE_MIN: 40,
            FRONTIER_RESERVE_MAX: 60,
            SERVICE_HOURS_BY_CHAIN_LENGTH: [0, 12, 24, 48, 96],
            RESERVE_STATE_THRESHOLDS: { full: 0.90, stable: 0.65, strained: 0.40, low: 0.15 }
        },
        PULSE_CARGO: {
            pulse_canister: { name: "Pulse Canister", storedTJ: 5, basePrice: 7 },
            heavy_pulse_module: { name: "Heavy Pulse Module", storedTJ: 20, basePrice: 26 }
        },
        ACCUMULATORS: {
            NAME: "Metric Pulse Accumulator",
            CAPACITY_BANDS_TJ: [12, 24, 48, 96, 192, 320],
            PRACTICAL_UPPER_TJ: 320
        }
    },
    PRICE: {
        REP_DIVISOR: 3000,
        PRIVATE_DIVISOR: 7000,
        TRUST_DIVISOR: 2500,
        HEAT_DIVISOR: 1800,
        INFLUENCE_DIVISOR: 2500,
        TRADER_GUILD_BONUS: 0.025,
        AFFINITY_GUILD_BONUS: 0.015,
        MAX_BONUS: 0.35,
        MAX_PENALTY: 0.25,
        MIN_MULT: 0.68,
        MAX_MULT: 1.40
    },
    FIGHTER_COST: 80,
    REPAIR_SHIELD_COST: 2,
    REPAIR_HULL_COST: 35,
};

export const SAVE_VERSION = 14;
export const SAVE_KEY = "starTradingSaveV14";
export const SAVE_KEY_LEGACY = "starTradingSaveV13";
export const SAVE_KEY_CLASSIC = "soloSpaceTraderSaveV6";
export const COMMODITIES = ["ore", "org", "eq"];
export const PULSE_COMMODITIES = ["pulse_canister", "heavy_pulse_module"];
export const MARKET_COMMODITIES = COMMODITIES.concat(PULSE_COMMODITIES);
export const CARGO_COMMODITIES = MARKET_COMMODITIES;
export const COMMODITY_NAMES = {
    ore: "Ore",
    org: "Organics",
    eq: "Equipment",
    pulse_canister: "Pulse Canisters",
    heavy_pulse_module: "Heavy Pulse Modules"
};
export const DEBUG_MODE = true;

export const FACTIONS = {
    sda: { id: "sda", type: "major", name: "StarDock Authority", short: "SDA", color: "#44aaff", icon: "★", description: "Core government enforcing law, traffic control, and StarDock access.", startingRep: 25 },
    fu: { id: "fu", type: "major", name: "Frontier Union", short: "FU", color: "#00ff88", icon: "☼", description: "Loose coalition of settlers, free ports, and frontier colonies.", startingRep: 15 },
    hc: { id: "hc", type: "major", name: "Helion Combine", short: "HC", color: "#ffaa00", icon: "⚒", description: "Industrial combines, ore processors, and hard-edged resource firms.", startingRep: 0 },
    vc: { id: "vc", type: "major", name: "Void Cartel", short: "VC", color: "#ff4444", icon: "☠", description: "Smugglers, protection rackets, and outlaw logistics networks.", startingRep: -20 },
    miners: { id: "miners", type: "guild", name: "Miners Guild", short: "MNG", color: "#ffaa00", icon: "⛏", description: "Hard-bitten asteroid prospectors with Helion Combine ties.", startingRep: 0, majorAffinity: "hc" },
    traders: { id: "traders", type: "guild", name: "Traders Guild", short: "TRD", color: "#00ffcc", icon: "¤", description: "Independent haulers, brokers, and market scouts.", startingRep: 0, majorAffinity: "fu" },
    colonists: { id: "colonists", type: "guild", name: "Colonists League", short: "COL", color: "#00ff88", icon: "⌂", description: "Settlement advocates and frontier mutual-aid networks.", startingRep: 0, majorAffinity: "fu" },
    smugglers: { id: "smugglers", type: "guild", name: "Smugglers Syndicate", short: "SMG", color: "#cc66ff", icon: "◆", description: "Quiet-route specialists and off-ledger freight brokers.", startingRep: 0, majorAffinity: "vc" }
};

export const DEFAULT_FACTION_RELATIONS = {
    sda: { fu: 30, hc: 10, vc: -80 },
    fu: { sda: 30, hc: -10, vc: -40 },
    hc: { sda: 10, fu: -10, vc: -60 },
    vc: { sda: -80, fu: -40, hc: -60 }
};

export const FACTION_INTERESTS = {
    sda: { wants: "stable lanes, registered colonies, taxes, low piracy", dislikes: "smuggling, hidden ports, unregistered settlements", law: "Inspections and patrols rise where SDA influence is high." },
    fu: { wants: "autonomous colonies, frontier supply, local militias", dislikes: "corporate dependency and abandoned settlements", law: "Colonies grow faster where Frontier influence is high." },
    hc: { wants: "ore, equipment, fuel, industrial throughput", dislikes: "supply disruption and miner unrest", law: "Mining and factory production improve where Helion influence is high." },
    vc: { wants: "shadow markets, weak patrols, leverage, hidden routes", dislikes: "cargo scans and reliable state control", law: "Black-market opportunity rises where Cartel influence is high." },
    miners: { wants: "recognized claims, ore price floors, safer extraction", dislikes: "claim jumping and corporate underpayment", law: "Guild charters improve mining but can pull politics toward Helion." },
    traders: { wants: "route stability, market intel, bulk contracts", dislikes: "blockades, price shocks, unstable ports", law: "Guild members get better market terms and route information." },
    colonists: { wants: "population growth, food security, settlement autonomy", dislikes: "abandoned colonies and unsafe migration routes", law: "League charters improve growth and colony output." },
    smugglers: { wants: "quiet lanes, forged manifests, informal port access", dislikes: "scanners, audits, patrol schedules", law: "Syndicate ties reduce some pirate risk but raise official heat." }
};

export const INFLUENCE_BASES = {
    Core: { sda: 58, fu: 18, hc: 14, vc: 6 },
    Frontier: { sda: 18, fu: 46, hc: 18, vc: 12 },
    Badlands: { sda: 6, fu: 16, hc: 28, vc: 36 }
};

export const FACTION_ASK_TYPES = ["ore_quota", "survey_patrol", "frontier_charter", "quiet_delivery", "market_intel"];
export const MAJOR_FACTIONS = Object.keys(FACTIONS).filter(id => FACTIONS[id].type === "major");
export const GUILD_FACTIONS = Object.keys(FACTIONS).filter(id => FACTIONS[id].type === "guild");
export const GUILD_TIER_NAMES = ["None", "Member", "Officer", "Leader"];

export const GUILD_REQUIREMENTS = {
    miners: { credits: 500, cargo: { ore: 30 }, allowedPortTypes: ["mining", "refinery"], note: "Join at a mining or refinery port." },
    traders: { credits: 750, cargo: {}, allowedPortTypes: ["consumer", "stardock"], note: "Join at StarDock or a consumer hub." },
    colonists: { credits: 500, cargo: { org: 20 }, allowedPortTypes: ["agricultural"], allowsPlayerColony: true, note: "Join at an agricultural port or your own colony." },
    smugglers: { credits: 900, cargo: { eq: 10 }, allowedRegions: ["Badlands"], note: "Join from a Badlands sector." }
};

export const PORT_TYPES = {
    stardock: { name: "StarDock Services", factionId: "sda", sells: ["pulse_canister", "heavy_pulse_module"], buys: ["pulse_canister", "heavy_pulse_module"], description: "Shipyard, repairs, upgrades, mission brokerage, and certified pulse logistics." },
    mining: { name: "Mining Outpost", factionId: "hc", sells: ["ore"], buys: ["org", "eq", "pulse_canister"], description: "Exports ore and imports supplies, machinery, and limited jump-pulse stores." },
    agricultural: { name: "Agricultural Station", factionId: "fu", sells: ["org"], buys: ["ore", "eq", "pulse_canister"], description: "Exports organics and imports machinery plus reserve pulse canisters." },
    industrial: { name: "Industrial Port", factionId: "hc", sells: ["eq", "pulse_canister"], buys: ["ore", "org", "heavy_pulse_module"], description: "Exports equipment and conditioned pulse canisters while importing raw materials." },
    consumer: { name: "Consumer Hub", factionId: "fu", sells: [], buys: ["ore", "org", "eq", "pulse_canister"], description: "Pays for almost anything the frontier needs, including packaged jump reserves." },
    refinery: { name: "Refinery", factionId: "hc", sells: ["eq", "pulse_canister", "heavy_pulse_module"], buys: ["ore"], description: "Turns ore and industrial power into equipment and packaged jump-pulse inventory." }
};

export const PLANET_TYPES = {
    terran: { name: "Terran", ore: 1.0, org: 1.2, eq: 1.0, growth: 1.3 },
    volcanic: { name: "Volcanic", ore: 1.8, org: 0.4, eq: 1.0, growth: 0.7 },
    oceanic: { name: "Oceanic", ore: 0.6, org: 1.8, eq: 0.8, growth: 1.2 },
    barren: { name: "Barren", ore: 1.5, org: 0.5, eq: 0.7, growth: 0.6 },
    industrial: { name: "Industrial", ore: 0.8, org: 0.7, eq: 1.7, growth: 0.9 },
    ice: { name: "Ice", ore: 1.0, org: 0.8, eq: 0.9, growth: 0.8 }
};

export const BUILDING_DEFS = {
    habitat: { name: "Habitat", minutes: 240, credits: 1500, cargo: { ore: 10, org: 10, eq: 10 }, description: "Raises colony capacity and growth." },
    mine: { name: "Mine", minutes: 240, credits: 2000, cargo: { ore: 0, org: 5, eq: 15 }, description: "Produces ore each morning." },
    farm: { name: "Farm", minutes: 240, credits: 1800, cargo: { ore: 10, org: 0, eq: 10 }, description: "Produces organics each morning." },
    factory: { name: "Factory", minutes: 360, credits: 2600, cargo: { ore: 20, org: 10, eq: 10 }, description: "Produces equipment each morning." },
    defense: { name: "Defense Grid", minutes: 300, credits: 2200, cargo: { ore: 10, org: 0, eq: 20 }, description: "Reduces pirate pressure around the colony." }
};

export const UPGRADE_DEFS = {
    cargo: { name: "Cargo Holds +25", credits: 3000, minutes: 120 },
    engine: { name: "Gate Transit Tune -5m per corridor", credits: 4500, minutes: 180 },
    scanner: { name: "Scanner Level +1", credits: 3500, minutes: 120 },
    mining: { name: "Mining Laser +15 yield", credits: 3800, minutes: 180 },
    shields: { name: "Shield Generator +100 max", credits: 4000, minutes: 180 },
    fighters: { name: "Fighter Bay +500 cap", credits: 4200, minutes: 180 }
};

export const CONTACT_DEFS = {
    sda_harrow: { id: "sda_harrow", name: "Director Lena Harrow", factionId: "sda", role: "StarDock compliance director", location: "StarDock", knownAtStart: true, startingRelation: 20, note: "Controls permits, inspections, and official port favors." },
    fu_marek: { id: "fu_marek", name: "Marshal Ivo Marek", factionId: "fu", role: "Frontier Union field marshal", location: "Frontier sectors", knownAtStart: true, startingRelation: 10, note: "Channels militia support and colony defense requests." },
    hc_voss: { id: "hc_voss", name: "Factor Selene Voss", factionId: "hc", role: "Helion Combine resource factor", location: "Industrial ports", knownAtStart: true, startingRelation: 0, note: "Arranges mining contracts, bulk ore purchases, and industrial favors." },
    vc_knife: { id: "vc_knife", name: "Kade Knife", factionId: "vc", role: "Void Cartel shadow broker", location: "Unlisted", knownAtStart: false, startingRelation: -10, note: "Appears once you have private Cartel value, heat, or black-market intel." },
    miners_brann: { id: "miners_brann", name: "Brann Orek", factionId: "miners", role: "Miners Guild claim boss", location: "Mining outposts", knownAtStart: false, startingRelation: 0, note: "Represents claim rights, ore quotas, and extraction disputes." },
    traders_suri: { id: "traders_suri", name: "Suri Vale", factionId: "traders", role: "Traders Guild route broker", location: "Consumer hubs", knownAtStart: false, startingRelation: 0, note: "Sells route intelligence and arbitrage tips." },
    colonists_elin: { id: "colonists_elin", name: "Elin Rusk", factionId: "colonists", role: "Colonists League organizer", location: "Player colonies", knownAtStart: false, startingRelation: 0, note: "Organizes migration waves, relief work, and colony charters." },
    smugglers_nix: { id: "smugglers_nix", name: "Nix Caldera", factionId: "smugglers", role: "Smugglers Syndicate fixer", location: "Black-market ports", knownAtStart: false, startingRelation: -5, note: "Handles hidden holds, quiet delivery, and heat management." }
};

export const CAPTAIN_DEFS = {
    mira_vael: { id: "mira_vael", name: "Mira Vael", callsign: "Blue Comet", archetype: "trader", knownAtStart: true, currentSector: 3, homeSector: 1, preferredFaction: "traders", ship: { name: "Blue Comet", cargoCapacity: 90, combatRating: 18, miningRating: 0, speed: 1.15 }, cargo: { ore: 0, org: 20, eq: 10 }, credits: 8400, factionStanding: { sda: 80, fu: 85, hc: 5, vc: -70, traders: 160, miners: 0, colonists: 15, smugglers: -50 }, memberships: { traders: 1 }, goals: ["profit", "safe_routes", "traders_guild_rank"], riskTolerance: 0.25, ethics: { smuggling: -45, piracy: -90, betrayal: -65 }, blurb: "A cautious route-runner who loves stable prices and hates Cartel surprises." },
    rook_vey: { id: "rook_vey", name: "Rook Vey", callsign: "Grey Wasp", archetype: "miner", knownAtStart: true, currentSector: 7, homeSector: 2, preferredFaction: "miners", ship: { name: "Grey Wasp", cargoCapacity: 70, combatRating: 22, miningRating: 34, speed: 0.9 }, cargo: { ore: 25, org: 0, eq: 0 }, credits: 5100, factionStanding: { sda: 5, fu: 20, hc: 35, vc: -45, miners: 145, traders: 0, colonists: 0, smugglers: -25 }, memberships: { miners: 1 }, goals: ["claims", "ore", "miners_guild_rank"], riskTolerance: 0.55, ethics: { smuggling: -5, piracy: -70, betrayal: -45 }, blurb: "A belt prospector who treats every rich rock as a future argument." },
    nix_caldera: { id: "nix_caldera", name: "Nix Caldera", callsign: "False Dawn", archetype: "smuggler", knownAtStart: false, currentSector: 23, homeSector: 23, preferredFaction: "smugglers", ship: { name: "False Dawn", cargoCapacity: 60, combatRating: 28, miningRating: 0, speed: 1.25 }, cargo: { ore: 0, org: 0, eq: 15 }, credits: 9200, factionStanding: { sda: -90, fu: -10, hc: 15, vc: 170, smugglers: 160, traders: -10, miners: 0, colonists: -15 }, memberships: { smugglers: 1 }, goals: ["black_market", "leverage", "quiet_routes"], riskTolerance: 0.78, ethics: { smuggling: 95, piracy: 10, betrayal: 25 }, blurb: "A quiet-lane runner with too many names and excellent timing." },
    ash_corven: { id: "ash_corven", name: "Ash Corven", callsign: "Red Ledger", archetype: "mercenary", knownAtStart: true, currentSector: 5, homeSector: 1, preferredFaction: "sda", ship: { name: "Red Ledger", cargoCapacity: 45, combatRating: 58, miningRating: 0, speed: 1.0 }, cargo: { ore: 0, org: 0, eq: 0 }, credits: 7600, factionStanding: { sda: 120, fu: 10, hc: 55, vc: -110, traders: 0, miners: 0, colonists: 0, smugglers: -80 }, memberships: {}, goals: ["bounties", "security_contracts", "reputation"], riskTolerance: 0.65, ethics: { smuggling: -60, piracy: -100, betrayal: -25 }, blurb: "A security captain who follows trouble because trouble pays." },
    elin_rusk: { id: "elin_rusk", name: "Elin Rusk", callsign: "Green Lantern", archetype: "colonist", knownAtStart: true, currentSector: 6, homeSector: 6, preferredFaction: "colonists", ship: { name: "Green Lantern", cargoCapacity: 85, combatRating: 12, miningRating: 4, speed: 0.95 }, cargo: { ore: 5, org: 30, eq: 10 }, credits: 6200, factionStanding: { sda: 25, fu: 135, hc: -15, vc: -80, colonists: 170, traders: 25, miners: 0, smugglers: -70 }, memberships: { colonists: 1 }, goals: ["settlements", "relief", "frontier_autonomy"], riskTolerance: 0.28, ethics: { smuggling: -35, piracy: -95, betrayal: -80 }, blurb: "A colony organizer who can turn a bad planet into somebody's home." },
    tal_morgan: { id: "tal_morgan", name: "Tal Morgan", callsign: "Iron Dividend", archetype: "industrialist", knownAtStart: true, currentSector: 4, homeSector: 4, preferredFaction: "hc", ship: { name: "Iron Dividend", cargoCapacity: 120, combatRating: 25, miningRating: 14, speed: 0.85 }, cargo: { ore: 20, org: 0, eq: 30 }, credits: 13300, factionStanding: { sda: 20, fu: -30, hc: 175, vc: -35, miners: 20, traders: 20, colonists: -10, smugglers: -20 }, memberships: {}, goals: ["industrial_contracts", "equipment", "helion_influence"], riskTolerance: 0.42, ethics: { smuggling: -10, piracy: -85, betrayal: -5 }, blurb: "A hard-nosed industrial hauler who thinks sentiment is unpaid inventory." },
    vark_sable: { id: "vark_sable", name: "Vark Sable", callsign: "Thorn Market", archetype: "smuggler", knownAtStart: false, currentSector: 18, homeSector: 18, preferredFaction: "vc", ship: { name: "Thorn Market", cargoCapacity: 75, combatRating: 35, miningRating: 0, speed: 1.1 }, cargo: { ore: 0, org: 0, eq: 20 }, credits: 11000, factionStanding: { sda: -120, fu: -30, hc: 20, vc: 190, smugglers: 130, traders: -20, miners: 5, colonists: -20 }, memberships: { smugglers: 2 }, goals: ["leverage", "black_market", "cartel_expansion"], riskTolerance: 0.88, ethics: { smuggling: 100, piracy: 45, betrayal: 55 }, blurb: "A cartel enforcer who considers 'honest work' a personal insult." }
};

export const ARCHETYPE_LABELS = {
    trader: "Trader", miner: "Miner", smuggler: "Smuggler",
    mercenary: "Mercenary", colonist: "Colonist", industrialist: "Industrialist", pirate: "Pirate"
};
export { MISSION_TUNING } from './config/missions.js';
export { STARTER_PLAYER, STARTER_SHIP } from './config/player.js';
export { POLITICS } from './config/politics.js';
export { MAP_UI } from './config/ui.js';
export { PORT_DEFAULTS, STARFIELD, WORLDGEN_GEOMETRY, WORLDGEN_SPAWN } from './config/worldgen.js';
