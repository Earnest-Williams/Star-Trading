import { state, APP_MODES, setAppMode } from '../state.js';
import { EventBus } from '../events.js';
import { Renderer, updateUI } from '../ui/renderer.js';
import { centerMapOnSector, resetMapViewport, setupMapInteraction } from '../ui/renderMap.js';
import { applyCommandResult } from '../ui/ui.js';
import { executeAction } from '../core/commands.js';
import { createPlayerFromBuild, generateUniverse, generateStars } from '../core/universe.js';
import { initSessionRng } from '../utils.js';
import { createCaptains, normaliseCaptains } from '../systems/captains.js';
import { normaliseTradeRoutes } from '../systems/tradeRoutes.js';
import { generateMissionPool } from '../systems/missions.js';
import { generateFactionAsks } from '../systems/guilds.js';
import { registerSimulationTickHooks } from '../core/worldTick.js';
import { addWorldEvent } from '../core/worldEvents.js';
import { Notifications } from '../ui/notifications.js';
import { syncShellVisibility } from '../ui/renderShell.js';
import { UI_LABELS } from '../constants.js';

export function createGameSessionController() {
    let gameplayInitialized = false;
    let unsubs = [];
    let topbarListeners = [];
    let unsubscribeMapInteraction = () => {};

    function registerRendererSubscriptions() {
        unsubs.push(EventBus.on('time_advanced', payload => {
            const changedSlices = payload?.tickSummary?.changedSlices;
            if (Array.isArray(changedSlices) && changedSlices.length > 0) {
                Renderer.sliceChanged(...changedSlices);
            }
            Renderer.invalidate('priority');
            Renderer.invalidate('header');
        }));
        unsubs.push(EventBus.on('faction_changed', () => Renderer.invalidate('factions')));
        unsubs.push(EventBus.on('captains_changed', () => {
            Renderer.invalidate('map');
            Renderer.invalidate('sector');
        }));
        unsubs.push(EventBus.on('captain_changed', () => Renderer.invalidate('sector')));
        unsubs.push(EventBus.on('data_cargo_changed', () => {
            Renderer.invalidate('screen');
            Renderer.invalidate('sector');
            Renderer.invalidate('map');
            Renderer.invalidate('mapInspector');
            Renderer.invalidate('priority');
            Renderer.invalidate('factions');
        }));
    }

    function addTopbarListener(id, fn) {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('click', fn);
        topbarListeners.push({ el, fn });
    }

    function bindTopbarButtons() {
        unbindTopbarButtons();
        addTopbarListener('btn-rest', () => applyCommandResult(executeAction({ type: 'restUntilMorning' })));
        addTopbarListener('btn-save', () => applyCommandResult(executeAction({ type: 'saveGame' })));
        addTopbarListener('btn-load', () => applyCommandResult(executeAction({ type: 'loadGame' })));
        addTopbarListener('btn-intel', () => applyCommandResult(executeAction({ type: 'showScreen', args: ['reputation'] })));
        addTopbarListener('btn-center-map', () => centerMapOnSector());
    }

    function unbindTopbarButtons() {
        topbarListeners.forEach(({ el, fn }) => el.removeEventListener('click', fn));
        topbarListeners = [];
    }

    function bindGameplayDom() {
        unsubscribeMapInteraction = setupMapInteraction();
        bindTopbarButtons();
    }

    function ensureGameplayInitialized() {
        if (gameplayInitialized || !state.player) return;
        registerSimulationTickHooks();
        registerRendererSubscriptions();
        bindGameplayDom();
        gameplayInitialized = true;
    }

    function startSimulation(worldgenSettings = null, buildSpec) {
        state.worldgenSettings = worldgenSettings;
        state.player = createPlayerFromBuild(buildSpec);
        initSessionRng(state.player.seed);
        generateStars();
        generateUniverse();
        createCaptains();
        normaliseCaptains();
        normaliseTradeRoutes();
        generateMissionPool();
        generateFactionAsks();
        state.selectedSectorId = state.player.currentSector;
        resetMapViewport();
    }

    function launchNewGame({ buildSpec, worldgenSettings, resetApp, applyStoredUiPreferences }) {
        state.isTransitioning = true;
        resetApp();
        startSimulation(worldgenSettings, buildSpec);
        applyStoredUiPreferences();
        setAppMode(APP_MODES.IN_GAME);
        ensureGameplayInitialized();
        syncShellVisibility(state.appMode);
        state.isTransitioning = false;
        addWorldEvent({ type: 'start', sectorId: state.player.currentSector, text: UI_LABELS.simulationStarted, importance: 2, alert: false });
        Notifications.show(UI_LABELS.sessionWelcome, 2);
        updateUI();
        centerMapOnSector();
    }

    function afterSuccessfulLoad(applyStoredUiPreferences) {
        ensureGameplayInitialized();
        applyStoredUiPreferences();
        setAppMode(APP_MODES.IN_GAME);
        state.isTransitioning = false;
        syncShellVisibility(state.appMode);
        updateUI();
    }

    function teardownSession() {
        unsubs.forEach(unsub => unsub());
        unsubs = [];
        unbindTopbarButtons();
        unsubscribeMapInteraction();
        unsubscribeMapInteraction = () => {};
        gameplayInitialized = false;
    }

    return { ensureGameplayInitialized, launchNewGame, afterSuccessfulLoad, teardownSession };
}
