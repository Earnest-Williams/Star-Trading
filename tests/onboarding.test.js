import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { buildNextActionSuggestions } from '../js/ui/onboarding.js';
import { resetState, state } from '../js/state.js';

describe('first-run onboarding suggestions', () => {
    afterEach(() => {
        resetState();
    });

    it('suggests map inspection, market review, and local missions from current state', () => {
        state.player = {
            currentSector: 1,
            cargo: { ore: 0, org: 0, eq: 0, pulse_canister: 0, heavy_pulse_module: 0 }
        };
        state.selectedSectorId = 2;
        state.universe = {
            1: {
                id: 1,
                jumpGates: [{ destinationSectorId: 2, status: 'open', effectiveSpanCost: 1 }]
            },
            2: { id: 2, jumpGates: [] }
        };
        state.ports = {
            1: {
                typeKey: 'mining',
                stock: { ore: 25 },
                maxStock: { ore: 40 }
            }
        };
        state.missions = [{ id: 1, status: 'available', originSector: 1 }];
        state.tradeRoutes = [{ id: 'existing', status: 'active' }];

        const suggestions = buildNextActionSuggestions();

        assert.equal(suggestions.length, 4);
        assert.deepEqual(
            suggestions.map(suggestion => suggestion.title),
            [
                'Inspect your current site',
                'Check the market spread',
                'Take a local contract',
                'Review operational messages'
            ]
        );
        assert.deepEqual(suggestions[0].args, [1]);
        assert.deepEqual(suggestions[1].args, ['market']);
        assert.deepEqual(suggestions[2].args, ['missions']);
    });

    it('falls back to corridor scouting when the current site is already selected', () => {
        state.player = {
            currentSector: 1,
            cargo: { ore: 0, org: 0, eq: 0, pulse_canister: 0, heavy_pulse_module: 0 }
        };
        state.selectedSectorId = 1;
        state.universe = {
            1: {
                id: 1,
                jumpGates: [{ destinationSectorId: 7, status: 'open', effectiveSpanCost: 1 }]
            },
            7: { id: 7, jumpGates: [] }
        };
        state.tradeRoutes = [{ id: 'existing', status: 'active' }];

        const suggestions = buildNextActionSuggestions();

        assert.equal(suggestions[0].title, 'Scout a direct jump corridor');
        assert.equal(suggestions[0].action, 'moveTo');
        assert.deepEqual(suggestions[0].args, [7]);
    });
});
