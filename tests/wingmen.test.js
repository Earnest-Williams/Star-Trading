import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { state, resetState } from '../js/state.js';
import { canAssignWingman, assignWingman, releaseWingman, getWingmanTransitModifiers } from '../js/systems/wingmen.js';
import { updateCaptainsDaily } from '../js/systems/captains/implementation.js';

describe('wingmen system', () => {
    beforeEach(() => {
        resetState();
        state.player = {
            currentSector: 1,
            wing: { captainIds: [], stance: 'balanced' },
            time: { day: 1, minuteOfDay: 480, wakeMinute: 480, sleepMinute: 1320 }
        };
        state.captains = {
            'c-1': {
                id: 'c-1',
                name: 'Captain Mercenary',
                status: 'active',
                known: true,
                currentSector: 1,
                archetype: 'mercenary',
                relationshipToPlayer: { opinion: 20, trust: 15, rivalry: 0, debt: 0 },
                history: []
            },
            'c-2': {
                id: 'c-2',
                name: 'Captain Trader',
                status: 'active',
                known: true,
                currentSector: 1,
                archetype: 'trader',
                relationshipToPlayer: { opinion: 5, trust: 5, rivalry: 0, debt: 0 },
                history: []
            }
        };
    });

    it('canAssignWingman checks captain status, visibility, location, rivalry, and relationship thresholds', () => {
        // c-1 meets highRep threshold (opinion >= 15 && trust >= 10)
        let check = canAssignWingman('c-1');
        assert.equal(check.ok, true);

        // c-2 does not meet relationship or debt or romance/favor/secret thresholds
        check = canAssignWingman('c-2');
        assert.equal(check.ok, false);
        assert.match(check.reason, /Requires cordial terms/);

        // Under high rivalry, assign is blocked
        state.captains['c-1'].relationshipToPlayer.rivalry = 50;
        check = canAssignWingman('c-1');
        assert.equal(check.ok, false);
        assert.match(check.reason, /Rivalry is too high/);
        state.captains['c-1'].relationshipToPlayer.rivalry = 0;

        // In a different sector, assignment is blocked
        state.captains['c-1'].currentSector = 2;
        check = canAssignWingman('c-1');
        assert.equal(check.ok, false);
        assert.match(check.reason, /not in your current system/);
    });

    it('assigns captain to wing and updates entanglement and relationship', () => {
        const res = assignWingman('c-1', 'overwatch');
        assert.ok(res);
        assert.ok(state.player.wing.captainIds.includes('c-1'));
        assert.equal(state.player.wing.stance, 'overwatch');

        // Check relationship nudge
        assert.equal(state.captains['c-1'].relationshipToPlayer.opinion, 25); // 20 + 5 nudge
    });

    it('releases captain from wing', () => {
        assignWingman('c-1', 'overwatch');
        const res = releaseWingman('c-1');
        assert.ok(res);
        assert.equal(state.player.wing.captainIds.includes('c-1'), false);
    });

    it('applies modifiers based on captain archetype and stance', () => {
        assignWingman('c-1', 'overwatch');
        const transitModifiers = getWingmanTransitModifiers();
        assert.equal(transitModifiers.pirateIncidentReduction, 0.25);
        assert.equal(transitModifiers.damageReduction, 0.30);
    });

    it('mirrors player sector during updateCaptainsDaily and skips actions', () => {
        assignWingman('c-1', 'overwatch');
        
        // Move player to sector 2
        state.player.currentSector = 2;

        updateCaptainsDaily();
        
        assert.equal(state.captains['c-1'].currentSector, 2);
    });
});
