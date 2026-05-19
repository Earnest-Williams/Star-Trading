import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const manifest = JSON.parse(readFileSync(new URL('../docs/security/html-sinks.json', import.meta.url), 'utf8'));
const allowed = new Set(manifest.sinks.map((sink) => `${sink.path}:${sink.pattern}`));
const patterns = ['innerHTML', 'outerHTML', 'insertAdjacentHTML'];
const files = execSync('rg --files js -g "**/*.js"', { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
const issues = [];
for (const path of files) {
    const lines = readFileSync(path, 'utf8').split('\n');
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
