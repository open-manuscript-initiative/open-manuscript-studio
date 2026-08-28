import assert from 'node:assert/strict';
import test from 'node:test';

import {
  insertIndexLetterNumberSpacing,
  normalizeWordGeneratedIndexSpacing,
  removeWordGeneratedIndexCache,
  stripGeneratedIndexPageNumbers,
} from '../src/services/docxGeneratedIndexCleanup.ts';
import type { DocxManuscriptImportPlan } from '../src/services/docxManuscriptImport.ts';

test('inserts a space between letters and Arabic page numbers', () => {
  assert.equal(insertIndexLetterNumberSpacing('Acsády Ignác376, 391'), 'Acsády Ignác 376, 391');
  assert.equal(insertIndexLetterNumberSpacing('Ákosfalvi Szilágyi László376'), 'Ákosfalvi Szilágyi László 376');
  assert.equal(insertIndexLetterNumberSpacing('II. Rákóczi Ferenc'), 'II. Rákóczi Ferenc');
  assert.equal(insertIndexLetterNumberSpacing('17. század'), '17. század');
});

test('normalizes spacing only inside a recognized name-index section', () => {
  const plan = {
    sections: [
      {
        id: 'body',
        title: 'Fejezet',
        blocks: [{ id: 'body-1', type: 'paragraph', content: 'Törzsszöveg123 marad változatlan' }],
      },
      {
        id: 'index',
        title: '14.2. Névmutató',
        blocks: [
          { id: 'idx-1', type: 'paragraph', content: 'Acsády Ignác376, 391' },
          {
            id: 'idx-2',
            type: 'paragraph',
            content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Apafi Mihály18, 27, 31' }] }] }),
          },
        ],
      },
    ],
  } as unknown as DocxManuscriptImportPlan;

  const result = normalizeWordGeneratedIndexSpacing(plan);
  assert.equal(result.sections[0]?.blocks[0]?.content, 'Törzsszöveg123 marad változatlan');
  assert.equal(result.sections[1]?.blocks[0]?.content, 'Acsády Ignác 376, 391');
  assert.match(result.sections[1]?.blocks[1]?.content ?? '', /Apafi Mihály 18, 27, 31/);
});

test('strips Word cached index page lists without treating them as semantic data', () => {
  assert.equal(stripGeneratedIndexPageNumbers('Acsády Ignác\t376, 391'), 'Acsády Ignác');
  assert.equal(stripGeneratedIndexPageNumbers('Acsády Ignác 376, 391'), 'Acsády Ignác');
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
          { id: 'idx-1', type: 'paragraph', content: 'Acsády Ignác 376, 391' },
          { id: 'idx-2', type: 'paragraph', content: 'Apafi Mihály 18, 27, 31, 51' },
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
