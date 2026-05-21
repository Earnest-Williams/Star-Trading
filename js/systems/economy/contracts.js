import { state } from '../../state.js';
import { BALANCE, COMMODITY_BASE_PRICES } from '../../constants.js';
import { formatCommodity, log } from '../../utils.js';
import { getPulseServiceSignalForSector } from './pulseService.js';

const CONTRACT_TYPES = Object.freeze({
    shortage_relief: Object.freeze({ label: 'Shortage Relief', rewardScale: 1.05 }),
    industrial_feedstock: Object.freeze({ label: 'Industrial Feedstock', rewardScale: 1.15 }),
    station_reserve: Object.freeze({ label: 'Station Reserve', rewardScale: 1.2 }),
    pulse_tender: Object.freeze({ label: 'Pulse Tender', rewardScale: 1.3 }),
    colony_supply: Object.freeze({ label: 'Colony Supply', rewardScale: 1.22 }),
    shipyard_procurement: Object.freeze({ label: 'Shipyard Procurement', rewardScale: 1.25 }),
    company_purchase_order: Object.freeze({ label: 'Company Purchase Order', rewardScale: 1.1 }),
    surplus_export: Object.freeze({ label: 'Surplus Export', rewardScale: 1.08 }),
    embargo_run: Object.freeze({ label: 'Embargo Run', rewardScale: 1.35 }),
    black_market_diversion: Object.freeze({ label: 'Black-Market Diversion', rewardScale: 1.4 })
});
const CONTRACT_BALANCE = Object.freeze({
    MIN_AMOUNT: BALANCE.ECONOMY.CONTRACTS.MIN_AMOUNT,
    BASE_AMOUNT: BALANCE.ECONOMY.CONTRACTS.BASE_AMOUNT,
    AMOUNT_PRESSURE_MULTIPLIER: BALANCE.ECONOMY.CONTRACTS.AMOUNT_PRESSURE_MULTIPLIER,
    LIFESPAN_DAYS: BALANCE.ECONOMY.CONTRACTS.LIFESPAN_DAYS,
    MAX_ACTIVE: BALANCE.ECONOMY.CONTRACTS.MAX_ACTIVE,
    GENERATION_SHORTAGE_THRESHOLD: BALANCE.ECONOMY.CONTRACTS.GENERATION_SHORTAGE_THRESHOLD,
    PRESSURE_REDUCTION_PER_UNIT: BALANCE.ECONOMY.CONTRACTS.PRESSURE_REDUCTION_PER_UNIT,
    EMBARGO_ROUTE_ACCESS_THRESHOLD: BALANCE.ECONOMY.CONTRACTS.EMBARGO_ROUTE_ACCESS_THRESHOLD,
    SURPLUS_EXPORT_RATIO_THRESHOLD: BALANCE.ECONOMY.CONTRACTS.SURPLUS_EXPORT_RATIO_THRESHOLD,
    PURCHASE_ORDER_DEMAND_RATIO_THRESHOLD: BALANCE.ECONOMY.CONTRACTS.PURCHASE_ORDER_DEMAND_RATIO_THRESHOLD,
    SHORTAGE_RELIEF_SEVERITY_THRESHOLD: BALANCE.ECONOMY.CONTRACTS.SHORTAGE_RELIEF_SEVERITY_THRESHOLD
});

function isOpenContractStatus(status) {
    return status === 'available' || status === 'accepted';
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function ensureEconomyState() {
    if (!state.economy) return null;
    if (!Array.isArray(state.economy.contracts)) state.economy.contracts = [];
    if (!Number.isInteger(state.economy.nextContractId) || state.economy.nextContractId <= 0) {
        state.economy.nextContractId = 1;
    }
    if (!state.economy.recentVolumeBySector || typeof state.economy.recentVolumeBySector !== 'object') {
        state.economy.recentVolumeBySector = {};
    }
    if (!state.economy.dailySummary || typeof state.economy.dailySummary !== 'object') {
        state.economy.dailySummary = {};
    }
    if (!Number.isFinite(Number(state.economy.dailySummary.contractPremiumPayout))) {
        state.economy.dailySummary.contractPremiumPayout = 0;
    }
    const currentDay = Number(state.player?.time?.day || 1);
    const payoutDay = Number(state.economy.dailySummary.contractPremiumPayoutDay);
    if (!Number.isFinite(payoutDay) || payoutDay !== currentDay) {
        state.economy.dailySummary.contractPremiumPayout = 0;
        state.economy.dailySummary.contractPremiumPayoutDay = currentDay;
    }
    return state.economy;
}

function inferContractType(commodity, signal, profile) {
    const tags = Array.isArray(profile?.roleTags) ? profile.roleTags : [];
    if ((signal?.routeAccess || 1) < CONTRACT_BALANCE.EMBARGO_ROUTE_ACCESS_THRESHOLD) return 'embargo_run';
    if (tags.includes('site:frontier')) return 'colony_supply';
    if (tags.includes('port:stardock')) return 'shipyard_procurement';
    if (tags.includes('faction:vc') || tags.includes('front:hidden')) return 'black_market_diversion';
    if (commodity === 'pulse_canister') return 'pulse_tender';
    if (tags.includes('port:way_station') || tags.includes('port:stardock')) return 'station_reserve';
    if (['ore', 'heavy_metals', 'rare_earths', 'electronics'].includes(commodity)) return 'industrial_feedstock';
    if ((signal?.surplus || 0) > (signal?.unmetDemand || 0) * CONTRACT_BALANCE.SURPLUS_EXPORT_RATIO_THRESHOLD) return 'surplus_export';
    const dailyDemand = Number(signal?.dailyDemand ?? signal?.dailyConsumption ?? 0);
    if (dailyDemand >= (signal?.dailyProduction || 0) * CONTRACT_BALANCE.PURCHASE_ORDER_DEMAND_RATIO_THRESHOLD) return 'company_purchase_order';
    if ((signal?.shortageSeverity || 0) >= CONTRACT_BALANCE.SHORTAGE_RELIEF_SEVERITY_THRESHOLD) return 'shortage_relief';
    return null;
}

function deriveSourceCandidates(destinationSectorId, commodity) {
    return Object.entries(state.economy?.pressureBySector || {})
        .filter(([sectorId, pressureMap]) => {
            if (Number(sectorId) === Number(destinationSectorId)) return false;
            const signal = pressureMap?.[commodity];
            return Number(signal?.surplus || 0) > 0;
        })
        .sort(([, pressureA], [, pressureB]) =>
            Number(pressureB?.[commodity]?.surplus || 0) - Number(pressureA?.[commodity]?.surplus || 0)
        )
        .slice(0, 3)
        .map(([sectorId]) => Number(sectorId));
}

function createContract(sectorId, commodity, signal, profile) {
    const type = inferContractType(commodity, signal, profile);
    if (!type) return null;
    const pressure = clamp(Number(signal?.shortageSeverity || 0), 0, 1);
    const destinationPort = state.ports?.[sectorId] || null;
    const basePrice = Math.max(10, Number(destinationPort?.basePrices?.[commodity] || COMMODITY_BASE_PRICES[commodity] || 100));
    const urgency = clamp(Number(signal?.unmetDemand || 0) / Math.max(1, Number(signal?.dailyDemand || signal?.dailyConsumption || 1)), 0, 1);
    const routeRisk = 1 - clamp(Number(signal?.routeAccess ?? 1), 0, 1);
    const pulseSignal = getPulseServiceSignalForSector(sectorId);
    const criticalPulseBonus = (type === 'pulse_tender' || type === 'station_reserve') && (pulseSignal.serviceQuality === 'critical' || pulseSignal.serviceQuality === 'failing') ? BALANCE.ECONOMY.CONTRACTS.CRITICAL_PULSE_PREMIUM_BONUS : 0;
    const blackMarketBonus = type === 'black_market_diversion' ? BALANCE.ECONOMY.CONTRACTS.BLACK_MARKET_PREMIUM_BONUS : 0;
    const premiumRate = clamp(BALANCE.ECONOMY.CONTRACTS.PREMIUM_MIN_RATE + pressure * BALANCE.ECONOMY.CONTRACTS.SHORTAGE_PREMIUM_MULTIPLIER + urgency * BALANCE.ECONOMY.CONTRACTS.URGENCY_PREMIUM_MULTIPLIER + routeRisk * BALANCE.ECONOMY.CONTRACTS.ROUTE_RISK_PREMIUM_MULTIPLIER + criticalPulseBonus + blackMarketBonus, BALANCE.ECONOMY.CONTRACTS.PREMIUM_MIN_RATE, BALANCE.ECONOMY.CONTRACTS.PREMIUM_MAX_RATE);
    const unitPremium = Math.max(1, Math.round(basePrice * premiumRate));
    const amount = Math.max(
        CONTRACT_BALANCE.MIN_AMOUNT,
        Math.round(CONTRACT_BALANCE.BASE_AMOUNT + pressure * CONTRACT_BALANCE.AMOUNT_PRESSURE_MULTIPLIER)
    );
    const day = Number(state.player?.time?.day || 1);
    const sourceCandidates = deriveSourceCandidates(sectorId, commodity);
    const localProductionLimit = Math.max(0, Number(signal?.dailyProduction || 0));
    const unmetDemand = Math.max(0, Number(signal?.unmetDemand || 0));
    const issuer = {
        entityType: 'company',
        name: `${CONTRACT_TYPES[type].label} Board`,
        sectorId: Number(sectorId)
    };
    const failureConsequences = {
        marketImpact: 'shortage_worsens',
        factionImpact: routeRisk > 0.6 ? 'frontier_stress' : 'minor_local_tension'
    };
    const targetStockGap = Math.max(0, Number(signal?.targetStock || 0) - Number(signal?.currentStock || 0));
    return {
        id: `econ-${state.economy.nextContractId++}`,
        type,
        status: 'available',
        commodity,
        amount,
        remaining: amount,
        destinationSector: Number(sectorId),
        postedDay: day,
        expiresDay: day + CONTRACT_BALANCE.LIFESPAN_DAYS,
        unitPremium,
        premiumRate,
        totalPremiumReward: Math.round(basePrice * amount * premiumRate),
        expectedMarketValue: Math.round(basePrice * amount),
        expectedTotalPayout: Math.round(basePrice * amount * (1 + premiumRate)),
        reward: Math.round(basePrice * amount * premiumRate),
        reason: `${CONTRACT_TYPES[type].label} procurement premium for sustained ${formatCommodity(commodity)} pressure.`,
        premiumModel: 'bounded_procurement_premium',
        unmetDemand,
        targetStockGap,
        shortageSeverity: pressure,
        localProductionLimit,
        sourceCandidates,
        routeRisk,
        issuer,
        supplierHints: sourceCandidates,
        failureConsequences
    };
}

function recordRecentDeliveredVolume(sectorId, commodity, amount) {
    const sid = String(sectorId);
    if (!state.economy?.recentVolumeBySector) return;
    if (!state.economy.recentVolumeBySector[sid] || typeof state.economy.recentVolumeBySector[sid] !== 'object') {
        state.economy.recentVolumeBySector[sid] = {};
    }
    state.economy.recentVolumeBySector[sid][commodity] =
        (Number(state.economy.recentVolumeBySector[sid][commodity]) || 0) + amount;
}

export function generateEconomyContractsDaily() {
    const economy = ensureEconomyState();
    if (!economy) return { created: 0, expired: 0, active: 0 };
    const day = Number(state.player?.time?.day || 1);
    let expired = 0;
    economy.contracts.forEach((contract) => {
        if (isOpenContractStatus(contract.status) && Number(contract.expiresDay) < day) {
            contract.status = 'expired';
            expired += 1;
        }
    });

    let created = 0;
    let activeCount = economy.contracts.filter((contract) => isOpenContractStatus(contract.status)).length;
    const maxActive = CONTRACT_BALANCE.MAX_ACTIVE;
    Object.entries(economy.pressureBySector || {}).forEach(([sectorId, pressureMap]) => {
        Object.entries(pressureMap || {}).forEach(([commodity, signal]) => {
            const shortage = Number(signal?.shortageSeverity || 0);
            const surplus = Number(signal?.surplus || 0);
            const targetStock = Math.max(1, Number(signal?.targetStock || 1));
            if (shortage < CONTRACT_BALANCE.GENERATION_SHORTAGE_THRESHOLD && surplus / targetStock < CONTRACT_BALANCE.GENERATION_SHORTAGE_THRESHOLD) return;
            const alreadyOpen = economy.contracts.some((contract) =>
                contract.destinationSector === Number(sectorId)
                && contract.commodity === commodity
                && isOpenContractStatus(contract.status)
            );
            if (alreadyOpen || activeCount >= maxActive) return;
            const profile = economy.profilesBySector?.[sectorId] || null;
            const contract = createContract(sectorId, commodity, signal, profile);
            if (!contract) return;
            economy.contracts.push(contract);
            created += 1;
            activeCount += 1;
        });
    });

    return {
        created,
        expired,
        active: economy.contracts.filter((contract) => isOpenContractStatus(contract.status)).length
    };
}

export function getMarketContractsForSector(sectorId) {
    const sid = Number(sectorId);
    return (state.economy?.contracts || []).filter((contract) =>
        contract.destinationSector === sid && isOpenContractStatus(contract.status)
    );
}

export function acceptEconomyContract(contractId) {
    const contract = (state.economy?.contracts || []).find((entry) => entry.id === contractId);
    if (!contract || contract.status !== 'available') return false;
    contract.status = 'accepted';
    log(`Accepted ${CONTRACT_TYPES[contract.type]?.label || 'economy'} contract: deliver ${contract.amount} ${formatCommodity(contract.commodity)} to Sector ${contract.destinationSector}.`);
    return true;
}

export function applyContractDeliveryHooks(sectorId, commodity, amount) {
    ensureEconomyState();
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) return { completed: 0, delivered: 0 };
    const sid = Number(sectorId);
    const sectorContracts = getMarketContractsForSector(sid).filter((contract) =>
        contract.status === 'accepted' && contract.commodity === commodity
    );
    let delivered = 0;
    let completed = 0;
    let remainingAmount = Math.floor(Number(amount));
    sectorContracts.forEach((contract) => {
        if (remainingAmount <= 0) return;
        const remaining = Math.max(0, Number(contract.remaining || contract.amount || 0));
        const step = Math.min(remaining, remainingAmount);
        if (step <= 0) return;
        contract.remaining = Math.max(0, remaining - step);
        remainingAmount -= step;
        delivered += step;
        recordRecentDeliveredVolume(sid, commodity, step);
        if (contract.remaining <= 0) {
            contract.status = 'completed';
            const currentPayout = Number(state.economy?.dailySummary?.contractPremiumPayout || 0);
            const payoutCap = Number(BALANCE.ECONOMY.CONTRACTS.MAX_DAILY_CONTRACT_PREMIUM_PAYOUT || 0);
            const requestedPayout = Number(contract.totalPremiumReward || contract.reward || 0);
            const remainingCap = Number.isFinite(payoutCap) ? Math.max(0, payoutCap - currentPayout) : requestedPayout;
            const paidPremium = Math.max(0, Math.min(requestedPayout, remainingCap));
            if (state.player) state.player.credits = (Number(state.player.credits) || 0) + paidPremium;
            state.economy.dailySummary.contractPremiumPayout = currentPayout + paidPremium;
            completed += 1;
        }
        const signal = state.economy?.pressureBySector?.[sid]?.[commodity];
        if (signal) {
            const amountBasis = Math.max(1, Number(contract.amount || 1));
            signal.shortageSeverity = clamp(Number(signal.shortageSeverity || 0) - step / amountBasis, 0, 1);
            signal.pricePressure = Math.max(1, Number(signal.pricePressure || 1) - step * CONTRACT_BALANCE.PRESSURE_REDUCTION_PER_UNIT);
        }
    });
    return { completed, delivered };
}
