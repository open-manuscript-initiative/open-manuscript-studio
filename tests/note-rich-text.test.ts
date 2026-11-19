import { renderPublicationNoteBody } from '../src/services/publicationNoteBody.ts';
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

test('publication note markup preserves rich runs, breaks and lists without trusting source HTML', () => {
  const note = { id: 'formatted', type: 'note', body: 'stale plain text', bodyContent: JSON.stringify({ type: 'doc', content: [
    { type: 'paragraph', content: [
      { type: 'text', text: '<script>unsafe</script> & ', marks: [{ type: 'bold' }, { type: 'italic' }] },
      { type: 'text', text: 'styled', marks: [{ type: 'omiUnderline' }, { type: 'strike' }, { type: 'omiSmallCaps' }] },
      { type: 'text', text: '2', marks: [{ type: 'omiSuperscript' }] },
      { type: 'text', text: 'n', marks: [{ type: 'omiSubscript' }] },
      { type: 'hardBreak' }, { type: 'text', text: 'Line\ttab' },
    ] },
    { type: 'paragraph', content: [{ type: 'text', text: 'link', marks: [{ type: 'omiLink', attrs: { href: 'https://source.example/?a=1&b=2"' } }, { type: 'omiLanguage', attrs: { lang: 'de' } }] }] },
    { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item' }] }] }] },
  ] }) } as OmiAnnotation;
  const before = JSON.stringify(note);
  const rendered = renderPublicationNoteBody(note, [], 'apa-7', 'en');
  assert.match(rendered.html, /<em><strong>&lt;script&gt;unsafe&lt;\/script&gt; &amp; <\/strong><\/em>/);
  assert.match(rendered.html, /font-variant:small-caps/);
  assert.match(rendered.html, /<del><u>styled<\/u><\/del>/);
  assert.match(rendered.html, /<sup>2<\/sup><sub>n<\/sub><br>Line\ttab<br>/);
  assert.match(rendered.html, /<span lang="de"><a href="https:\/\/source.example\/\?a=1&amp;b=2%22" rel="external">link<\/a><\/span><br>• Item/);
  assert.doesNotMatch(rendered.html, /<script>|<p>|<div>|stale plain text/);
  assert.equal(JSON.stringify(note), before);
});

test('publication rendering retains legacy plain notes and their generated citation labels', () => {
  const note = { id: 'legacy', type: 'note', body: 'Legacy <note>\nnext', noteCitations: [{ id: 'c', target: record.id }] } as OmiAnnotation;
  const rendered = renderPublicationNoteBody(note, [record], 'apa-7', 'en');
  assert.match(rendered.html, /Legacy &lt;note&gt;<br>next/);
  assert.match(rendered.html, /Scholar/);
  assert.equal(rendered.text, noteBodyPlainText(createNoteBodyDocument(note, [record], 'apa-7', 'en')));
});
