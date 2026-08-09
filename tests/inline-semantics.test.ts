import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractOmiInlineRuns,
  omiCharacterStyleName,
  semanticKindsFromMarks,
} from '../src/model/inlineSemantics.ts';
import { wordCharacterStyleSemantics } from '../src/model/docxImport.ts';

test('normalizes Tiptap marks into OMI inline semantics', () => {
  assert.deepEqual(
    semanticKindsFromMarks([
      { type: 'italic' },
      { type: 'bold' },
      { type: 'omiSmallCaps' },
      { type: 'omiSuperscript' },
    ]),
    ['emphasis', 'strong', 'small-caps', 'superscript'],
  );
});

test('maps Word character style names in multiple languages', () => {
  assert.deepEqual(wordCharacterStyleSemantics('Emphasis', 'Emphasis'), ['emphasis']);
  assert.deepEqual(wordCharacterStyleSemantics('Strong', 'Strong'), ['strong']);
  assert.deepEqual(wordCharacterStyleSemantics('Kiskapitalis', 'Kiskapitális'), ['small-caps']);
  assert.deepEqual(wordCharacterStyleSemantics('Dolt', 'Dőlt'), ['emphasis']);
  assert.deepEqual(wordCharacterStyleSemantics('Felkover', 'Félkövér'), ['strong']);
});

test('extracts styled text runs without flattening semantics', () => {
  const content = JSON.stringify({
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [
        { type: 'text', text: 'normal ' },
        { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
        { type: 'text', text: ' bold italic', marks: [{ type: 'bold' }, { type: 'italic' }] },
      ],
    }],
  });
  const runs = extractOmiInlineRuns(content);
  assert.equal(runs[0]?.text, 'normal ');
  assert.deepEqual(runs[1]?.semantics, ['emphasis']);
  assert.equal(omiCharacterStyleName(runs[2]?.semantics ?? []), 'OMI Strong Emphasis');
});
