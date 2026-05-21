// Smoke tests for core/persistence.js — migrateSave and save normalisation.
import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
    migrateSave,
    saveGame,
    loadGame,
    hasSavedGame,
    importSavePayload,
    setPersistenceAdapters,
    buildSaveData,
    SAVE_STATE_FIELDS,
    SAVE_IMPORT_LIMITS
} from '../js/core/persistence.js';
import { state, resetState } from '../js/state.js';
import { SAVE_VERSION, SAVE_KEY, DEFAULT_FACTION_RELATIONS } from '../js/constants.js';

// Build the minimal valid save data that every version should contain.
function minimalSave(version) {
    return {
        version,
        player: {
            credits: 5000,
            currentSector: 1,
            ship: { name: 'Test Ship', maxHolds: 75, travelMinutesPerCorridor: 45,
                    miningPower: 25, scannerLevel: 1, maxFighters: 2500,
                    maxShields: 400, maxHull: 100 },
            cargo: { ore: 0, org: 0, eq: 0 },
            fighters: 30, shields: 400, hull: 100, reputation: 0,
            time: { day: 1, minuteOfDay: 480, wakeMinute: 480, sleepMinute: 1320 },
            seed: 12345,
            factionRelations: JSON.parse(JSON.stringify(DEFAULT_FACTION_RELATIONS)),
            factions: { reputation: {}, trust: {}, heat: {}, membership: {},
                        leverage: {}, favors: {}, memory: {}, publicRep: {},
                        privateRep: {}, intel: [], asks: [], contacts: {},
                        nextAskId: 1 }
        },
        universe: {},
        ports: {},
        planets: {},
        missions: [],
        captains: {},
        captainEventLog: [],
        nextCaptainEventId: 1,
        worldEvents: [],
        nextWorldEventId: 1,
        tradeRoutes: [],
        nextTradeRouteId: 1,
        nextMissionId: 1,
        economy: {
            version: 1,
            profilesBySector: {},
            pressureBySector: {},
            recentVolumeBySector: {},
            contracts: [],
            nextContractId: 1,
            dailySummary: null,
            lastProfileBuildDay: null,
            lastPressureDay: null,
            generatedByVersion: 1
        },
        ambientTrade: { day: 0, moved: { ore: 0, org: 0, eq: 0 }, flows: 0 },
        dataCargo: { sectorKnowledge: {}, playerHold: { publicSnapshots: {} }, ambientTransfers: [] }
    };
}

describe('migrateSave — version stamping', () => {
    it('sets version to SAVE_VERSION regardless of input version', () => {
        const result = migrateSave(minimalSave(0));
        assert.equal(result.version, SAVE_VERSION);
    });

    it('is a no-op on a current-version save (aside from version stamp)', () => {
        const save = minimalSave(SAVE_VERSION);
        const before = JSON.stringify(save);
        const result = migrateSave(save);
        // version stays the same; everything else should be unchanged
        assert.equal(result.version, SAVE_VERSION);
        const after = JSON.stringify(result);
        assert.equal(before, after);
    });
});

describe('migrateSave — economy profile normalisation', () => {
    it('drops invalid profile records and normalises valid entries, defaulting zero weights', () => {
        const save = minimalSave(SAVE_VERSION);
        save.economy.profilesBySector = {
            1: {
                sectorId: '1',
                generatedDay: '3',
                roleTags: ['port:mining', 7],
                supplyWeight: 1.2,
                demandWeight: 1.1,
                extractionCapacity: '40',
                populationDemand: null,
                likelyExports: ['ore', false],
                likelyImports: ['eq', 4]
            },
            2: {
                sectorId: 2,
                supplyWeight: 0,
                demandWeight: 1
            }
        };

        const result = migrateSave(save);

        assert.deepEqual(result.economy.profilesBySector, {
            1: {
                sectorId: 1,
                generatedDay: 3,
                roleTags: ['port:mining'],
                supplyWeight: 1.2,
                demandWeight: 1.1,
                extractionCapacity: 40,
                populationDemand: 0,
                likelyExports: ['ore'],
                likelyImports: ['eq']
            },
            2: {
                sectorId: 2,
                generatedDay: 1,
                roleTags: [],
                supplyWeight: 1,
                demandWeight: 1,
                extractionCapacity: 0,
                populationDemand: 0,
                likelyExports: [],
                likelyImports: []
            }
        });
    });
});

describe('migrateSave — economy scaffolding', () => {
    it('adds economy state defaults when missing', () => {
        const save = minimalSave(SAVE_VERSION);
        delete save.economy;
        const result = migrateSave(save);
        assert.deepEqual(result.economy, {
            version: 1,
            profilesBySector: {},
            pressureBySector: {},
            recentVolumeBySector: {},
            contracts: [],
            nextContractId: 1,
            dailySummary: null,
            lastProfileBuildDay: null,
            lastPressureDay: null,
            generatedByVersion: 1
        });
    });

    it('sanitizes economy pressure, volume, and contracts from user-imported save payloads', () => {
        const save = minimalSave(SAVE_VERSION);
        save.economy.pressureBySector = {
            1: { ore: { shortageSeverity: '0.5', surplus: -2, pricePressure: '1.3', routeAccess: null } },
            2: 'invalid'
        };
        save.economy.recentVolumeBySector = {
            1: { ore: '5', eq: -1 },
            2: 10
        };
        save.economy.contracts = [
            { id: '4', destinationSectorId: '3', commodity: 'ore', amount: '8', delivered: '2', status: 'accepted' },
            { id: 'bad', destinationSectorId: 3, commodity: 'ore' },
            { id: 5, destinationSectorId: 'x', commodity: 'ore' }
        ];

        const result = migrateSave(save);

        assert.deepEqual(result.economy.pressureBySector, {
            1: { ore: { shortageSeverity: 0.5, surplus: 0, pricePressure: 1.3, routeAccess: 0 } }
        });
        assert.deepEqual(result.economy.recentVolumeBySector, {
            1: { ore: 5, eq: 0 }
        });
        assert.deepEqual(result.economy.contracts, [
            { id: 4, destinationSectorId: 3, commodity: 'ore', amount: 8, delivered: 2, status: 'accepted' }
        ]);
    });
});

describe('migrateSave — pre-v6 (faction rebuild)', () => {
    it('removes stale factions so normaliseLoadedGame can rebuild them', () => {
        const save = minimalSave(5);
        save.player.factions = { reputation: { sda: 99 } }; // stale old shape
        const result = migrateSave(save);
        assert.equal(result.player.factions, undefined,
            'factions should be deleted so the normalise step can rebuild it');
    });
});

describe('migrateSave — pre-v7 (event log seeding)', () => {
    it('seeds captainEventLog and worldEvents arrays when missing', () => {
        const save = minimalSave(6);
        delete save.captainEventLog;
        delete save.worldEvents;
        const result = migrateSave(save);
        assert.ok(Array.isArray(result.captainEventLog), 'captainEventLog should be an array');
        assert.ok(Array.isArray(result.worldEvents), 'worldEvents should be an array');
    });

    it('does not overwrite existing captainEventLog', () => {
        const save = minimalSave(6);
        save.captainEventLog = [{ id: 1, text: 'test' }];
        const result = migrateSave(save);
        assert.equal(result.captainEventLog.length, 1);
    });
});

describe('migrateSave — pre-v8 (trade route seeding)', () => {
    it('seeds tradeRoutes and nextTradeRouteId when missing', () => {
        const save = minimalSave(7);
        delete save.tradeRoutes;
        delete save.nextTradeRouteId;
        const result = migrateSave(save);
        assert.ok(Array.isArray(result.tradeRoutes), 'tradeRoutes should be an array');
        assert.equal(result.nextTradeRouteId, 1);
    });

    it('does not overwrite an existing non-empty tradeRoutes array', () => {
        const save = minimalSave(7);
        save.tradeRoutes = [{ id: 1, status: 'active' }];
        save.nextTradeRouteId = 2;
        const result = migrateSave(save);
        assert.equal(result.tradeRoutes.length, 1);
        assert.equal(result.nextTradeRouteId, 2);
    });
});

describe('migrateSave — pre-v10 (seed + factionRelations moved into player)', () => {
    it('adds a seed to player when missing', () => {
        const save = minimalSave(9);
        delete save.player.seed;
        delete save.player.factionRelations;
        const result = migrateSave(save);
        assert.equal(typeof result.player.seed, 'number', 'seed should be a number');
        assert.ok(result.player.seed > 0, 'seed should be positive');
    });

    it('copies top-level factionRelations into player when player has none', () => {
        const save = minimalSave(9);
        delete save.player.factionRelations;
        save.factionRelations = { sda: { fu: 25, hc: 5, vc: -75 }, fu: { sda: 25, hc: -15, vc: -35 }, hc: { sda: 5, fu: -15, vc: -55 }, vc: { sda: -75, fu: -35, hc: -55 } };
        const result = migrateSave(save);
        assert.equal(result.player.factionRelations.sda.fu, 25, 'sda→fu relation should be preserved from top-level field');
    });

    it('falls back to default faction relations when no top-level field exists', () => {
        const save = minimalSave(9);
        delete save.player.factionRelations;
        const result = migrateSave(save);
        assert.deepEqual(result.player.factionRelations, DEFAULT_FACTION_RELATIONS,
            'factionRelations should match defaults when no field existed');
    });

    it('does not overwrite factionRelations already present in player', () => {
        const save = minimalSave(9);
        // Already has factionRelations in player; should not be touched
        save.player.factionRelations.sda.fu = 99;
        const result = migrateSave(save);
        assert.equal(result.player.factionRelations.sda.fu, 99,
            'existing factionRelations in player should not be overwritten');
    });
});


describe('migrateSave — pre-v12 jump gate and explicit route migration', () => {
    it('old save with warps loads into jump-gate corridors', () => {
        const save = minimalSave(11);
        save.universe = {
            1: { id: 1, warps: [2], region: 'Core', pirateThreat: 0 },
            2: { id: 2, warps: [1], region: 'Core', pirateThreat: 0 }
        };
        const result = migrateSave(save);
        assert.equal(result.universe[1].warps, undefined);
        assert.equal(result.universe[1].jumpGates[0].destinationSectorId, 2);
        assert.equal(result.universe[2].jumpGates[0].destinationSectorId, 1);
        assert.equal(result.universe[1].jumpGates[0].corridorId, result.universe[2].jumpGates[0].corridorId);
    });

    it('old trade routes become player-owned explicit routes', () => {
        const save = minimalSave(11);
        save.tradeRoutes = [{ id: 1, originSector: 1, destinationSector: 2, commodity: 'ore' }];
        const result = migrateSave(save);
        assert.equal(result.tradeRoutes[0].ownerType, 'player');
        assert.equal(result.tradeRoutes[0].ownerId, null);
        assert.equal(result.tradeRoutes[0].operatorType, 'player');
    });

    it('old ship travel timing field migrates correctly', () => {
        const save = minimalSave(11);
        delete save.player.ship.travelMinutesPerCorridor;
        save.player.ship.travelMinutesPerWarp = 37;
        const result = migrateSave(save);
        assert.equal(result.player.ship.travelMinutesPerCorridor, 37);
        assert.equal(result.player.ship.travelMinutesPerWarp, undefined);
    });

    it('repeated migration does not corrupt corridor endpoints', () => {
        const save = minimalSave(11);
        save.universe = {
            1: { id: 1, warps: [2], region: 'Core', pirateThreat: 0 },
            2: { id: 2, warps: [1], region: 'Core', pirateThreat: 0 }
        };
        const once = migrateSave(save);
        const twice = migrateSave(once);
        assert.equal(twice.universe[1].jumpGates.length, 1);
        assert.equal(twice.universe[2].jumpGates.length, 1);
    });
});

describe('save serialization', () => {
    afterEach(() => {
        setPersistenceAdapters();
        resetState();
    });

    it('does not persist sitesById because it is derived from universe', () => {
        const save = minimalSave(SAVE_VERSION);
        state.player = save.player;
        state.universe = { 1: { id: 1, jumpGates: [] } };
        state.sitesById = state.universe;
        state.siteIdByCoord = { '1,0,0': 1 };
        state.ports = {};
        state.planets = {};

        const data = buildSaveData();

        assert.equal(Object.hasOwn(data, 'sitesById'), false);
        assert.equal(data.universe, state.universe);
    });


    it('serializes only the persisted state manifest fields', () => {
        const save = minimalSave(SAVE_VERSION);
        state.player = save.player;
        state.universe = { 1: { id: 1, jumpGates: [] } };
        state.siteIdByCoord = { '1,0,0': 1 };
        state.ports = {};
        state.planets = {};
        state.starField = [{ x: 1, y: 2, size: 1 }];
        state.selectedSectorId = 99;
        state.currentScreen = 'map';
        state.reputationTab = 'captains';
        state.selectedCaptainId = 'captain-1';
        state.mapNodeCache = { 1: { x: 10, y: 20 } };
        state.mapLayers = { systems: false };
        state.mapLayersOpen = false;
        state.mapHelpOpen = true;
        state.mapInspectorCompact = true;
        state.worldGraphRevision = 12;
        state.appMode = 'settings';
        state.shellMessage = 'Save shell alert';
        state.settingsOpenTab = 'display';
        state.isTransitioning = true;

        const data = buildSaveData();
        const expectedKeys = ['version', ...SAVE_STATE_FIELDS].sort();

        assert.deepEqual(Object.keys(data).sort(), expectedKeys);
        assert.equal(Object.hasOwn(data, 'sitesById'), false);
        assert.equal(Object.hasOwn(data, 'starField'), false);
        assert.equal(Object.hasOwn(data, 'selectedSectorId'), false);
        assert.equal(Object.hasOwn(data, 'currentScreen'), false);
        assert.equal(Object.hasOwn(data, 'reputationTab'), false);
        assert.equal(Object.hasOwn(data, 'selectedCaptainId'), false);
        assert.equal(Object.hasOwn(data, 'mapNodeCache'), false);
        assert.equal(Object.hasOwn(data, 'mapLayers'), false);
        assert.equal(Object.hasOwn(data, 'mapLayersOpen'), false);
        assert.equal(Object.hasOwn(data, 'mapHelpOpen'), false);
        assert.equal(Object.hasOwn(data, 'mapInspectorCompact'), false);
        assert.equal(Object.hasOwn(data, 'worldGraphRevision'), false);
        assert.equal(Object.hasOwn(data, 'appMode'), false);
        assert.equal(Object.hasOwn(data, 'shellMessage'), false);
        assert.equal(Object.hasOwn(data, 'settingsOpenTab'), false);
        assert.equal(Object.hasOwn(data, 'isTransitioning'), false);
    });

    it('round-trips through JSON save data and rebuilds derived live aliases', () => {
        const save = minimalSave(SAVE_VERSION);
        const captain = {
            id: 'captain-1',
            name: 'Round Trip Captain',
            factionId: 'sda',
            currentSector: 1,
            known: true,
            character: {
                stats: { nerve: 51, tradecraft: 52, fieldcraft: 53, command: 54 },
                traits: [],
                originTraitId: null,
                careerTraitIds: [],
                platform: { type: 'ship_owned', employerLaneId: null },
                contacts: []
            }
        };
        state.player = save.player;
        state.player.credits = 4321;
        state.universe = {
            1: {
                id: 1,
                name: 'Round Trip Sector',
                coord: { x: 2, y: 3, z: 1 },
                coordKey: '2,3,1',
                charted: true,
                reachable: true,
                jumpGates: [],
                region: 'Core',
                pirateThreat: 0
            }
        };
        state.sitesById = { 99: { id: 99 } };
        state.siteIdByCoord = { '2,3,1': 1 };
        state.world = { saveModel: 'sparse-3d-sites', roles: { homeSiteId: 1 } };
        state.worldgenSettings = { sectorCount: 12 };
        state.ports = {};
        state.planets = {};
        state.companies = { 'company-1': { id: 'company-1', sectorId: 1, contactPersonIds: ['person-1'] } };
        state.companyIdsBySector = { 1: ['company-1'] };
        state.nextCompanyId = 2;
        state.people = { 'person-1': { id: 'person-1', sectorId: 1, companyId: 'company-1' } };
        state.peopleBySector = { 1: ['person-1'] };
        state.peopleByCompany = { 'company-1': ['person-1'] };
        state.nextPersonId = 2;
        state.polities = { polity_1: { id: 'polity_1', sectorIds: [1], type: 'federation' } };
        state.polityIdsBySector = { 1: 'polity_1' };
        state.missions = [{ id: 7, status: 'completed', rewardRep: 3 }];
        state.captains = { [captain.id]: captain };
        state.captainEventLog = [{ id: 1, text: 'Captain event' }];
        state.nextCaptainEventId = 2;
        state.worldEvents = [{ id: 1, text: 'World event' }];
        state.nextWorldEventId = 2;
        state.simulationTrace = [{
            id: 1,
            eventType: 'world_event',
            sourceSystem: 'world',
            day: 1,
            minute: 480,
            causedBy: [{ traceId: null, sourceSystem: 'test', eventType: 'cause', eventId: 7, label: 'cause' }],
            summary: { text: 'Trace event' },
            payload: {}
        }];
        state.nextSimulationTraceId = 2;
        state.tradeRoutes = [];
        state.nextTradeRouteId = 1;
        state.nextMissionId = 8;
        state.economy = {
            version: 1,
            profilesBySector: { 1: { profile: 'industrial' } },
            pressureBySector: { 1: { ore: { shortageSeverity: 0.25, surplus: 0, pricePressure: 0.1, routeAccess: 1 } } },
            recentVolumeBySector: { 1: { ore: 12 } },
            contracts: [{ id: 1, commodity: 'ore', status: 'open' }],
            nextContractId: 2,
            dailySummary: { day: 3, shortages: 1 },
            lastProfileBuildDay: 2,
            lastPressureDay: 3,
            generatedByVersion: 1
        };
        state.ambientTrade = { day: 2, moved: { ore: 3, org: 4, eq: 5 }, flows: 6 };
        state.rng = { seed: 12345, session: 2 };
        state.starField = [{ x: 99, y: 99, size: 2 }];
        state.mapNodeCache = { 1: { x: 50, y: 50 } };

        const payload = JSON.stringify(buildSaveData());
        resetState();
        setPersistenceAdapters({ storage: { getItem() { return payload; } } });

        assert.equal(loadGame(), true);
        assert.equal(state.player.credits, 4321);
        assert.equal(state.universe[1].name, 'Round Trip Sector');
        assert.equal(state.sitesById, state.universe);
        assert.equal(state.sitesById[99], undefined);
        assert.deepEqual(state.siteIdByCoord, { '2,3,1': 1 });
        assert.equal(state.captains['captain-1'].name, 'Round Trip Captain');
        assert.equal(state.companies['company-1'].sectorId, 1);
        assert.deepEqual(state.companyIdsBySector[1], ['company-1']);
        assert.equal(state.people['person-1'].companyId, 'company-1');
        assert.deepEqual(state.peopleByCompany['company-1'], ['person-1']);
        assert.deepEqual(state.polities.polity_1.sectorIds, [1]);
        assert.equal(state.polityIdsBySector[1], 'polity_1');
        assert.equal(state.simulationTrace[0].summary.text, 'Trace event');
        assert.equal(state.simulationTrace[0].causedBy[0].eventId, 7);
        assert.equal(state.nextSimulationTraceId, 2);
        assert.equal(state.economy.contracts[0].commodity, 'ore');
        assert.equal(state.economy.nextContractId, 2);
        assert.equal(state.economy.pressureBySector[1].ore.shortageSeverity, 0.25);
        assert.equal(state.selectedSectorId, state.player.currentSector);
        assert.equal(state.currentScreen, 'sector');
        assert.deepEqual(state.starField, []);
        assert.deepEqual(state.mapNodeCache, {});
    });

    it('rejects save payloads that include removed top-level legacy fields', () => {
        const save = minimalSave(SAVE_VERSION);
        save.universe = { 1: { id: 1, jumpGates: [], region: 'Core', pirateThreat: 0 } };
        save.sitesById = { 99: { id: 99, jumpGates: [] } };
        const storage = {
            getItem() { return JSON.stringify(save); }
        };
        setPersistenceAdapters({ storage });

        assert.equal(loadGame(), false);
        assert.deepEqual(state.sitesById, {});
        assert.equal(state.universe[99], undefined);
    });
});

describe('persistence adapters', () => {
    afterEach(() => {
        setPersistenceAdapters();
        resetState();
    });

    it('saves through injected storage and notification adapters without browser globals', () => {
        const writes = new Map();
        const notifications = [];
        const storage = {
            setItem(key, value) { writes.set(key, value); }
        };
        state.player = minimalSave(SAVE_VERSION).player;

        const previousDocument = globalThis.document;
        delete globalThis.document;
        setPersistenceAdapters({
            storage,
            notifier: (message, priority) => notifications.push({ message, priority })
        });

        assert.equal(saveGame(), true);
        assert.equal(writes.size, 1);
        assert.deepEqual(notifications, [{ message: 'Game saved', priority: 1 }]);
        if (previousDocument !== undefined) globalThis.document = previousDocument;
    });

    it('loads through injected adapters and invokes afterLoad without browser globals', () => {
        const save = minimalSave(SAVE_VERSION);
        const storage = {
            getItem() { return JSON.stringify(save); }
        };
        const notifications = [];
        let afterLoadCount = 0;

        const previousDocument = globalThis.document;
        delete globalThis.document;
        setPersistenceAdapters({
            storage,
            notifier: (message, priority) => notifications.push({ message, priority }),
            afterLoad: () => { afterLoadCount += 1; }
        });

        assert.equal(loadGame(), true);
        assert.equal(state.player.currentSector, 1);
        assert.deepEqual(notifications, [{ message: 'Game loaded', priority: 2 }]);
        assert.equal(afterLoadCount, 1);
        if (previousDocument !== undefined) globalThis.document = previousDocument;
    });
});

describe('hasSavedGame', () => {
    it('returns true only when a save exists in available save keys', () => {
        const storage = {
            getItem(key) {
                if (key === SAVE_KEY) return '{"version":17}';
                return null;
            }
        };
        assert.equal(hasSavedGame(storage), true);
    });

    it('returns false when no save is present', () => {
        const storage = {
            getItem() {
                return null;
            }
        };
        assert.equal(hasSavedGame(storage), false);
    });
});

describe('loadGame — validation before live state swap', () => {
    afterEach(() => {
        setPersistenceAdapters();
        resetState();
    });

    it('normalises unknown port type keys while loading legacy save content', () => {
        const legacySave = minimalSave(SAVE_VERSION);
        legacySave.universe = { 1: { id: 1, jumpGates: [], region: 'Core' } };
        legacySave.ports = {
            1: { typeKey: 'missing-port-type', stock: { ore: 0, org: 0, eq: 0 } }
        };
        const messages = [];
        setPersistenceAdapters({
            storage: { getItem() { return JSON.stringify(legacySave); } },
            logger: message => messages.push(message)
        });

        assert.equal(loadGame(), true);
        assert.equal(state.ports[1].typeKey, 'consumer');
        assert.equal(state.ports[1].factionId, 'fu');
        assert.ok(messages.includes('Game loaded'));
    });

    it('infers missing port type keys from legacy inventory when possible', () => {
        const legacySave = minimalSave(SAVE_VERSION);
        legacySave.universe = { 1: { id: 1, jumpGates: [], region: 'Core' } };
        legacySave.ports = {
            1: { stock: { ore: 5000, org: 10, eq: 20 } }
        };
        setPersistenceAdapters({
            storage: { getItem() { return JSON.stringify(legacySave); } }
        });

        assert.equal(loadGame(), true);
        assert.equal(state.ports[1].typeKey, 'mining');
        assert.equal(state.ports[1].factionId, 'hc');
    });
});

describe('importSavePayload', () => {
    afterEach(() => {
        resetState();
    });

    it('rejects invalid imported JSON without mutating live state', () => {
        state.player = minimalSave(SAVE_VERSION).player;
        state.player.credits = 555;

        assert.equal(importSavePayload('{'), false);
        assert.equal(state.player.credits, 555);
    });

    it('rejects malformed imported save content without mutating live state', () => {
        state.player = minimalSave(SAVE_VERSION).player;
        state.player.credits = 777;
        const malformed = JSON.stringify({ version: SAVE_VERSION, player: {}, universe: {}, ports: {} });

        assert.equal(importSavePayload(malformed), false);
        assert.equal(state.player.credits, 777);
    });

    it('rejects imported saves containing forbidden nested keys', () => {
        const imported = minimalSave(SAVE_VERSION);
        const maliciousShip = { ...imported.player.ship };
        Object.defineProperty(maliciousShip, '__proto__', {
            value: { polluted: true },
            enumerable: true,
            configurable: true,
            writable: true
        });
        imported.player.ship = maliciousShip;

        assert.equal(importSavePayload(JSON.stringify(imported)), false);
    });

    it('rejects imported saves with oversized arrays', () => {
        const imported = minimalSave(SAVE_VERSION);
        imported.missions = new Array(SAVE_IMPORT_LIMITS.maxArrayEntries + 1).fill(null);

        assert.equal(importSavePayload(JSON.stringify(imported)), false);
    });

    it('loads valid imported saves through normalisation path', () => {
        const imported = minimalSave(SAVE_VERSION);
        delete imported.player.time;
        imported.universe = {
            1: {
                id: 1,
                name: 'Import Sector',
                coord: { x: 1, y: 2, z: 3 },
                coordKey: '1,2,3',
                jumpGates: []
            }
        };
        imported.siteIdByCoord = { '1,2,3': 1 };

        assert.equal(importSavePayload(JSON.stringify(imported)), true);
        assert.equal(state.player.currentSector, 1);
        assert.equal(state.currentScreen, 'sector');
        assert.deepEqual(state.player.time, { day: 1, minuteOfDay: 480, wakeMinute: 480, sleepMinute: 1320 });
        assert.equal(state.sitesById, state.universe);
    });
});

describe('migrateSave — deterministic seed fallback', () => {
    it('derives the same missing seed from identical pre-v10 payloads', () => {
        const saveA = minimalSave(9);
        const saveB = minimalSave(9);
        delete saveA.player.seed;
        delete saveB.player.seed;

        const resultA = migrateSave(saveA);
        const resultB = migrateSave(saveB);

        assert.equal(resultA.player.seed, resultB.player.seed);
        assert.equal(typeof resultA.player.seed, 'number');
        assert.ok(resultA.player.seed > 0);
    });
});
