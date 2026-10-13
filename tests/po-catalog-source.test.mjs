import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { flattenStrings, parsePo } from '../scripts/po-utils.mjs';

const repositoryRoot = process.cwd();
const primaryLocales = ['en', 'de', 'hu'];

async function readCatalog(locale) {
  const source = await readFile(
    path.join(repositoryRoot, 'locale', locale, 'studio.po'),
    'utf8',
  );
  return parsePo(source);
}

function readPointerValue(dictionary, pointer) {
  return pointer
    .slice(1)
    .split('/')
    .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce((value, segment) => value?.[segment], dictionary);
}

test('English, German and Hungarian PO catalogs are complete and drive the runtime dictionaries', async () => {
  const englishEntries = await readCatalog('en');
  const englishByPointer = new Map(
    englishEntries.map((entry) => [entry.pointer, entry]),
  );

  assert.equal(englishByPointer.size, englishEntries.length, 'English catalog keys must be unique');
  assert.ok(englishEntries.length > 0, 'English PO catalog must not be empty');

  for (const entry of englishEntries) {
    assert.equal(entry.source, entry.translation, `English msgstr must match msgid at ${entry.pointer}`);
  }

  for (const locale of primaryLocales) {
    const entries = locale === 'en' ? englishEntries : await readCatalog(locale);
    const byPointer = new Map(entries.map((entry) => [entry.pointer, entry]));
    const actualKeys = [...byPointer.keys()].sort();
    const expectedKeys = [...englishByPointer.keys()].sort();

    assert.equal(byPointer.size, entries.length, `${locale} catalog keys must be unique`);
    assert.deepEqual(actualKeys, expectedKeys, `${locale} catalog must cover every English UI key`);

    for (const [pointer, sourceEntry] of englishByPointer) {
      const entry = byPointer.get(pointer);
      assert.equal(entry.source, sourceEntry.source, `${locale} msgid must match English at ${pointer}`);
      assert.ok(entry.translation.trim(), `${locale} msgstr must be non-empty at ${pointer}`);

      const runtime = JSON.parse(
        await readFile(
          path.join(repositoryRoot, 'src', 'i18n', 'locales', locale, 'studio.json'),
          'utf8',
        ),
      );
      assert.equal(
        readPointerValue(runtime, pointer),
        entry.translation,
        `${locale} runtime value must be compiled from PO at ${pointer}`,
      );
    }

    const runtime = JSON.parse(
      await readFile(
        path.join(repositoryRoot, 'src', 'i18n', 'locales', locale, 'studio.json'),
        'utf8',
      ),
    );
    const runtimeKeys = new Map(flattenStrings(runtime));
    assert.deepEqual([...runtimeKeys.keys()].sort(), expectedKeys, `${locale} runtime key set must match PO`);
  }
});
