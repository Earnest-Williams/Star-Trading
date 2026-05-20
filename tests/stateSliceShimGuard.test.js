import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
const LEGACY_IMPORT_PATH = 'js/ui/stateSlices.js';

function listTrackedJsFiles() {
    return execFileSync('git', ['ls-files', 'js/**/*.js', 'tests/**/*.js'], {
        cwd: REPO_ROOT,
        encoding: 'utf8'
    }).trim().split('\n').filter(Boolean);
}

describe('state slice shim guard', () => {
    it('keeps internal code on js/core/state/index.js imports', () => {
        const offenders = [];
        const files = listTrackedJsFiles();

        files.forEach(file => {
            const filePath = `${REPO_ROOT}${file}`;
            if (!existsSync(filePath)) return;
            const contents = readFileSync(filePath, 'utf8');
            if (/['"](?:\.\.?\/)*(?:js\/)?ui\/stateSlices\.js['"]/.test(contents)) {
                offenders.push(file);
            }
        });

        assert.deepEqual(offenders, []);
    });
});
