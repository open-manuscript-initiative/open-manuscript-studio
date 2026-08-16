import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const localeArg = process.argv.find((arg) => arg.startsWith('--locale='));
const legacyArg = process.argv.find((arg) => arg.startsWith('--legacy='));

const locale = localeArg?.slice('--locale='.length);
const legacyPath = legacyArg?.slice('--legacy='.length);

if (!locale || !legacyPath) {
  throw new Error('Usage: node scripts/fill-pending-from-legacy-module-translations.mjs --locale=<locale> --legacy=<file>');
}

const pendingPath = path.join(root, 'locale', 'pending', `${locale}.json`);
const pending = JSON.parse(await fs.readFile(pendingPath, 'utf8'));
const legacy = JSON.parse(await fs.readFile(path.resolve(legacyPath), 'utf8'));

if (pending.locale !== locale) {
  throw new Error(`Pending locale mismatch: expected ${locale}, got ${pending.locale}.`);
}

const intentionalIdentityKeys = new Set([
  '/contributors/orcid',
  '/auth/brand/name',
  '/auth/fields/email/placeholder',
]);

function decodePointerSegment(segment) {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function getLegacyValue(pointer) {
  const segments = pointer
    .split('/')
    .slice(2)
    .map(decodePointerSegment);

  let value = legacy;
  for (const segment of segments) {
    if (value == null || typeof value !== 'object' || !(segment in value)) return undefined;
    value = value[segment];
  }
  return value;
}

let filled = 0;
const missing = [];

for (const entry of pending.entries ?? []) {
  if (entry.translation?.trim()) continue;

  let translation;
  if (entry.key.startsWith('/modules/')) {
    translation = getLegacyValue(entry.key);
  } else if (intentionalIdentityKeys.has(entry.key)) {
    translation = entry.source;
  }

  if (typeof translation !== 'string' || translation.trim().length === 0) {
    missing.push(entry.key);
    continue;
  }

  for (const term of entry.protectedTerms ?? []) {
    if (entry.source.includes(term) && !translation.includes(term)) {
      throw new Error(`${locale}: protected term ${JSON.stringify(term)} missing at ${entry.key}.`);
    }
  }

  entry.translation = translation;
  filled += 1;
}

if (missing.length) {
  throw new Error(`${locale}: ${missing.length} pending entries were not found in the legacy translation dictionary:\n${missing.join('\n')}`);
}

await fs.writeFile(pendingPath, `${JSON.stringify(pending, null, 2)}\n`, 'utf8');
console.log(`Filled ${locale}: ${filled}/${pending.entries.length} pending translations from legacy module translations.`);
