import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const assetsDirectory = new URL('../dist/assets/', import.meta.url);
const entries = await readdir(assetsDirectory, { withFileTypes: true });
const javascriptFiles = entries
  .filter((entry) => entry.isFile() && /\\.m?js$/i.test(entry.name))
  .map((entry) => entry.name);
const bundles = await Promise.all(
  javascriptFiles.map(async (file) => ({
    file,
    source: await readFile(join(assetsDirectory.pathname, file), 'utf8'),
  })),
);

const allSource = bundles.map(({ source }) => source).join('\\n');
assert.ok(
  allSource.includes('Kutatási modulok'),
  'Hungarian research module navigation must be present in emitted locale chunks.',
);
assert.ok(
  allSource.includes('Régészeti és kulturális örökségi munkaterület'),
  'Hungarian archaeology copy must be present in emitted locale chunks.',
);
assert.doesNotMatch(
  allSource,
  /import\\(["'][^"']*locales\\/hu\\/studio\\.json["']/,
  'Production bundles must not request source-tree JSON files directly.',
);

console.log(`Verified ${javascriptFiles.length} production JavaScript assets include Vite-bundled Hungarian dictionaries.`);
