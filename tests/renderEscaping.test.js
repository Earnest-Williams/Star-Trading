import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { state, resetState } from '../js/state.js';
import { renderAllMissionScreen } from '../js/ui/renderMissions.js';

describe('renderer escaping hardening', () => {
    beforeEach(() => {
        resetState();
        state.player = { currentSector: 1, acceptedMissions: [] };
        state.currentScreen = 'missions';
        state.ports = { 1: {} };
        state.captains = {};
    });

    it('escapes hostile mission text in rendered output', () => {
        const hostile = '<img src=x onerror=alert(1)>';
        state.missions = [{
            id: 'm1', title: hostile, type: 'delivery', cargoType: 'ore', amount: 1,
            destinationSector: 2, originSector: 1, rewardCredits: 100, expiresDay: 3, status: 'available'
        }];
        const html = renderAllMissionScreen();
        assert.equal(html.includes('<script'), false);
        assert.equal(html.includes('<img src=x onerror=alert(1)>'), false);
        assert.equal(html.includes('&lt;img src=x onerror=alert(1)&gt;'), true);
    });
});
