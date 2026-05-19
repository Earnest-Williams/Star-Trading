import { SAVE_VERSION } from '../../constants.js';
import { apply as applyV06 } from './v06.js';
import { apply as applyV07 } from './v07.js';
import { apply as applyV08 } from './v08.js';
import { apply as applyV10 } from './v10.js';
import { apply as applyV14 } from './v14.js';
import { apply as applyV19 } from './v19.js';
import { isObject, migrateLegacyWarpAdjacencyToJumpGates, migrateShipTransitFields } from './helpers.js';

function normaliseRouteOwnership(data) {
    if (!Array.isArray(data.tradeRoutes)) data.tradeRoutes = [];
    data.tradeRoutes.forEach(route => {
        if (!isObject(route)) return;
        if (!route.ownerType) route.ownerType = 'player';
        if (typeof route.ownerId === 'undefined') route.ownerId = route.ownerType === 'player' ? null : route.ownerId;
        if (!route.operatorType) route.operatorType = route.ownerType;
        if (!route.createdBy) route.createdBy = route.ownerType;
    });
}

function ensureDefaults(data) {
    if (!data.ambientTrade || typeof data.ambientTrade !== 'object') data.ambientTrade = { day: 0, moved: { ore: 0, org: 0, eq: 0 }, flows: 0 };
    if (!data.dataCargo || typeof data.dataCargo !== 'object') {
        data.dataCargo = { sectorKnowledge: {}, playerHold: { publicSnapshots: {}, privatePayloads: [], securePayloads: [] }, secureContracts: [], ambientTransfers: [], nextPayloadId: 1, license: { secureCourier: false, issuedByFactionId: null, issuedDay: null } };
    }
}

export function runMigrations(data) {
    if (!isObject(data)) return data;
    const version = Number(data.version) || 0;
    if (version < 6) applyV06(data);
    if (version < 7) applyV07(data);
    if (version < 8) applyV08(data);
    if (version < 10) applyV10(data);
    if (version < 15) applyV14(data);
    if (version < 19) applyV19(data);

    migrateLegacyWarpAdjacencyToJumpGates(data.universe);
    normaliseRouteOwnership(data);
    migrateShipTransitFields(data.player);
    ensureDefaults(data);
    data.version = SAVE_VERSION;
    return data;
}
