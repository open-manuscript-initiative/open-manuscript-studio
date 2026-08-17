import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const overlayRoot = path.join(root, 'locale', 'completion-overlays');

const allowedLocales = new Set();
try {
  for (const entry of await fs.readdir(overlayRoot, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.json')) {
      allowedLocales.add(entry.name.slice(0, -'.json'.length));
    }
  }
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

const output = execFileSync(
  'git',
  ['diff', '--name-only', '--', 'src/i18n/locales'],
  { cwd: root, encoding: 'utf8' },
).trim();

const changed = output ? output.split(/\r?\n/).filter(Boolean) : [];
const unexpected = [];

for (const file of changed) {
  const match = /^src\/i18n\/locales\/([^/]+)\/studio\.json$/.exec(file);
  if (!match || !allowedLocales.has(match[1])) unexpected.push(file);
}

if (unexpected.length) {
  throw new Error(
    `Generated runtime locale files changed without a reviewed completion overlay:\n${unexpected.map((file) => `  ${file}`).join('\n')}`,
  );
}

if (changed.length) {
  console.log(`Accepted ${changed.length} generated runtime locale change(s) backed by reviewed completion overlays.`);
  for (const file of changed) console.log(`  ${file}`);
} else {
  console.log('Generated runtime locale files match the committed dictionaries.');
}
