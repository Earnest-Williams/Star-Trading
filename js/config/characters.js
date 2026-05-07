// Character system constants — stats, buy curve, platform types.

export const CHAR_STATS = Object.freeze(["nerve", "tradecraft", "fieldcraft", "command"]);

export const CHAR_DEFAULTS = Object.freeze({
    STAT_BASE: 50,
    STAT_CAP: 100,
    STAT_CHARGEN_MIN: 50,
    CHARGEN_POINTS: 100,
    CAREER_TRAIT_COST: 50
});

// Stat buy curve: maps spend tier → stat gained per point spent in that tier.
// Tier bounds are inclusive spend-point counts (1-indexed).
export const STAT_BUY_CURVE = Object.freeze([
    { from: 1,  to: 10, gain: 3 },
    { from: 11, to: 15, gain: 2 },
    { from: 16, to: 25, gain: 1 }
]);

export const PLATFORM_TYPES = Object.freeze({
    ship_owned:          { label: "Owned Ship" },
    ship_rented:         { label: "Rented Ship" },
    employed_salary:     { label: "Salaried Employee" },
    employed_commission: { label: "Commission Employee" }
});

export const DEFAULT_PLATFORM_TYPE = "ship_owned";

export const EMPLOYER_LANES = Object.freeze([
    { id: "sda_auxiliary",           label: "SDA Auxiliary",              factionId: "sda" },
    { id: "fu_courier",              label: "FU Courier",                 factionId: "fu"  },
    { id: "hc_extractor",            label: "HC Extractor",               factionId: "hc"  },
    { id: "traders_guild_freight",   label: "Traders Guild Freight House", factionId: "tg"  },
    { id: "colonists_logistics",     label: "Colonists Logistics Office", factionId: "col" },
    { id: "vc_runner",               label: "VC Runner",                  factionId: "vc"  }
]);
