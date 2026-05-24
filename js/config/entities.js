export const NPC_FINDABLE_PART_DEFS = Object.freeze({
    fuel_injector: Object.freeze({
        id: "fuel_injector",
        label: "fuel injector",
        basePrice: 420,
        rarity: 0.45,
        favoredPortTypes: Object.freeze(["industrial", "refinery", "stardock"]),
        favoredRegions: Object.freeze(["Core", "Frontier"])
    }),
    nav_chip: Object.freeze({
        id: "nav_chip",
        label: "nav chip",
        basePrice: 680,
        rarity: 0.62,
        favoredPortTypes: Object.freeze(["stardock", "consumer"]),
        favoredRegions: Object.freeze(["Core"])
    }),
    hull_patch: Object.freeze({
        id: "hull_patch",
        label: "hull patch",
        basePrice: 260,
        rarity: 0.25,
        favoredPortTypes: Object.freeze(["mining", "industrial", "refinery"]),
        favoredRegions: Object.freeze(["Frontier", "Badlands"])
    })
});
export const NPC_FINDABLE_PARTS = Object.freeze(Object.keys(NPC_FINDABLE_PART_DEFS));
export const DEBUG_MODE = true;

export const CONTACT_SERVICE_LABELS = Object.freeze({
    parts: "Parts",
    orders: "Orders",
    permits: "Permits",
    intel: "Intel",
    discounts: "Discounts"
});

export const UI_LABELS = Object.freeze({
    contactMoreToggle: "More",
    contactLessToggle: "Less",
    screenRailToggle: "Panel",
    sectorSummaryUnknownName: "Unknown",
    sectorSummaryPortActive: "Port active",
    sectorSummaryNoPort: "No port",
    sectorSummaryAsteroids: "Asteroids",
    sectorSummaryNoAsteroids: "No asteroids",
    sectorSummaryPlanet: "Planet",
    sectorSummaryNoPlanet: "No planet",
    sectorSummaryPriority: "Priority: maintain local readiness",
    simulationStarted: "The frontier simulation started.",
    sessionWelcome: "Welcome to the frontier",
    randomBuildUnavailable: "Random build unavailable in this browser.",
    settingsSaved: "Settings saved.",
    importFailed: "Import failed",
    importReadFailed: "Import read failed",
    parseErrNonEmptyString: "must be a non-empty string",
});

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
    mine: { name: "Mine", minutes: 240, credits: 2000, cargo: { ore: 0, org: 5, eq: 15 }, description: "Produces ore, heavy metals, and rare earths each morning." },
    farm: { name: "Farm", minutes: 240, credits: 1800, cargo: { ore: 10, org: 0, eq: 10 }, description: "Produces organics and water ice each morning." },
    refinery: { name: "Refinery", minutes: 360, credits: 2400, cargo: { ore: 15, org: 10, eq: 10 }, description: "Refines raw feedstocks into processed commodities." },
    factory: { name: "Factory", minutes: 360, credits: 2600, cargo: { ore: 20, org: 10, eq: 10 }, description: "Produces equipment, machinery, and parts each morning." },
    electronics_fab: { name: "Electronics Fab", minutes: 360, credits: 3000, cargo: { ore: 10, org: 10, eq: 20 }, description: "Fabricates electronics and control cores." },
    medical_lab: { name: "Medical Lab", minutes: 300, credits: 2200, cargo: { ore: 5, org: 20, eq: 15 }, description: "Formulates advanced medical supplies daily." },
    pulse_works: { name: "Pulse Works", minutes: 300, credits: 2800, cargo: { ore: 15, org: 5, eq: 20 }, description: "Manufactures jump-pulse canisters and modules." },
    warehouse: { name: "Warehouse", minutes: 180, credits: 1200, cargo: { ore: 20, org: 5, eq: 5 }, description: "Increases bulk storage capacity by 200." },
    cold_storage: { name: "Cold Storage", minutes: 180, credits: 1400, cargo: { ore: 10, org: 15, eq: 5 }, description: "Increases cold storage capacity by 200 and mitigates spoilage." },
    housing: { name: "Housing", minutes: 240, credits: 1500, cargo: { ore: 10, org: 10, eq: 10 }, description: "Expands residential capacity for higher housing tiers." },
    civic_services: { name: "Civic Services", minutes: 240, credits: 1800, cargo: { ore: 5, org: 15, eq: 15 }, description: "Provides essential services to support quality-of-life tiers." },
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
