import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createManuscriptClipboardFragment,
  pasteManuscriptFragmentWithNotes,
} from '../src/editor/manuscriptClipboard.ts';
import type { OmiAnnotation, OmiSection } from '../src/types/omi.ts';

const content = JSON.stringify({
  type: 'doc',
  content: [{
    type: 'paragraph',
    content: [
      { type: 'text', text: 'Before ' },
      { type: 'omiNote', attrs: { noteId: 'note-source', anchorId: 'anchor-source', label: '1', noteType: 'footnote' } },
      { type: 'text', text: ' after' },
    ],
  }],
});

const annotations: OmiAnnotation[] = [{
  id: 'note-source',
  type: 'note',
  noteKind: 'footnote',
  anchorId: 'anchor-source',
  targetBlockId: 'source-block',
  body: 'A source note with its full text.',
  renderingHint: 'footnote',
}];

const source: OmiSection[] = [{
  id: 'source-section',
  title: 'Source',
  blocks: [{ id: 'source-block', type: 'paragraph', content }],
}];

test('OMI clipboard carries note annotations with a copied text range', () => {
  const fragment = createManuscriptClipboardFragment(
    source,
    'source-block',
    0,
    'source-block',
    13,
    annotations,
  );

  assert.equal(fragment?.annotations?.[0]?.body, annotations[0]?.body);
  const copied = JSON.stringify(fragment?.blocks[0]?.content);
  assert.match(copied, /omiNote/);
});

test('pasting an OMI fragment creates an independent note annotation and anchor', () => {
  const fragment = createManuscriptClipboardFragment(
    source,
    'source-block',
    0,
    'source-block',
    13,
    annotations,
  )!;
  const target: OmiSection[] = [{
    id: 'target-section',
    title: 'Target',
    blocks: [{ id: 'target-block', type: 'paragraph', content: 'Existing text' }],
  }];

  const pasted = pasteManuscriptFragmentWithNotes(
    target,
    'target-block',
    0,
    fragment,
    [],
  );
  const note = pasted.annotations[0];
  assert.equal(note?.body, annotations[0]?.body);
  assert.equal(note?.targetBlockId, 'target-block');
  assert.notEqual(note?.id, annotations[0]?.id);
  assert.notEqual(note?.anchorId, annotations[0]?.anchorId);
  assert.match(pasted.sections[0]?.blocks[0]?.content ?? '', new RegExp(note?.id ?? 'missing'));
});
