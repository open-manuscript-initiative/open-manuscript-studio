import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { flattenStrings, renderPo } from './po-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const jsonRoot = path.join(root, 'src', 'i18n', 'locales');
const poRoot = path.join(root, 'locale');
const referenceLocale = 'en';

async function readJson(locale) {
  const file = path.join(jsonRoot, locale, 'studio.json');
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

const dirs = (await fs.readdir(jsonRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (!dirs.includes(referenceLocale)) {
  throw new Error('English JSON locale is required.');
}

const englishEntries = new Map(flattenStrings(await readJson(referenceLocale)));

for (const locale of dirs) {
  const dictionary = await readJson(locale);
  const localizedEntries = new Map(flattenStrings(dictionary));

  const missing = [...englishEntries.keys()].filter((key) => !localizedEntries.has(key));
  const extra = [...localizedEntries.keys()].filter((key) => !englishEntries.has(key));

  if (missing.length || extra.length) {
    throw new Error(
      `${locale}: JSON key parity failed before PO export. Missing: ${missing.length}; extra: ${extra.length}.`,
    );
  }

  const entries = [...englishEntries.entries()].map(([pointer, source]) => ({
    pointer,
    source,
    translation: localizedEntries.get(pointer),
  }));

  const targetDir = path.join(poRoot, locale);
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(
    path.join(targetDir, 'studio.po'),
    renderPo({ locale, entries }),
    'utf8',
  );

  console.log(`Exported ${locale}: ${entries.length} PO entries`);
}

console.log(`Exported ${dirs.length} locales to ${path.relative(root, poRoot)}/<locale>/studio.po.`);
