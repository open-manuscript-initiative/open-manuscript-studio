import assert from 'node:assert/strict';
import test from 'node:test';

import {
  renderWordGeneratedIndexField,
  renderWordIndexEntryFields,
} from '../src/services/exportDocx.ts';

test('exports semantic OMI index occurrences as Word XE fields', () => {
  const xml = renderWordIndexEntryFields([
    {
      id: 'entry-1',
      kind: 'name',
      terms: ['Apafi Mihály'],
      targetBlockId: 'block-1',
      source: { format: 'docx-xe' },
    },
    {
      id: 'entry-2',
      kind: 'name',
      terms: ['Bethlen', 'Gábor'],
      targetBlockId: 'block-1',
      source: { format: 'manual' },
    },
  ]);

  assert.match(xml, /XE &quot;Apafi Mihály&quot;/);
  assert.match(xml, /XE &quot;Bethlen:Gábor&quot;/);
  assert.equal((xml.match(/w:fldCharType="begin"/g) ?? []).length, 2);
});

test('exports a dirty Word INDEX field whose page numbers are recalculated after pagination', () => {
  const xml = renderWordGeneratedIndexField('hu');
  assert.match(xml, /w:dirty="true"/);
  assert.match(xml, /> INDEX </);
  assert.match(xml, /oldalszámai/);
});
