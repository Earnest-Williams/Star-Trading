import { resetState, state } from './state.js';
import { EventBus } from './events.js';
import { Renderer, updateUI } from './ui/renderer.js';
import { BALANCE } from './constants.js';
import { createPlayerFromBuild, generateUniverse, generateStars } from './core/universe.js';
import { resetTimeHooks } from './core/time.js';
import { addWorldEvent } from './core/worldEvents.js';
import { setPersistenceAdapters } from './core/persistence.js';
import { setupMapInteraction } from './ui/renderMap.js';
import { disposeUI, handleActionClick, initUI } from './ui/ui.js';
import { Notifications } from './ui/notifications.js';
import { generateFactionAsks } from './systems/guilds.js';
import { initSessionRng } from './utils.js';
import { createCaptains, normaliseCaptains } from './systems/captains.js';
import { generateMissionPool } from './systems/missions.js';
import { executeAction } from './core/commands.js';
import { registerSimulationTickHooks } from './core/worldTick.js';
import { normaliseTradeRoutes } from './systems/tradeRoutes.js';
import { renderChargenControls } from './ui/renderChargen.js';
import { getChargenBuild, readChargenBuildFromDom, validateChargenDraft } from './ui/chargenState.js';

// =====================================================
// APP BOOTSTRAP
// Wraps game initialisation so the sim can be reset,
// hot-reloaded, or torn down cleanly in tests.
// =====================================================
export const App = (() => {
    let initialized = false;
    let _unsubs = [];
    let _topbarListeners = [];
    let _unsubscribeMapInteraction = () => {};

    function init() {
        if (initialized) return;
        resetState();
        initialized = true;

        configurePersistence();
        initUI();
        registerSimulationTickHooks();
        registerRendererSubscriptions();
        renderChargen();
        startSimulation(readWorldgenSettingsFromDom(), getChargenBuild());
        bindAppShellDom();
        postStartupNotifications();
        updateUI();
    }

    function configurePersistence() {
        setPersistenceAdapters({
            storage: globalThis.localStorage || null,
            notifier: (message, priority) => Notifications.show(message, priority),
            afterLoad: updateUI
        });
    }

    function registerRendererSubscriptions() {
        _unsubs.push(EventBus.on('time_advanced', () => {
            Renderer.invalidate('priority');
            Renderer.invalidate('header');
        }));
        _unsubs.push(EventBus.on('faction_changed', () => Renderer.invalidate('factions')));
        _unsubs.push(EventBus.on('captains_changed', () => {
            Renderer.invalidate('map');
            Renderer.invalidate('sector');
        }));
        _unsubs.push(EventBus.on('captain_changed', () => Renderer.invalidate('sector')));
    }

    function readWorldgenSettingsFromDom() {
        const archetype = document.getElementById("worldgen-archetype");
        const occupiedSites = document.getElementById("worldgen-sites");
        const routeDensity = document.getElementById("worldgen-route-density");
        const chartedFraction = document.getElementById("worldgen-known-space");
        return {
            galaxyArchetype: archetype ? archetype.value : BALANCE.WORLDGEN.DEFAULT_ARCHETYPE,
            occupiedSites: occupiedSites ? Number(occupiedSites.value) : BALANCE.WORLDGEN.DEFAULT_OCCUPIED_SITES,
            routeDensity: routeDensity ? Number(routeDensity.value) : BALANCE.WORLDGEN.DEFAULT_ROUTE_DENSITY,
            chartedFraction: chartedFraction ? Number(chartedFraction.value) : BALANCE.WORLDGEN.DEFAULT_CHARTED_FRACTION
        };
    }

    function startSimulation(worldgenSettings = null, buildSpec = getChargenBuild()) {
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
    }

    function bindAppShellDom() {
        _unsubscribeMapInteraction = setupMapInteraction();
        bindTopbarButtons();
        document.body.addEventListener('click', handleActionClick);
    }

    function bindTopbarButtons() {
        document.querySelectorAll('.topbar button').forEach(btn => {
            const fn = () => executeAction({ type: 'showScreen', args: [btn.dataset.screen] });
            btn.addEventListener('click', fn);
            _topbarListeners.push({ el: btn, fn });
        });
        addTopbarListener('btn-rest', () => {
            const result = executeAction({ type: 'restUntilMorning' });
            if (result !== false) updateUI();
        });
        addTopbarListener('btn-save', () => executeAction({ type: 'saveGame' }));
        addTopbarListener('btn-load', () => executeAction({ type: 'loadGame' }));
        addTopbarListener('btn-intel', () => executeAction({ type: 'showScreen', args: ['reputation'] }));
        addTopbarListener('btn-new-game', () => {
            const buildSpec = readChargenBuildFromDom();
            const validation = validateChargenDraft();
            if (!validation.valid) {
                Notifications.show(validation.reason, 4);
                renderChargen();
                return;
            }
            resetState();
            disposeUI();
            resetTimeHooks();
            initUI();
            registerSimulationTickHooks();
            startSimulation(readWorldgenSettingsFromDom(), buildSpec);
            updateUI();
        });
        ['chargenPanel'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', () => { readChargenBuildFromDom(); renderChargen(); });
            el.addEventListener('change', () => { readChargenBuildFromDom(); renderChargen(); });
        });
    }

    function renderChargen() {
        const panel = document.getElementById('chargenPanel');
        if (panel) panel.innerHTML = renderChargenControls();
    }

    function addTopbarListener(id, fn) {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('click', fn);
        _topbarListeners.push({ el, fn });
    }

    function postStartupNotifications() {
        addWorldEvent({
            type: 'start',
            sectorId: state.player.currentSector,
            text: 'The frontier simulation started.',
            importance: 2,
            alert: false
        });
        Notifications.show('Welcome to the frontier', 2);
    }

    function dispose() {
        resetTimeHooks();
        _unsubs.forEach(unsub => unsub());
        _unsubs = [];
        EventBus.reset();
        _topbarListeners.forEach(({ el, fn }) => el.removeEventListener('click', fn));
        _topbarListeners = [];
        _unsubscribeMapInteraction();
        _unsubscribeMapInteraction = () => {};
        document.body.removeEventListener('click', handleActionClick);
        disposeUI();
        resetState();
        initialized = false;
    }

    return { init, dispose };
})();

window.onload = App.init;
