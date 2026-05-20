import { state } from '../../state.js';
import { BALANCE } from '../../constants.js';
import { formatCommodity, log } from '../../utils.js';

const CONTRACT_TYPES = Object.freeze({
    shortage_relief: Object.freeze({ label: 'Shortage Relief', rewardScale: 1.05 }),
    industrial_feedstock: Object.freeze({ label: 'Industrial Feedstock', rewardScale: 1.15 }),
    station_reserve: Object.freeze({ label: 'Station Reserve', rewardScale: 1.2 }),
    pulse_tender: Object.freeze({ label: 'Pulse Tender', rewardScale: 1.3 })
});
const CONTRACT_BALANCE = Object.freeze({
    MIN_AMOUNT: BALANCE.ECONOMY?.CONTRACTS?.MIN_AMOUNT ?? 8,
    BASE_AMOUNT: BALANCE.ECONOMY?.CONTRACTS?.BASE_AMOUNT ?? 10,
    AMOUNT_PRESSURE_MULTIPLIER: BALANCE.ECONOMY?.CONTRACTS?.AMOUNT_PRESSURE_MULTIPLIER ?? 30,
    LIFESPAN_DAYS: BALANCE.ECONOMY?.CONTRACTS?.LIFESPAN_DAYS ?? 4,
    MAX_ACTIVE: BALANCE.ECONOMY?.CONTRACTS?.MAX_ACTIVE ?? 18,
    GENERATION_SHORTAGE_THRESHOLD: BALANCE.ECONOMY?.CONTRACTS?.GENERATION_SHORTAGE_THRESHOLD ?? 0.35,
    PRESSURE_REDUCTION_PER_UNIT: BALANCE.ECONOMY?.CONTRACTS?.PRESSURE_REDUCTION_PER_UNIT ?? 0.01
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
    return state.economy;
}

function inferContractType(commodity, signal, profile) {
    const tags = Array.isArray(profile?.roleTags) ? profile.roleTags : [];
    if (commodity === 'pulse_canister') return 'pulse_tender';
    if (tags.includes('port:way_station') || tags.includes('port:stardock')) return 'station_reserve';
    if (['ore', 'heavy_metals', 'rare_earths', 'electronics'].includes(commodity)) return 'industrial_feedstock';
    if ((signal?.shortageSeverity || 0) >= 0.4) return 'shortage_relief';
    return null;
}

function createContract(sectorId, commodity, signal, profile) {
    const type = inferContractType(commodity, signal, profile);
    if (!type) return null;
    const pressure = clamp(Number(signal?.shortageSeverity || 0), 0, 1);
    const destinationPort = state.ports?.[sectorId] || null;
    const buyPressure = Math.max(1, Number(signal?.pricePressure || 1));
    const basePrice = Math.max(10, Number(destinationPort?.basePrices?.[commodity] || 100));
    const unitReward = Math.max(10, Math.round(basePrice * buyPressure * CONTRACT_TYPES[type].rewardScale));
    const amount = Math.max(
        CONTRACT_BALANCE.MIN_AMOUNT,
        Math.round(CONTRACT_BALANCE.BASE_AMOUNT + pressure * CONTRACT_BALANCE.AMOUNT_PRESSURE_MULTIPLIER)
    );
    const day = Number(state.player?.time?.day || 1);
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
        unitReward,
        reward: unitReward * amount,
        reason: `${CONTRACT_TYPES[type].label} request due to sustained ${formatCommodity(commodity)} shortage pressure.`
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
            if ((signal?.shortageSeverity || 0) < CONTRACT_BALANCE.GENERATION_SHORTAGE_THRESHOLD) return;
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
            state.player.credits = (Number(state.player?.credits) || 0) + Number(contract.reward || 0);
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
