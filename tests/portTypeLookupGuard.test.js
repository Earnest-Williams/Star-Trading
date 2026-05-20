import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../', import.meta.url));
const DIRECT_PORT_TYPE_LOOKUP = new RegExp(
    String.raw`PORT_TYPES\[[^\]\n]*(?:\bport\??\.typeKey\b|\bports\[[^\]]+\]\.typeKey\b)[^\]\n]*\]`,
    'g'
);
const ALLOWED_FILES = new Set(['js/core/ports.js']);

describe('port type lookup guard', () => {
    it('keeps legacy port type normalisation behind core/ports.js helpers', () => {
        const files = execFileSync('git', ['ls-files', 'js/**/*.js', 'tests/**/*.js'], {
            cwd: REPO_ROOT,
            encoding: 'utf8'
        }).trim().split('\n').filter(Boolean);
        const offenders = [];

        files.forEach(file => {
            if (ALLOWED_FILES.has(file)) return;
            const filePath = `${REPO_ROOT}${file}`;
            if (!existsSync(filePath)) return;
            const contents = readFileSync(filePath, 'utf8');
            const matches = contents.match(DIRECT_PORT_TYPE_LOOKUP) || [];
            matches.forEach(match => offenders.push(`${file}: ${match}`));
        });

        assert.deepEqual(offenders, []);
    });
});
