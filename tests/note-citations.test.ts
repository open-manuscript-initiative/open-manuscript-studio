import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createNoteCitation,
  renderNoteCitation,
} from '../src/model/noteCitations.ts';
import type { OmiAnnotation, OmiBibliographicRecord } from '../src/types/omi.ts';

const record: OmiBibliographicRecord = {
  id: 'record-1',
  type: 'journal-article',
  title: 'A portable scholarly reference',
  contributors: [{
    id: 'contrib-1',
    role: 'author',
    givenName: 'Ada',
    familyName: 'Scholar',
  }],
  issued: '2026',
  identifiers: [],
  status: 'verified',
};

const note: OmiAnnotation = {
  id: 'note-1',
  type: 'note',
  noteKind: 'footnote',
  anchorId: 'anchor-1',
  targetBlockId: 'block-1',
  body: 'See the cited study.',
  renderingHint: 'footnote',
};

test('note citation references bibliography record and keeps locator semantics', () => {
  const citation = createNoteCitation('record-1', {
    type: 'page',
    value: '42',
  });

  assert.equal(citation.target, 'record-1');
  assert.deepEqual(citation.locator, { type: 'page', value: '42' });

  const rendered = renderNoteCitation(citation, note, [record], 'apa-7', 'en');
  assert.match(rendered, /Scholar/);
  assert.match(rendered, /2026/);
  assert.match(rendered, /42/);
});
