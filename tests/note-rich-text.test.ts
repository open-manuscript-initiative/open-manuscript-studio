import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectNoteCitationIds,
  createNoteBodyDocument,
  noteBodyPlainText,
} from '../src/model/noteRichText.ts';
import type { OmiAnnotation, OmiBibliographicRecord } from '../src/types/omi.ts';

const record: OmiBibliographicRecord = {
  id: 'bib-one',
  type: 'journal-article',
  title: 'Structured Notes',
  contributors: [{ id: 'author-one', role: 'author', familyName: 'Scholar', givenName: 'Ada' }],
  issued: '2026',
  identifiers: [],
  status: 'verified',
};

test('migrates legacy note citations into inline rich note content', () => {
  const note = {
    id: 'note-one',
    type: 'note',
    noteKind: 'footnote',
    anchorId: 'anchor-one',
    targetBlockId: 'block-one',
    body: 'See also',
    renderingHint: 'footnote',
    noteCitations: [{
      id: 'note-citation-one',
      target: record.id,
      locator: { type: 'page', value: '45–47' },
    }],
  } as OmiAnnotation;

  const document = createNoteBodyDocument(note, [record], 'apa-7', 'en');
  assert.deepEqual(collectNoteCitationIds(document), ['note-citation-one']);
  const text = noteBodyPlainText(document);
  assert.match(text, /See also/);
  assert.match(text, /Scholar/);
  assert.match(text, /45/);
});

test('collects citations in exact note-body order', () => {
  const document = {
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [
        { type: 'text', text: 'First ' },
        { type: 'omiCitation', attrs: { citationId: 'c1', label: '(A, 2020)' } },
        { type: 'text', text: ', then ' },
        { type: 'omiCitation', attrs: { citationId: 'c2', label: '(B, 2021)' } },
      ],
    }],
  };
  assert.deepEqual(collectNoteCitationIds(document), ['c1', 'c2']);
  assert.equal(noteBodyPlainText(document), 'First (A, 2020), then (B, 2021)');
});
