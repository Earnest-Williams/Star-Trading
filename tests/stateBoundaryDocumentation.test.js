import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
const DOC_PATH = `${REPO_ROOT}docs/state-boundary-exceptions.md`;

describe('state boundary documentation', () => {
    it('documents why direct js/state.js import exceptions exist', () => {
        assert.equal(existsSync(DOC_PATH), true, 'Expected boundary exception documentation file.');
        const source = readFileSync(DOC_PATH, 'utf8');
        assert.equal(source.includes('tests/stateImportGuard.test.js'), true);
        assert.equal(source.includes('tests/stateModuleBoundary.test.js'), true);
        assert.equal(source.includes('js/core/state/selectors.js'), true);
        assert.equal(source.includes('js/core/state/mutations.js'), true);
        assert.equal(source.includes('Transitional legacy runtime exceptions'), true);
    });
});
