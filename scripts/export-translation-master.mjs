import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root = process.cwd();
const outputRoot = path.join(root, 'locale', 'translation-master');

const english = JSON.parse(
  await fs.readFile(path.join(root, 'src', 'i18n', 'locales', 'en', 'studio.json'), 'utf8'),
);
const supplemental = JSON.parse(
  await fs.readFile(
    path.join(root, 'locale', 'pending', 'supplemental', 'master-source.json'),
    'utf8',
  ),
);
const terminology = JSON.parse(
  await fs.readFile(path.join(root, 'locale', 'terminology.json'), 'utf8'),
);
const deepLMap = JSON.parse(
  await fs.readFile(
    path.join(root, 'locale', 'pending', 'deepl-language-map.json'),
    'utf8',
  ),
);

function flatten(value, prefix = '') {
  if (typeof value === 'string') return [[prefix, value]];
  if (Array.isArray(value)) {
    return value.flatMap((child, index) => flatten(child, `${prefix}[${index}]`));
  }
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const next = prefix ? `${prefix}/${key}` : `/${key}`;
    return flatten(child, next);
  });
}

function protectedTerms(source) {
  const terms = new Set(
    terminology.protectedTerms.filter((term) => source.includes(term)),
  );
  for (const placeholder of source.match(/\{[^}]+\}/g) ?? []) terms.add(placeholder);
  for (const url of source.match(/https?:\/\/[^\s)]+/g) ?? []) terms.add(url);
  for (const extension of source.match(/\.[a-z0-9]{2,8}\b/gi) ?? []) terms.add(extension);
  return [...terms];
}

function sourceId(source) {
  return createHash('sha256').update(source).digest('hex').slice(0, 16);
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

const targetLocales = Object.entries(deepLMap.languages)
  .filter(([locale]) => locale !== 'en')
  .map(([locale, language]) => ({
    locale,
    appName: language.appName,
    deepLName: language.deepLName,
    deepLCode: language.code,
    deepLApiTargetCode: language.apiTargetCode,
    deepLSupported: language.supported,
  }));

const canonicalEntries = flatten(english).map(([key, source]) => ({
  key,
  source,
  kind: 'canonical-po',
  surface: key.split('/').filter(Boolean)[0] ?? 'general',
  sourceFile: 'src/i18n/locales/en/studio.json',
  protectedTerms: protectedTerms(source),
}));

const entryByKey = new Map();
for (const entry of canonicalEntries) entryByKey.set(entry.key, entry);
for (const entry of supplemental.entries ?? []) entryByKey.set(entry.key, entry);

const entries = [...entryByKey.values()]
  .map((entry) => ({
    id: sourceId(`${entry.key}\n${entry.source}`),
    sourceGroup: sourceId(entry.source),
    key: entry.key,
    source: entry.source,
    kind: entry.kind,
    surface: entry.surface,
    sourceFile: entry.sourceFile,
    protectedTerms: entry.protectedTerms ?? protectedTerms(entry.source),
    translations: Object.fromEntries(targetLocales.map(({ locale }) => [locale, ''])),
  }))
  .sort((left, right) =>
    left.surface.localeCompare(right.surface)
      || left.source.localeCompare(right.source)
      || left.key.localeCompare(right.key),
  );

const groups = new Map();
for (const entry of entries) {
  const existing = groups.get(entry.sourceGroup) ?? {
    sourceGroup: entry.sourceGroup,
    source: entry.source,
    protectedTerms: new Set(),
    surfaces: new Set(),
    keys: [],
    sourceFiles: new Set(),
  };
  for (const term of entry.protectedTerms) existing.protectedTerms.add(term);
  existing.surfaces.add(entry.surface);
  existing.keys.push(entry.key);
  existing.sourceFiles.add(entry.sourceFile);
  groups.set(entry.sourceGroup, existing);
}

const glossaryEntries = [...groups.values()]
  .map((group) => ({
    sourceGroup: group.sourceGroup,
    source: group.source,
    protectedTerms: [...group.protectedTerms].sort(),
    surfaces: [...group.surfaces].sort(),
    occurrenceCount: group.keys.length,
    keys: group.keys.sort(),
    sourceFiles: [...group.sourceFiles].sort(),
    translations: Object.fromEntries(targetLocales.map(({ locale }) => [locale, ''])),
  }))
  .sort((left, right) => left.source.localeCompare(right.source));

await fs.mkdir(outputRoot, { recursive: true });

const metadata = {
  formatVersion: 1,
  referenceLocale: 'en',
  generatedFrom: [
    'src/i18n/locales/en/studio.json',
    'source-level coded dictionaries',
    'detailed help',
    'direct UI literals detected from the current source tree',
  ],
  generatedBy: 'scripts/export-translation-master.mjs',
  keyLevelEntryCount: entries.length,
  uniqueSourceCount: glossaryEntries.length,
  targetLocaleCount: targetLocales.length,
  targetLocales,
  instructions: [
    'Translate target-language cells/values only.',
    'Do not modify id, sourceGroup, key, source, kind, surface or sourceFile.',
    'Preserve protectedTerms, placeholders, URLs, identifiers and file extensions.',
    'Use the key-level master when context requires different translations for identical English source text.',
    'The deduplicated glossary is a convenience view; the key-level master is authoritative for re-import.',
  ],
};

await fs.writeFile(
  path.join(outputRoot, 'studio-translation-master.json'),
  `${JSON.stringify({ ...metadata, entries }, null, 2)}\n`,
  'utf8',
);
await fs.writeFile(
  path.join(outputRoot, 'studio-translation-glossary.json'),
  `${JSON.stringify({ ...metadata, entries: glossaryEntries }, null, 2)}\n`,
  'utf8',
);

const languageHeader = targetLocales.map(({ locale }) => locale);
const masterHeader = [
  'id',
  'sourceGroup',
  'key',
  'surface',
  'kind',
  'sourceFile',
  'protectedTerms',
  'English source',
  ...languageHeader,
];
const masterRows = [
  masterHeader,
  ...entries.map((entry) => [
    entry.id,
    entry.sourceGroup,
    entry.key,
    entry.surface,
    entry.kind,
    entry.sourceFile,
    entry.protectedTerms.join(' | '),
    entry.source,
    ...languageHeader.map((locale) => entry.translations[locale]),
  ]),
];
await fs.writeFile(
  path.join(outputRoot, 'studio-translation-master.csv'),
  `${masterRows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`,
  'utf8',
);

const glossaryHeader = [
  'sourceGroup',
  'English source',
  'surfaces',
  'occurrenceCount',
  'protectedTerms',
  'keys',
  ...languageHeader,
];
const glossaryRows = [
  glossaryHeader,
  ...glossaryEntries.map((entry) => [
    entry.sourceGroup,
    entry.source,
    entry.surfaces.join(' | '),
    entry.occurrenceCount,
    entry.protectedTerms.join(' | '),
    entry.keys.join(' | '),
    ...languageHeader.map((locale) => entry.translations[locale]),
  ]),
];
await fs.writeFile(
  path.join(outputRoot, 'studio-translation-glossary.csv'),
  `${glossaryRows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`,
  'utf8',
);

const languageRows = [
  ['locale', 'Studio language name', 'DeepL language name', 'DeepL code', 'DeepL API target', 'DeepL supported'],
  ...targetLocales.map((language) => [
    language.locale,
    language.appName,
    language.deepLName ?? '',
    language.deepLCode ?? '',
    language.deepLApiTargetCode ?? '',
    language.deepLSupported ? 'yes' : 'no',
  ]),
];
await fs.writeFile(
  path.join(outputRoot, 'languages.csv'),
  `${languageRows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`,
  'utf8',
);

console.log(
  `Translation master generated: ${entries.length} key-level entries, ` +
  `${glossaryEntries.length} unique English strings, ` +
  `${targetLocales.length} target locales.`,
);
