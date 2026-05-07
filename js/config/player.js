export const STARTER_PLAYER = Object.freeze({
    CREDITS: 5000,
    CURRENT_SECTOR: 1,
    CARGO: Object.freeze({ ore: 0, org: 0, eq: 0, pulse_canister: 0, heavy_pulse_module: 0 }),
    FIGHTERS: 30,
    REPUTATION: 0
});

export const STARTER_SHIP = Object.freeze({
    NAME: "Merchant Cruiser",
    MAX_HOLDS: 75,
    TRAVEL_MINUTES_PER_CORRIDOR: 45,
    MINING_POWER: 25,
    SCANNER_LEVEL: 1,
    MAX_FIGHTERS: 2500,
    MAX_SHIELDS: 400,
    MAX_HULL: 100
});
