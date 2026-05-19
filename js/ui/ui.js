import { state, APP_MODES } from '../state.js';
import { Renderer, updateUI } from './renderer.js';
import { StateSlice, stateChanged } from './stateSlices.js';
import { BALANCE, UI_LABELS } from '../constants.js';
import { advanceTime } from '../core/time.js';
import { commandFailed, commandOk, executeAction, registerAction, resetActions } from '../core/commands.js';
import { savePreferencePatch } from '../core/preferences.js';

// Render subsystems
import {
    renderHeader, renderFactionPanel, renderAcceptedMissions,
    renderPriorityFeed, renderSectorActionMenu, renderActionHotbar, injectLogisticsModule
} from './renderHUD.js';
import { renderSectorContents, renderSectorSummary, renderMenuPanel, renderMapInspector, toggleMapInspectorCompact } from './renderSector.js';
import { drawMap, selectSector, renderMapOverlay } from './renderMap.js';
import { renderMarketPanel } from './renderMarket.js';
import { renderColonyPanel } from './renderColony.js';
import { renderShipyardPanel, buyUpgrade, repairShip, buyFighters } from './renderShipyard.js';
import { renderAllMissionScreen } from './renderMissions.js';
import { renderReputationScreen } from './renderReputation.js';
import { renderLogisticsScreen } from './renderLogistics.js';
import { renderCharacterSheet } from './renderCharacterSheet.js';
import { renderPropertyScreen } from './renderProperty.js';
import { renderCommunicationsScreen } from './renderComms.js';
import { bindSpreadsheetScreen, renderSpreadsheetScreen } from './renderSpreadsheet.js';
import { renderShell, SHELL_RENDERER_DEPS } from './renderShell.js';
import { renderNextStepsPanel } from './onboarding.js';
import { dismissPriorityBriefing } from '../core/priorityBriefingActions.js';
import { Notifications } from './notifications.js';
import { acceptLogisticsObjective, abandonLogisticsObjective } from '../systems/logisticsObjectives.js';

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
import { applyPlayerPropertyAction } from '../systems/properties.js';
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
import {
    acceptDialogueOffer,
    askNpcToFindPart,
    checkBackWithNpc,
    markDialogueMessageRead,
    rejectDialogueOffer,
    requestContactService,
    startPersonalChat,
    deepenRelationship,
    touchDialogueConversation,
    DIALOGUE_CONVERSATION_STATUSES
} from '../systems/people.js';

// =====================================================
// ACTION DISPATCHER
// All data-action buttons are handled via event delegation, then
// passed through the domain command layer.
// =====================================================
export function handleActionClick(event) {
    if (event.type === 'keydown') {
        if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
        event.preventDefault();
    }
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    const args = [];
    for (let i = 0; i < 5; i++) {
        if (target.dataset['arg' + i] !== undefined) args.push(target.dataset['arg' + i]);
    }
    try {
        const result = executeAction({ type: action, args });
        if (!result.ok) {
            if (result.message) Notifications.show(result.message, 2);
            return;
        }
        if (result.slices.length > 0) {
            Renderer.sliceChanged(...result.slices);
            return;
        }
        if (result.invalidateAll) updateUI();
    } catch (e) {
        console.error(`Action ${action} failed:`, e);
    }
}

// =====================================================
// SCREEN ROUTING
// =====================================================
const GAMEPLAY_SCREENS = new Set([
    'sector', 'market', 'colony', 'missions', 'logistics',
    'reputation', 'communications', 'spreadsheet', 'shipyard', 'property', 'character'
]);

export function showScreen(screen) {
    if (!GAMEPLAY_SCREENS.has(screen)) return false;
    if (state.appMode !== APP_MODES.IN_GAME || !state.player) return false;

    if (screen === 'market' && !state.ports[state.player.currentSector]) {
        Notifications.show('No market is available in this sector.', 2);
        return false;
    }
    if (screen === 'colony' && !state.planets[state.player.currentSector]) {
        Notifications.show('No colony is available in this sector.', 2);
        return false;
    }
    if (screen === 'shipyard' && state.player.currentSector !== state.world?.roles?.shipyardSiteId) {
        Notifications.show('Shipyard access is only available at Stardock.', 2);
        return false;
    }

    state.currentScreen = screen;
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
    ['sector', 'market', 'colony', 'missions', 'logistics', 'reputation', 'communications', 'spreadsheet', 'shipyard', 'property', 'character'].forEach(screen => {
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
    const actions = document.getElementById('actions');
    if (!title) return;
    if (!actions) return;
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
        actions.innerHTML = renderAllMissionScreen();
        return;
    }
    if (currentScreen === 'reputation') {
        title.innerHTML = 'Network &amp; Intel';
        renderReputationScreen();
        return;
    }
    if (currentScreen === 'communications') {
        title.innerHTML = 'Communications Console';
        actions.innerHTML = renderCommunicationsScreen();
        return;
    }
    if (currentScreen === 'spreadsheet') {
        title.innerHTML = 'Trade Ledger';
        actions.innerHTML = renderSpreadsheetScreen();
        bindSpreadsheetScreen();
        return;
    }
    if (currentScreen === 'logistics') {
        title.innerHTML = 'Trade Routes &amp; Supply Chains';
        actions.innerHTML = renderLogisticsScreen();
        return;
    }
    if (currentScreen === 'property') {
        title.innerHTML = 'Property';
        actions.innerHTML = renderPropertyScreen();
        return;
    }
    if (currentScreen === 'character') {
        title.innerHTML = 'Character Sheet';
        actions.innerHTML = renderCharacterSheet();
        return;
    }
    state.currentScreen = 'sector';
    title.innerHTML = `Current Sector <span id="curSector">${player.currentSector}</span>`;
    actions.innerHTML = renderSectorActionMenu();
}

function applyScreenPanelMode() {
    const panel = document.querySelector('.screen-content-panel');
    const viewport = document.querySelector('.main-viewport');
    const summary = document.getElementById('screenSummary');
    const actions = document.getElementById('actions');
    const controls = document.getElementById('screenPanelControls');
    const railButton = panel?.querySelector('.screen-rail-toggle');
    if (!panel || !viewport || !summary || !actions) return;
    panel.classList.remove('screen-mode-full', 'screen-mode-summary', 'screen-mode-rail');
    viewport.classList.toggle('main-screen-summary', state.screenPanelMode === 'summary');
    viewport.classList.toggle('main-screen-rail', state.screenPanelMode === 'rail');
    panel.classList.add(`screen-mode-${state.screenPanelMode}`);
    summary.hidden = state.screenPanelMode !== 'summary';
    if (controls) controls.hidden = state.screenPanelMode === 'rail';
    if (railButton) railButton.hidden = state.screenPanelMode !== 'rail';
    if (state.screenPanelMode === 'summary') {
        renderSectorSummary();
    }
}

function bindScreenPanelControls() {
    const controls = document.getElementById('screenPanelControls');
    const screenPanel = document.querySelector('.screen-content-panel');
    if (!controls || !screenPanel) return () => {};
    const clickHandler = event => {
        const button = event.target.closest('[data-screen-panel-mode]');
        if (!button) return;
        state.screenPanelMode = button.dataset.screenPanelMode;
        applyScreenPanelMode();
    };
    controls.addEventListener('click', clickHandler);
    const railButton = document.createElement('button');
    railButton.className = 'screen-rail-toggle';
    railButton.type = 'button';
    railButton.textContent = UI_LABELS.screenRailToggle;
    railButton.hidden = true;
    const railClickHandler = () => {
        state.screenPanelMode = 'full';
        applyScreenPanelMode();
    };
    railButton.addEventListener('click', railClickHandler);
    screenPanel.appendChild(railButton);
    return () => {
        controls.removeEventListener('click', clickHandler);
        railButton.removeEventListener('click', railClickHandler);
        railButton.remove();
    };
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
        StateSlice.DATA_CARGO,
        StateSlice.DIALOGUE
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
        StateSlice.DIALOGUE,
        StateSlice.REPUTATION_TAB
    ]],

    ['actionHotbar', renderActionHotbar, [
        StateSlice.APP_MODE,
        StateSlice.CURRENT_SCREEN,
        StateSlice.PLAYER,
        StateSlice.UNIVERSE,
        StateSlice.PORTS,
        StateSlice.PLANETS,
        StateSlice.TRADE_ROUTES,
        StateSlice.SELECTED_SECTOR,
        StateSlice.MAP_VIEW
    ]],

    ['menu', renderMenuPanel, [
        StateSlice.PLAYER,
        StateSlice.UNIVERSE,
        StateSlice.PORTS,
        StateSlice.PLANETS,
        StateSlice.DIALOGUE
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

    ['mapOverlay', renderMapOverlay, [
        StateSlice.MAP_VIEW
    ]],

    ['mapInspector', renderMapInspector, [
        StateSlice.PLAYER,
        StateSlice.UNIVERSE,
        StateSlice.PORTS,
        StateSlice.PLANETS,
        StateSlice.TRADE_ROUTES,
        StateSlice.SELECTED_SECTOR,
        StateSlice.MAP_VIEW
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
    ]],

    ['nextSteps', renderNextStepsPanel, [
        StateSlice.PLAYER,
        StateSlice.UNIVERSE,
        StateSlice.PORTS,
        StateSlice.MISSIONS,
        StateSlice.TRADE_ROUTES,
        StateSlice.CURRENT_SCREEN,
        StateSlice.SELECTED_SECTOR,
        StateSlice.DATA_CARGO,
        StateSlice.DIALOGUE,
        StateSlice.FACTIONS,
        StateSlice.PRIORITY_BRIEFING
    ]]
];
let rendererUnsubscribers = [];
let uiDomUnsubscribers = [];
let uiInitialized = false;

function registerUIRenderers() {
    if (rendererUnsubscribers.length > 0) return;
    rendererUnsubscribers = rendererRegistrations.map(([key, fn, deps]) =>
        Renderer.register(key, fn, deps)
    );
}

function bindLayoutControls() {
    const gameShell = document.getElementById('gameShell');
    if (!gameShell) return () => {};

    const controls = [
        {
            id: 'btn-toggle-left-sidebar',
            className: 'layout-left-collapsed',
            expandedLabel: 'Collapse Captain',
            collapsedLabel: 'Expand Captain'
        },
        {
            id: 'btn-toggle-right-sidebar',
            className: 'layout-right-collapsed',
            expandedLabel: 'Collapse Navigation',
            collapsedLabel: 'Expand Navigation'
        }
    ];

    const syncControl = control => {
        const button = document.getElementById(control.id);
        if (!button) return;
        const collapsed = gameShell.classList.contains(control.className);
        button.textContent = collapsed ? control.collapsedLabel : control.expandedLabel;
        button.setAttribute('aria-expanded', String(!collapsed));
    };

    const unsubscribers = [];
    controls.forEach(control => {
        const button = document.getElementById(control.id);
        if (!button) return;

        syncControl(control);

        const clickHandler = event => {
            event.stopPropagation();
            gameShell.classList.toggle(control.className);
            syncControl(control);
            const collapsed = gameShell.classList.contains(control.className);
            const patch = control.id === 'btn-toggle-left-sidebar'
                ? { leftSidebarCollapsed: collapsed }
                : { rightSidebarCollapsed: collapsed };
            savePreferencePatch(null, patch);

            Renderer.invalidate('map');
        };
        button.addEventListener('click', clickHandler);
        unsubscribers.push(() => button.removeEventListener('click', clickHandler));
    });
    return () => {
        unsubscribers.forEach(unsubscribe => unsubscribe());
        controls.forEach(control => {
            const button = document.getElementById(control.id);
            if (button) delete button.dataset.layoutControlBound;
        });
    };
}

function bindCommandConsoleControls() {
    const clickHandler = event => {
        const accordionToggle = event.target.closest('[data-accordion-toggle]');
        if (accordionToggle) {
            event.preventDefault();
            const section = accordionToggle.closest('.accordion-section');
            const body = section?.querySelector('.accordion-body');
            if (!section || !body) return;
            const open = !section.classList.contains('is-open');
            section.classList.toggle('is-open', open);
            accordionToggle.setAttribute('aria-expanded', String(open));
            body.hidden = !open;
            return;
        }

        const contactToggle = event.target.closest('.contact-more-toggle');
        if (!contactToggle) return;
        event.preventDefault();
        const card = contactToggle.closest('.contact-card');
        const secondary = card?.querySelector('.contact-secondary-actions');
        if (!card || !secondary) return;
        const open = secondary.hidden;
        secondary.hidden = !open;
        contactToggle.setAttribute('aria-expanded', String(open));
        contactToggle.textContent = open ? UI_LABELS.contactLessToggle : UI_LABELS.contactMoreToggle;
    };
    document.addEventListener('click', clickHandler);
    return () => {
        document.removeEventListener('click', clickHandler);
        delete document.body.dataset.commandConsoleBound;
    };
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
    registerAction('moveTo', destinationId => moveTo(destinationId) ? commandOk(StateSlice.PLAYER, StateSlice.UNIVERSE, StateSlice.CURRENT_SCREEN, StateSlice.SELECTED_SECTOR) : commandFailed());
    registerAction('showScreen', screen => showScreen(screen) ? commandOk(StateSlice.CURRENT_SCREEN, StateSlice.SELECTED_CAPTAIN) : commandFailed());
    registerAction('showCommunications', () => showScreen('communications') ? commandOk(StateSlice.CURRENT_SCREEN, StateSlice.SELECTED_CAPTAIN) : commandFailed());
    registerAction('selectSector', id => selectSector(parseInt(id, 10)));
    registerAction('toggleMapInspectorCompact', toggleMapInspectorCompact);
    registerAction('dismissPriorityBriefing', dismissPriorityBriefing);

    // Exploration
    registerAction('surveySector', surveySector);

    // Market
    registerAction('tradeCommodity', (commodityId, mode) => tradeCommodity(commodityId, mode) ? commandOk(StateSlice.PLAYER, StateSlice.PORTS, StateSlice.CURRENT_SCREEN, StateSlice.PRIORITY_BRIEFING) : commandFailed());

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

    // Properties
    registerAction('propertyAction', (propertyId, actionId) => {
        const result = applyPlayerPropertyAction(propertyId, actionId);
        return result.ok ? commandOk(StateSlice.PLAYER, StateSlice.CURRENT_SCREEN) : commandFailed(result.reason || null);
    });

    // Trade routes
    registerAction('createTradeRoute', (...args) => createTradeRoute(...args) ? commandOk(StateSlice.TRADE_ROUTES, StateSlice.PLAYER, StateSlice.CURRENT_SCREEN) : commandFailed());
    registerAction('toggleTradeRoute', (...args) => toggleTradeRoute(...args) ? commandOk(StateSlice.TRADE_ROUTES, StateSlice.PLAYER, StateSlice.CURRENT_SCREEN) : commandFailed());
    registerAction('closeTradeRoute', (...args) => closeTradeRoute(...args) ? commandOk(StateSlice.TRADE_ROUTES, StateSlice.PLAYER, StateSlice.CURRENT_SCREEN) : commandFailed());
    registerAction('assignCaptainToRoute', (...args) => assignCaptainToRoute(...args) ? commandOk(StateSlice.TRADE_ROUTES, StateSlice.PLAYER, StateSlice.CURRENT_SCREEN) : commandFailed());
    registerAction('unassignRouteEscort', (...args) => unassignRouteEscort(...args) ? commandOk(StateSlice.TRADE_ROUTES, StateSlice.PLAYER, StateSlice.CURRENT_SCREEN) : commandFailed());
    registerAction('acceptLogisticsObjective', acceptLogisticsObjective);
    registerAction('abandonLogisticsObjective', abandonLogisticsObjective);

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
    registerAction('askNpcToFindPart', (personId, itemId) => {
        const result = askNpcToFindPart(personId, itemId);
        return result ? stateChanged(StateSlice.DIALOGUE, StateSlice.CURRENT_SCREEN) : false;
    });
    registerAction('checkBackWithNpc', (personId, itemId) => {
        const result = checkBackWithNpc(personId, itemId);
        return result ? stateChanged(StateSlice.DIALOGUE, StateSlice.CURRENT_SCREEN) : false;
    });
    registerAction('requestContactService', (personId, serviceType, value) => {
        const payload = {};
        if (serviceType === 'parts') payload.itemId = value || 'fujiwattit';
        if (serviceType === 'orders') payload.commodityId = value || 'eq';
        if (serviceType === 'permits') payload.permitType = value || 'local_access';
        if (serviceType === 'intel') payload.topic = value || 'local_activity';
        const result = requestContactService(personId, serviceType, payload);
        return result ? stateChanged(StateSlice.DIALOGUE, StateSlice.CURRENT_SCREEN) : false;
    });
    registerAction('startPersonalChat', personId => {
        const result = startPersonalChat(personId);
        if (!result.ok) return false;
        state.selectedDialogueConversationId = result.conversationId;
        return stateChanged(StateSlice.DIALOGUE, StateSlice.CURRENT_SCREEN);
    });
    registerAction('deepenRelationship', (personId, topicTag) => {
        const result = deepenRelationship(personId, topicTag);
        if (!result.ok) return false;
        state.selectedDialogueConversationId = result.conversationId;
        return stateChanged(StateSlice.DIALOGUE, StateSlice.CURRENT_SCREEN);
    });
    registerAction('markDialogueMessageRead', messageId => {
        const result = markDialogueMessageRead(parseInt(messageId, 10));
        return result ? stateChanged(StateSlice.DIALOGUE, StateSlice.CURRENT_SCREEN) : false;
    });
    registerAction('acceptDialogueOffer', offerId => {
        const result = acceptDialogueOffer(parseInt(offerId, 10));
        return result ? stateChanged(StateSlice.DIALOGUE, StateSlice.PLAYER, StateSlice.CURRENT_SCREEN) : false;
    });
    registerAction('rejectDialogueOffer', offerId => {
        const result = rejectDialogueOffer(parseInt(offerId, 10));
        return result ? stateChanged(StateSlice.DIALOGUE, StateSlice.CURRENT_SCREEN) : false;
    });
    registerAction('selectDialogueConversation', conversationId => {
        state.selectedDialogueConversationId = conversationId;
        return stateChanged(StateSlice.DIALOGUE, StateSlice.CURRENT_SCREEN);
    });
    registerAction('archiveDialogueConversation', conversationId => {
        const result = touchDialogueConversation(conversationId, { status: DIALOGUE_CONVERSATION_STATUSES.ARCHIVED });
        return result ? stateChanged(StateSlice.DIALOGUE, StateSlice.CURRENT_SCREEN) : false;
    });

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
    uiDomUnsubscribers.push(bindScreenPanelControls());
    applyScreenPanelMode();
    registerUIActions();
    uiDomUnsubscribers.push(bindLayoutControls());
    uiDomUnsubscribers.push(bindCommandConsoleControls());
    uiInitialized = true;
}

export function disposeUI() {
    rendererUnsubscribers.forEach(unregister => unregister());
    rendererUnsubscribers = [];
    uiDomUnsubscribers.forEach(unsubscribe => unsubscribe());
    uiDomUnsubscribers = [];
    if (typeof document !== 'undefined') {
        document.querySelectorAll('.screen-rail-toggle').forEach(button => button.remove());
    }
    resetActions();
    actionsRegistered = false;
    uiInitialized = false;
}
