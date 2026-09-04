import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const legacyBranch = 'origin/agent/eu-language-files';

const locales = [
  'bg', 'cs', 'da', 'de', 'el', 'en', 'es', 'et', 'fi', 'fr', 'ga', 'hr',
  'hu', 'it', 'lt', 'lv', 'mt', 'nl', 'pl', 'pt', 'ro', 'sk', 'sl', 'sv',
];

const currentBranchLocales = new Set(['en', 'hu', 'de']);

function flattenKeys(value, prefix = '') {
  return Object.entries(value).flatMap(([key, child]) => {
    const next = prefix ? `${prefix}.${key}` : key;

    if (typeof child === 'string') {
      return [next];
    }

    if (child && typeof child === 'object' && !Array.isArray(child)) {
      return flattenKeys(child, next);
    }

    throw new TypeError(`Unsupported translation value at ${next}`);
  });
}

function readLegacyBranchLocale(locale) {
  const path = `src/i18n/locales/${locale}.ts`;

  try {
    return execFileSync(
      'git',
      ['show', `${legacyBranch}:${path}`],
      { cwd: root, encoding: 'utf8' },
    );
  } catch {
    throw new Error(
      `Could not read ${locale} from ${legacyBranch}. Run "git fetch origin" first.`,
    );
  }
}

async function readLocaleSource(locale) {
  if (currentBranchLocales.has(locale)) {
    return readFile(
      resolve(root, `src/i18n/locales/${locale}.ts`),
      'utf8',
    );
  }

  return readLegacyBranchLocale(locale);
}

function evaluateDictionary(source, locale) {
  const withoutImports = source
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('import '))
    .join('\n');

  const declaration = `export const ${locale}: TranslationDictionary =`;

  if (!withoutImports.includes(declaration)) {
    throw new Error(`Could not find translation export for ${locale}.`);
  }

  const executable = withoutImports.replace(
    declaration,
    `const ${locale} =`,
  );

  // Locale sources are repository-owned static object literals. Evaluating the
  // stripped object lets this one-time migration preserve every translated
  // string without introducing a TypeScript parser dependency.
  return Function(`${executable}\nreturn ${locale};`)();
}

const dictionaries = {};

for (const locale of locales) {
  const source = await readLocaleSource(locale);
  dictionaries[locale] = evaluateDictionary(source, locale);
}

const referenceKeys = flattenKeys(dictionaries.en).sort();

for (const locale of locales) {
  const keys = flattenKeys(dictionaries[locale]).sort();
  const missing = referenceKeys.filter((key) => !keys.includes(key));
  const extra = keys.filter((key) => !referenceKeys.includes(key));

  if (missing.length || extra.length) {
    throw new Error(
      [
        `Locale ${locale} does not match en.`,
        missing.length ? `Missing: ${missing.join(', ')}` : '',
        extra.length ? `Extra: ${extra.join(', ')}` : '',
      ].filter(Boolean).join('\n'),
    );
  }

  const directory = resolve(root, `src/i18n/locales/${locale}`);
  await mkdir(directory, { recursive: true });
  await writeFile(
    resolve(directory, 'studio.json'),
    `${JSON.stringify(dictionaries[locale], null, 2)}\n`,
    'utf8',
  );

  console.log(`Created ${locale}/studio.json (${keys.length} keys)`);
}

console.log(
  `Migrated and validated ${locales.length} EU locales against en (${referenceKeys.length} keys).`,
);
