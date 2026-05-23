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

        assert.equal(source.includes('export function setAppMode'), false);
        assert.equal(source.includes('export function isValidAppMode'), false);
        assert.equal(source.includes('export const APP_MODES'), false);
    });
});
