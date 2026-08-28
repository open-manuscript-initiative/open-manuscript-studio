import assert from 'node:assert/strict';
import test from 'node:test';

import type { OmiIndexEntry } from '../src/model/indexing.ts';
import {
  bindWordIndexEntriesToBlocks,
  extractWordIndexMarkerLocations,
} from '../src/services/docxIndexLocationImport.ts';
import type { DocxManuscriptImportPlan } from '../src/services/docxManuscriptImport.ts';

function paragraphBlock(id: string, text: string) {
  return {
    id,
    type: 'paragraph',
    content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }),
  };
}

test('extracts each XE marker with the Word paragraph that contains it', () => {
  const xml = `
    <w:document><w:body>
      <w:p><w:r><w:t>Petki István levele.</w:t></w:r>
        <w:r><w:fldChar w:fldCharType="begin"/></w:r>
        <w:r><w:instrText> XE "Petk</w:instrText></w:r>
        <w:r><w:instrText>y István" </w:instrText></w:r>
        <w:r><w:fldChar w:fldCharType="end"/></w:r>
      </w:p>
      <w:p><w:r><w:t>Bethlen Gábor fejedelem.</w:t></w:r>
        <w:r><w:fldChar w:fldCharType="begin"/></w:r>
        <w:r><w:instrText> XE "Bethlen Gábor" </w:instrText></w:r>
        <w:r><w:fldChar w:fldCharType="end"/></w:r>
      </w:p>
    </w:body></w:document>`;

  assert.deepEqual(extractWordIndexMarkerLocations(xml), [
    { entryOrdinal: 0, paragraphOrdinal: 0, paragraphText: 'Petki István levele.' },
    { entryOrdinal: 1, paragraphOrdinal: 1, paragraphText: 'Bethlen Gábor fejedelem.' },
  ]);
});

test('keeps imported index navigation when XE spelling differs from visible text', () => {
  const entries: OmiIndexEntry[] = [{
    id: 'petky',
    kind: 'name',
    terms: ['Petky István'],
    source: { format: 'docx-xe', instruction: 'XE "Petky István"' },
  }];
  const sections = [{
    id: 'section-1',
    title: 'Text',
    blocks: [paragraphBlock('block-1', 'Petki István levele.')],
  }] as DocxManuscriptImportPlan['sections'];

  const [bound] = bindWordIndexEntriesToBlocks(entries, [
    { entryOrdinal: 0, paragraphOrdinal: 12, paragraphText: 'Petki István levele.' },
  ], sections);

  assert.equal(bound?.targetBlockId, 'block-1');
  assert.ok(bound?.anchorId);
  assert.equal(bound?.targetText, undefined);
  assert.equal(bound?.targetTextOffset, undefined);
});

test('stores exact text offset when the XE term is visible in its source paragraph', () => {
  const entries: OmiIndexEntry[] = [{
    id: 'bethlen',
    kind: 'name',
    terms: ['Bethlen Gábor'],
    source: { format: 'docx-xe', instruction: 'XE "Bethlen Gábor"' },
  }];
  const sections = [{
    id: 'section-1',
    title: 'Text',
    blocks: [paragraphBlock('block-2', 'A fejedelem Bethlen Gábor volt.')],
  }] as DocxManuscriptImportPlan['sections'];

  const [bound] = bindWordIndexEntriesToBlocks(entries, [
    { entryOrdinal: 0, paragraphOrdinal: 20, paragraphText: 'A fejedelem Bethlen Gábor volt.' },
  ], sections);

  assert.equal(bound?.targetBlockId, 'block-2');
  assert.equal(bound?.targetText, 'Bethlen Gábor');
  assert.equal(bound?.targetTextOffset, 11);
});

test('binds multiple XE markers in one paragraph to the same stable block', () => {
  const entries: OmiIndexEntry[] = [
    { id: 'a', kind: 'name', terms: ['Petky István'], source: { format: 'docx-xe' } },
    { id: 'b', kind: 'name', terms: ['Rákóczi György'], source: { format: 'docx-xe' } },
  ];
  const sections = [{
    id: 'section-1',
    title: 'Text',
    blocks: [paragraphBlock('block-shared', 'Petky István II. Rákóczi Györggyel tárgyalt.')],
  }] as DocxManuscriptImportPlan['sections'];
  const locations = [
    { entryOrdinal: 0, paragraphOrdinal: 7, paragraphText: 'Petky István II. Rákóczi Györggyel tárgyalt.' },
    { entryOrdinal: 1, paragraphOrdinal: 7, paragraphText: 'Petky István II. Rákóczi Györggyel tárgyalt.' },
  ];

  const bound = bindWordIndexEntriesToBlocks(entries, locations, sections);
  assert.equal(bound[0]?.targetBlockId, 'block-shared');
  assert.equal(bound[1]?.targetBlockId, 'block-shared');
});
