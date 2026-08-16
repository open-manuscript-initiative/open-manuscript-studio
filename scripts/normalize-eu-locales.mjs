import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const locales = [
  'bg', 'cs', 'da', 'el', 'es', 'et', 'fi', 'fr', 'ga', 'hr', 'it',
  'lt', 'lv', 'mt', 'nl', 'pl', 'pt', 'ro', 'sk', 'sl', 'sv'
];

const topLevelOrder = [
  'common',
  'navigation',
  'studio',
  'manuscript',
  'notes',
  'citations',
  'contributors',
  'history',
  'editor',
  'status',
  'validation',
  'languages',
  'auth'
];

const identifierPattern = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function quoteString(value) {
  return `'${value
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
    .replaceAll('\r', '\\r')
    .replaceAll('\n', '\\n')}'`;
}

function formatKey(key) {
  return identifierPattern.test(key) ? key : quoteString(key);
}

function orderedEntries(object, depth) {
  const entries = Object.entries(object);
  if (depth !== 0) return entries;

  const rank = new Map(topLevelOrder.map((key, index) => [key, index]));
  return entries.sort(([a], [b]) => {
    const aRank = rank.get(a) ?? Number.MAX_SAFE_INTEGER;
    const bRank = rank.get(b) ?? Number.MAX_SAFE_INTEGER;
    return aRank - bRank;
  });
}

function formatValue(value, depth = 0) {
  if (typeof value === 'string') return quoteString(value);

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const indent = '  '.repeat(depth);
    const childIndent = '  '.repeat(depth + 1);
    const entries = orderedEntries(value, depth);

    const lines = entries.map(([key, child]) => {
      const formatted = formatValue(child, depth + 1);
      return `${childIndent}${formatKey(key)}: ${formatted}`;
    });

    const separator = depth === 0 ? ',\n\n' : ',\n';
    return `{\n${lines.join(separator)}\n${indent}}`;
  }

  throw new TypeError(`Unsupported translation value: ${String(value)}`);
}

function collectLeafKeys(value, prefix = '') {
  const keys = [];

  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === 'string') {
      keys.push(path);
    } else if (child && typeof child === 'object' && !Array.isArray(child)) {
      keys.push(...collectLeafKeys(child, path));
    } else {
      throw new TypeError(`Unsupported translation value at ${path}.`);
    }
  }

  return keys.sort();
}

function compareKeys(reference, candidate, locale) {
  const referenceKeys = collectLeafKeys(reference);
  const candidateKeys = collectLeafKeys(candidate);
  const referenceSet = new Set(referenceKeys);
  const candidateSet = new Set(candidateKeys);

  const missing = referenceKeys.filter((key) => !candidateSet.has(key));
  const extra = candidateKeys.filter((key) => !referenceSet.has(key));

  if (missing.length || extra.length) {
    const details = [
      missing.length ? `missing: ${missing.join(', ')}` : '',
      extra.length ? `extra: ${extra.join(', ')}` : ''
    ].filter(Boolean).join('; ');

    throw new Error(`Locale ${locale} does not match en.ts key structure (${details}).`);
  }
}

async function loadLocale(locale) {
  const file = new URL(`../src/i18n/locales/${locale}.ts`, import.meta.url);
  const moduleUrl = `${pathToFileURL(file.pathname).href}?normalize=${Date.now()}-${locale}`;
  const module = await import(moduleUrl);
  const dictionary = module[locale];

  if (!dictionary || typeof dictionary !== 'object') {
    throw new Error(`Locale ${locale} does not export a dictionary named ${locale}.`);
  }

  return { file, dictionary };
}

const { dictionary: english } = await loadLocale('en');

for (const locale of locales) {
  const { file, dictionary } = await loadLocale(locale);
  compareKeys(english, dictionary, locale);

  const content = [
    "import type { TranslationDictionary } from '../types';",
    '',
    `export const ${locale}: TranslationDictionary = ${formatValue(dictionary)};`,
    ''
  ].join('\n');

  await writeFile(file, content, 'utf8');
  console.log(`Normalized ${locale}.ts`);
}

console.log(`Normalized and validated ${locales.length} EU locale files against en.ts.`);
