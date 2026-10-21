import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parsePo } from './po-utils.mjs';
import { loadTranslationOverlay, resolveReviewedTranslation } from './translation-overlays.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const jsonRoot = path.join(root, 'src', 'i18n', 'locales');
const poRoot = path.join(root, 'locale');
const referenceLocale = 'en';
const primaryLocales = ['en', 'de', 'hu', 'fr', 'it', 'es', 'sk'];

function parseOptions(args) {
  const options = { all: false, locales: null };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--all') {
      options.all = true;
    } else if (arg === '--locales') {
      options.locales = (args[index + 1] ?? '').split(',').filter(Boolean);
      index += 1;
    } else if (arg.startsWith('--locales=')) {
      options.locales = arg.slice('--locales='.length).split(',').filter(Boolean);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (options.all && options.locales) {
    throw new Error('Use either --all or --locales, not both.');
  }
  return options;
}

function decodePointer(pointer) {
  if (!pointer.startsWith('/') || pointer === '/') {
    throw new Error(`Unsupported translation pointer: ${pointer}`);
  }
  return pointer
    .slice(1)
    .split('/')
    .map((token) => token.replace(/~1/g, '/').replace(/~0/g, '~'));
}

function setAtPointer(rootObject, pointer, value) {
  const tokens = decodePointer(pointer);
  let target = rootObject;

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const token = tokens[index];
    if (target[token] === undefined) {
      target[token] = /^\d+$/.test(tokens[index + 1]) ? [] : {};
    }
    if (typeof target[token] !== 'object' || target[token] === null) {
      throw new Error(`Translation path collides at ${pointer}.`);
    }
    target = target[token];
  }

  const finalToken = tokens.at(-1);
  if (finalToken === undefined) throw new Error(`Unsupported translation pointer: ${pointer}`);
  target[finalToken] = value;
}

const options = parseOptions(process.argv.slice(2));
const availableLocales = [];
for (const entry of await fs.readdir(poRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  try {
    await fs.access(path.join(poRoot, entry.name, 'studio.po'));
    availableLocales.push(entry.name);
  } catch {
    // Working directories such as locale/pending and completion-overlays are ignored.
  }
}
availableLocales.sort();

if (!availableLocales.includes(referenceLocale)) {
  throw new Error('English PO locale is required.');
}

const locales = options.all
  ? availableLocales
  : options.locales ?? primaryLocales;
const unknownLocales = locales.filter((locale) => !availableLocales.includes(locale));
if (unknownLocales.length) {
  throw new Error(`Missing PO catalogs: ${unknownLocales.join(', ')}.`);
}
if (!locales.includes(referenceLocale)) {
  throw new Error('Every compile set must include the English reference catalog.');
}

const englishEntries = parsePo(
  await fs.readFile(path.join(poRoot, referenceLocale, 'studio.po'), 'utf8'),
);
const englishByPointer = new Map(englishEntries.map((entry) => [entry.pointer, entry]));
if (englishByPointer.size !== englishEntries.length) {
  throw new Error('en: duplicate msgctxt translation keys found.');
}
if (englishEntries.some((entry) => entry.translation.trim().length === 0 || entry.source !== entry.translation)) {
  throw new Error('en: every English msgstr must match its msgid and be non-empty.');
}

for (const locale of locales) {
  const entries = locale === referenceLocale
    ? englishEntries
    : parsePo(await fs.readFile(path.join(poRoot, locale, 'studio.po'), 'utf8'));
  const byPointer = new Map(entries.map((entry) => [entry.pointer, entry]));
  const overlay = await loadTranslationOverlay(root, locale);

  if (byPointer.size !== entries.length) {
    throw new Error(`${locale}: duplicate msgctxt translation keys found.`);
  }

  const missing = [...englishByPointer.keys()].filter((key) => !byPointer.has(key));
  const extra = [...byPointer.keys()].filter((key) => !englishByPointer.has(key));
  if (missing.length || extra.length) {
    throw new Error(`${locale}: PO key parity failed. Missing: ${missing.length}; extra: ${extra.length}.`);
  }

  const output = {};
  let overlayApplied = 0;

  for (const [pointer, englishEntry] of englishByPointer) {
    const entry = byPointer.get(pointer);
    if (entry.source !== englishEntry.source) {
      throw new Error(`${locale}: stale msgid at ${pointer}. Expected ${JSON.stringify(englishEntry.source)}, got ${JSON.stringify(entry.source)}.`);
    }
    if (entry.translation.trim().length === 0) {
      throw new Error(`${locale}: empty msgstr at ${pointer}.`);
    }

    const resolved = resolveReviewedTranslation({
      locale,
      pointer,
      source: englishEntry.source,
      current: entry.translation,
      overlay,
    });
    if (resolved.reviewedByOverlay) overlayApplied += 1;
    setAtPointer(output, pointer, resolved.value);
  }

  const targetDir = path.join(jsonRoot, locale);
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(path.join(targetDir, 'studio.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`Compiled ${locale}: ${entries.length} PO entries -> studio.json (${overlayApplied} reviewed overlay values)`);
}

console.log(`Compiled ${locales.length} PO locale(s) to runtime JSON.`);
