import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { resetState, state } from '../js/state.js';
import { BALANCE } from '../js/constants.js';
import { addJumpGateCorridor } from '../js/core/universe.js';
import { initSessionRng } from '../js/utils.js';
import { runTradeRoute } from '../js/systems/tradeRoutes.js';
import {
    acceptLogisticsObjective,
    createLogisticsObjectiveFromTemplate,
    normaliseLogisticsObjectives,
    recordLogisticsDelivery,
    runLogisticsObjectivesDaily,
    scoreRoutePlan
} from '../js/systems/logisticsObjectives.js';

function buildObjectiveUniverse() {
    resetState();
    state.universe = {
        1: { id: 1, jumpGates: [], pirateThreat: 0, region: 'Core', influence: { sda: 50, fu: 20, hc: 20, vc: 5 } },
        2: { id: 2, jumpGates: [], pirateThreat: 0, region: 'Core', influence: { sda: 45, fu: 35, hc: 15, vc: 5 } },
        3: { id: 3, jumpGates: [], pirateThreat: 2, region: 'Frontier', influence: { sda: 42, fu: 39, hc: 15, vc: 5 } }
    };
    addJumpGateCorridor(1, 2);
    addJumpGateCorridor(2, 3);
    state.ports = {
        1: {
            typeKey: 'agricultural', factionId: 'fu', publicFactionId: 'fu', hiddenFactionId: null,
            stock: { ore: 100, org: 500, eq: 100 },
            maxStock: { ore: 1000, org: 1000, eq: 1000 },
            basePrices: { ore: 80, org: 150, eq: 300 }
        },
        3: {
            typeKey: 'industrial', factionId: 'sda', publicFactionId: 'sda', hiddenFactionId: null,
            stock: { ore: 100, org: 50, eq: 100 },
            maxStock: { ore: 1000, org: 1000, eq: 1000 },
            basePrices: { ore: 80, org: 150, eq: 300 }
        }
    };
    state.planets = {
        3: {
            owner: 'Player', factionId: 'colonists', typeKey: 'temperate', colonists: 150,
            stock: { ore: 0, org: 0, eq: 0 }, shortages: { ore: 0, org: 0, eq: 0 },
            satisfaction: 60, buildings: { habitat: 1, mine: 0, farm: 0, factory: 0, defense: 0 }
        }
    };
    state.player = {
        currentSector: 1,
        credits: 0,
        cargo: { ore: 0, org: 0, eq: 0 },
        time: { day: 1, minuteOfDay: 480, wakeMinute: 480, sleepMinute: 1320 },
        seed: 1,
        character: { stats: { command: 70, tradecraft: 70, fieldcraft: 70 }, traits: [] }
    };
    state.tradeRoutes = [];
    state.nextTradeRouteId = 1;
    state.logisticsObjectives = [];
    state.nextLogisticsObjectiveId = 1;
    state.worldEvents = [];
    state.nextWorldEventId = 1;
    state.simulationTrace = [];
    state.nextSimulationTraceId = 1;
    initSessionRng(1);
}

describe('logistics objectives', () => {
    beforeEach(buildObjectiveUniverse);

    it('normalises persisted objective records with stable ids and progress shape', () => {
        state.logisticsObjectives = [{ id: 7, templateId: 'shortage_relief_colony_org', targetSectorId: 3 }];
        state.nextLogisticsObjectiveId = 1;

        normaliseLogisticsObjectives();

        assert.equal(state.logisticsObjectives[0].id, 7);
        assert.equal(state.logisticsObjectives[0].status, 'available');
        assert.deepEqual(state.logisticsObjectives[0].progress.delivered, { ore: 0, org: 0, eq: 0 });
        assert.equal(state.nextLogisticsObjectiveId, 8);
    });

    it('does not burn objective ids while normalising existing records', () => {
        state.logisticsObjectives = [{ id: 7, templateId: 'shortage_relief_colony_org', targetSectorId: 3 }];
        state.nextLogisticsObjectiveId = 20;

        normaliseLogisticsObjectives();
        normaliseLogisticsObjectives();

        assert.equal(state.logisticsObjectives[0].id, 7);
        assert.equal(state.nextLogisticsObjectiveId, 20);
    });

    it('drops stale closed objectives while keeping recent and active ones', () => {
        state.player.time.day = 50;
        state.logisticsObjectives = [
            { id: 1, templateId: 'shortage_relief_colony_org', targetSectorId: 3, status: 'completed', lastEvaluatedDay: 19 },
            { id: 2, templateId: 'shortage_relief_colony_org', targetSectorId: 3, status: 'failed', lastEvaluatedDay: 20 },
            { id: 3, templateId: 'shortage_relief_colony_org', targetSectorId: 3, status: 'active', lastEvaluatedDay: 1 }
        ];

        normaliseLogisticsObjectives();

        assert.equal(BALANCE.LOGISTICS_OBJECTIVE.CLOSED_OBJECTIVE_RETENTION_DAYS, 30);
        assert.deepEqual(state.logisticsObjectives.map(objective => objective.id), [2, 3]);
    });

    it('credits active objectives from completed real trade-route runs', () => {
        const objective = createLogisticsObjectiveFromTemplate('shortageRelief', {
            targetSectorId: 3,
            requirements: { throughput: { org: 12 }, minReliability: 40 }
        });
        state.logisticsObjectives.push(objective);
        acceptLogisticsObjective(objective.id);
        const route = {
            id: 1,
            name: 'Organics relief',
            originSector: 1,
            destinationSector: 3,
            commodity: 'org',
            amount: 12,
            ownerType: 'player',
            ownerId: null,
            status: 'active',
            heat: 0,
            reliability: 80,
            runs: 0,
            failures: 0,
            starvedDays: 0,
            profit: 0,
            factionId: 'colonists'
        };
        state.tradeRoutes.push(route);

        runTradeRoute(route);
        runLogisticsObjectivesDaily();

        const trackedObjective = state.logisticsObjectives[0];
        assert.equal(trackedObjective.status, 'completed');
        assert.equal(trackedObjective.progress.delivered.org, 12);
        assert.equal(trackedObjective.progress.routeRuns, 1);
        assert.ok(trackedObjective.causalEventRefs.some(ref => ref.eventType === 'route_success'));
    });

    it('does not double-count route events when daily evaluation is rerun', () => {
        const objective = createLogisticsObjectiveFromTemplate('shortageRelief', {
            targetSectorId: 3,
            requirements: { throughput: { org: 24 }, minReliability: 40 }
        });
        state.logisticsObjectives.push(objective);
        acceptLogisticsObjective(objective.id);
        const route = {
            id: 11,
            name: 'Organics relief',
            originSector: 1,
            destinationSector: 3,
            commodity: 'org',
            amount: 12,
            ownerType: 'player',
            ownerId: null,
            status: 'active',
            heat: 0,
            reliability: 80,
            runs: 0,
            failures: 0,
            starvedDays: 0,
            profit: 0,
            factionId: 'colonists'
        };
        state.tradeRoutes.push(route);

        runTradeRoute(route);
        runLogisticsObjectivesDaily();
        runLogisticsObjectivesDaily();

        const trackedObjective = state.logisticsObjectives[0];
        assert.equal(trackedObjective.status, 'active');
        assert.equal(trackedObjective.progress.delivered.org, 12);
        assert.equal(trackedObjective.progress.routeRuns, 1);
    });

    it('does not fabricate progress when route connectivity breaks', () => {
        const objective = createLogisticsObjectiveFromTemplate('shortageRelief', {
            targetSectorId: 3,
            requirements: { throughput: { org: 12 }, minReliability: 40 }
        });
        state.logisticsObjectives.push(objective);
        acceptLogisticsObjective(objective.id);
        const route = {
            id: 2,
            name: 'Broken relief',
            originSector: 1,
            destinationSector: 3,
            commodity: 'org',
            amount: 12,
            ownerType: 'player',
            ownerId: null,
            status: 'active',
            heat: 0,
            reliability: 80,
            runs: 0,
            failures: 0,
            starvedDays: 0,
            profit: 0,
            factionId: 'colonists'
        };
        state.tradeRoutes.push(route);
        state.universe[2].jumpGates = [];

        runTradeRoute(route);
        runLogisticsObjectivesDaily();

        const trackedObjective = state.logisticsObjectives[0];
        assert.equal(trackedObjective.status, 'active');
        assert.equal(trackedObjective.progress.delivered.org, 0);
        assert.equal(route.status, 'paused');
    });

    it('records manual colony delivery progress only for allowed objective sources', () => {
        const objective = createLogisticsObjectiveFromTemplate('shortageRelief', {
            targetSectorId: 3,
            requirements: { throughput: { org: 20 } }
        });
        state.logisticsObjectives.push(objective);
        acceptLogisticsObjective(objective.id);

        recordLogisticsDelivery({ source: 'ambient', sectorId: 3, commodity: 'org', amount: 10 });
        recordLogisticsDelivery({ source: 'colony_deposit', sectorId: 3, commodity: 'org', amount: 10 });

        const trackedObjective = state.logisticsObjectives[0];
        assert.equal(trackedObjective.progress.delivered.org, 10);
        assert.equal(trackedObjective.status, 'active');
    });

    it('applies campaign political effects on completion', () => {
        const beforeSponsorInfluence = state.universe[3].influence.sda;
        const objective = createLogisticsObjectiveFromTemplate('sectorControl', {
            targetSectorId: 3,
            requirements: { throughput: { ore: 0, org: 0, eq: 1 }, routeRuns: 0, pirateThreatReduction: 0, dominanceRequired: false }
        });
        state.logisticsObjectives.push(objective);
        acceptLogisticsObjective(objective.id);

        recordLogisticsDelivery({ source: 'market_trade', sectorId: 3, commodity: 'eq', amount: 1 });
        runLogisticsObjectivesDaily();

        const trackedObjective = state.logisticsObjectives[0];
        assert.equal(trackedObjective.status, 'completed');
        assert.ok(state.universe[3].influence.sda > beforeSponsorInfluence);
    });

    it('scores safer reliable plans above equally profitable strained plans', () => {
        const safeScore = scoreRoutePlan({ throughput: 12, reliability: 85, margin: 100, risk: 1, reserveStrain: 0, heat: 0 });
        const strainedScore = scoreRoutePlan({ throughput: 12, reliability: 40, margin: 100, risk: 1, reserveStrain: 2, heat: 10 });

        assert.ok(safeScore > strainedScore);
    });
});
