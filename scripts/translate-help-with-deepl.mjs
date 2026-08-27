import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  getDetailedHelpLabels,
  getDetailedHelpTopic,
} from '../src/i18n/helpDetailed.ts';
import {
  generatedDetailedHelpByLocale,
  generatedDetailedHelpLabels,
} from '../src/i18n/helpDetailed.generated.ts';

const ALL_HELP_LOCALES = [
  'bg', 'cs', 'da', 'de', 'el', 'en', 'es', 'et', 'fi', 'fr', 'ga', 'hr',
  'hu', 'it', 'lt', 'lv', 'mt', 'nl', 'pl', 'pt', 'ro', 'sk', 'sl', 'sv',
];
const SOURCE_LOCALE = 'en';
const BUILT_IN_DETAILED_LOCALES = new Set(['en', 'hu', 'de']);
const OUTPUT_FILE = fileURLToPath(new URL('../src/i18n/helpDetailed.generated.ts', import.meta.url));
const PROTECTED_TERMS = [
  'Open Manuscript Studio', 'Open Manuscript Initiative', 'WebAuthn', 'SHA-256',
  'ORCID', 'ROR', 'DOI', 'OJS', 'OMP', 'DOCX', 'IDML', 'JATS', 'CSL',
  'OMI', 'CSS', 'HTML', 'PDF', 'EPUB', 'XTG', 'MIF', 'SLA', 'LaTeX',
  '@page', 'passkey', 'Word', 'Studio',
].sort((a, b) => b.length - a.length);

const args = new Set(process.argv.slice(2));
const write = args.has('--write');
const force = args.has('--force');
const requestedLocales = readListArg('--locales=') ?? ALL_HELP_LOCALES;
const targetLocales = requestedLocales.filter((locale) => !BUILT_IN_DETAILED_LOCALES.has(locale));

if (!targetLocales.length) {
  console.log('No non-built-in detailed-help locales selected.');
  process.exit(0);
}

const existingLocales = new Set(Object.keys(generatedDetailedHelpByLocale));
const missingLocales = targetLocales.filter((locale) => force || !existingLocales.has(locale));

console.log(`Detailed help source: ${SOURCE_LOCALE}`);
console.log(`Selected target locales: ${targetLocales.join(', ')}`);
console.log(`Already generated: ${targetLocales.filter((locale) => existingLocales.has(locale)).join(', ') || 'none'}`);
console.log(`Need translation: ${missingLocales.join(', ') || 'none'}`);

if (!write) {
  console.log('\nDry run only. No DeepL request was sent and no file was changed.');
  console.log('Run with --write to translate missing locales. Add --force to regenerate existing generated locales.');
  process.exit(0);
}

if (!missingLocales.length) {
  console.log('Nothing to translate.');
  process.exit(0);
}

const authKey = process.env.DEEPL_API_KEY?.trim();
if (!authKey) {
  throw new Error('DEEPL_API_KEY is required when --write is used.');
}

const apiBase = resolveApiBase(authKey);
const supportedTargets = await fetchSupportedTargetLanguages(apiBase, authKey);
const supportedLocales = [];
const unsupportedLocales = [];
for (const locale of missingLocales) {
  const targetCode = resolveTargetLanguageCode(locale, supportedTargets);
  if (targetCode) supportedLocales.push({ locale, targetCode });
  else unsupportedLocales.push(locale);
}

if (unsupportedLocales.length) {
  console.warn(`DeepL does not report a compatible target language for: ${unsupportedLocales.join(', ')}. These locales were skipped.`);
}
if (!supportedLocales.length) {
  console.log('No selected locale is supported by this DeepL API account.');
  process.exit(0);
}

const nextLabels = structuredClone(generatedDetailedHelpLabels);
const nextByLocale = structuredClone(generatedDetailedHelpByLocale);
const sourceLabels = getDetailedHelpLabels(SOURCE_LOCALE);
const sourceTopics = {};
for (let index = 1; index <= 20; index += 1) {
  const topic = getDetailedHelpTopic(SOURCE_LOCALE, String(index));
  if (!topic) throw new Error(`Missing English detailed help topic ${index}.`);
  sourceTopics[index] = topic;
}

for (const { locale, targetCode } of supportedLocales) {
  console.log(`Translating ${locale} -> DeepL ${targetCode}...`);
  const texts = flattenHelp(sourceLabels, sourceTopics);
  const translated = await translateTexts(apiBase, authKey, targetCode, texts);
  const rebuilt = rebuildHelp(translated);
  nextLabels[locale] = rebuilt.labels;
  nextByLocale[locale] = rebuilt.topics;
  console.log(`  ${translated.length} strings translated.`);
}

const moduleSource = renderGeneratedModule(nextLabels, nextByLocale);
await writeFile(OUTPUT_FILE, moduleSource, 'utf8');
console.log(`\nUpdated ${OUTPUT_FILE}`);
console.log('Review the generated translations, then run npm test / npm run build before committing.');

function readListArg(prefix) {
  const item = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  if (!item) return null;
  return item.slice(prefix.length).split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
}

function resolveApiBase(key) {
  const configured = process.env.DEEPL_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
}

async function fetchSupportedTargetLanguages(apiBase, authKey) {
  const response = await fetch(`${apiBase}/v2/languages?type=target`, {
    headers: { Authorization: `DeepL-Auth-Key ${authKey}` },
  });
  if (!response.ok) throw await deeplError('Unable to read DeepL target languages', response);
  const languages = await response.json();
  return new Set(languages.map((item) => String(item.language).toUpperCase()));
}

function resolveTargetLanguageCode(locale, supported) {
  const candidates = locale === 'pt'
    ? ['PT-PT', 'PT-BR', 'PT']
    : locale === 'en'
      ? ['EN-GB', 'EN-US', 'EN']
      : [locale.toUpperCase()];
  return candidates.find((candidate) => supported.has(candidate)) ?? null;
}

function flattenHelp(labels, topics) {
  const texts = [labels.location, labels.steps, labels.checks];
  for (let index = 1; index <= 20; index += 1) {
    const topic = topics[index];
    texts.push(topic.location, ...topic.steps, ...topic.checks);
  }
  return texts;
}

function rebuildHelp(translated) {
  let cursor = 0;
  const labels = {
    location: translated[cursor++],
    steps: translated[cursor++],
    checks: translated[cursor++],
  };
  const topics = {};
  for (let index = 1; index <= 20; index += 1) {
    const source = getDetailedHelpTopic(SOURCE_LOCALE, String(index));
    topics[index] = {
      location: translated[cursor++],
      steps: source.steps.map(() => translated[cursor++]),
      checks: source.checks.map(() => translated[cursor++]),
    };
  }
  if (cursor !== translated.length) throw new Error(`Translation rebuild mismatch: used ${cursor} of ${translated.length} strings.`);
  return { labels, topics };
}

async function translateTexts(apiBase, authKey, targetLang, texts) {
  const protectedTexts = texts.map(protectTerms);
  const output = [];
  const batchSize = 40;
  for (let offset = 0; offset < protectedTexts.length; offset += batchSize) {
    const batch = protectedTexts.slice(offset, offset + batchSize);
    const body = new URLSearchParams();
    for (const text of batch) body.append('text', text);
    body.set('source_lang', 'EN');
    body.set('target_lang', targetLang);
    body.set('tag_handling', 'xml');
    body.set('ignore_tags', 'keep');
    body.set('preserve_formatting', '1');

    const response = await fetch(`${apiBase}/v2/translate`, {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${authKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    if (!response.ok) throw await deeplError(`DeepL translation failed for ${targetLang}`, response);
    const payload = await response.json();
    output.push(...payload.translations.map((item) => unprotectTerms(String(item.text))));
  }
  if (output.length !== texts.length) throw new Error(`DeepL returned ${output.length} translations for ${texts.length} inputs.`);
  return output;
}

function protectTerms(text) {
  let result = text;
  for (const term of PROTECTED_TERMS) {
    const escaped = escapeRegExp(term);
    result = result.replace(new RegExp(escaped, 'g'), (match) => `<keep>${escapeXml(match)}</keep>`);
  }
  return result;
}

function unprotectTerms(text) {
  return text.replace(/<keep>([\s\S]*?)<\/keep>/g, (_, value) => decodeXml(value));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeXml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function decodeXml(value) {
  return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

async function deeplError(prefix, response) {
  const detail = await response.text().catch(() => '');
  return new Error(`${prefix}: HTTP ${response.status}${detail ? ` — ${detail.slice(0, 500)}` : ''}`);
}

function renderGeneratedModule(labels, byLocale) {
  return `// Generated by scripts/translate-help-with-deepl.mjs.\n// Keep this file committed so generated translations are reproducible in every build.\n// Manual corrections are allowed; the translator does not overwrite existing locales unless --force is used.\n\nexport const generatedDetailedHelpLabels: Record<string, {\n  location: string;\n  steps: string;\n  checks: string;\n}> = ${JSON.stringify(sortObject(labels), null, 2)};\n\nexport const generatedDetailedHelpByLocale: Record<string, Record<number, {\n  location: string;\n  steps: string[];\n  checks: string[];\n}>> = ${JSON.stringify(sortObject(byLocale), null, 2)};\n`;
}

function sortObject(value) {
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
}
