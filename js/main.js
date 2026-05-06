import { state } from './state.js';
import { EventBus } from './events.js';
import { Renderer, updateUI } from './ui/renderer.js';
import { createPlayer, generateUniverse, generateStars } from './core/universe.js';
import { registerDailyHook, registerHourlyHook, clearDailyHooks, clearHourlyHooks } from './core/time.js';
import { addWorldEvent } from './core/worldEvents.js';
import { produceColonies, updateColonyNeedsDaily } from './systems/colonies.js';
import { runTradeRoutesDaily } from './systems/tradeRoutes.js';
import { updatePortsDaily, updateThreatsDaily, updateFactionsDaily } from './systems/politics.js';
import { expireMissions, prepareMissionOpportunity } from './systems/missions.js';
import { updateCaptainsDaily, updateCaptainsHourly } from './systems/captains.js';
import { saveGame, loadGame } from './core/persistence.js';
import { restUntilMorning } from './systems/travel.js';
import { setupMapInteraction } from './ui/renderMap.js';
import { showScreen } from './ui/ui.js';
import { handleActionClick } from './ui/ui.js';
import { Notifications } from './ui/notifications.js';
import { generateFactionAsks } from './systems/guilds.js';
import { createCaptains } from './systems/captains.js';
import { generateMissionPool } from './systems/missions.js';

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
        initialized = true;

        // Register daily world tick
        registerDailyHook(reason => {
            produceColonies();
            runTradeRoutesDaily();
            updateColonyNeedsDaily();
            updatePortsDaily();
            updateThreatsDaily();
            updateFactionsDaily();
            expireMissions();
            updateCaptainsDaily(reason);
            addWorldEvent({
                type: 'daily_tick',
                text: `Day ${state.player.time.day} opened: colonies produced goods, markets shifted, captains acted, factions moved, and sector threats advanced.`,
                importance: 2,
                alert: false
            });
        });

        // Register hourly world tick
        registerHourlyHook(() => {
            updateCaptainsHourly();
            state.missions.filter(m => m.status === 'available').forEach(prepareMissionOpportunity);
            if (state.player.factions && Array.isArray(state.player.factions.intel)) {
                state.player.factions.intel = state.player.factions.intel.filter(
                    item => item.expiresDay >= state.player.time.day
                );
            }
        });

        // EventBus subscriptions — store unsubscribers for clean teardown
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

        // Initialise game world
        state.player = createPlayer();
        generateStars();
        generateUniverse();
        createCaptains();
        generateMissionPool();
        generateFactionAsks();
        state.selectedSectorId = state.player.currentSector;
        setupMapInteraction();

        // Bind persistent top-bar buttons (stored so dispose() can remove them)
        document.querySelectorAll('.topbar button').forEach(btn => {
            const fn = () => showScreen(btn.dataset.screen);
            btn.addEventListener('click', fn);
            _topbarListeners.push({ el: btn, fn });
        });
        const addBtn = (id, fn) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('click', fn);
            _topbarListeners.push({ el, fn });
        };
        addBtn('btn-rest', restUntilMorning);
        addBtn('btn-save', saveGame);
        addBtn('btn-load', loadGame);
        addBtn('btn-intel', () => showScreen('reputation'));

        // Single delegated handler for all data-action buttons
        document.body.addEventListener('click', handleActionClick);

        addWorldEvent({
            type: 'start',
            sectorId: state.player.currentSector,
            text: 'The frontier simulation started.',
            importance: 2,
            alert: false
        });
        Notifications.show('Welcome to the frontier', 2);
        updateUI();
    }

    function dispose() {
        clearDailyHooks();
        clearHourlyHooks();
        _unsubs.forEach(unsub => unsub());
        _unsubs = [];
        _topbarListeners.forEach(({ el, fn }) => el.removeEventListener('click', fn));
        _topbarListeners = [];
        document.body.removeEventListener('click', handleActionClick);
        initialized = false;
    }

    return { init, dispose };
})();

window.onload = App.init;
