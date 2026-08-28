import assert from 'node:assert/strict';
import test from 'node:test';

import {
  removeWordGeneratedIndexCache,
  stripGeneratedIndexPageNumbers,
} from '../src/services/docxGeneratedIndexCleanup.ts';
import type { DocxManuscriptImportPlan } from '../src/services/docxManuscriptImport.ts';

test('strips Word cached index page lists without treating them as semantic data', () => {
  assert.equal(stripGeneratedIndexPageNumbers('Acsády Ignác\t376, 391'), 'Acsády Ignác');
  assert.equal(stripGeneratedIndexPageNumbers('Acsády Ignác376, 391'), 'Acsády Ignác');
  assert.equal(stripGeneratedIndexPageNumbers('Ákosfalvi Szilágyi László376'), 'Ákosfalvi Szilágyi László');
  assert.equal(stripGeneratedIndexPageNumbers('II. Rákóczi Ferenc'), 'II. Rákóczi Ferenc');
});

test('removes a cached Word name-index section while preserving XE entries', () => {
  const plan = {
    sections: [
      {
        id: 'body',
        title: 'Fejezet',
        blocks: [{ id: 'body-1', type: 'paragraph', content: 'Valódi törzsszöveg' }],
      },
      {
        id: 'index',
        title: 'Névmutató',
        blocks: [
          { id: 'idx-1', type: 'paragraph', content: 'Acsády Ignác376, 391' },
          { id: 'idx-2', type: 'paragraph', content: 'Apafi Mihály18, 27, 31, 51' },
        ],
      },
    ],
    indexEntries: [
      { id: 'xe-1', kind: 'name', terms: ['Acsády Ignác'], targetBlockId: 'body-1', source: { format: 'docx-xe' } },
      { id: 'xe-2', kind: 'name', terms: ['Apafi Mihály'], targetBlockId: 'body-1', source: { format: 'docx-xe' } },
    ],
    generatedIndexes: [{ id: 'index-1', kind: 'name', source: { format: 'docx-index' } }],
  } as unknown as DocxManuscriptImportPlan;

  const result = removeWordGeneratedIndexCache(plan);
  assert.deepEqual(result.sections.map((section) => section.id), ['body']);
  assert.equal(result.indexEntries?.length, 2);
});
