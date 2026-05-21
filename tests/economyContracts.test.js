import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { resetState, state } from '../js/state.js';
import { generateEconomyContractsDaily, acceptEconomyContract, applyContractDeliveryHooks } from '../js/systems/economy/contracts.js';
import { BALANCE } from '../js/constants.js';

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
    function pickContract() {
        return state.economy.contracts.find((entry) => entry.destinationSector === 2 && entry.commodity === 'pulse_canister') || state.economy.contracts[0];
    }

    it('creates and accepts pressure contracts', () => {
        const summary = generateEconomyContractsDaily();
        assert.equal(summary.created > 0, true);
        const contract = pickContract();
        assert.equal(contract.type, 'pulse_tender');
        assert.equal(contract.sourceCandidates.includes(3), true);
        assert.equal(contract.routeRisk, 0.8);
        assert.equal(contract.premiumModel, 'bounded_procurement_premium');
        assert.equal(contract.unitPremium > 0, true);
        assert.equal(contract.premiumRate >= BALANCE.ECONOMY.CONTRACTS.PREMIUM_MIN_RATE, true);
        assert.equal(contract.premiumRate <= BALANCE.ECONOMY.CONTRACTS.PREMIUM_MAX_RATE, true);
        assert.equal(contract.totalPremiumReward, contract.reward);
        assert.equal(contract.expectedMarketValue > contract.totalPremiumReward, BALANCE.ECONOMY.CONTRACTS.PREMIUM_MAX_RATE < 1 && contract.type !== 'black_market_diversion');
        assert.equal(contract.expectedTotalPayout, contract.expectedMarketValue + contract.totalPremiumReward);
        assert.equal(acceptEconomyContract(contract.id), true);
        assert.equal(contract.status, 'accepted');
    });



    it('records sector delivery volume when contract hook delivers units', () => {
        generateEconomyContractsDaily();
        const contract = pickContract();
        acceptEconomyContract(contract.id);
        const hook = applyContractDeliveryHooks(contract.destinationSector, contract.commodity, 5);
        assert.equal(hook.delivered, 5);
        assert.equal(state.economy.recentVolumeBySector[String(contract.destinationSector)][contract.commodity], 5);
    });

    it('completes accepted contracts and reduces pressure on delivery', () => {
        generateEconomyContractsDaily();
        const contract = pickContract();
        acceptEconomyContract(contract.id);
        const priorCredits = state.player.credits;
        const beforeShortage = state.economy.pressureBySector[String(contract.destinationSector)][contract.commodity].shortageSeverity;
        const hook = applyContractDeliveryHooks(contract.destinationSector, contract.commodity, contract.amount);
        assert.equal(hook.completed, 1);
        assert.equal(contract.status, 'completed');
        assert.equal(state.player.credits - priorCredits, contract.totalPremiumReward);
        assert.equal(state.economy.pressureBySector[String(contract.destinationSector)][contract.commodity].shortageSeverity < beforeShortage, true);
    });

    it('higher shortage severity yields higher premium rate', () => {
        const mild = { shortageSeverity: 0.05, pricePressure: 1.1, routeAccess: 0.8, dailyDemand: 10, dailyProduction: 8, unmetDemand: 1, targetStock: 100, currentStock: 25 };
        const severe = { ...mild, shortageSeverity: 0.95, unmetDemand: 30, routeAccess: 0.1 };
        state.economy.pressureBySector[2].pulse_canister = mild;
        generateEconomyContractsDaily();
        const mildRate = pickContract().premiumRate;
        state.economy.contracts = [];
        state.economy.pressureBySector[2].pulse_canister = severe;
        generateEconomyContractsDaily();
        const severeRate = pickContract().premiumRate;
        assert.equal(severeRate > mildRate, true);
    });

    it('caps premium rate under extreme pressure', () => {
        state.economy.pressureBySector[2].pulse_canister = { shortageSeverity: 1, pricePressure: 2, routeAccess: 0, dailyDemand: 100, dailyProduction: 1, unmetDemand: 200 };
        generateEconomyContractsDaily();
        const contract = pickContract();
        assert.equal(contract.premiumRate <= BALANCE.ECONOMY.CONTRACTS.PREMIUM_MAX_RATE, true);
    });

    it('caps daily contract premium payout', () => {
        state.economy.dailySummary = {
            contractPremiumPayout: BALANCE.ECONOMY.CONTRACTS.MAX_DAILY_CONTRACT_PREMIUM_PAYOUT - 5,
            contractPremiumPayoutDay: state.player.time.day
        };
        generateEconomyContractsDaily();
        const contract = pickContract();
        acceptEconomyContract(contract.id);
        const priorCredits = state.player.credits;
        const hook = applyContractDeliveryHooks(contract.destinationSector, contract.commodity, contract.amount);
        assert.equal(hook.completed, 1);
        assert.equal(state.player.credits - priorCredits, 5);
    });

    it('resets daily contract premium payout when day advances', () => {
        state.economy.dailySummary = {
            contractPremiumPayout: 123,
            contractPremiumPayoutDay: state.player.time.day - 1
        };
        generateEconomyContractsDaily();
        assert.equal(state.economy.dailySummary.contractPremiumPayout, 0);
        assert.equal(state.economy.dailySummary.contractPremiumPayoutDay, state.player.time.day);
    });

    it('completes contract payout without throwing when player state is missing', () => {
        generateEconomyContractsDaily();
        const contract = pickContract();
        acceptEconomyContract(contract.id);
        state.player = null;
        assert.doesNotThrow(() => applyContractDeliveryHooks(contract.destinationSector, contract.commodity, contract.amount));
        assert.equal(contract.status, 'completed');
    });
});
