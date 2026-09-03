import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  collectStudyNotes,
  collectStudyNoteOverview,
  countStudyNotes,
  getCurrentStudyNotes,
  resolveCurrentStudy,
} from '../src/model/currentStudyNotes.ts';
import { createDocumentStructureProfile } from '../src/model/documentProfile.ts';
import { createNoteAnnotation } from '../src/model/notes.ts';
import type {
  OmiBlock,
  OmiManuscriptState,
  OmiSection,
} from '../src/types/omi.ts';

test('resolves the active study subtree and includes only its anchored notes', () => {
  const manuscript = createVolumeState();
  const current = getCurrentStudyNotes(manuscript, 'study-a-child');

  assert.equal(current?.study.rootSectionId, 'study-a');
  assert.deepEqual(
    current?.study.sections.map((section) => section.id),
    ['study-a', 'study-a-child'],
  );
  assert.deepEqual(
    current?.notes.map((note) => note.id),
    ['note-a', 'note-a-child'],
  );
});

test('nested OMI blocks contribute notes to their owning study', () => {
  const manuscript = createVolumeState();
  const study = resolveCurrentStudy(manuscript, 'study-a');

  assert.ok(study);
  assert.deepEqual(
    collectStudyNotes(manuscript, study).map((note) => note.id),
    ['note-a', 'note-a-child'],
  );
  assert.equal(countStudyNotes(manuscript, study), 2);
  assert.deepEqual(
    [...collectStudyNoteOverview(manuscript, study).numberByNoteId.entries()],
    [['note-a', 1], ['note-a-child', 2], ['note-b', 1]],
  );
});

test('a standalone study treats all of its sections as one editing unit', () => {
  const manuscript = createVolumeState();
  manuscript.documentStructure = createDocumentStructureProfile('study');

  const current = getCurrentStudyNotes(manuscript, 'study-b');

  assert.equal(current?.study.rootSectionId, 'study-a');
  assert.deepEqual(
    current?.study.sections.map((section) => section.id),
    ['study-a', 'study-a-child', 'study-b'],
  );
  assert.deepEqual(
    current?.notes.map((note) => note.id),
    ['note-a', 'note-a-child', 'note-b'],
  );
});

test('the desktop UI exposes one toggle and a natural-height note footer', () => {
  const headerSource = readFileSync(
    new URL('../src/components/Header.tsx', import.meta.url),
    'utf8',
  );
  const editorSource = readFileSync(
    new URL('../src/components/ContinuousManuscriptEditor.tsx', import.meta.url),
    'utf8',
  );
  const footerSource = readFileSync(
    new URL('../src/components/CurrentStudyNotesFooter.tsx', import.meta.url),
    'utf8',
  );
  const continuousStyles = readFileSync(
    new URL('../src/styles/continuous-editor.css', import.meta.url),
    'utf8',
  );
  const shellStyles = readFileSync(
    new URL('../src/styles/academic-shell.css', import.meta.url),
    'utf8',
  );

  assert.match(headerSource, /<StickyNote/);
  assert.match(headerSource, /aria-pressed=\{currentStudyNotesVisible\}/);
  assert.match(headerSource, /aria-controls="omi-current-study-notes"/);
  assert.match(editorSource, /<CurrentStudyNotesFooter/);
  assert.match(editorSource, /currentStudy\?\.rootSectionId === study\.rootSectionId/);
  assert.match(footerSource, /numberByNoteId\.get\(note\.id\)/);
  assert.match(footerSource, /findRenderedNoteElement\(note\.id\)/);
  assert.match(
    continuousStyles,
    /\.omi-current-study-notes \{[\s\S]*?height: auto;[\s\S]*?max-height: none;[\s\S]*?overflow: visible;/,
  );
  assert.match(
    shellStyles,
    /@media \(max-width: 760px\)[\s\S]*?\.focus-current-notes-button \{\s*display: none;/,
  );
});

function createVolumeState(): OmiManuscriptState {
  const now = '2026-09-02T00:00:00.000Z';
  const sections: OmiSection[] = [
    section('study-a', undefined, block('block-a', 'note-a')),
    section(
      'study-a-child',
      'study-a',
      {
        ...block('block-a-container', 'note-a-child'),
        children: [block('block-a-child')],
      },
    ),
    section('study-b', undefined, block('block-b', 'note-b')),
  ];
  const notes = [
    createNoteAnnotation({
      id: 'note-b',
      anchorId: 'anchor-note-b',
      targetBlockId: 'block-b',
      body: 'B',
      timestamp: now,
    }),
    createNoteAnnotation({
      id: 'note-a-child',
      anchorId: 'anchor-note-a-child',
      targetBlockId: 'block-a-child',
      body: 'A child',
      timestamp: now,
    }),
    createNoteAnnotation({
      id: 'note-a',
      anchorId: 'anchor-note-a',
      targetBlockId: 'block-a',
      body: 'A',
      timestamp: now,
    }),
  ];

  return {
    schema: 'https://openmanuscript.org/schemas/omi-manuscript-0.1.json',
    id: 'manuscript-1',
    version: '0.1.0-alpha.1',
    identityModelVersion: 'OMI-SPEC-150@0.1.0',
    locale: 'en',
    title: 'Volume',
    keywords: [],
    agents: [],
    contributions: [],
    tombstones: [],
    documentStructure: createDocumentStructureProfile('volume', 'edited-volume'),
    sections,
    annotations: notes,
    citations: [],
    createdAt: now,
    updatedAt: now,
  };
}

function section(
  id: string,
  parentSectionId: string | undefined,
  contentBlock: OmiBlock,
): OmiSection {
  return {
    id,
    title: id,
    ...(parentSectionId ? { parentSectionId } : {}),
    blocks: [contentBlock],
  } as OmiSection;
}

function block(id: string, noteId?: string): OmiBlock {
  return {
    id,
    type: 'paragraph',
    content: JSON.stringify({
      type: 'doc',
      content: [{
        type: 'paragraph',
        ...(noteId
          ? {
              content: [{
                type: 'omiNote',
                attrs: {
                  noteId,
                  anchorId: `anchor-${noteId}`,
                  label: '?',
                  noteType: 'footnote',
                },
              }],
            }
          : {}),
      }],
    }),
  };
}
