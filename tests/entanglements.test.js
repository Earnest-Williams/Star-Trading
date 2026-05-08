import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { state, resetState } from '../js/state.js';
import {
    addOrNudgeEntanglement,
    canDeepenRomanceWithCaptain,
    deepenRomanceWithCaptain,
    getCaptainEntanglements,
    normaliseEntanglements,
    startRomanceWithCaptain,
    updateEntanglementsDaily
} from '../js/systems/entanglements.js';
import { ENTANGLEMENTS } from '../js/config/entanglements.js';

function setup() {
    resetState();

    state.player = {
        currentSector: 1,
        time: { day: 3 },
        factions: { rep: { sda: 20, fu: 0, hc: 0, vc: 0 }, heat: { sda: 0 } },
        factionRelations: {}
    };

    state.universe = {
        1: {
            id: 1,
            region: 'Core',
            pirateThreat: 0,
            surveyed: true,
            influence: { sda: 55, fu: 20, hc: 10, vc: 15 },
            jumpGates: []
        }
    };

    state.ports = {};
    state.missions = [];
    state.nextMissionId = 1;
    state.worldEvents = [];
    state.nextWorldEventId = 1;
    state.entanglements = [];
    state.nextEntanglementId = 1;

    state.captains = {
        mara: {
            id: 'mara',
            name: 'Mara',
            callsign: 'Knife',
            archetype: 'smuggler',
            status: 'active',
            currentSector: 1,
            preferredFaction: 'vc',
            currentPlan: null,
            factionStanding: {},
            ethics: {},
            riskTolerance: 0.5,
            relationshipToPlayer: {
                opinion: 40,
                trust: 20,
                rivalry: 0,
                debt: 0,
                leverage: 0
            }
        }
    };
}

beforeEach(setup);

describe('entanglements', () => {
    it('creates and nudges durable captain entanglements', () => {
        addOrNudgeEntanglement({
            kind: ENTANGLEMENTS.KINDS.FAVOR,
            parties: [{ type: 'player', id: 'player' }, { type: 'captain', id: 'mara' }],
            strength: 10,
            pressure: 5
        });

        addOrNudgeEntanglement({
            kind: ENTANGLEMENTS.KINDS.FAVOR,
            parties: [{ type: 'player', id: 'player' }, { type: 'captain', id: 'mara' }],
            strength: 4,
            pressure: 3
        });

        const items = getCaptainEntanglements('mara', ENTANGLEMENTS.KINDS.FAVOR);
        assert.equal(items.length, 1);
        assert.equal(items[0].strength, 14);
        assert.equal(items[0].pressure, 8);
    });

    it('starts romance only when relationship thresholds are met', () => {
        const result = startRomanceWithCaptain('mara');
        assert.ok(result);
        assert.equal(result.kind, ENTANGLEMENTS.KINDS.ROMANCE);
        assert.equal(result.data.stage, ENTANGLEMENTS.ROMANCE_STAGES.INTEREST);
    });

    it('rejects romance when relationship thresholds are not met', () => {
        state.captains.mara.relationshipToPlayer.opinion = 10;

        const result = startRomanceWithCaptain('mara');

        assert.equal(result, false);
        assert.equal(getCaptainEntanglements('mara', ENTANGLEMENTS.KINDS.ROMANCE).length, 0);
        assert.equal(state.worldEvents.length, 0);
    });

    it('does not allow deepening romance before a romance exists', () => {
        const result = canDeepenRomanceWithCaptain('mara');
        assert.equal(result.ok, false);
        assert.match(result.reason, /no personal bond exists yet/i);
    });

    it('does not let deepenRomanceWithCaptain start a new romance', () => {
        const result = deepenRomanceWithCaptain('mara');
        assert.equal(result, false);
        assert.equal(getCaptainEntanglements('mara', ENTANGLEMENTS.KINDS.ROMANCE).length, 0);
        assert.equal(state.worldEvents.length, 0);
    });

    it('normalises next entanglement id above restored ids', () => {
        state.entanglements = [{
            id: 42,
            kind: ENTANGLEMENTS.KINDS.SECRET,
            parties: [{ type: 'player', id: 'player' }],
            strength: 5,
            pressure: 0
        }];
        state.nextEntanglementId = 2;

        normaliseEntanglements();

        assert.equal(state.nextEntanglementId, 43);
    });

    it('does not inflate relationship-derived entanglement strength every day', () => {
        state.captains.mara.relationshipToPlayer.debt = 2;

        updateEntanglementsDaily();
        updateEntanglementsDaily();

        const items = getCaptainEntanglements('mara', ENTANGLEMENTS.KINDS.FAVOR);
        assert.equal(items.length, 1);
        assert.equal(items[0].strength, 16);
    });

    it('spawns pressure events from romance conflict', () => {
        const romance = startRomanceWithCaptain('mara');
        romance.pressure = 80;

        state.missions.push({
            id: 1,
            title: 'VC Quiet Job',
            status: 'captain_taken',
            takenBy: 'mara',
            factionId: 'vc',
            originSector: 1,
            expiresDay: 8
        });

        state.captains.mara.currentPlan = {
            type: 'mission',
            missionId: 1,
            completionDay: 4,
            targetSector: 1
        };

        updateEntanglementsDaily();

        assert.ok(state.missions.some(mission =>
            mission.kind === 'entanglement_event'
            && mission.eventType === 'conflicted_loyalties'
        ));
    });

    it('does not merge two-party entanglement into an existing three-party one', () => {
        addOrNudgeEntanglement({
            kind: ENTANGLEMENTS.KINDS.FAVOR,
            parties: [
                { type: 'player', id: 'player' },
                { type: 'captain', id: 'mara' },
                { type: 'contact', id: 'broker-1' }
            ],
            strength: 10,
            pressure: 5
        });

        addOrNudgeEntanglement({
            kind: ENTANGLEMENTS.KINDS.FAVOR,
            parties: [
                { type: 'player', id: 'player' },
                { type: 'captain', id: 'mara' }
            ],
            strength: 4,
            pressure: 3
        });

        const favorEntanglements = state.entanglements.filter(entanglement => entanglement.kind === ENTANGLEMENTS.KINDS.FAVOR);
        assert.equal(favorEntanglements.length, 2);
    });
});
