import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const localesRoot = resolve('src/i18n/locales');
const referenceLocale = 'en';

function flatten(value, prefix = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`Expected translation object at ${prefix || '<root>'}.`);
  }

  const entries = [];

  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (typeof child === 'string') {
      entries.push([path, child]);
      continue;
    }

    entries.push(...flatten(child, path));
  }

  return entries;
}

async function loadLocale(locale) {
  const file = resolve(localesRoot, locale, 'studio.json');
  const source = await readFile(file, 'utf8');
  return JSON.parse(source);
}

const directoryEntries = await readdir(localesRoot, { withFileTypes: true });
const locales = directoryEntries
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (!locales.includes(referenceLocale)) {
  throw new Error(`Reference locale ${referenceLocale}/studio.json is missing.`);
}

const reference = await loadLocale(referenceLocale);
const referenceEntries = flatten(reference);
const referenceKeys = new Set(referenceEntries.map(([key]) => key));

for (const locale of locales) {
  const dictionary = await loadLocale(locale);
  const entries = flatten(dictionary);
  const keys = new Set(entries.map(([key]) => key));

  const missing = [...referenceKeys].filter((key) => !keys.has(key));
  const extra = [...keys].filter((key) => !referenceKeys.has(key));
  const empty = entries
    .filter(([, value]) => value.trim().length === 0)
    .map(([key]) => key);

  if (missing.length || extra.length || empty.length) {
    const details = [
      missing.length ? `missing: ${missing.join(', ')}` : '',
      extra.length ? `extra: ${extra.join(', ')}` : '',
      empty.length ? `empty: ${empty.join(', ')}` : '',
    ].filter(Boolean).join('\n');

    throw new Error(`Locale ${locale} failed validation:\n${details}`);
  }

  console.log(`Validated ${locale}: ${entries.length} keys`);
}

console.log(`Validated ${locales.length} JSON locales against ${referenceLocale}.`);
