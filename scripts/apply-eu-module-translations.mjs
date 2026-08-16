import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const localesDir = path.join(root, 'src', 'i18n', 'locales');
const translationsDir = path.join(root, 'scripts', 'i18n-module-translations');
const targetLocales = [
  'bg', 'cs', 'da', 'el', 'es', 'et', 'fi', 'fr', 'ga', 'hr', 'it',
  'lt', 'lv', 'mt', 'nl', 'pl', 'pt', 'ro', 'sk', 'sl', 'sv',
];

function flatten(value, prefix = '', out = new Map()) {
  if (typeof value === 'string') {
    out.set(prefix, value);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(item, `${prefix}[${index}]`, out));
    return out;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }
  throw new TypeError(`Unsupported translation value at ${prefix || '<root>'}`);
}

const englishPath = path.join(localesDir, 'en', 'studio.json');
const english = JSON.parse(await fs.readFile(englishPath, 'utf8'));
const reference = flatten(english.modules);
const referenceKeys = new Set(reference.keys());

let translatedCount = 0;
for (const locale of targetLocales) {
  const translationPath = path.join(translationsDir, `${locale}.json`);
  const localePath = path.join(localesDir, locale, 'studio.json');

  const modules = JSON.parse(await fs.readFile(translationPath, 'utf8'));
  const flat = flatten(modules);
  const keys = new Set(flat.keys());
  const missing = [...referenceKeys].filter((key) => !keys.has(key));
  const extra = [...keys].filter((key) => !referenceKeys.has(key));
  const empty = [...flat].filter(([, value]) => !value.trim()).map(([key]) => key);

  if (missing.length || extra.length || empty.length) {
    throw new Error([
      `${locale}: invalid module translation`,
      missing.length ? `missing: ${missing.join(', ')}` : '',
      extra.length ? `extra: ${extra.join(', ')}` : '',
      empty.length ? `empty: ${empty.join(', ')}` : '',
    ].filter(Boolean).join('\n'));
  }

  const dictionary = JSON.parse(await fs.readFile(localePath, 'utf8'));
  dictionary.modules = modules;
  await fs.writeFile(localePath, `${JSON.stringify(dictionary, null, 2)}\n`, 'utf8');
  translatedCount += flat.size;
  console.log(`Applied ${locale}: ${flat.size} translated module strings`);
}

console.log(`Applied ${translatedCount} translated module strings across ${targetLocales.length} EU locales.`);
