import { state } from '../state.js';
import { BALANCE } from '../config/economy.js';
import { FACTIONS } from '../config/factions.js';
import { EventBus } from '../events.js';
import { recordLogisticsDelivery } from './logisticsObjectives.js';
import { normaliseDataCargoState } from '../core/dataCargo.js';
import { getDominantInfluence } from '../core/influence.js';
import { addFactionRep, addFactionTrust, getFactionRep, getFactionTrust } from '../core/factions.js';
import { addWorldEvent } from '../core/worldEvents.js';
import { applyShipDamage } from './combat.js';
import { log, random } from '../utils.js';
import { Notifications } from '../ui/notifications.js';

const SECURE_REP_THRESHOLD = BALANCE.DATA_CARGO.SECURE_LICENSE_REP_THRESHOLD;
const SECURE_TRUST_THRESHOLD = BALANCE.DATA_CARGO.SECURE_LICENSE_TRUST_THRESHOLD;
export const SECURE_LICENSE_REP_THRESHOLD = SECURE_REP_THRESHOLD;
export const SECURE_LICENSE_TRUST_THRESHOLD = SECURE_TRUST_THRESHOLD;
const MAX_AVAILABLE_CONTRACTS = BALANCE.DATA_CARGO.SECURE_MAX_AVAILABLE_CONTRACTS;
const SECURE_CONTRACT_TYPES = [
    'diplomatic_packet',
    'sealed_manifest',
    'compliance_keys',
    'industrial_cipher',
    'frontier_writ'
];

function currentDay() {
    return state.player?.time?.day || 0;
}

function ensureSecureCargoState() {
    state.dataCargo = state.dataCargo || {};
    state.dataCargo.playerHold = state.dataCargo.playerHold || {};
    if (!Array.isArray(state.dataCargo.playerHold.securePayloads)) state.dataCargo.playerHold.securePayloads = [];
    if (!Array.isArray(state.dataCargo.secureContracts)) state.dataCargo.secureContracts = [];
    const nextId = Number(state.dataCargo.nextPayloadId);
    if (!Number.isFinite(nextId) || nextId < 1) state.dataCargo.nextPayloadId = 1;
    state.dataCargo.license = state.dataCargo.license || {};
    if (state.dataCargo.license.secureCourier !== true) state.dataCargo.license.secureCourier = false;
    if (!Object.hasOwn(state.dataCargo.license, 'issuedByFactionId')) state.dataCargo.license.issuedByFactionId = null;
    if (!Object.hasOwn(state.dataCargo.license, 'issuedDay')) state.dataCargo.license.issuedDay = null;
}

function nextSecureId() {
    ensureSecureCargoState();
    return `secure-${state.dataCargo.nextPayloadId++}`;
}

function getSectorIdsWithPorts() {
    const portIds = Object.keys(state.ports || {})
        .map(id => Number(id))
        .filter(id => Number.isFinite(id) && state.universe?.[id]);
    if (portIds.length > 0) return portIds;
    return Object.keys(state.universe || {})
        .map(id => Number(id))
        .filter(Number.isFinite);
}

function chooseDifferentSector(originSectorId, sectorIds) {
    const choices = sectorIds.filter(id => id !== originSectorId);
    if (choices.length === 0) return originSectorId;
    return choices[Math.floor(random() * choices.length)];
}

function getFactionForSector(sectorId) {
    const port = state.ports?.[sectorId];
    return port?.factionId || port?.publicFactionId || getDominantInfluence(sectorId) || 'sda';
}

function getFactionShort(factionId) {
    return FACTIONS[factionId]?.short || String(factionId || 'Unaligned').toUpperCase();
}

function buildContractText(contract) {
    const issuer = getFactionShort(contract.factionId);
    const target = getFactionShort(contract.targetFactionId);
    return `Sealed ${issuer} courier packet bound for ${target} liaison staff in S${contract.destinationSectorId}.`;
}

function getSecureHold() {
    ensureSecureCargoState();
    return state.dataCargo.playerHold.securePayloads;
}

function takeSecurePayload(payloadId) {
    const payloads = getSecureHold();
    const id = String(payloadId);
    const index = payloads.findIndex(payload => payload.id === id);
    if (index < 0) return null;
    const [payload] = payloads.splice(index, 1);
    EventBus.emit('data_cargo_changed', { securePayloads: payloads.length });
    return payload;
}

function hasReputationAccess(contract) {
    const factionId = contract?.factionId;
    if (!factionId || !FACTIONS[factionId]) return false;
    return getFactionRep(factionId) >= SECURE_REP_THRESHOLD
        || getFactionTrust(factionId) >= SECURE_TRUST_THRESHOLD;
}

export function hasSecureCourierLicense() {
    ensureSecureCargoState();
    return state.dataCargo.license.secureCourier === true;
}

export function grantSecureCourierLicense(factionId = 'sda') {
    ensureSecureCargoState();
    const issuer = FACTIONS[factionId] ? factionId : 'sda';
    const issuerRep = getFactionRep(issuer);
    const issuerTrust = getFactionTrust(issuer);
    if (issuerRep < SECURE_LICENSE_REP_THRESHOLD && issuerTrust < SECURE_LICENSE_TRUST_THRESHOLD) {
        Notifications.show(`${getFactionShort(issuer)} standing too low for a courier license`, 2);
        return false;
    }
    state.dataCargo.license = {
        secureCourier: true,
        issuedByFactionId: issuer,
        issuedDay: currentDay()
    };
    addWorldEvent({
        type: 'secure_courier_license_granted',
        factionId: issuer,
        text: `${getFactionShort(issuer)} issued you a Secure Courier License.`,
        importance: 2,
        alert: false
    });
    Notifications.show('Secure Courier License issued', 2);
    EventBus.emit('data_cargo_changed', { license: true });
    return true;
}

export function revokeSecureCourierLicense(reason = 'license revoked') {
    ensureSecureCargoState();
    const issuer = state.dataCargo.license.issuedByFactionId || null;
    state.dataCargo.license = {
        secureCourier: false,
        issuedByFactionId: issuer,
        issuedDay: state.dataCargo.license.issuedDay || null
    };
    addWorldEvent({
        type: 'secure_courier_license_revoked',
        factionId: issuer,
        text: `Secure Courier License revoked: ${reason}.`,
        importance: 2,
        alert: true
    });
    EventBus.emit('data_cargo_changed', { license: false });
    return true;
}

export function canAcceptSecureContract(contract) {
    if (getSecureHold().length >= BALANCE.DATA_CARGO.SECURE_MAX_ACTIVE_PAYLOADS) return false;
    return hasSecureCourierLicense() || hasReputationAccess(contract);
}

export function generateSecureCourierContracts() {
    normaliseDataCargoState();
    const today = currentDay();
    state.dataCargo.secureContracts = state.dataCargo.secureContracts
        .filter(contract => contract.status === 'available' && contract.expiresDay >= today);
    if (state.dataCargo.secureContracts.length >= MAX_AVAILABLE_CONTRACTS) {
        return { generatedCount: 0 };
    }

    const sectorIds = getSectorIdsWithPorts();
    if (sectorIds.length < 2) return { generatedCount: 0 };

    const openSlots = MAX_AVAILABLE_CONTRACTS - state.dataCargo.secureContracts.length;
    const attempts = Math.min(openSlots, Math.max(1, Math.ceil(sectorIds.length / BALANCE.DATA_CARGO.SECURE_GENERATION_SECTOR_DIVISOR)));
    let generatedCount = 0;
    for (let i = 0; i < attempts; i++) {
        if (random() > BALANCE.DATA_CARGO.SECURE_GENERATION_SKIP_CHANCE && state.dataCargo.secureContracts.length > 0) continue;
        const originSectorId = sectorIds[Math.floor(random() * sectorIds.length)];
        const destinationSectorId = chooseDifferentSector(originSectorId, sectorIds);
        const factionId = getFactionForSector(originSectorId);
        const targetFactionId = getFactionForSector(destinationSectorId);
        const risk = Math.max(BALANCE.DATA_CARGO.SECURE_RISK_MIN, Math.min(BALANCE.DATA_CARGO.SECURE_RISK_MAX, BALANCE.DATA_CARGO.SECURE_RISK_MIN + Math.floor(random() * BALANCE.DATA_CARGO.SECURE_RISK_RANDOM_SPAN) + Math.floor((Number(state.universe?.[destinationSectorId]?.pirateThreat) || 0) / BALANCE.DATA_CARGO.SECURE_RISK_PIRATE_DIVISOR)));
        const value = BALANCE.DATA_CARGO.SECURE_BASE_VALUE + risk * BALANCE.DATA_CARGO.SECURE_VALUE_PER_RISK + Math.floor(random() * BALANCE.DATA_CARGO.SECURE_VALUE_RANDOM_SPAN);
        const contract = {
            id: nextSecureId(),
            tier: 'secure',
            type: SECURE_CONTRACT_TYPES[Math.floor(random() * SECURE_CONTRACT_TYPES.length)],
            originSectorId,
            destinationSectorId,
            factionId,
            targetFactionId,
            createdDay: today,
            expiresDay: today + BALANCE.DATA_CARGO.SECURE_DEFAULT_EXPIRY_DAYS + Math.floor(random() * BALANCE.DATA_CARGO.SECURE_EXPIRY_RANDOM_DAYS),
            value,
            risk,
            status: 'available'
        };
        contract.text = buildContractText(contract);
        state.dataCargo.secureContracts.push(contract);
        generatedCount += 1;
    }
    if (generatedCount > 0) EventBus.emit('data_cargo_changed', { secureContracts: state.dataCargo.secureContracts.length });
    return { generatedCount };
}

export function getAvailableSecureContracts(sectorId = state.player.currentSector) {
    normaliseDataCargoState();
    const localSectorId = Number(sectorId);
    const today = currentDay();
    return state.dataCargo.secureContracts
        .filter(contract => contract.status === 'available'
            && contract.originSectorId === localSectorId
            && contract.expiresDay >= today)
        .slice()
        .sort((a, b) => a.expiresDay - b.expiresDay || a.id.localeCompare(b.id));
}

export function getActiveSecurePayloads() {
    const today = currentDay();
    return getSecureHold()
        .filter(payload => payload.status === 'accepted' && payload.expiresDay >= today)
        .slice()
        .sort((a, b) => a.expiresDay - b.expiresDay || a.id.localeCompare(b.id));
}

export function acceptSecureContract(contractId) {
    normaliseDataCargoState();
    const id = String(contractId);
    const index = state.dataCargo.secureContracts.findIndex(contract => contract.id === id);
    if (index < 0) return false;
    const contract = state.dataCargo.secureContracts[index];
    if (contract.status !== 'available') return false;
    if (contract.originSectorId !== Number(state.player.currentSector)) return false;
    if (!canAcceptSecureContract(contract)) return false;
    const [accepted] = state.dataCargo.secureContracts.splice(index, 1);
    const payload = {
        ...accepted,
        acquiredDay: currentDay(),
        status: 'accepted',
        text: accepted.text || buildContractText(accepted)
    };
    state.dataCargo.playerHold.securePayloads.push(payload);
    addWorldEvent({
        type: 'secure_payload_accepted',
        sectorId: payload.originSectorId,
        factionId: payload.factionId,
        text: `Accepted secure courier contract ${payload.id}: ${payload.text}`,
        importance: 2,
        alert: false
    });
    Notifications.show('Secure courier packet accepted', 2);
    EventBus.emit('data_cargo_changed', { securePayloads: state.dataCargo.playerHold.securePayloads.length });
    return payload;
}

export function completeSecurePayload(payloadId) {
    const payload = getSecureHold().find(item => item.id === String(payloadId));
    if (!payload || payload.status !== 'accepted') return false;
    if (payload.destinationSectorId !== Number(state.player.currentSector)) return false;
    const delivered = takeSecurePayload(payloadId);
    state.player.credits = (Number(state.player.credits) || 0) + delivered.value;
    recordLogisticsDelivery({
        source: "secure_delivery",
        sectorId: delivered.destinationSectorId,
        commodity: "eq",
        amount: Math.max(1, Math.floor(delivered.value / BALANCE.DATA_CARGO.SECURE_DELIVERY_LOGISTICS_AMOUNT_DIVISOR)),
        profit: delivered.value
    });
    addFactionRep(delivered.factionId, Math.max(BALANCE.DATA_CARGO.SECURE_DELIVERY_MIN_REP_GAIN, Math.floor(delivered.value / BALANCE.DATA_CARGO.SECURE_DELIVERY_VALUE_REP_DIVISOR)), 'secure courier delivery');
    addFactionTrust(delivered.factionId, BALANCE.DATA_CARGO.SECURE_DELIVERY_TRUST_GAIN, 'secure courier delivery');
    if (delivered.targetFactionId && delivered.targetFactionId !== delivered.factionId) {
        addFactionTrust(delivered.targetFactionId, BALANCE.DATA_CARGO.SECURE_HANDOFF_TRUST_GAIN, 'secure courier handoff');
    }
    addWorldEvent({
        type: 'secure_payload_delivered',
        sectorId: delivered.destinationSectorId,
        factionId: delivered.factionId,
        text: `Delivered ${delivered.id} to S${delivered.destinationSectorId} for ${delivered.value} credits.`,
        importance: 3,
        alert: false
    });
    log(`Delivered secure courier packet for ${delivered.value} credits.`);
    Notifications.show(`Secure delivery complete: +${delivered.value} credits`, 3);
    return delivered;
}

export function failExpiredSecurePayloads() {
    normaliseDataCargoState();
    const today = currentDay();
    let failedCount = 0;
    state.dataCargo.secureContracts = state.dataCargo.secureContracts
        .filter(contract => contract.status === 'available' && contract.expiresDay >= today);
    state.dataCargo.playerHold.securePayloads = state.dataCargo.playerHold.securePayloads
        .filter(payload => {
            if (payload.status !== 'accepted' || payload.expiresDay >= today) return true;
            failedCount += 1;
            addFactionRep(payload.factionId, -BALANCE.DATA_CARGO.SECURE_EXPIRY_REP_LOSS, 'expired secure courier packet');
            addWorldEvent({
                type: 'secure_payload_expired',
                sectorId: payload.destinationSectorId,
                factionId: payload.factionId,
                text: `Secure courier packet ${payload.id} expired before delivery to S${payload.destinationSectorId}.`,
                importance: 2,
                alert: true
            });
            return false;
        });
    if (failedCount > 0) {
        Notifications.show(`${failedCount} secure packet${failedCount === 1 ? '' : 's'} expired`, 3);
        EventBus.emit('data_cargo_changed', { failedSecurePayloads: failedCount });
    }
    return { failedCount };
}

export function maybeSecureDataInterception(randomUnit = random) {
    const payloads = getActiveSecurePayloads();
    if (payloads.length === 0) return { intercepted: false, outcome: 'none' };
    const sectorId = Number(state.player.currentSector);
    const sector = state.universe?.[sectorId] || {};
    const pirateThreat = Math.max(0, Number(sector.pirateThreat) || 0);
    const totalRisk = payloads.reduce((sum, payload) => sum + (Number(payload.risk) || 1), 0);
    const dominant = getDominantInfluence(sectorId);
    const hostilePressure = dominant === BALANCE.DATA_CARGO.SECURE_HOSTILE_FACTION_ID ? BALANCE.DATA_CARGO.SECURE_HOSTILE_PRESSURE : 0;
    const chance = Math.min(BALANCE.DATA_CARGO.SECURE_INTERCEPTION_BASE_CHANCE + totalRisk * BALANCE.DATA_CARGO.SECURE_INTERCEPTION_RISK_MULTIPLIER + pirateThreat * BALANCE.DATA_CARGO.SECURE_INTERCEPTION_PIRATE_MULTIPLIER + hostilePressure, BALANCE.DATA_CARGO.SECURE_INTERCEPTION_MAX_CHANCE);
    if (randomUnit() >= chance) return { intercepted: false, outcome: 'none', chance };

    const outcomeRoll = randomUnit();
    if (outcomeRoll < BALANCE.DATA_CARGO.SECURE_WARNING_OUTCOME_THRESHOLD) {
        Notifications.show('Encrypted packet probe detected', 2);
        addWorldEvent({
            type: 'secure_interception_warning',
            sectorId,
            text: `A hostile scan brushed your secure courier hold near S${sectorId}.`,
            importance: 1,
            alert: false
        });
        return { intercepted: true, outcome: 'warning', chance };
    }
    if (outcomeRoll < BALANCE.DATA_CARGO.SECURE_DAMAGE_OUTCOME_THRESHOLD) {
        const damage = BALANCE.DATA_CARGO.SECURE_DAMAGE_BASE + Math.floor(randomUnit() * BALANCE.DATA_CARGO.SECURE_DAMAGE_RANDOM_SPAN) + pirateThreat;
        applyShipDamage(damage);
        Notifications.show(`Courier intercept evasive burn — ${damage} damage`, 3);
        return { intercepted: true, outcome: 'damage', damage, chance };
    }
    if (outcomeRoll < BALANCE.DATA_CARGO.SECURE_COMPROMISE_OUTCOME_THRESHOLD) {
        const target = payloads[Math.floor(randomUnit() * payloads.length)];
        const compromised = takeSecurePayload(target.id);
        addFactionRep(compromised.factionId, -BALANCE.DATA_CARGO.SECURE_COMPROMISE_REP_LOSS, 'compromised secure courier packet');
        addWorldEvent({
            type: 'secure_payload_compromised',
            sectorId,
            factionId: compromised.factionId,
            text: `Interceptors compromised ${compromised.id} before delivery to S${compromised.destinationSectorId}.`,
            importance: 3,
            alert: true
        });
        Notifications.show('Secure courier packet compromised', 4);
        return { intercepted: true, outcome: 'compromised', payloadId: compromised.id, chance };
    }
    if (state.universe?.[sectorId]) state.universe[sectorId].pirateThreat = pirateThreat + 1;
    Notifications.show('Courier chase stirred up pirate activity', 2);
    return { intercepted: true, outcome: 'pirate_threat', chance };
}
