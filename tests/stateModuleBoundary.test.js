import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
const STATE_MODULE_PATH = `${REPO_ROOT}js/state.js`;

function getStateModuleSource() {
    return readFileSync(STATE_MODULE_PATH, 'utf8');
}

describe('state module boundary', () => {
    it('keeps js/state.js focused on initialization and reset exports', () => {
        const source = getStateModuleSource();
        assert.equal(source.includes('export function createInitialState'), true);
        assert.equal(source.includes('export const state = createInitialState();'), true);
        assert.equal(source.includes('export function resetState()'), true);

        assert.equal(source.includes("export const APP_MODES = CORE_APP_MODES;"), true);
        assert.equal(source.includes("import { APP_MODES as CORE_APP_MODES } from './core/state/domains.js';"), true);
        assert.equal(source.includes('export function setAppMode'), true);
        assert.equal(source.includes('export function isValidAppMode'), true);
        assert.equal(source.includes('setCoreAppMode(mode);'), true);
    });
});
