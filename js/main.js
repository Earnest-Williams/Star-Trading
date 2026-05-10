import { resetState, state, APP_MODES, setAppMode } from './state.js';
import { EventBus } from './events.js';
import { Renderer, updateUI } from './ui/renderer.js';
import { BALANCE } from './constants.js';
import { createPlayerFromBuild, generateUniverse, generateStars } from './core/universe.js';
import { resetTimeHooks } from './core/time.js';
import { addWorldEvent } from './core/worldEvents.js';
import { setPersistenceAdapters, getSavedGameSummary, hasSavedGame, importSavePayload, loadGame } from './core/persistence.js';
import { getDefaultPreferences, loadPreferences, normalisePreferences, savePreferences } from './core/preferences.js';
import { centerMapOnSector, resetMapViewport, setupMapInteraction, stopMapAnimation } from './ui/renderMap.js';
import { disposeUI, handleActionClick, initUI } from './ui/ui.js';
import { Notifications } from './ui/notifications.js';
import { generateFactionAsks } from './systems/guilds.js';
import { initSessionRng } from './utils.js';
import { createCaptains, normaliseCaptains } from './systems/captains.js';
import { generateMissionPool } from './systems/missions.js';
import { executeAction } from './core/commands.js';
import { registerSimulationTickHooks } from './core/worldTick.js';
import { normaliseTradeRoutes } from './systems/tradeRoutes.js';
import { ARCHETYPE_PRESETS } from './config/chargen.js';
import { renderChargenControls } from './ui/renderChargen.js';
import { getChargenBuild, readChargenBuildFromDom, setChargenBuild, setRandomPresetBuild, setRandomValidBuild, validateChargenDraft } from './ui/chargenState.js';
import { renderShell, syncShellVisibility } from './ui/renderShell.js';

// =====================================================
// APP BOOTSTRAP
// Wraps game initialisation so the sim can be reset,
// hot-reloaded, or torn down cleanly in tests.
// =====================================================
export const App = (() => {
    let initialized = false;
    let gameplayInitialized = false;
    let _unsubs = [];
    let _topbarListeners = [];
    let _shellListeners = [];
    let _unsubscribeMapInteraction = () => {};
    let preferences = null;
    let _shellPanel = 'main'; // 'main' | 'chargen' | 'load' | 'settings'

    function init() {
        if (initialized) return;
        resetState();
        initialized = true;
        configurePersistence();
        loadStoredPreferences();
        initUI();
        bindShellDom();
        enterMainMenu();
    }

    function configurePersistence() {
        setPersistenceAdapters({
            storage: globalThis.localStorage || null,
            notifier: (message, priority) => Notifications.show(message, priority),
            afterLoad: afterSuccessfulLoad
        });
    }

    function afterSuccessfulLoad() {
        ensureGameplayInitialized();
        setAppMode(APP_MODES.IN_GAME);
        state.isTransitioning = false;
        syncShellVisibility(state.appMode);
        updateUI();
    }

    function loadStoredPreferences() {
        preferences = loadPreferences();
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
        _unsubs.push(EventBus.on('data_cargo_changed', () => {
            Renderer.invalidate('screen');
            Renderer.invalidate('sector');
            Renderer.invalidate('map');
            Renderer.invalidate('mapInspector');
            Renderer.invalidate('priority');
            Renderer.invalidate('factions');
        }));
    }

    // =====================================================
    // WORLDGEN HELPERS
    // =====================================================
    function validNumberFromSelect(id, fallback, allowedValues = null) {
        const el = document.getElementById(id);
        if (!el) return fallback;
        const val = Number(el.value);
        if (!Number.isFinite(val)) return fallback;
        if (allowedValues && !allowedValues.includes(val)) return fallback;
        return val;
    }

    function readWorldgenSettingsFromDom() {
        const archetypeEl = document.getElementById("worldgen-archetype");
        const archetype = archetypeEl && Object.hasOwn(BALANCE.WORLDGEN.ARCHETYPES, archetypeEl.value)
            ? archetypeEl.value
            : BALANCE.WORLDGEN.DEFAULT_ARCHETYPE;
        const occupiedSites = validNumberFromSelect(
            "worldgen-sites",
            BALANCE.WORLDGEN.DEFAULT_OCCUPIED_SITES
        );
        const routeDensity = validNumberFromSelect(
            "worldgen-route-density",
            BALANCE.WORLDGEN.DEFAULT_ROUTE_DENSITY
        );
        const chartedFraction = validNumberFromSelect(
            "worldgen-known-space",
            BALANCE.WORLDGEN.DEFAULT_CHARTED_FRACTION
        );
        return { galaxyArchetype: archetype, occupiedSites, routeDensity, chartedFraction };
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
        resetMapViewport();
    }

    // =====================================================
    // SHELL TRANSITIONS
    // =====================================================
    function renderCurrentShell() {
        const allPanels = ['mainMenu', 'newGamePanel', 'loadGamePanel', 'settingsPanel'];
        allPanels.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.hidden = true;
        });
        const panelMap = {
            main: 'mainMenu',
            chargen: 'newGamePanel',
            load: 'loadGamePanel',
            settings: 'settingsPanel'
        };
        const activeId = panelMap[_shellPanel];
        const activeEl = activeId ? document.getElementById(activeId) : null;
        if (activeEl) activeEl.hidden = false;

        if (_shellPanel === 'chargen') renderChargen();
        if (_shellPanel === 'settings') populateSettingsFromPreferences();
    }

    function transitionTo(mode, message = null) {
        _shellPanel = mode;
        state.shellMessage = message;
        renderCurrentShell();
    }

    function enterMainMenu(message = null) {
        setAppMode(APP_MODES.MAIN_MENU);
        transitionTo('main', message);
    }

    function enterChargen() {
        transitionTo('chargen');
    }

    function enterLoadGame() {
        transitionTo('load');
    }

    function enterSettings() {
        setAppMode(APP_MODES.SETTINGS);
        transitionTo('settings');
    }

    // =====================================================
    // GAMEPLAY INITIALIZATION (lazy)
    // =====================================================
    function ensureGameplayInitialized() {
        if (gameplayInitialized) return;
        if (!state.player) return;
        registerSimulationTickHooks();
        registerRendererSubscriptions();
        bindGameplayDom();
        gameplayInitialized = true;
    }

    function bindGameplayDom() {
        _unsubscribeMapInteraction = setupMapInteraction();
        bindTopbarButtons();
    }

    // =====================================================
    // SHELL EVENT HANDLING
    // =====================================================
    function bindShellDom() {
        const shellView = document.getElementById('shellView');
        if (shellView) {
            const clickFn = event => handleShellClick(event.target);
            const changeFn = event => handleShellChange(event);
            shellView.addEventListener('click', clickFn);
            shellView.addEventListener('change', changeFn);
            shellView.addEventListener('input', changeFn);
            _shellListeners.push({ el: shellView, event: 'click', fn: clickFn });
            _shellListeners.push({ el: shellView, event: 'change', fn: changeFn });
            _shellListeners.push({ el: shellView, event: 'input', fn: changeFn });
        }
        document.addEventListener("contextmenu", suppressContextMenu);
        document.body.addEventListener('click', handleActionClick);
    }

    function handleShellClick(target) {
        if (!target) return;
        switch (target.id) {
            case 'btn-menu-new-game': enterChargen(); break;
            case 'btn-menu-continue': continueGame(); break;
            case 'btn-menu-load': enterLoadGame(); break;
            case 'btn-menu-settings': enterSettings(); break;
            case 'btn-chargen-back': enterMainMenu(); break;
            case 'btn-load-back': enterMainMenu(); break;
            case 'btn-settings-back': enterMainMenu(); break;
            case 'btn-chargen-start': launchNewGame(); break;
            case 'btn-random-preset': setRandomPresetBuild(); renderChargen(); break;
            case 'btn-random-valid-build': setRandomValidBuild(); renderChargen(); break;
            case 'btn-load-from-storage': quickLoadGame(); break;
            case 'btn-import-save': document.getElementById('import-save-file')?.click(); break;
            case 'btn-settings-save': saveSettingsFromDom(); enterMainMenu('Settings saved.'); break;
        }
    }

    function handleShellChange(event) {
        const target = event.target;
        if (!target) return;
        if (target.id === 'import-save-file') {
            importSaveFile(target);
            return;
        }
        if (!target.closest('#newGamePanel')) return;
        if (target.id === 'chargen-preset' && target.value && ARCHETYPE_PRESETS[target.value]) {
            setChargenBuild(ARCHETYPE_PRESETS[target.value].build);
        } else {
            readChargenBuildFromDom();
        }
        renderChargen();
    }

    // =====================================================
    // NEW GAME FLOW
    // =====================================================
    function launchNewGame() {
        if (state.isTransitioning) return;
        const buildSpec = readChargenBuildFromDom();
        const validation = validateChargenDraft();
        if (!validation.valid) {
            Notifications.show(validation.reason, 4);
            renderChargen();
            return;
        }
        const worldgenSettings = readWorldgenSettingsFromDom();
        state.isTransitioning = true;
        resetState();
        gameplayInitialized = false;
        resetTimeHooks();
        _unsubs.forEach(unsub => unsub());
        _unsubs = [];
        disposeUI();
        initUI();
        startSimulation(worldgenSettings, buildSpec);
        setAppMode(APP_MODES.IN_GAME);
        ensureGameplayInitialized();
        syncShellVisibility(state.appMode);
        state.isTransitioning = false;
        postStartupNotifications();
        updateUI();
        centerMapOnSector();
    }

    // =====================================================
    // CONTINUE / LOAD FLOWS
    // =====================================================
    function continueGame() {
        if (!hasSavedGame()) return;
        state.isTransitioning = true;
        const result = loadGame();
        if (result === false) {
            state.isTransitioning = false;
            enterMainMenu('Failed to load saved game.');
        }
        // On success, afterSuccessfulLoad handles the rest.
    }

    function quickLoadGame() {
        state.isTransitioning = true;
        const result = loadGame();
        if (result === false) {
            state.isTransitioning = false;
            enterLoadGame();
        }
        // On success, afterSuccessfulLoad handles the rest.
    }

    function importSaveFile(input) {
        if (!input || !input.files || !input.files[0]) return;
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = event => {
            state.isTransitioning = true;
            const result = importSavePayload(event.target.result);
            if (result === false) {
                state.isTransitioning = false;
            }
            // On success, afterSuccessfulLoad handles the rest.
            input.value = '';
        };
        reader.readAsText(file);
    }

    // =====================================================
    // SETTINGS FLOW
    // =====================================================
    function populateSettingsFromPreferences() {
        const prefs = preferences || getDefaultPreferences();
        const reducedMotion = document.getElementById('settings-reduced-motion');
        const compactUi = document.getElementById('settings-compact-ui');
        const showBootTips = document.getElementById('settings-show-boot-tips');
        const archetype = document.getElementById('settings-default-archetype');
        const sites = document.getElementById('settings-default-sites');
        if (reducedMotion) reducedMotion.checked = prefs.reducedMotion;
        if (compactUi) compactUi.checked = prefs.compactUi;
        if (showBootTips) showBootTips.checked = prefs.showBootTips;
        if (archetype) archetype.value = prefs.defaultWorldgenArchetype;
        if (sites) sites.value = String(prefs.defaultOccupiedSites);
    }

    function saveSettingsFromDom() {
        const reducedMotion = document.getElementById('settings-reduced-motion');
        const compactUi = document.getElementById('settings-compact-ui');
        const showBootTips = document.getElementById('settings-show-boot-tips');
        const archetype = document.getElementById('settings-default-archetype');
        const sites = document.getElementById('settings-default-sites');
        const prefs = preferences || getDefaultPreferences();
        const raw = {
            reducedMotion: reducedMotion ? reducedMotion.checked : prefs.reducedMotion,
            compactUi: compactUi ? compactUi.checked : prefs.compactUi,
            showBootTips: showBootTips ? showBootTips.checked : prefs.showBootTips,
            defaultWorldgenArchetype: archetype ? archetype.value : prefs.defaultWorldgenArchetype,
            defaultOccupiedSites: sites ? Number(sites.value) : prefs.defaultOccupiedSites
        };
        preferences = savePreferences(null, raw);
    }

    // =====================================================
    // TOPBAR BUTTONS (gameplay only, bound after game starts)
    // =====================================================
    function suppressContextMenu(event) {
        event.preventDefault();
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
        addTopbarListener('btn-center-map', () => centerMapOnSector());
    }

    function renderChargen() {
        const panel = document.getElementById('chargenPanel');
        if (panel) panel.innerHTML = renderChargenControls();
        const startButton = document.getElementById('btn-chargen-start');
        if (startButton) startButton.disabled = !validateChargenDraft().valid;
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
        stopMapAnimation();
        resetTimeHooks();
        _unsubs.forEach(unsub => unsub());
        _unsubs = [];
        EventBus.reset();
        _topbarListeners.forEach(({ el, fn }) => el.removeEventListener('click', fn));
        _topbarListeners = [];
        _shellListeners.forEach(({ el, event, fn }) => el.removeEventListener(event, fn));
        _shellListeners = [];
        _unsubscribeMapInteraction();
        _unsubscribeMapInteraction = () => {};
        document.removeEventListener("contextmenu", suppressContextMenu);
        document.body.removeEventListener('click', handleActionClick);
        disposeUI();
        resetState();
        gameplayInitialized = false;
        initialized = false;
    }

    return { init, dispose };
})();

window.onload = App.init;
