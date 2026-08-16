import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parsePo } from './po-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const poRoot = path.join(root, 'locale');
const outRoot = path.join(root, 'locale', 'pending');
const policy = JSON.parse(await fs.readFile(path.join(poRoot, 'translation-status.json'), 'utf8'));
const terminology = JSON.parse(await fs.readFile(path.join(poRoot, 'terminology.json'), 'utf8'));
const referenceLocale = policy.referenceLocale ?? 'en';
const identicalAllowlist = new Set(policy.identicalAllowlist ?? []);
const onlyLocaleArg = process.argv.find((arg) => arg.startsWith('--locale='));
const onlyLocale = onlyLocaleArg?.slice('--locale='.length);

async function readEntries(locale) {
  const file = path.join(poRoot, locale, 'studio.po');
  return parsePo(await fs.readFile(file, 'utf8'));
}

const referenceEntries = await readEntries(referenceLocale);
const referenceByPointer = new Map(referenceEntries.map((entry) => [entry.pointer, entry]));
const localeDirs = (await fs.readdir(poRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && entry.name !== 'pending')
  .map((entry) => entry.name)
  .filter((locale) => locale !== referenceLocale)
  .filter((locale) => !onlyLocale || locale === onlyLocale)
  .sort();

if (onlyLocale && localeDirs.length === 0) {
  throw new Error(`Locale not found: ${onlyLocale}`);
}

await fs.mkdir(outRoot, { recursive: true });
let grandTotal = 0;

for (const locale of localeDirs) {
  const entries = await readEntries(locale);
  const pending = [];

  for (const entry of entries) {
    const reference = referenceByPointer.get(entry.pointer);
    if (!reference) continue;
    if (identicalAllowlist.has(entry.pointer)) continue;
    if (entry.translation !== reference.source) continue;

    pending.push({
      key: entry.pointer,
      source: reference.source,
      translation: '',
      protectedTerms: terminology.protectedTerms.filter((term) => reference.source.includes(term)),
    });
  }

  const payload = {
    locale,
    referenceLocale,
    generatedFrom: 'locale/<locale>/studio.po',
    pendingCount: pending.length,
    instructions: [
      'Translate only the translation field.',
      'Do not change key or source.',
      'Preserve protectedTerms verbatim unless the product terminology policy is explicitly changed.',
      'Do not remove placeholders, URLs, identifiers, file extensions, or standard names.',
    ],
    entries: pending,
  };

  await fs.writeFile(
    path.join(outRoot, `${locale}.json`),
    `${JSON.stringify(payload, null, 2)}\n`,
    'utf8',
  );

  grandTotal += pending.length;
  console.log(`Exported ${locale}: ${pending.length} pending translations`);
}

console.log(`Exported ${grandTotal} pending translations across ${localeDirs.length} locale(s).`);
