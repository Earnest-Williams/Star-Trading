import { state, APP_MODES } from '../state.js';
import { Renderer, updateUI } from './renderer.js';
import { StateSlice, stateChanged } from './stateSlices.js';
import { BALANCE } from '../constants.js';
import { advanceTime } from '../core/time.js';
import { executeAction, registerAction, resetActions } from '../core/commands.js';

// Render subsystems
import {
    renderHeader, renderFactionPanel, renderAcceptedMissions,
    renderPriorityFeed, renderSectorActionMenu, injectLogisticsModule
} from './renderHUD.js';
import { renderSectorContents, renderMenuPanel, renderMapInspector } from './renderSector.js';
import { drawMap, selectSector } from './renderMap.js';
import { renderMarketPanel } from './renderMarket.js';
import { renderColonyPanel } from './renderColony.js';
import { renderShipyardPanel, buyUpgrade, repairShip, buyFighters } from './renderShipyard.js';
import { renderAllMissionScreen } from './renderMissions.js';
import { renderReputationScreen } from './renderReputation.js';
import { renderLogisticsScreen } from './renderLogistics.js';
import { renderCharacterSheet } from './renderCharacterSheet.js';
import { renderCommunicationsScreen } from './renderComms.js';
import { bindSpreadsheetScreen, renderSpreadsheetScreen } from './renderSpreadsheet.js';
import { renderShell, SHELL_RENDERER_DEPS } from './renderShell.js';

// Captain UI (needs dependency injection)
import {
    hailCaptain, offerHelpToCaptain, tradeRumorsWithCaptain,
    supportCaptainJob, buyOffCaptain, provokeCaptain, injectCaptainUIDeps,
    startRomanceWithCaptainAction, deepenRomanceWithCaptainAction
} from './renderCaptains.js';

// System actions
import { moveTo, restUntilMorning } from '../systems/travel.js';
import { surveySector, mineAsteroids } from '../systems/mining.js';
import { tradeCommodity } from '../systems/market.js';
import {
    foundColony, alignColony, setColonyPolicy,
    depositToColony, loadFromColony, buildColonyStructure
} from '../systems/colonies.js';
import { fightPirates } from '../systems/combat.js';
import {
    createTradeRoute, toggleTradeRoute, closeTradeRoute,
    assignCaptainToRoute, unassignRouteEscort, getLogisticsNode
} from '../systems/tradeRoutes.js';
import { acceptMission, completeMission } from '../systems/missions.js';
import { saveGame, loadGame } from '../core/persistence.js';
import {
    acceptFactionAsk, completeFactionAsk, sellIntel, joinGuild, promoteGuild
} from '../systems/guilds.js';
import { addFactionRep } from '../core/factions.js';
import { discardPrivatePayload, releasePrivatePayload, sellPrivatePayload } from '../core/dataCargo.js';
import {
    acceptSecureContract, completeSecurePayload, grantSecureCourierLicense
} from '../systems/secureCourier.js';
import { spendTime } from '../core/time.js';

// =====================================================
// ACTION DISPATCHER
// All data-action buttons are handled via event delegation, then
// passed through the domain command layer.
// =====================================================
function isStateSliceArray(value) {
    return Array.isArray(value)
        && value.every(item => typeof item === 'string');
}

export function handleActionClick(event) {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    const args = [];
    for (let i = 0; i < 5; i++) {
        if (target.dataset['arg' + i] !== undefined) args.push(target.dataset['arg' + i]);
    }
    try {
        const result = executeAction({ type: action, args });

        if (result === false) return;

        if (isStateSliceArray(result)) {
            Renderer.sliceChanged(...result);
            return;
        }

        updateUI();
    } catch (e) {
        console.error(`Action ${action} failed:`, e);
    }
}

// =====================================================
// SCREEN ROUTING
// =====================================================
const GAMEPLAY_SCREENS = new Set([
    'sector', 'market', 'colony', 'missions', 'logistics',
    'reputation', 'communications', 'spreadsheet', 'shipyard', 'character'
]);

export function showScreen(screen) {
    if (!GAMEPLAY_SCREENS.has(screen)) return false;
    if (state.appMode !== APP_MODES.IN_GAME || !state.player) return false;
    state.currentScreen = screen;
    if (screen === 'colony' && !state.planets[state.player.currentSector]) state.currentScreen = 'sector';
    if (screen === 'market' && !state.ports[state.player.currentSector]) state.currentScreen = 'sector';
    if (screen === 'shipyard' && state.player.currentSector !== state.world?.roles?.shipyardSiteId) state.currentScreen = 'sector';
    if (state.currentScreen !== 'reputation') state.selectedCaptainId = null;
    return stateChanged(StateSlice.CURRENT_SCREEN, StateSlice.SELECTED_CAPTAIN);
}

export function setReputationTab(tab) {
    state.reputationTab = tab;
    state.currentScreen = 'reputation';
    state.selectedCaptainId = null;
    return stateChanged(
        StateSlice.REPUTATION_TAB,
        StateSlice.CURRENT_SCREEN,
        StateSlice.SELECTED_CAPTAIN
    );
}

// =====================================================
// SCREEN-LEVEL RENDERERS (registered with Renderer)
// =====================================================
function renderTopTabs() {
    ['sector', 'market', 'colony', 'missions', 'logistics', 'reputation', 'communications', 'spreadsheet', 'shipyard', 'character'].forEach(screen => {
        const el = document.getElementById(`top-${screen}`);
        if (!el) return;
        if (screen === state.currentScreen) el.classList.add('active-tab');
        else el.classList.remove('active-tab');
    });
}

function renderCurrentScreen() {
    if (state.appMode !== APP_MODES.IN_GAME) return;
    if (!state.player) return;
    const { currentScreen, player, ports, planets } = state;
    const title = document.getElementById('screenTitle');
    if (!title) return;
    if (currentScreen === 'market' && ports[player.currentSector]) {
        title.innerHTML = `Market - Sector <span id="curSector">${player.currentSector}</span>`;
        renderMarketPanel();
        return;
    }
    if (currentScreen === 'colony' && planets[player.currentSector]) {
        title.innerHTML = `Colony - Sector <span id="curSector">${player.currentSector}</span>`;
        renderColonyPanel();
        return;
    }
    if (currentScreen === 'shipyard' && player.currentSector === state.world?.roles?.shipyardSiteId) {
        title.innerHTML = 'StarDock Shipyard';
        renderShipyardPanel();
        return;
    }
    if (currentScreen === 'missions') {
        title.innerHTML = 'Mission Board';
        document.getElementById('actions').innerHTML = renderAllMissionScreen();
        return;
    }
    if (currentScreen === 'reputation') {
        title.innerHTML = 'Network &amp; Intel';
        renderReputationScreen();
        return;
    }
    if (currentScreen === 'communications') {
        title.innerHTML = 'Communications Console';
        document.getElementById('actions').innerHTML = renderCommunicationsScreen();
        return;
    }
    if (currentScreen === 'spreadsheet') {
        title.innerHTML = 'Trade Ledger';
        document.getElementById('actions').innerHTML = renderSpreadsheetScreen();
        bindSpreadsheetScreen();
        return;
    }
    if (currentScreen === 'logistics') {
        title.innerHTML = 'Trade Routes &amp; Supply Chains';
        document.getElementById('actions').innerHTML = renderLogisticsScreen();
        return;
    }
    if (currentScreen === 'character') {
        title.innerHTML = 'Character Sheet';
        document.getElementById('actions').innerHTML = renderCharacterSheet();
        return;
    }
    state.currentScreen = 'sector';
    title.innerHTML = `Current Sector <span id="curSector">${player.currentSector}</span>`;
    document.getElementById('actions').innerHTML = renderSectorActionMenu();
}

// =====================================================
// REGISTER RENDERERS
// =====================================================
const rendererRegistrations = [
    ['shell', renderShell, SHELL_RENDERER_DEPS],

    ['header', renderHeader, [
        StateSlice.PLAYER,
        StateSlice.TIME,
        StateSlice.UNIVERSE
    ]],

    ['sector', renderSectorContents, [
        StateSlice.PLAYER,
        StateSlice.UNIVERSE,
        StateSlice.PORTS,
        StateSlice.PLANETS,
        StateSlice.TRADE_ROUTES,
        StateSlice.CAPTAINS,
        StateSlice.DATA_CARGO
    ]],

    ['screen', renderCurrentScreen, [
        StateSlice.CURRENT_SCREEN,
        StateSlice.PLAYER,
        StateSlice.PORTS,
        StateSlice.PLANETS,
        StateSlice.MISSIONS,
        StateSlice.FACTIONS,
        StateSlice.CAPTAINS,
        StateSlice.TRADE_ROUTES,
        StateSlice.DATA_CARGO,
        StateSlice.REPUTATION_TAB
    ]],

    ['menu', renderMenuPanel, [
        StateSlice.PLAYER,
        StateSlice.UNIVERSE,
        StateSlice.PORTS,
        StateSlice.PLANETS
    ]],

    ['acceptedMissions', renderAcceptedMissions, [
        StateSlice.MISSIONS
    ]],

    ['factions', renderFactionPanel, [
        StateSlice.PLAYER,
        StateSlice.FACTIONS,
        StateSlice.DATA_CARGO
    ]],

    ['map', drawMap, [
        StateSlice.PLAYER,
        StateSlice.UNIVERSE,
        StateSlice.PORTS,
        StateSlice.PLANETS,
        StateSlice.TRADE_ROUTES,
        StateSlice.CAPTAINS,
        StateSlice.SELECTED_SECTOR,
        StateSlice.MAP_VIEW,
        StateSlice.DATA_CARGO
    ]],

    ['mapInspector', renderMapInspector, [
        StateSlice.PLAYER,
        StateSlice.UNIVERSE,
        StateSlice.PORTS,
        StateSlice.PLANETS,
        StateSlice.TRADE_ROUTES,
        StateSlice.SELECTED_SECTOR
    ]],

    ['topTabs', renderTopTabs, [
        StateSlice.CURRENT_SCREEN
    ]],

    ['priority', renderPriorityFeed, [
        StateSlice.PLAYER,
        StateSlice.TIME,
        StateSlice.MISSIONS,
        StateSlice.PLANETS,
        StateSlice.TRADE_ROUTES,
        StateSlice.UNIVERSE,
        StateSlice.FACTIONS
    ]]
];
let rendererUnsubscribers = [];
let uiInitialized = false;

function registerUIRenderers() {
    if (rendererUnsubscribers.length > 0) return;
    rendererUnsubscribers = rendererRegistrations.map(([key, fn, deps]) =>
        Renderer.register(key, fn, deps)
    );
}

// =====================================================
// INJECT CROSS-MODULE DEPENDENCIES
// =====================================================
function injectUIDependencies() {
    injectLogisticsModule({ getLogisticsNode });
    injectCaptainUIDeps({ spendTime, addFactionRep });
}

// =====================================================
// REGISTER ACTIONS
// =====================================================
let actionsRegistered = false;

export function registerUIActions() {
    if (actionsRegistered) return;
    actionsRegistered = true;
    // Navigation & travel
    registerAction('moveTo', moveTo);
    registerAction('showScreen', showScreen);
    registerAction('showCommunications', () => showScreen('communications'));
    registerAction('selectSector', id => selectSector(parseInt(id, 10)));

    // Exploration
    registerAction('surveySector', surveySector);

    // Market
    registerAction('tradeCommodity', tradeCommodity);

    // Mining
    registerAction('mineAsteroids', mineAsteroids);

    // Colonies
    registerAction('foundColony', foundColony);
    registerAction('alignColony', alignColony);
    registerAction('setColonyPolicy', setColonyPolicy);
    registerAction('depositToColony', depositToColony);
    registerAction('loadFromColony', loadFromColony);
    registerAction('buildColonyStructure', buildColonyStructure);

    // Combat
    registerAction('fightPirates', fightPirates);

    // Trade routes
    registerAction('createTradeRoute', createTradeRoute);
    registerAction('toggleTradeRoute', toggleTradeRoute);
    registerAction('closeTradeRoute', closeTradeRoute);
    registerAction('assignCaptainToRoute', assignCaptainToRoute);
    registerAction('unassignRouteEscort', unassignRouteEscort);

    // Time
    registerAction('restUntilMorning', restUntilMorning);

    // Shipyard
    registerAction('buyUpgrade', buyUpgrade);
    registerAction('repairShip', repairShip);
    registerAction('buyFighters', buyFighters);

    // Missions
    registerAction('acceptMission', acceptMission);
    registerAction('completeMission', completeMission);
    registerAction('acceptSecureContract', acceptSecureContract);
    registerAction('completeSecurePayload', completeSecurePayload);
    registerAction('grantSecureCourierLicense', grantSecureCourierLicense);

    // Captains
    registerAction('hailCaptain', hailCaptain);
    registerAction('offerHelpToCaptain', offerHelpToCaptain);
    registerAction('tradeRumorsWithCaptain', tradeRumorsWithCaptain);
    registerAction('supportCaptainJob', supportCaptainJob);
    registerAction('buyOffCaptain', buyOffCaptain);
    registerAction('provokeCaptain', provokeCaptain);
    registerAction('startRomanceWithCaptain', startRomanceWithCaptainAction);
    registerAction('deepenRomanceWithCaptain', deepenRomanceWithCaptainAction);

    // Reputation
    registerAction('setReputationTab', setReputationTab);

    // Debug
    registerAction('debugAdvanceHours', hours => {
        advanceTime(parseInt(hours, 10) * 60, `debug simulation: ${hours} hours`);
        updateUI();
    });
    registerAction('debugAdvanceDays', days => {
        advanceTime(parseInt(days, 10) * BALANCE.DAY_MINUTES, `debug simulation: ${days} days`);
        updateUI();
    });

    // Factions / guilds / intel
    registerAction('acceptFactionAsk', acceptFactionAsk);
    registerAction('completeFactionAsk', completeFactionAsk);
    registerAction('sellIntel', sellIntel);
    registerAction('sellPrivatePayload', sellPrivatePayload);
    registerAction('releasePrivatePayload', releasePrivatePayload);
    registerAction('discardPrivatePayload', discardPrivatePayload);
    registerAction('joinGuild', joinGuild);
    registerAction('promoteGuild', promoteGuild);

    // Persistence
    registerAction('saveGame', saveGame);
    registerAction('loadGame', loadGame);
}

export function markUIActionsUnregistered() {
    actionsRegistered = false;
}

export function initUI() {
    if (uiInitialized) return;
    injectUIDependencies();
    registerUIRenderers();
    registerUIActions();
    uiInitialized = true;
}

export function disposeUI() {
    rendererUnsubscribers.forEach(unregister => unregister());
    rendererUnsubscribers = [];
    resetActions();
    actionsRegistered = false;
    uiInitialized = false;
}
