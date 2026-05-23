import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, resetState } from '../js/state.js';
import {
    normaliseShipLoadout,
    getShipLoadoutSummary,
    getShipSystemBonuses,
    canInstallShipModule,
    installShipModule
} from '../js/systems/shipLoadout.js';

describe('ship loadout system', () => {
    beforeEach(() => {
        resetState();
        state.world = {
            roles: {
                shipyardSiteId: 1
            }
        };
        state.player = {
            credits: 10000,
            currentSector: 1,
            shields: 100,
            ship: {
                name: 'Test Ship',
                maxHolds: 50,
                maxShields: 100,
                scannerLevel: 1,
                combatRating: 10,
                travelMinutesPerCorridor: 30,
                loadout: null
            },
            time: { day: 1, minuteOfDay: 480, wakeMinute: 480, sleepMinute: 1320 },
            factions: {
                reputation: {},
                trust: {},
                heat: {},
                membership: {},
                leverage: {},
                favors: {},
                memory: {},
                publicRep: {},
                privateRep: {},
                intel: [],
                asks: [],
                contacts: {},
                nextAskId: 1
            }
        };
    });

    it('normalises ship loadout structure', () => {
        const ship = state.player.ship;
        normaliseShipLoadout(ship);
        assert.ok(ship.loadout);
        assert.equal(ship.loadout.weapons, null);
        assert.equal(ship.loadout.shields, null);
    });

    it('retrieves loadout summary and bonuses correctly', () => {
        const ship = state.player.ship;
        normaliseShipLoadout(ship);
        ship.loadout.weapons = 'laser_cannon_i';
        
        const summary = getShipLoadoutSummary(ship);
        assert.equal(summary.weapons, 'Pulse Laser Cannon I');
        assert.equal(summary.shields, 'Empty');

        const bonuses = getShipSystemBonuses(ship);
        assert.equal(bonuses.combatRating, 15);
        assert.equal(bonuses.pirateIncidentReduction, 0.15);
    });

    it('canInstallShipModule checks shipyard location, credits, and prerequisites', () => {
        // Location check
        state.player.currentSector = 2;
        let check = canInstallShipModule('laser_cannon_i');
        assert.equal(check.ok, false);
        assert.match(check.reason, /only be installed at StarDock Shipyard/);

        // Reset location
        state.player.currentSector = 1;

        // Credits check
        state.player.credits = 500;
        check = canInstallShipModule('laser_cannon_i');
        assert.equal(check.ok, false);
        assert.match(check.reason, /Not enough credits/);

        // Reset credits
        state.player.credits = 10000;

        // Prerequisites check (Tier II needs Tier I)
        check = canInstallShipModule('plasma_bolt_ii');
        assert.equal(check.ok, false);
        assert.match(check.reason, /Requires Pulse Laser Cannon I installed/);

        // Install Tier I
        normaliseShipLoadout(state.player.ship);
        state.player.ship.loadout.weapons = 'laser_cannon_i';
        check = canInstallShipModule('plasma_bolt_ii');
        assert.equal(check.ok, true);
    });

    it('installs module and updates scalar stats', () => {
        const ship = state.player.ship;
        const initialCredits = state.player.credits;

        // Install laser_cannon_i
        const res = installShipModule('laser_cannon_i');
        assert.ok(res);
        assert.equal(ship.loadout.weapons, 'laser_cannon_i');
        assert.equal(ship.combatRating, 25); // 10 base + 15 laser
        assert.equal(state.player.credits, initialCredits - 3000);

        // Install shield_generator_i
        const resShield = installShipModule('shield_generator_i');
        assert.ok(resShield);
        assert.equal(ship.loadout.shields, 'shield_generator_i');
        assert.equal(ship.maxShields, 200); // 100 base + 100 shield
        assert.equal(state.player.shields, 200); // player shields increase
    });
});
