import { APP_MODES, setAppMode, state } from '../state.js';
import { BALANCE } from '../config/economy.js';
import { UI_LABELS } from '../config/entities.js';
import { ARCHETYPE_PRESETS } from '../config/chargen.js';
import { renderChargenControls } from './renderChargen.js';
import { renderShell } from './renderShell.js';
import { Notifications } from './notifications.js';
import { SAVE_IMPORT_LIMITS, importSavePayload } from '../core/persistence.js';
import { loadPreferences, saveSettingsPreferences } from '../core/preferences.js';
import {
    readChargenBuildFromDom,
    setChargenBuild,
    validateChargenDraft
} from './chargenState.js';

export function createShellController(deps) {
    let shellPanel = 'main';

    function renderChargen() {
        const panel = document.getElementById('chargenPanel');
        if (panel) panel.innerHTML = renderChargenControls();
        const startButton = document.getElementById('btn-chargen-start');
        if (startButton) startButton.disabled = !validateChargenDraft().valid;
    }

    function readStoredPreferences() {
        return loadPreferences();
    }

    function applyPreferencesToWorldgenControls() {
        const prefs = readStoredPreferences();
        const archetype = document.getElementById('worldgen-archetype');
        const sites = document.getElementById('worldgen-sites');
        if (archetype) archetype.value = prefs.defaultWorldgenArchetype;
        if (sites && BALANCE.WORLDGEN.SITE_COUNT_PRESETS.includes(prefs.defaultOccupiedSites)) {
            sites.value = String(prefs.defaultOccupiedSites);
        }
    }

    function populateSettingsFromPreferences() {
        const prefs = readStoredPreferences();
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
        const prefs = readStoredPreferences();
        const raw = {
            reducedMotion: reducedMotion ? reducedMotion.checked : prefs.reducedMotion,
            compactUi: compactUi ? compactUi.checked : prefs.compactUi,
            showBootTips: showBootTips ? showBootTips.checked : prefs.showBootTips,
            defaultWorldgenArchetype: archetype ? archetype.value : prefs.defaultWorldgenArchetype,
            defaultOccupiedSites: sites ? Number(sites.value) : prefs.defaultOccupiedSites
        };
        saveSettingsPreferences(null, raw);
    }

    function renderCurrentShell() {
        ['mainMenu', 'newGamePanel', 'loadGamePanel', 'settingsPanel'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.hidden = true;
        });
        const panelMap = { main: 'mainMenu', chargen: 'newGamePanel', load: 'loadGamePanel', settings: 'settingsPanel' };
        const activeId = panelMap[shellPanel];
        const activeEl = activeId ? document.getElementById(activeId) : null;
        if (activeEl) activeEl.hidden = false;
        if (shellPanel === 'chargen') renderChargen();
        if (shellPanel === 'settings') populateSettingsFromPreferences();
        renderShell();
    }

    function transitionTo(mode, message = null) {
        shellPanel = mode;
        state.shellMessage = message;
        renderCurrentShell();
    }

    function enterMainMenu(message = null) {
        setAppMode(APP_MODES.MAIN_MENU);
        transitionTo('main', message);
    }

    function enterChargen() {
        applyPreferencesToWorldgenControls();
        transitionTo('chargen');
    }

    function enterLoadGame() {
        transitionTo('load');
    }

    function enterSettings() {
        setAppMode(APP_MODES.SETTINGS);
        transitionTo('settings');
    }

    function randomiseChargen(randomiseFn) {
        try {
            randomiseFn();
        } catch (err) {
            console.error('Chargen randomisation failed:', err);
            Notifications.show(UI_LABELS.randomBuildUnavailable, 4);
        }
        renderChargen();
    }

    function importSaveFile(input) {
        if (!input || !input.files || !input.files[0]) return;
        const file = input.files[0];
        const maxBytes = SAVE_IMPORT_LIMITS.maxChars;
        const isJsonName = typeof file.name === 'string' && file.name.toLowerCase().endsWith('.json');
        const mime = typeof file.type === 'string' ? file.type.toLowerCase() : '';
        const isJsonMime = mime === 'application/json' || mime === 'text/json' || mime === '';
        if (file.size > maxBytes || !isJsonName || !isJsonMime) {
            state.isTransitioning = false;
            input.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onerror = () => {
            state.isTransitioning = false;
            input.value = '';
        };
        reader.onload = event => {
            state.isTransitioning = true;
            try {
                const text = typeof event.target?.result === 'string' ? event.target.result : '';
                const result = importSavePayload(text);
                if (result === false) state.isTransitioning = false;
            } catch (error) {
                console.error(UI_LABELS.importFailed + ':', error);
                state.isTransitioning = false;
            }
            input.value = '';
        };
        try {
            reader.readAsText(file);
        } catch (error) {
            console.error(UI_LABELS.importReadFailed + ':', error);
            state.isTransitioning = false;
            input.value = '';
        }
    }

    function handleShellClick(target) {
        if (!target) return;
        switch (target.id) {
            case 'btn-menu-new-game': enterChargen(); break;
            case 'btn-menu-continue': deps.continueGame(); break;
            case 'btn-menu-load': enterLoadGame(); break;
            case 'btn-menu-settings': enterSettings(); break;
            case 'btn-chargen-back': enterMainMenu(); break;
            case 'btn-load-back': enterMainMenu(); break;
            case 'btn-settings-back': enterMainMenu(); break;
            case 'btn-chargen-start': deps.launchNewGame(); break;
            case 'btn-random-preset': randomiseChargen(deps.setRandomPresetBuild); break;
            case 'btn-random-valid-build': randomiseChargen(deps.setRandomValidBuild); break;
            case 'btn-load-from-storage': deps.quickLoadGame(); break;
            case 'btn-import-save': document.getElementById('import-save-file')?.click(); break;
            case 'btn-settings-save': saveSettingsFromDom(); enterMainMenu(UI_LABELS.settingsSaved); break;
        }
    }

    function handleShellChange(event) {
        const target = event.target;
        if (!target) return;
        if (target.id === 'import-save-file') return importSaveFile(target);
        if (!target.closest('#newGamePanel')) return;
        if (target.id === 'chargen-preset' && target.value && ARCHETYPE_PRESETS[target.value]) {
            setChargenBuild(ARCHETYPE_PRESETS[target.value].build);
        } else {
            readChargenBuildFromDom();
        }
        renderChargen();
    }

    function readWorldgenSettingsFromDom() {
        const validNumberFromSelect = (id, fallback, allowedValues = null) => {
            const el = document.getElementById(id);
            if (!el) return fallback;
            const val = Number(el.value);
            if (!Number.isFinite(val)) return fallback;
            if (allowedValues && !allowedValues.includes(val)) return fallback;
            return val;
        };
        const archetypeEl = document.getElementById('worldgen-archetype');
        const archetype = archetypeEl && Object.hasOwn(BALANCE.WORLDGEN.ARCHETYPES, archetypeEl.value)
            ? archetypeEl.value
            : BALANCE.WORLDGEN.DEFAULT_ARCHETYPE;
        const occupiedSites = validNumberFromSelect('worldgen-sites', BALANCE.WORLDGEN.DEFAULT_OCCUPIED_SITES, BALANCE.WORLDGEN.SITE_COUNT_PRESETS);
        const routeDensity = validNumberFromSelect('worldgen-route-density', BALANCE.WORLDGEN.DEFAULT_ROUTE_DENSITY);
        const chartedFraction = validNumberFromSelect('worldgen-known-space', BALANCE.WORLDGEN.DEFAULT_CHARTED_FRACTION);
        return { galaxyArchetype: archetype, occupiedSites, routeDensity, chartedFraction };
    }

    return {
        enterMainMenu,
        enterLoadGame,
        handleShellClick,
        handleShellChange,
        readWorldgenSettingsFromDom,
        renderChargen
    };
}
