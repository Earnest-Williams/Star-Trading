import { resetState, state } from './state.js';
import { EventBus } from './events.js';
import { Renderer, updateUI } from './ui/renderer.js';
import { createPlayer, generateUniverse, generateStars } from './core/universe.js';
import { clearDailyHooks, clearHourlyHooks } from './core/time.js';
import { addWorldEvent } from './core/worldEvents.js';
import { setPersistenceAdapters } from './core/persistence.js';
import { setupMapInteraction } from './ui/renderMap.js';
import { handleActionClick } from './ui/ui.js';
import { Notifications } from './ui/notifications.js';
import { generateFactionAsks } from './systems/guilds.js';
import { initSessionRng } from './utils.js';
import { createCaptains } from './systems/captains.js';
import { generateMissionPool } from './systems/missions.js';
import { executeAction } from './core/commands.js';
import { registerSimulationTickHooks } from './core/worldTick.js';

// =====================================================
// APP BOOTSTRAP
// Wraps game initialisation so the sim can be reset,
// hot-reloaded, or torn down cleanly in tests.
// =====================================================
export const App = (() => {
    let initialized = false;
    let _unsubs = [];
    let _topbarListeners = [];

    function init() {
        if (initialized) return;
        resetState();
        initialized = true;

        configurePersistence();
        registerSimulationTickHooks();
        registerRendererSubscriptions();
        startSimulation();
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

    function startSimulation() {
        state.player = createPlayer();
        initSessionRng(state.player.seed);
        generateStars();
        generateUniverse();
        createCaptains();
        generateMissionPool();
        generateFactionAsks();
        state.selectedSectorId = state.player.currentSector;
    }

    function bindAppShellDom() {
        setupMapInteraction();
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
        clearDailyHooks();
        clearHourlyHooks();
        _unsubs.forEach(unsub => unsub());
        _unsubs = [];
        _topbarListeners.forEach(({ el, fn }) => el.removeEventListener('click', fn));
        _topbarListeners = [];
        document.body.removeEventListener('click', handleActionClick);
        resetState();
        initialized = false;
    }

    return { init, dispose };
})();

window.onload = App.init;
