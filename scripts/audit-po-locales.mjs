import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parsePo } from './po-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const poRoot = path.join(root, 'locale');
const policyFile = path.join(root, 'locale', 'translation-status.json');

const policy = JSON.parse(await fs.readFile(policyFile, 'utf8'));
const referenceLocale = policy.referenceLocale ?? 'en';
const completeLocales = new Set(policy.completeLocales ?? []);
const identicalAllowlist = new Set(policy.identicalAllowlist ?? []);

const localeDirs = (await fs.readdir(poRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (!localeDirs.includes(referenceLocale)) {
  throw new Error(`Reference PO locale ${referenceLocale} is missing.`);
}

async function readEntries(locale) {
  const file = path.join(poRoot, locale, 'studio.po');
  const text = await fs.readFile(file, 'utf8');
  return parsePo(text);
}

const referenceEntries = await readEntries(referenceLocale);
const referenceByPointer = new Map(referenceEntries.map((entry) => [entry.pointer, entry]));
const expectedPointers = new Set(referenceByPointer.keys());

if (referenceByPointer.size !== referenceEntries.length) {
  throw new Error(`${referenceLocale}: duplicate msgctxt values in reference catalog.`);
}

const rows = [];
let structuralFailures = 0;
let completenessFailures = 0;

for (const locale of localeDirs) {
  const entries = await readEntries(locale);
  const byPointer = new Map(entries.map((entry) => [entry.pointer, entry]));
  const duplicates = entries.length - byPointer.size;
  const missing = [...expectedPointers].filter((pointer) => !byPointer.has(pointer));
  const extra = [...byPointer.keys()].filter((pointer) => !expectedPointers.has(pointer));

  const empty = [];
  const stale = [];
  const identical = [];

  for (const [pointer, referenceEntry] of referenceByPointer) {
    const entry = byPointer.get(pointer);
    if (!entry) continue;

    if (entry.source !== referenceEntry.source) {
      stale.push(pointer);
    }

    if (entry.translation.trim().length === 0) {
      empty.push(pointer);
    } else if (
      locale !== referenceLocale &&
      entry.translation === referenceEntry.source &&
      !identicalAllowlist.has(pointer)
    ) {
      identical.push(pointer);
    }
  }

  const structural = duplicates + missing.length + extra.length + stale.length + empty.length;
  const translated = expectedPointers.size - empty.length - identical.length;
  const percent = expectedPointers.size === 0
    ? 100
    : (translated / expectedPointers.size) * 100;
  const complete = completeLocales.has(locale);

  if (structural > 0) structuralFailures += 1;
  if (complete && identical.length > 0) completenessFailures += 1;

  rows.push({
    locale,
    total: expectedPointers.size,
    translated,
    percent,
    empty: empty.length,
    identical: identical.length,
    missing: missing.length,
    extra: extra.length,
    stale: stale.length,
    duplicates,
    complete,
    identicalPointers: identical,
  });
}

console.log('PO translation audit');
console.log('====================');
console.log(`Reference locale: ${referenceLocale}`);
console.log(`Expected entries: ${expectedPointers.size}`);
console.log('');
console.log('Locale  Progress   Translated  Identical  Empty  Structural  Status');
console.log('------  ---------  ----------  ---------  -----  ----------  ------');

for (const row of rows) {
  const structural = row.missing + row.extra + row.stale + row.duplicates;
  const status = row.complete ? 'complete' : 'in progress';
  console.log(
    `${row.locale.padEnd(6)}  ${row.percent.toFixed(1).padStart(7)}%  ${String(row.translated).padStart(10)}  ${String(row.identical).padStart(9)}  ${String(row.empty).padStart(5)}  ${String(structural).padStart(10)}  ${status}`,
  );
}

const nonReferenceRows = rows.filter((row) => row.locale !== referenceLocale);
const totalIdentical = nonReferenceRows.reduce((sum, row) => sum + row.identical, 0);
const totalEmpty = nonReferenceRows.reduce((sum, row) => sum + row.empty, 0);

console.log('');
console.log(`Identical-to-English candidates: ${totalIdentical}`);
console.log(`Empty translations: ${totalEmpty}`);
console.log(`Structurally invalid locales: ${structuralFailures}`);

const detailsRequested = process.argv.includes('--details');
if (detailsRequested) {
  for (const row of nonReferenceRows) {
    if (row.identicalPointers.length === 0) continue;
    console.log(`\n${row.locale}: identical-to-English candidates (${row.identicalPointers.length})`);
    for (const pointer of row.identicalPointers) {
      console.log(`  ${pointer}`);
    }
  }
}

if (structuralFailures > 0) {
  throw new Error(`${structuralFailures} locale(s) failed PO structural validation.`);
}

if (completenessFailures > 0) {
  const failed = rows
    .filter((row) => row.complete && row.identical > 0)
    .map((row) => `${row.locale} (${row.identical})`)
    .join(', ');
  throw new Error(`Complete locale(s) still contain English-identical candidates: ${failed}`);
}

console.log('PO audit passed.');
