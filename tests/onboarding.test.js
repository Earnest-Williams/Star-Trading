import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { buildNextActionSuggestions } from '../js/ui/onboarding.js';
import { resetState, state } from '../js/state.js';

describe('priority briefing compatibility export', () => {
    afterEach(() => {
        resetState();
    });

    it('suggests corridor pinning, market review, and local contracts from current state', () => {
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
                'Current site not pinned',
                'Local contract postings',
                'Local surplus available',
                'Comms console idle'
            ]
        );
        assert.deepEqual(suggestions[0].args, [1]);
        assert.deepEqual(suggestions[1].args, ['missions']);
        assert.deepEqual(suggestions[2].args, ['market']);
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

        assert.equal(suggestions[0].title, 'Direct jump available');
        assert.equal(suggestions[0].action, 'moveTo');
        assert.deepEqual(suggestions[0].args, [7]);
    });
});
