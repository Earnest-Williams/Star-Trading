import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const manifest = JSON.parse(readFileSync(new URL('../docs/security/html-sinks.json', import.meta.url), 'utf8'));
const allowed = new Set(manifest.sinks.map((sink) => `${sink.path}:${sink.pattern}`));
const patterns = ['innerHTML', 'outerHTML', 'insertAdjacentHTML'];
const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const jsRoot = join(repoRoot, 'js');
const files = listJavaScriptFiles(jsRoot).map((file) => relative(repoRoot, file).replaceAll('\\', '/'));
const issues = [];
for (const path of files) {
    const lines = readFileSync(join(repoRoot, path), 'utf8').split('\n');
    lines.forEach((line, index) => {
        for (const pattern of patterns) {
            if (!line.includes(pattern)) continue;
            const key = `${path}:${pattern}`;
            if (!allowed.has(key)) issues.push(`${path}:${index + 1} uses ${pattern}`);
        }
    });
}
if (issues.length) {
    console.error('Unlisted HTML sinks found:\n' + issues.join('\n'));
    process.exit(1);
}

function listJavaScriptFiles(directory) {
    const files = [];
    const entries = readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...listJavaScriptFiles(fullPath));
            continue;
        }
        if (entry.isFile() && entry.name.endsWith('.js')) files.push(fullPath);
    }
    return files;
}
