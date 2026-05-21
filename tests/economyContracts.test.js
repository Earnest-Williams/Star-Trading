import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { resetState, state } from '../js/state.js';
import { generateEconomyContractsDaily, acceptEconomyContract, applyContractDeliveryHooks } from '../js/systems/economy/contracts.js';

describe('economy contracts', () => {
    beforeEach(() => {
        resetState();
        state.player = { time: { day: 5 }, currentSector: 2, credits: 1000, cargo: {} };
        state.economy.profilesBySector = { 2: { roleTags: ['port:way_station'] } };
        state.economy.pressureBySector = {
            1: { pulse_canister: { shortageSeverity: 0, surplus: 40 } },
            3: { pulse_canister: { shortageSeverity: 0, surplus: 25 } },
            2: { pulse_canister: { shortageSeverity: 0.8, pricePressure: 1.5, routeAccess: 0.2 } }
        };
        state.ports[2] = { basePrices: { pulse_canister: 100 } };
    });

    it('creates and accepts pressure contracts', () => {
        const summary = generateEconomyContractsDaily();
        assert.equal(summary.created > 0, true);
        const contract = state.economy.contracts[0];
        assert.equal(contract.type, 'pulse_tender');
        assert.deepEqual(contract.sourceCandidates, [1, 3]);
        assert.equal(contract.routeRisk, 0.8);
        assert.equal(contract.premiumModel, 'procurement_subsidy');
        assert.equal(acceptEconomyContract(contract.id), true);
        assert.equal(contract.status, 'accepted');
    });



    it('records sector delivery volume when contract hook delivers units', () => {
        generateEconomyContractsDaily();
        const contract = state.economy.contracts[0];
        acceptEconomyContract(contract.id);
        const hook = applyContractDeliveryHooks(2, 'pulse_canister', 5);
        assert.equal(hook.delivered, 5);
        assert.equal(state.economy.recentVolumeBySector['2'].pulse_canister, 5);
    });

    it('completes accepted contracts and reduces pressure on delivery', () => {
        generateEconomyContractsDaily();
        const contract = state.economy.contracts[0];
        acceptEconomyContract(contract.id);
        const priorCredits = state.player.credits;
        const beforeShortage = state.economy.pressureBySector[2].pulse_canister.shortageSeverity;
        const hook = applyContractDeliveryHooks(2, 'pulse_canister', contract.amount);
        assert.equal(hook.completed, 1);
        assert.equal(contract.status, 'completed');
        assert.equal(state.player.credits > priorCredits, true);
        assert.equal(state.economy.pressureBySector[2].pulse_canister.shortageSeverity < beforeShortage, true);
    });
});
