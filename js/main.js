import { state } from './state.js';
import { EventBus, Renderer, updateUI } from './events.js';
import { createPlayer, generateUniverse, generateStars } from './core/universe.js';
import { registerDailyHook, registerHourlyHook } from './core/time.js';
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
// DAILY WORLD TICK HOOKS
// Registered once; called by time.js on each new day.
// =====================================================
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

// =====================================================
// HOURLY WORLD TICK HOOKS
// Registered once; called by time.js on each new hour.
// =====================================================
registerHourlyHook(() => {
    updateCaptainsHourly();
    state.missions.filter(m => m.status === 'available').forEach(prepareMissionOpportunity);
    if (state.player.factions && Array.isArray(state.player.factions.intel)) {
        state.player.factions.intel = state.player.factions.intel.filter(
            item => item.expiresDay >= state.player.time.day
        );
    }
});

// =====================================================
// EVENTBUS SUBSCRIPTIONS
// Keep render keys invalidated when game state changes.
// =====================================================
EventBus.on('time_advanced', () => {
    Renderer.invalidate('priority');
    Renderer.invalidate('header');
});
EventBus.on('faction_changed', () => Renderer.invalidate('factions'));
EventBus.on('captains_changed', () => {
    Renderer.invalidate('map');
    Renderer.invalidate('sector');
});
EventBus.on('captain_changed', () => Renderer.invalidate('sector'));

// =====================================================
// GAME ENTRY POINT
// =====================================================
function startGame() {
    state.player = createPlayer();
    generateStars();
    generateUniverse();
    createCaptains();
    generateMissionPool();
    generateFactionAsks();
    state.selectedSectorId = state.player.currentSector;
    setupMapInteraction();

    // Persistent top-bar buttons
    document.querySelectorAll('.topbar button').forEach(btn => {
        btn.addEventListener('click', () => showScreen(btn.dataset.screen));
    });
    document.getElementById('btn-rest').addEventListener('click', restUntilMorning);
    document.getElementById('btn-save').addEventListener('click', saveGame);
    document.getElementById('btn-load').addEventListener('click', loadGame);
    document.getElementById('btn-intel').addEventListener('click', () => showScreen('reputation'));

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

window.onload = startGame;
