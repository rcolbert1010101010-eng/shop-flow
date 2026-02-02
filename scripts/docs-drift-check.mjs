import { execSync } from 'node:child_process';

const run = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();

const diff = run('git diff --name-only');
const staged = run('git diff --cached --name-only');

const changed = new Set(
  [diff, staged]
    .filter(Boolean)
    .flatMap((chunk) => chunk.split('\n'))
    .filter(Boolean)
);

if (changed.size === 0) {
  console.log('DOCS DRIFT PASS (no changes)');
  process.exit(0);
}

const affectsApp = Array.from(changed).some((file) =>
  file.startsWith('src/pages/') || file.startsWith('src/components/') || file.startsWith('src/stores/')
);

const docsRegistryTouched = changed.has('src/help/docsRegistry.ts');

if (affectsApp && !docsRegistryTouched) {
  console.error('DOCS DRIFT FAILED');
  console.error('Detected changes under src/pages, src/components, or src/stores without updating src/help/docsRegistry.ts.');
  console.error('Update updatedAt for the impacted module(s) in docsRegistry.');
  process.exit(1);
}

console.log('DOCS DRIFT PASS');
