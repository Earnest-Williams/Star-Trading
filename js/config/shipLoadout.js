// @ts-check

/**
 * Module definitions for shipyard slot-based loadouts.
 */
export const SHIP_MODULE_DEFS = {
    // Weapons slot
    laser_cannon_i: {
        id: "laser_cannon_i",
        slot: "weapons",
        name: "Pulse Laser Cannon I",
        tier: 1,
        credits: 3000,
        minutes: 120,
        effects: {
            maxHolds: 0,
            maxShields: 0,
            scannerLevel: 0,
            transitScanPower: 0,
            localScanPower: 0,
            pirateIncidentReduction: 0.15,
            pulseReserveSupport: 0,
            cargoDataCapacity: 0,
            combatRating: 15
        },
        description: "Standard tactical laser to deter pirate harassment.",
        guildDiscounts: { sda: 0.05 },
        prerequisites: []
    },
    plasma_bolt_ii: {
        id: "plasma_bolt_ii",
        slot: "weapons",
        name: "Plasma Charger II",
        tier: 2,
        credits: 5500,
        minutes: 180,
        effects: {
            maxHolds: 0,
            maxShields: 0,
            scannerLevel: 0,
            transitScanPower: 0,
            localScanPower: 0,
            pirateIncidentReduction: 0.30,
            pulseReserveSupport: 0,
            cargoDataCapacity: 0,
            combatRating: 35
        },
        description: "Heavy plasma accelerator for badlands escort duties.",
        guildDiscounts: { sda: 0.10 },
        prerequisites: ["laser_cannon_i"]
    },

    // Shields slot
    shield_generator_i: {
        id: "shield_generator_i",
        slot: "shields",
        name: "Shield Deflector Aegis I",
        tier: 1,
        credits: 4000,
        minutes: 180,
        effects: {
            maxHolds: 0,
            maxShields: 100,
            scannerLevel: 0,
            transitScanPower: 0,
            localScanPower: 0,
            pirateIncidentReduction: 0.05,
            pulseReserveSupport: 0,
            cargoDataCapacity: 0
        },
        description: "Adds 100 max shield strength to absorb direct corridor debris and pirate fire.",
        guildDiscounts: { sda: 0.05 },
        prerequisites: []
    },
    shield_generator_ii: {
        id: "shield_generator_ii",
        slot: "shields",
        name: "Shield Deflector Aegis II",
        tier: 2,
        credits: 7500,
        minutes: 240,
        effects: {
            maxHolds: 0,
            maxShields: 250,
            scannerLevel: 0,
            transitScanPower: 0,
            localScanPower: 0,
            pirateIncidentReduction: 0.10,
            pulseReserveSupport: 0,
            cargoDataCapacity: 0
        },
        description: "High-yield deflector array providing 250 max shields.",
        guildDiscounts: { sda: 0.10 },
        prerequisites: ["shield_generator_i"]
    },

    // Pulse Tender slot
    pulse_charger_i: {
        id: "pulse_charger_i",
        slot: "pulseTender",
        name: "Pulse Transfer Accumulator I",
        tier: 1,
        credits: 3200,
        minutes: 120,
        effects: {
            maxHolds: 0,
            maxShields: 0,
            scannerLevel: 0,
            transitScanPower: 0,
            localScanPower: 0,
            pirateIncidentReduction: 0,
            pulseReserveSupport: 25,
            cargoDataCapacity: 0
        },
        description: "Specialized accumulator to support jump gate banks and relay stations.",
        guildDiscounts: { miners: 0.05 },
        prerequisites: []
    },
    pulse_stabiliser_ii: {
        id: "pulse_stabiliser_ii",
        slot: "pulseTender",
        name: "Resonance Pulse Tender II",
        tier: 2,
        credits: 6000,
        minutes: 180,
        effects: {
            maxHolds: 0,
            maxShields: 0,
            scannerLevel: 0,
            transitScanPower: 5,
            localScanPower: 5,
            pirateIncidentReduction: 0,
            pulseReserveSupport: 60,
            cargoDataCapacity: 0
        },
        description: "Maintains optimal gate pulse alignments and feeds local relay buoys.",
        guildDiscounts: { miners: 0.10 },
        prerequisites: ["pulse_charger_i"]
    },

    // Scanner Array slot
    scanner_standard_i: {
        id: "scanner_standard_i",
        slot: "scannerArray",
        name: "Survey Scanner Suite I",
        tier: 1,
        credits: 3500,
        minutes: 120,
        effects: {
            maxHolds: 0,
            maxShields: 0,
            scannerLevel: 1,
            transitScanPower: 15,
            localScanPower: 20,
            pirateIncidentReduction: 0,
            pulseReserveSupport: 0,
            cargoDataCapacity: 10
        },
        description: "Enhances raw scanner level by 1 and grants standard passive sensing.",
        guildDiscounts: { traders: 0.05 },
        prerequisites: []
    },
    scanner_deep_ii: {
        id: "scanner_deep_ii",
        slot: "scannerArray",
        name: "Deep Space Sensor Ring II",
        tier: 2,
        credits: 6800,
        minutes: 180,
        effects: {
            maxHolds: 0,
            maxShields: 0,
            scannerLevel: 2,
            transitScanPower: 40,
            localScanPower: 50,
            pirateIncidentReduction: 0.05,
            pulseReserveSupport: 10,
            cargoDataCapacity: 25
        },
        description: "State-of-the-art sensor array for deep sector anomaly scanning.",
        guildDiscounts: { traders: 0.10 },
        prerequisites: ["scanner_standard_i"]
    },

    // Cargo Expander slot
    cargo_expansion_i: {
        id: "cargo_expansion_i",
        slot: "cargoExpander",
        name: "Hold Optimizer Pod I",
        tier: 1,
        credits: 3000,
        minutes: 120,
        effects: {
            maxHolds: 25,
            maxShields: 0,
            scannerLevel: 0,
            transitScanPower: 0,
            localScanPower: 0,
            pirateIncidentReduction: 0,
            pulseReserveSupport: 0,
            cargoDataCapacity: 0
        },
        description: "Integrates lightweight expandable cargo cells (+25 holds).",
        guildDiscounts: { traders: 0.05 },
        prerequisites: []
    },
    cargo_expansion_ii: {
        id: "cargo_expansion_ii",
        slot: "cargoExpander",
        name: "Hold Optimizer Pod II",
        tier: 2,
        credits: 5800,
        minutes: 180,
        effects: {
            maxHolds: 60,
            maxShields: 0,
            scannerLevel: 0,
            transitScanPower: 0,
            localScanPower: 0,
            pirateIncidentReduction: 0,
            pulseReserveSupport: 0,
            cargoDataCapacity: 0
        },
        description: "Adds 60 cargo capacity units via compressed bulkhead layout.",
        guildDiscounts: { traders: 0.10 },
        prerequisites: ["cargo_expansion_i"]
    }
};
