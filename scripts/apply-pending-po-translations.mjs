import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parsePo, renderPo } from './po-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const poRoot = path.join(root, 'locale');
const pendingRoot = path.join(poRoot, 'pending');
const terminology = JSON.parse(await fs.readFile(path.join(poRoot, 'terminology.json'), 'utf8'));
const onlyLocaleArg = process.argv.find((arg) => arg.startsWith('--locale='));
const onlyLocale = onlyLocaleArg?.slice('--locale='.length);

const files = (await fs.readdir(pendingRoot, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
  .map((entry) => entry.name)
  .filter((name) => !onlyLocale || name === `${onlyLocale}.json`)
  .sort();

if (onlyLocale && files.length === 0) {
  throw new Error(`Pending translation file not found for locale: ${onlyLocale}`);
}

let appliedTotal = 0;

for (const fileName of files) {
  const pending = JSON.parse(await fs.readFile(path.join(pendingRoot, fileName), 'utf8'));
  const locale = pending.locale;
  const poFile = path.join(poRoot, locale, 'studio.po');
  const entries = parsePo(await fs.readFile(poFile, 'utf8'));
  const byPointer = new Map(entries.map((entry) => [entry.pointer, entry]));
  let applied = 0;

  for (const item of pending.entries ?? []) {
    if (typeof item.key !== 'string' || typeof item.source !== 'string' || typeof item.translation !== 'string') {
      throw new Error(`${locale}: malformed pending translation entry.`);
    }

    const entry = byPointer.get(item.key);
    if (!entry) throw new Error(`${locale}: unknown translation key ${item.key}.`);
    if (entry.source !== item.source) throw new Error(`${locale}: stale source for ${item.key}.`);
    if (item.translation.trim().length === 0) continue;

    for (const term of terminology.protectedTerms ?? []) {
      if (item.source.includes(term) && !item.translation.includes(term)) {
        throw new Error(`${locale}: protected term ${JSON.stringify(term)} missing from translation at ${item.key}.`);
      }
    }

    entry.translation = item.translation;
    applied += 1;
  }

  await fs.writeFile(poFile, renderPo({ locale, entries }), 'utf8');
  appliedTotal += applied;
  console.log(`Applied ${locale}: ${applied} translations`);
}

console.log(`Applied ${appliedTotal} translations across ${files.length} locale(s).`);
