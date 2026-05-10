import { state, APP_MODES } from '../state.js';
import { getSavedGameSummary } from '../core/persistence.js';
import { StateSlice } from './stateSlices.js';

export function renderShell() {
    const shellView = document.getElementById('shellView');
    const gameShell = document.getElementById('gameShell');
    if (!shellView || !gameShell) return;

    const inGame = state.appMode === APP_MODES.IN_GAME;
    shellView.hidden = inGame;
    gameShell.hidden = !inGame;

    if (inGame) return;

    const btnContinue = document.getElementById('btn-continue');
    const continueInfo = document.getElementById('shellContinueInfo');
    if (!btnContinue) return;

    const summary = getSavedGameSummary();
    btnContinue.hidden = !summary;
    if (continueInfo) {
        continueInfo.textContent = summary
            ? `${summary.shipName || 'Unknown Ship'} \u00b7 Day ${summary.day} \u00b7 ${summary.credits.toLocaleString()} Cr`
            : '';
    }
}

export const SHELL_RENDERER_DEPS = [StateSlice.APP_MODE];
