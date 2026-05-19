import { execSync } from 'node:child_process';

const GUARDED_PATHS = new Set([
  'docs/SAVE_FORMAT.md',
  'docs/SYSTEMS.md',
  'docs/ARCHITECTURE.md',
  'docs/CONTRIBUTING.md'
]);

const GUARDED_PATTERNS = [
  'SAVE_STATE_FIELDS',
  'SAVE_VERSION',
  'PUBLIC_ACTIONS',
  'ACTION_REGISTRY',
  'WORLDGEN',
  'SITE_COUNT',
  'GALAXY'
];

function getChangedFiles(baseSha, headSha) {
  if (!baseSha || !headSha) {
    return [];
  }

  const output = execSync(`git diff --name-only "${baseSha}".."${headSha}"`, {
    encoding: 'utf8'
  });

  return output
    .split('\n')
    .map((file) => file.trim())
    .filter((file) => file.length > 0);
}

function fileTouchesGuardedContent(file) {
  if (!file.endsWith('.js')) {
    return false;
  }

  const diff = execSync(`git diff -U0 "${process.env.BASE_SHA}".."${process.env.HEAD_SHA}" -- "${file}"`, {
    encoding: 'utf8'
  });

  return GUARDED_PATTERNS.some((pattern) => diff.includes(pattern));
}

const baseSha = process.env.BASE_SHA;
const headSha = process.env.HEAD_SHA;

const changedFiles = getChangedFiles(baseSha, headSha);
const docsChanged = changedFiles.some((file) => GUARDED_PATHS.has(file));

const guardedCodeChanged = changedFiles.some((file) => fileTouchesGuardedContent(file));

if (guardedCodeChanged && !docsChanged) {
  console.error(
    'Docs drift check failed: guarded persistence/action/worldgen constants changed without docs updates.'
  );
  process.exit(1);
}

console.log('Docs drift check passed.');
