import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectNoteAnchors,
  createNoteAnnotation,
  getNoteNumber,
  reconcileNoteState,
  removeNoteFromState,
} from '../src/model/notes.ts';
import type { OmiManuscriptState } from '../src/types/omi.ts';

function noteDocument(...noteIds: string[]): string {
  return JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: noteIds.map((noteId) => ({
          type: 'omiNote',
          attrs: {
            noteId,
            anchorId: `anchor-${noteId}`,
            label: '?',
            noteType: 'footnote',
          },
        })),
      },
    ],
  });
}

function createState(): OmiManuscriptState {
  const now = '2026-08-07T00:00:00.000Z';

  return {
    schema: 'https://openmanuscript.org/schemas/omi-manuscript-0.1.json',
    id: 'manuscript-1',
    version: '0.1.0-alpha.1',
    identityModelVersion: 'OMI-SPEC-150@0.1.0',
    locale: 'en',
    title: 'Test',
    keywords: [],
    agents: [],
    contributions: [],
    tombstones: [],
    sections: [
      {
        id: 'section-1',
        title: 'Section',
        blocks: [
          {
            id: 'block-1',
            type: 'paragraph',
            content: noteDocument('note-a', 'note-b'),
          },
        ],
      },
    ],
    annotations: [
      createNoteAnnotation({
        id: 'note-a',
        anchorId: 'anchor-note-a',
        targetBlockId: 'block-1',
        body: 'First note',
        timestamp: now,
      }),
      createNoteAnnotation({
        id: 'note-b',
        anchorId: 'anchor-note-b',
        targetBlockId: 'block-1',
        kind: 'endnote',
        body: 'Second note',
        timestamp: now,
      }),
    ],
    citations: [],
    createdAt: now,
    updatedAt: now,
  };
}

test('note annotations remain separate from inline anchors', () => {
  const state = createState();
  const anchors = collectNoteAnchors(state);

  assert.equal(anchors.length, 2);
  assert.equal(state.annotations[0]?.body, 'First note');
  assert.equal(getNoteNumber(state, 'note-a'), 1);
  assert.equal(getNoteNumber(state, 'note-b'), 2);
});

test('reconciliation numbers anchors and derives note presentation from annotation metadata', () => {
  const result = reconcileNoteState(createState());
  const block = result.state.sections[0]?.blocks[0];
  const parsed = JSON.parse(block?.content ?? '{}') as {
    content?: Array<{ content?: Array<{ attrs?: Record<string, unknown> }> }>;
  };
  const inline = parsed.content?.[0]?.content ?? [];

  assert.equal(inline[0]?.attrs?.label, '1');
  assert.equal(inline[1]?.attrs?.label, '2');
  assert.equal(inline[1]?.attrs?.noteType, 'endnote');
  assert.ok(result.blockChanges.length >= 1);
});

test('deleting a note removes its inline anchor and renumbers surviving notes', () => {
  const result = removeNoteFromState(createState(), 'note-a');
  const anchors = collectNoteAnchors(result.state);

  assert.deepEqual(
    result.state.annotations.map((annotation) => annotation.id),
    ['note-b'],
  );
  assert.deepEqual(anchors.map((anchor) => anchor.noteId), ['note-b']);
  assert.equal(getNoteNumber(result.state, 'note-b'), 1);
  assert.equal(result.removedAnnotations[0]?.id, 'note-a');
});

test('orphan note annotations are removed only when explicitly requested', () => {
  const state = createState();
  state.sections[0]!.blocks[0]!.content = noteDocument('note-a');

  const preserved = reconcileNoteState(state, {
    removeOrphanAnnotations: false,
  });
  const cleaned = reconcileNoteState(state, {
    removeOrphanAnnotations: true,
  });

  assert.equal(preserved.state.annotations.length, 2);
  assert.deepEqual(
    cleaned.state.annotations.map((annotation) => annotation.id),
    ['note-a'],
  );
  assert.equal(cleaned.removedAnnotations[0]?.id, 'note-b');
});
