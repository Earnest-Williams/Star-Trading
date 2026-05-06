import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { state, resetState } from '../js/state.js';
import { addJumpGateCorridor } from '../js/core/universe.js';
import { normaliseCaptains, createCaptainEconomy, captainCanOpenTradeRoutes, updateCaptainsDaily } from '../js/systems/captains.js';

function setup() {
    resetState();
    state.player = { currentSector: 1, time: { day: 3 } };
    state.universe = {
        1: { id: 1, jumpGates: [], region: 'Core', pirateThreat: 0, influence: { sda: 60, fu: 0, hc: 0, vc: 0 } },
        2: { id: 2, jumpGates: [], region: 'Core', pirateThreat: 0, influence: { sda: 60, fu: 0, hc: 0, vc: 0 } }
    };
    addJumpGateCorridor(1, 2);
    state.ports = {
        1: { typeKey: 'mining', factionId: 'hc', stock: { ore: 5500, org: 0, eq: 0 }, maxStock: { ore: 6000, org: 5000, eq: 4000 }, basePrices: { ore: 80, org: 150, eq: 300 } },
        2: { typeKey: 'industrial', factionId: 'hc', stock: { ore: 100, org: 3000, eq: 2500 }, maxStock: { ore: 6000, org: 5000, eq: 4000 }, basePrices: { ore: 80, org: 150, eq: 300 } }
    };
    state.planets = {};
    state.tradeRoutes = [];
    state.nextTradeRouteId = 1;
    state.missions = [];
    state.captains = {
        trader: { id: 'trader', name: 'Trader', callsign: 'T', archetype: 'trader', status: 'active', currentSector: 1, homeSector: 1, preferredFaction: 'traders', ship: { cargoCapacity: 80, combatRating: 10 }, cargo: { ore: 0, org: 0, eq: 0 }, credits: 5000, factionStanding: {}, memberships: {}, riskTolerance: 0.2, ethics: {}, relations: {}, relationshipToPlayer: {} },
        merc: { id: 'merc', name: 'Merc', callsign: 'M', archetype: 'mercenary', status: 'active', currentSector: 1, homeSector: 1, preferredFaction: 'sda', ship: { cargoCapacity: 40, combatRating: 50 }, cargo: { ore: 0, org: 0, eq: 0 }, credits: 5000, factionStanding: {}, memberships: {}, riskTolerance: 0.8, ethics: {}, relations: {}, relationshipToPlayer: {} }
    };
    normaliseCaptains();
    state.captains.trader.economy.routeAppetite = 1;
}


beforeEach(setup);

describe('captain economy route ownership', () => {
    it('eligible trader-like captains may open routes', () => {
        assert.equal(captainCanOpenTradeRoutes(state.captains.trader), true);
        updateCaptainsDaily();
        assert.ok(state.tradeRoutes.some(route => route.ownerType === 'captain' && route.ownerId === 'trader'));
    });

    it('ineligible captains do not open normal trade routes', () => {
        assert.equal(captainCanOpenTradeRoutes(state.captains.merc), false);
        updateCaptainsDaily();
        assert.equal(state.tradeRoutes.some(route => route.ownerId === 'merc'), false);
    });

    it('captains pause bad routes over time', () => {
        state.tradeRoutes.push({ id: 7, ownerType: 'captain', ownerId: 'trader', originSector: 1, destinationSector: 2, commodity: 'ore', status: 'active', failures: 4 });
        updateCaptainsDaily();
        assert.equal(state.tradeRoutes.find(route => route.id === 7).status, 'paused');
    });

    it('captain route choices respond to excessive risk', () => {
        state.captains.trader.economy = createCaptainEconomy(state.captains.trader);
        state.captains.trader.economy.nextRouteEvaluationDay = 1;
        state.universe[2].pirateThreat = 9;
        updateCaptainsDaily();
        assert.equal(state.tradeRoutes.some(route => route.ownerId === 'trader'), false);
    });
});
