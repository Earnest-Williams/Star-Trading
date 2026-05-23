import { resetState, state } from './state.js';
import { APP_MODES, setAppMode } from './core/state/index.js';
import { EventBus } from './events.js';
import { resetTimeHooks } from './core/time.js';
import { setPersistenceAdapters, hasSavedGame, loadGame } from './core/persistence.js';
import { loadPreferences } from './core/preferences.js';
import { stopMapAnimation } from './ui/renderMap.js';
import { disposeUI, handleActionClick, initUI } from './ui/ui.js';
import { Notifications } from './ui/notifications.js';
import { setRandomPresetBuild, setRandomValidBuild, readChargenBuildFromDom, validateChargenDraft } from './ui/chargenState.js';
import { createShellController } from './ui/shellController.js';
import { createGameSessionController } from './app/gameSessionController.js';

export const App = (() => {
    let initialized = false;
    let shellListeners = [];
    const gameSession = createGameSessionController();
    let shellController;

    function getBrowserStorage() {
        try {
            return globalThis.localStorage || null;
        } catch (err) {
            console.warn('Browser storage unavailable:', err);
            return null;
        }
    }

    function readStoredPreferences() {
        return loadPreferences();
    }

    function applyStoredUiPreferences() {
        const prefs = readStoredPreferences();
        state.mapLayers = { ...state.mapLayers, ...prefs.mapLayers };
        state.mapLayersOpen = prefs.mapLayersOpen;
        state.mapInspectorCompact = prefs.mapInspectorCompact;
        const gameShell = document.getElementById('gameShell');
        if (!gameShell) return;
        gameShell.classList.toggle('layout-left-collapsed', prefs.leftSidebarCollapsed);
        gameShell.classList.toggle('layout-right-collapsed', prefs.rightSidebarCollapsed);
    }

    function resetAppForNewSession() {
        resetState();
        resetTimeHooks();
        gameSession.teardownSession();
        disposeUI();
        initUI();
    }

    function afterSuccessfulLoad() {
        gameSession.afterSuccessfulLoad(applyStoredUiPreferences);
    }

    function configurePersistence() {
        setPersistenceAdapters({
            storage: getBrowserStorage(),
            notifier: (message, priority) => Notifications.show(message, priority),
            afterLoad: afterSuccessfulLoad
        });
    }

    function launchNewGame() {
        if (state.isTransitioning) return;
        const buildSpec = readChargenBuildFromDom();
        const validation = validateChargenDraft();
        if (!validation.valid) {
            Notifications.show(validation.reason, 4);
            shellController.renderChargen();
            return;
        }
        gameSession.launchNewGame({
            buildSpec,
            worldgenSettings: shellController.readWorldgenSettingsFromDom(),
            resetApp: resetAppForNewSession,
            applyStoredUiPreferences
        });
    }

    function continueGame() {
        if (!hasSavedGame()) return;
        state.isTransitioning = true;
        const result = loadGame();
        if (result === false) {
            state.isTransitioning = false;
            shellController.enterMainMenu('Failed to load saved game.');
        }
    }

    function quickLoadGame() {
        state.isTransitioning = true;
        const result = loadGame();
        if (result === false) {
            state.isTransitioning = false;
            shellController.enterLoadGame();
        }
    }


    function bindShellDom() {
        const shellView = document.getElementById('shellView');
        if (shellView) {
            const clickFn = event => shellController.handleShellClick(event.target);
            const changeFn = event => shellController.handleShellChange(event);
            shellView.addEventListener('click', clickFn);
            shellView.addEventListener('change', changeFn);
            shellView.addEventListener('input', changeFn);
            shellListeners.push({ el: shellView, event: 'click', fn: clickFn });
            shellListeners.push({ el: shellView, event: 'change', fn: changeFn });
            shellListeners.push({ el: shellView, event: 'input', fn: changeFn });
        }
        document.body.addEventListener('click', handleActionClick);
        document.body.addEventListener('keydown', handleActionClick);
    }

    function init() {
        if (initialized) return;
        resetState();
        initialized = true;
        configurePersistence();
        applyStoredUiPreferences();
        initUI();
        shellController = createShellController({ continueGame, quickLoadGame, launchNewGame, setRandomPresetBuild, setRandomValidBuild });
        bindShellDom();
        shellController.enterMainMenu();
    }

    function dispose() {
        stopMapAnimation();
        resetTimeHooks();
        gameSession.teardownSession();
        EventBus.reset();
        shellListeners.forEach(({ el, event, fn }) => el.removeEventListener(event, fn));
        shellListeners = [];
        document.body.removeEventListener('click', handleActionClick);
        document.body.removeEventListener('keydown', handleActionClick);
        disposeUI();
        resetState();
        initialized = false;
        setAppMode(APP_MODES.MAIN_MENU);
    }

    return { init, dispose };
})();

window.onload = App.init;
