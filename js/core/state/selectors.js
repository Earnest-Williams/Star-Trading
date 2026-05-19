// @ts-check
import { state } from '../../state.js';

const EMPTY_ARRAY = Object.freeze([]);
const EMPTY_OBJECT = Object.freeze({});

const isObject = value => Boolean(value) && typeof value === 'object';

export const getPlayer = () => state?.player || null;
export function requirePlayer() {
    const player = getPlayer();
    if (!player) throw new Error('Player state is required');
    return player;
}
export const getCurrentSectorId = () => getPlayer()?.currentSector ?? null;
export const getPlayerCargo = () => getPlayer()?.cargo || EMPTY_OBJECT;
export const getPlayerCredits = () => getPlayer()?.credits ?? null;
export const getPlayerCharacter = () => getPlayer()?.character || null;
export const getPlayerTime = () => getPlayer()?.time || null;

export const getSiteById = id => state?.universe?.[id] || state?.sitesById?.[id] || null;
export const getCurrentSite = () => getSiteById(getCurrentSectorId());
export const getCurrentPort = () => getPortBySector(getCurrentSectorId());
export const getCurrentPlanet = () => getPlanetBySector(getCurrentSectorId());
export const getRoleSiteId = role => state?.world?.roles?.[role] ?? null;
export const getJumpGatesForSite = id => getSiteById(id)?.jumpGates || EMPTY_ARRAY;
export const isKnownSite = id => Boolean(getSiteById(id));

export const getPortBySector = sectorId => state?.ports?.[sectorId] || null;
export const getPlanetBySector = sectorId => state?.planets?.[sectorId] || null;
export const getAmbientTradeState = () => (isObject(state?.ambientTrade) ? state.ambientTrade : EMPTY_OBJECT);
export const getDataCargoState = () => (isObject(state?.dataCargo) ? state.dataCargo : EMPTY_OBJECT);

export const getTradeRoutes = () => (Array.isArray(state?.tradeRoutes) ? state.tradeRoutes : EMPTY_ARRAY);
export const getRouteById = routeId => getTradeRoutes().find(route => route?.id === routeId) || null;
export const getActiveRoutes = () => getTradeRoutes().filter(route => route?.status !== 'closed');
export const getPlayerRoutes = () => getTradeRoutes().filter(route => (route?.ownerType || 'player') === 'player');
export const getRoutesForEndpoint = sectorId => getTradeRoutes().filter(route => route?.originSector === sectorId || route?.destinationSector === sectorId);

export const getCaptainById = id => state?.captains?.[id] || null;
export const getKnownCaptainById = id => {
    const captain = getCaptainById(id);
    return captain && captain.known ? captain : null;
};
export const getKnownCaptains = () => Object.values(state?.captains || EMPTY_OBJECT).filter(c => c?.known);
export const getActiveCaptains = () => Object.values(state?.captains || EMPTY_OBJECT).filter(c => c?.status === 'active');

export const getDialogueConversationById = id => (Array.isArray(state?.dialogueConversations) ? state.dialogueConversations.find(item => item?.id === id) : null) || null;
export const getSelectedDialogueConversation = () => getDialogueConversationById(state?.selectedDialogueConversationId ?? null);
export const getDialogueTables = () => ({
    memories: state?.dialogueMemories || EMPTY_ARRAY,
    proposals: state?.dialogueProposals || EMPTY_ARRAY,
    tasks: state?.dialogueTasks || EMPTY_ARRAY,
    offers: state?.dialogueOffers || EMPTY_ARRAY,
    messages: state?.dialogueMessages || EMPTY_ARRAY,
    conversationParts: state?.dialogueConversationParts || EMPTY_ARRAY,
    conversations: state?.dialogueConversations || EMPTY_ARRAY
});

export const getCurrentScreen = () => state?.currentScreen || null;
export const getSelectedSectorId = () => state?.selectedSectorId ?? null;
export const getMapViewport = () => state?.mapViewport || EMPTY_OBJECT;
export const getMapLayers = () => state?.mapLayers || EMPTY_OBJECT;
export const getAppMode = () => state?.appMode || null;
