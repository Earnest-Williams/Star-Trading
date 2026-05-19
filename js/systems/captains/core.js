// @ts-check
/**
 * @module captains/core
 * @see {@link ../../../docs/ARCHITECTURE.md#module-captains}
 */
export {
    createCaptains,
    ensureCaptainRelation,
    normaliseCaptains,
    getCaptain,
    getKnownCaptains,
    getCaptainsInSector,
    captainDisplayName,
    getCaptainRelationshipLabel,
    addCaptainHistory,
    nudgeCaptainRelation,
    nudgeCaptainFaction,
    getCaptainGuildTier,
    getCaptainDominantFaction
} from './implementation.js';
