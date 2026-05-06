// js/systems/contraband.js
// Opinionated underlay for hidden freight: typed cargo, sector sourcing,
// receiver demand, inspection risk, and delivery settlement.

import { BALANCE } from '../constants.js';
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

export const CONTRABAND_TYPES = Object.freeze(BALANCE.CONTRABAND.TYPES);

function contrabandBalance() {
    return BALANCE.CONTRABAND;
}

function receiverFactionId() {
    return contrabandBalance().RECEIVER_FACTION_ID;
}

function inspectorFactionId() {
    return contrabandBalance().INSPECTOR_FACTION_ID;
}

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
        const parsedSector = Number.parseInt(item.acquiredSector, 10);
        const acquiredSector = (Number.isInteger(parsedSector) && parsedSector > 0)
            ? parsedSector
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
    const scannerBonus = Math.max(0, (Number(player.ship.scannerLevel) || 1) - 1)
        * contrabandBalance().SCANNER_HIDDEN_HOLD_BONUS;
    const guildBonus = getGuildTier('smugglers')
        * contrabandBalance().SMUGGLER_TIER_HIDDEN_HOLD_BONUS;
    return Math.max(
        contrabandBalance().MIN_HIDDEN_HOLD_CAPACITY,
        Math.floor(maxHolds * contrabandBalance().BASE_HIDDEN_HOLD_FRACTION)
            + scannerBonus
            + guildBonus
    );
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
        ? Math.max(1, Math.floor((sourceScore * sourceWeight) / contrabandBalance().SOURCE_QUANTITY_DIVISOR))
        : 0;
    const demandQuantity = demandWeight > 0 && demandScore > 0
        ? Math.max(1, Math.floor((demandScore * demandWeight) / contrabandBalance().DEMAND_QUANTITY_DIVISOR))
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
    const vcInfluence = Number.isFinite(numericSectorId) ? sectorInfluence(numericSectorId, receiverFactionId()) : 0;
    const sdaInfluence = Number.isFinite(numericSectorId) ? sectorInfluence(numericSectorId, inspectorFactionId()) : 0;
    const pirateThreat = Number.isFinite(numericSectorId) ? sectorPirateThreat(numericSectorId) : 0;
    const region = Number.isFinite(numericSectorId) ? sectorRegion(numericSectorId) : null;
    const hasCartelReceiver = Boolean(port && port.hiddenFactionId === receiverFactionId());
    const badlandsBonus = region === 'Badlands' ? contrabandBalance().BADLANDS_SOURCE_BONUS : 0;
    const receiverSourceBonus = hasCartelReceiver ? contrabandBalance().RECEIVER_SOURCE_BONUS : 0;
    const receiverDemandBonus = hasCartelReceiver ? contrabandBalance().RECEIVER_DEMAND_BONUS : 0;
    const sourceScore = Math.max(
        0,
        vcInfluence
            + pirateThreat * contrabandBalance().PIRATE_SOURCE_MULT
            + badlandsBonus
            + receiverSourceBonus
            - sdaInfluence * contrabandBalance().SDA_SOURCE_PRESSURE_MULT
    );
    const demandScore = Math.max(
        0,
        vcInfluence * contrabandBalance().VC_DEMAND_MULT
            + pirateThreat * contrabandBalance().PIRATE_DEMAND_MULT
            + receiverDemandBonus
    );
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

    addFactionRep(
        receiverFactionId(),
        Math.max(
            contrabandBalance().PICKUP_MIN_REP,
            Math.floor(count / contrabandBalance().PICKUP_REP_DIVISOR)
        ),
        'contraband pickup',
        'private'
    );
    addFactionTrust(receiverFactionId(), contrabandBalance().PICKUP_TRUST_GAIN, 'accepted hidden cargo');
    addFactionHeat(inspectorFactionId(), definition.heat, 'contraband pickup');
    addWorldEvent({
        type: 'contraband_acquired',
        sectorId: acquiredSector,
        factionId: receiverFactionId(),
        text: `Loaded ${count} ${definition.name} into the hidden hold.`,
        importance: contrabandBalance().ACQUIRED_EVENT_IMPORTANCE,
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
    const scannerMitigation = Math.max(0, ((player && player.ship && player.ship.scannerLevel) || 1) - 1)
        * contrabandBalance().INSPECTION_SCANNER_MITIGATION;
    const forgedMitigation = Math.min(
        contrabandBalance().INSPECTION_FORGED_MITIGATION_CAP,
        (manifest.totalsByType.forged_manifests || 0)
            * CONTRABAND_TYPES.forged_manifests.inspectionMitigation
    );
    const sdaHeatPressure = getFactionHeat(inspectorFactionId())
        * contrabandBalance().INSPECTION_FACTION_HEAT_PRESSURE;
    const sdaInfluencePressure = sectorInfluence(sectorId, inspectorFactionId())
        * contrabandBalance().INSPECTION_SDA_INFLUENCE_PRESSURE;
    const pirateNoise = sectorPirateThreat(sectorId) * contrabandBalance().INSPECTION_PIRATE_NOISE;
    const localPressure = sdaHeatPressure + sdaInfluencePressure - pirateNoise;
    const rawDetectionChance = contrabandBalance().INSPECTION_BASE_CHANCE
        + manifest.heat * contrabandBalance().INSPECTION_HEAT_MULT
        + localPressure
        - scannerMitigation
        - forgedMitigation;
    const detectionChance = Math.min(
        contrabandBalance().INSPECTION_MAX_CHANCE,
        Math.max(contrabandBalance().INSPECTION_MIN_CHANCE, rawDetectionChance)
    );
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
    addFactionHeat(
        inspectorFactionId(),
        Math.min(contrabandBalance().MAX_BUST_HEAT, contrabandBalance().BUST_BASE_HEAT + confiscated),
        'contraband discovered'
    );
    addFactionRep(
        receiverFactionId(),
        -Math.min(contrabandBalance().MAX_BUST_REP_LOSS, confiscated),
        'lost a hidden shipment',
        'private'
    );
    addWorldEvent({
        type: 'contraband_bust',
        sectorId: state.player.currentSector,
        factionId: inspectorFactionId(),
        text: `SDA inspectors found and confiscated ${confiscated} contraband units.`,
        importance: contrabandBalance().BUST_EVENT_IMPORTANCE,
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
    return Math.min(
        contrabandBalance().ROUTE_RISK_REWARD_CAP,
        risk * contrabandBalance().ROUTE_RISK_REWARD_MULT
    );
}

function calculateDeliveryReward(hold, destinationSector, demandProfile) {
    let reward = 0;
    hold.forEach(item => {
        const definition = contrabandDefinition(item.type);
        if (!definition) return;
        const routeBonus = routeRiskBonus(item.acquiredSector || destinationSector, destinationSector);
        const demand = demandProfile.demandedTypes.find(type => type.type === item.type);
        const demandBonus = demand
            ? Math.min(
                contrabandBalance().DEMAND_REWARD_CAP,
                demand.demandQuantity / contrabandBalance().DEMAND_REWARD_DIVISOR
            )
            : 0;
        reward += item.amount * definition.value * (1 + routeBonus + demandBonus);
    });
    const relationshipBonus = Math.max(0, getPrivateFactionRep(receiverFactionId()))
        / contrabandBalance().RELATIONSHIP_REWARD_DIVISOR;
    return Math.floor(
        reward * (1 + Math.min(contrabandBalance().RELATIONSHIP_REWARD_CAP, relationshipBonus))
    );
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
    addFactionRep(
        receiverFactionId(),
        Math.max(
            contrabandBalance().DELIVERY_MIN_REP,
            Math.floor(manifest.units / contrabandBalance().DELIVERY_REP_DIVISOR)
        ),
        'contraband delivered',
        'private'
    );
    addFactionTrust(receiverFactionId(), contrabandBalance().DELIVERY_TRUST_GAIN, 'completed a hidden delivery');
    addFactionHeat(
        inspectorFactionId(),
        Math.min(
            contrabandBalance().MAX_DELIVERY_HEAT,
            contrabandBalance().DELIVERY_BASE_HEAT
                + Math.floor(manifest.units / contrabandBalance().DELIVERY_HEAT_DIVISOR)
        ),
        'contraband delivery rumors'
    );
    addWorldEvent({
        type: 'contraband_delivered',
        sectorId: state.player.currentSector,
        factionId: receiverFactionId(),
        text: `Delivered ${manifest.units} hidden units for ${contactId || 'a Cartel receiver'} and earned ${formatCredits(reward)} credits.`,
        importance: contrabandBalance().DELIVERED_EVENT_IMPORTANCE,
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
