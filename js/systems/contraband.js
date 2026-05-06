// js/systems/contraband.js
// Opinionated underlay for hidden freight: typed cargo, sector sourcing,
// receiver demand, inspection risk, and delivery settlement.

import { state } from '../state.js';
import { addWorldEvent } from '../core/worldEvents.js';
import {
    addFactionHeat,
    addFactionRep,
    addFactionTrust,
    getFactionHeat,
    getGuildTier,
    getPrivateFactionRep
} from '../core/factions.js';
import { getRouteRiskForSectors } from '../systems/tradeRoutes.js';
import { clampRange, formatCredits, log, random } from '../utils.js';

export const CONTRABAND_TYPES = Object.freeze({
    black_market_eq: Object.freeze({
        id: 'black_market_eq',
        name: 'Black-Market Equipment',
        value: 220,
        heat: 4,
        bulk: 1,
        sourceWeight: { industrial: 3, refinery: 2, stardock: 1 },
        demandWeight: { mining: 2, agricultural: 1, consumer: 2 }
    }),
    forged_manifests: Object.freeze({
        id: 'forged_manifests',
        name: 'Forged Manifests',
        value: 140,
        heat: 2,
        bulk: 1,
        inspectionMitigation: 0.03,
        sourceWeight: { stardock: 3, consumer: 2, refinery: 1 },
        demandWeight: { industrial: 2, mining: 1, agricultural: 1 }
    }),
    restricted_meds: Object.freeze({
        id: 'restricted_meds',
        name: 'Restricted Meds',
        value: 180,
        heat: 3,
        bulk: 1,
        sourceWeight: { agricultural: 2, consumer: 2, stardock: 1 },
        demandWeight: { mining: 2, refinery: 2, industrial: 1 }
    })
});

const BASE_HIDDEN_HOLD_FRACTION = 0.18;
const RECEIVER_FACTION_ID = 'vc';
const INSPECTOR_FACTION_ID = 'sda';

function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function contrabandDefinition(itemType) {
    return CONTRABAND_TYPES[itemType] || null;
}

function sectorInfluence(sectorId, factionId) {
    const sector = state.universe && state.universe[sectorId];
    if (!sector || !sector.influence) return 0;
    return Math.max(0, Number(sector.influence[factionId]) || 0);
}

function sectorPirateThreat(sectorId) {
    const sector = state.universe && state.universe[sectorId];
    return sector ? Math.max(0, Number(sector.pirateThreat) || 0) : 0;
}

function sectorRegion(sectorId) {
    const sector = state.universe && state.universe[sectorId];
    return sector ? sector.region || null : null;
}

function portAt(sectorId) {
    return state.ports && state.ports[sectorId] ? state.ports[sectorId] : null;
}

function getPlayer() {
    return state.player || null;
}

function normaliseAmount(amount) {
    const count = Number.parseInt(amount, 10);
    if (!Number.isFinite(count) || count <= 0) return 0;
    return count;
}

function cloneContrabandLot(item) {
    return {
        type: item.type,
        amount: item.amount,
        acquiredSector: item.acquiredSector
    };
}

export function listContrabandTypes() {
    return Object.values(CONTRABAND_TYPES);
}

export function getContrabandDefinition(itemType) {
    return contrabandDefinition(itemType);
}

export function ensureContrabandHold() {
    const player = getPlayer();
    if (!player) return [];
    if (!Array.isArray(player.contrabandHold)) player.contrabandHold = [];

    const merged = new Map();
    player.contrabandHold.forEach(item => {
        if (!isObject(item)) return;
        const definition = contrabandDefinition(item.type);
        const amount = normaliseAmount(item.amount);
        if (!definition || amount <= 0) return;
        const acquiredSector = Number.isFinite(Number(item.acquiredSector))
            ? Number(item.acquiredSector)
            : player.currentSector;
        const key = `${item.type}:${acquiredSector}`;
        const existing = merged.get(key);
        if (existing) existing.amount += amount;
        else merged.set(key, { type: item.type, amount, acquiredSector });
    });
    player.contrabandHold = Array.from(merged.values());
    return player.contrabandHold;
}

export function getContrabandHold() {
    return ensureContrabandHold().filter(item => item.amount > 0);
}

export function getContrabandManifest(hold = getContrabandHold()) {
    const totalsByType = {};
    const originSectors = new Set();
    let units = 0;
    let bulk = 0;
    let value = 0;
    let heat = 0;
    hold.forEach(item => {
        const definition = contrabandDefinition(item.type);
        if (!definition) return;
        const amount = normaliseAmount(item.amount);
        if (amount <= 0) return;
        units += amount;
        bulk += amount * definition.bulk;
        value += amount * definition.value;
        heat += amount * definition.heat;
        totalsByType[item.type] = (totalsByType[item.type] || 0) + amount;
        if (Number.isFinite(Number(item.acquiredSector))) originSectors.add(Number(item.acquiredSector));
    });
    return {
        units,
        bulk,
        value,
        heat,
        totalsByType,
        originSectors: Array.from(originSectors).sort((a, b) => a - b)
    };
}

export function getHiddenHoldCapacity() {
    const player = getPlayer();
    if (!player || !player.ship) return 0;
    if (typeof player.ship.hiddenHoldCapacity === 'number') {
        return Math.max(0, Math.floor(player.ship.hiddenHoldCapacity));
    }
    const maxHolds = Math.max(0, Number(player.ship.maxHolds) || 0);
    const scannerBonus = Math.max(0, (Number(player.ship.scannerLevel) || 1) - 1);
    const guildBonus = getGuildTier('smugglers') * 2;
    return Math.max(4, Math.floor(maxHolds * BASE_HIDDEN_HOLD_FRACTION) + scannerBonus + guildBonus);
}

export function getHiddenHoldUsed() {
    return getContrabandManifest().bulk;
}

export function getAvailableHiddenHold() {
    return Math.max(0, getHiddenHoldCapacity() - getHiddenHoldUsed());
}

function typeWeightForPort(definition, port, mode) {
    const weights = mode === 'source' ? definition.sourceWeight : definition.demandWeight;
    if (!port || !weights) return 0;
    return weights[port.typeKey] || 0;
}

function buildTypeAvailability(definition, sectorId, port, sourceScore, demandScore) {
    const sourceWeight = typeWeightForPort(definition, port, 'source');
    const demandWeight = typeWeightForPort(definition, port, 'demand');
    const sourceQuantity = sourceWeight > 0 && sourceScore > 0
        ? Math.max(1, Math.floor((sourceScore * sourceWeight) / 18))
        : 0;
    const demandQuantity = demandWeight > 0 && demandScore > 0
        ? Math.max(1, Math.floor((demandScore * demandWeight) / 16))
        : 0;
    return {
        type: definition.id,
        name: definition.name,
        value: definition.value,
        heat: definition.heat,
        sourceQuantity,
        demandQuantity,
        canSource: sourceQuantity > 0,
        canReceive: demandQuantity > 0,
        sectorId
    };
}

export function getContrabandSectorProfile(sectorId = state.player && state.player.currentSector) {
    const numericSectorId = Number(sectorId);
    const port = Number.isFinite(numericSectorId) ? portAt(numericSectorId) : null;
    const vcInfluence = Number.isFinite(numericSectorId) ? sectorInfluence(numericSectorId, RECEIVER_FACTION_ID) : 0;
    const sdaInfluence = Number.isFinite(numericSectorId) ? sectorInfluence(numericSectorId, INSPECTOR_FACTION_ID) : 0;
    const pirateThreat = Number.isFinite(numericSectorId) ? sectorPirateThreat(numericSectorId) : 0;
    const region = Number.isFinite(numericSectorId) ? sectorRegion(numericSectorId) : null;
    const hasCartelReceiver = Boolean(port && port.hiddenFactionId === RECEIVER_FACTION_ID);
    const badlandsBonus = region === 'Badlands' ? 12 : 0;
    const sourceScore = Math.max(0, vcInfluence + pirateThreat * 7 + badlandsBonus + (hasCartelReceiver ? 25 : 0) - sdaInfluence * 0.25);
    const demandScore = Math.max(0, vcInfluence * 0.7 + pirateThreat * 5 + (hasCartelReceiver ? 35 : 0));
    const types = listContrabandTypes().map(definition => buildTypeAvailability(definition, numericSectorId, port, sourceScore, demandScore));
    return {
        sectorId: numericSectorId,
        port,
        region,
        vcInfluence,
        sdaInfluence,
        pirateThreat,
        sourceScore,
        demandScore,
        hasBlackMarketSource: types.some(item => item.canSource),
        hasCartelReceiver,
        availableTypes: types.filter(item => item.canSource),
        demandedTypes: types.filter(item => item.canReceive)
    };
}

export function getContrabandOpportunities(sectorId = state.player && state.player.currentSector) {
    const profile = getContrabandSectorProfile(sectorId);
    const hold = getContrabandHold();
    const manifest = getContrabandManifest(hold);
    return {
        profile,
        hold: hold.map(cloneContrabandLot),
        manifest,
        hiddenHoldCapacity: getHiddenHoldCapacity(),
        hiddenHoldUsed: manifest.bulk,
        hiddenHoldAvailable: getAvailableHiddenHold(),
        canDeliver: profile.hasCartelReceiver && manifest.units > 0,
        canAcquireAny: profile.hasBlackMarketSource && getAvailableHiddenHold() > 0
    };
}

export function canAcquireContraband(itemType, amount, sectorId = state.player && state.player.currentSector) {
    const definition = contrabandDefinition(itemType);
    const count = normaliseAmount(amount);
    const reasons = [];
    if (!getPlayer()) reasons.push('no_player');
    if (!definition) reasons.push('unknown_type');
    if (count <= 0) reasons.push('invalid_amount');

    const profile = getContrabandSectorProfile(sectorId);
    const availability = definition
        ? profile.availableTypes.find(item => item.type === definition.id)
        : null;
    if (!availability) reasons.push('no_black_market_source');
    else if (availability.sourceQuantity < count) reasons.push('insufficient_local_supply');

    const neededBulk = definition ? count * definition.bulk : count;
    if (getAvailableHiddenHold() < neededBulk) reasons.push('hidden_hold_full');

    return {
        ok: reasons.length === 0,
        reasons,
        profile,
        availability,
        neededBulk
    };
}

export function acquireContraband(itemType, amount) {
    const check = canAcquireContraband(itemType, amount);
    if (!check.ok) {
        log('No viable hidden-cargo pickup is available here.');
        return false;
    }
    const definition = contrabandDefinition(itemType);
    const count = normaliseAmount(amount);
    const hold = ensureContrabandHold();
    const acquiredSector = state.player.currentSector;
    const existing = hold.find(item => item.type === itemType && item.acquiredSector === acquiredSector);
    if (existing) existing.amount += count;
    else hold.push({ type: itemType, amount: count, acquiredSector });

    addFactionRep(RECEIVER_FACTION_ID, Math.max(1, Math.floor(count / 5)), 'contraband pickup', 'private');
    addFactionTrust(RECEIVER_FACTION_ID, 1, 'accepted hidden cargo');
    addFactionHeat(INSPECTOR_FACTION_ID, definition.heat, 'contraband pickup');
    addWorldEvent({
        type: 'contraband_acquired',
        sectorId: acquiredSector,
        factionId: RECEIVER_FACTION_ID,
        text: `Loaded ${count} ${definition.name} into the hidden hold.`,
        importance: 2,
        alert: true
    });
    return true;
}

export function getInspectionProfile(sectorId = state.player && state.player.currentSector) {
    const hold = getContrabandHold();
    const manifest = getContrabandManifest(hold);
    if (manifest.units === 0) {
        return { sectorId, manifest, detectionChance: 0, scannerMitigation: 0, localPressure: 0 };
    }
    const player = getPlayer();
    const scannerMitigation = Math.max(0, ((player && player.ship && player.ship.scannerLevel) || 1) - 1) * 0.04;
    const forgedMitigation = Math.min(0.12, (manifest.totalsByType.forged_manifests || 0) * CONTRABAND_TYPES.forged_manifests.inspectionMitigation);
    const sdaHeatPressure = getFactionHeat(INSPECTOR_FACTION_ID) * 0.0025;
    const sdaInfluencePressure = sectorInfluence(sectorId, INSPECTOR_FACTION_ID) * 0.0015;
    const pirateNoise = sectorPirateThreat(sectorId) * 0.01;
    const localPressure = sdaHeatPressure + sdaInfluencePressure - pirateNoise;
    const detectionChance = Math.min(0.85, Math.max(0.03, 0.08 + manifest.heat * 0.015 + localPressure - scannerMitigation - forgedMitigation));
    return {
        sectorId,
        manifest,
        detectionChance,
        scannerMitigation,
        forgedMitigation,
        localPressure
    };
}

export function runInspectionCheck() {
    const profile = getInspectionProfile();
    if (profile.manifest.units === 0) return false;
    if (random() >= profile.detectionChance) return false;

    const confiscated = profile.manifest.units;
    state.player.contrabandHold = [];
    addFactionHeat(INSPECTOR_FACTION_ID, Math.min(25, 5 + confiscated), 'contraband discovered');
    addFactionRep(RECEIVER_FACTION_ID, -Math.min(8, confiscated), 'lost a hidden shipment', 'private');
    addWorldEvent({
        type: 'contraband_bust',
        sectorId: state.player.currentSector,
        factionId: INSPECTOR_FACTION_ID,
        text: `SDA inspectors found and confiscated ${confiscated} contraband units.`,
        importance: 4,
        alert: true
    });
    return true;
}

export function canDeliverContraband(sectorId = state.player && state.player.currentSector) {
    const opportunities = getContrabandOpportunities(sectorId);
    const reasons = [];
    if (opportunities.manifest.units <= 0) reasons.push('empty_hidden_hold');
    if (!opportunities.profile.hasCartelReceiver) reasons.push('no_cartel_receiver');
    return { ok: reasons.length === 0, reasons, opportunities };
}

function routeRiskBonus(originSector, destinationSector) {
    const risk = getRouteRiskForSectors(originSector, destinationSector);
    if (risk === null) return 0;
    return Math.min(0.5, risk * 0.04);
}

function calculateDeliveryReward(hold, destinationSector, demandProfile) {
    let reward = 0;
    hold.forEach(item => {
        const definition = contrabandDefinition(item.type);
        if (!definition) return;
        const routeBonus = routeRiskBonus(item.acquiredSector || destinationSector, destinationSector);
        const demand = demandProfile.demandedTypes.find(type => type.type === item.type);
        const demandBonus = demand ? Math.min(0.3, demand.demandQuantity / 80) : 0;
        reward += item.amount * definition.value * (1 + routeBonus + demandBonus);
    });
    const relationshipBonus = Math.max(0, getPrivateFactionRep(RECEIVER_FACTION_ID)) / 2500;
    return Math.floor(reward * (1 + Math.min(0.12, relationshipBonus)));
}

export function deliverContraband(contactId) {
    const check = canDeliverContraband();
    if (!check.ok) {
        log('No trusted Cartel receiver is available in this sector.');
        return false;
    }
    const hold = getContrabandHold();
    const manifest = getContrabandManifest(hold);
    const profile = check.opportunities.profile;
    const reward = calculateDeliveryReward(hold, state.player.currentSector, profile);

    state.player.credits += reward;
    state.player.contrabandHold = [];
    addFactionRep(RECEIVER_FACTION_ID, Math.max(2, Math.floor(manifest.units / 3)), 'contraband delivered', 'private');
    addFactionTrust(RECEIVER_FACTION_ID, 2, 'completed a hidden delivery');
    addFactionHeat(INSPECTOR_FACTION_ID, Math.min(10, 1 + Math.floor(manifest.units / 4)), 'contraband delivery rumors');
    addWorldEvent({
        type: 'contraband_delivered',
        sectorId: state.player.currentSector,
        factionId: RECEIVER_FACTION_ID,
        text: `Delivered ${manifest.units} hidden units for ${contactId || 'a Cartel receiver'} and earned ${formatCredits(reward)} credits.`,
        importance: 3,
        alert: true
    });
    return reward;
}

export function getContrabandStatus(sectorId = state.player && state.player.currentSector) {
    const opportunities = getContrabandOpportunities(sectorId);
    const inspection = getInspectionProfile(sectorId);
    return {
        ...opportunities,
        inspection,
        riskLabel: clampRange(inspection.detectionChance * 100, 0, 100)
    };
}
