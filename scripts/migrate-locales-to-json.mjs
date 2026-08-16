import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { en } from '../src/i18n/locales/en.ts';
import { hu } from '../src/i18n/locales/hu.ts';
import { de } from '../src/i18n/locales/de.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const localesRoot = resolve(root, 'src/i18n/locales');

const dictionaries = { en, hu, de };

function leafKeys(value, prefix = '') {
  if (typeof value === 'string') {
    return [prefix];
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`Unsupported translation value at ${prefix || '<root>'}.`);
  }

  return Object.entries(value).flatMap(([key, child]) =>
    leafKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

const canonicalKeys = leafKeys(en).sort();

for (const [locale, dictionary] of Object.entries(dictionaries)) {
  const keys = leafKeys(dictionary).sort();
  const missing = canonicalKeys.filter((key) => !keys.includes(key));
  const extra = keys.filter((key) => !canonicalKeys.includes(key));

  if (missing.length || extra.length) {
    throw new Error(
      [
        `Locale ${locale} does not match the English key set.`,
        missing.length ? `Missing: ${missing.join(', ')}` : '',
        extra.length ? `Extra: ${extra.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  const localeDir = resolve(localesRoot, locale);
  await mkdir(localeDir, { recursive: true });
  await writeFile(
    resolve(localeDir, 'studio.json'),
    `${JSON.stringify(dictionary, null, 2)}\n`,
    'utf8',
  );

  console.log(`Created src/i18n/locales/${locale}/studio.json`);
}

console.log(
  `Migrated ${Object.keys(dictionaries).length} locales and validated ${canonicalKeys.length} translation keys.`,
);
