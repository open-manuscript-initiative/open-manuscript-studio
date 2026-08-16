import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { flattenStrings, parsePo, setAtPointer } from './po-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const jsonRoot = path.join(root, 'src', 'i18n', 'locales');
const poRoot = path.join(root, 'locale');
const referenceLocale = 'en';

const referenceFile = path.join(jsonRoot, referenceLocale, 'studio.json');
const reference = JSON.parse(await fs.readFile(referenceFile, 'utf8'));
const englishEntries = new Map(flattenStrings(reference));

const poDirs = [];
for (const entry of await fs.readdir(poRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const poFile = path.join(poRoot, entry.name, 'studio.po');
  try {
    await fs.access(poFile);
    poDirs.push(entry.name);
  } catch {
    // Non-locale working directories such as locale/pending are ignored.
  }
}
poDirs.sort();

if (!poDirs.includes(referenceLocale)) {
  throw new Error('English PO locale is required.');
}

for (const locale of poDirs) {
  const poFile = path.join(poRoot, locale, 'studio.po');
  const source = await fs.readFile(poFile, 'utf8');
  const entries = parsePo(source);
  const byPointer = new Map(entries.map((entry) => [entry.pointer, entry]));

  if (byPointer.size !== entries.length) {
    throw new Error(`${locale}: duplicate msgctxt translation keys found.`);
  }

  const missing = [...englishEntries.keys()].filter((key) => !byPointer.has(key));
  const extra = [...byPointer.keys()].filter((key) => !englishEntries.has(key));

  if (missing.length || extra.length) {
    throw new Error(
      `${locale}: PO key parity failed. Missing: ${missing.length}; extra: ${extra.length}.`,
    );
  }

  const output = structuredClone(reference);

  for (const [pointer, englishSource] of englishEntries) {
    const entry = byPointer.get(pointer);

    if (entry.source !== englishSource) {
      throw new Error(
        `${locale}: stale msgid at ${pointer}. Expected ${JSON.stringify(englishSource)}, got ${JSON.stringify(entry.source)}.`,
      );
    }

    if (entry.translation.trim().length === 0) {
      throw new Error(`${locale}: empty msgstr at ${pointer}.`);
    }

    setAtPointer(output, pointer, entry.translation);
  }

  const targetDir = path.join(jsonRoot, locale);
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(
    path.join(targetDir, 'studio.json'),
    `${JSON.stringify(output, null, 2)}\n`,
    'utf8',
  );

  console.log(`Compiled ${locale}: ${entries.length} PO entries -> studio.json`);
}

console.log(`Compiled ${poDirs.length} PO locales to runtime JSON.`);
