import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildListPlacementGroups,
  buildReferencePlacementGroups,
} from '../src/model/backMatterPlacement.ts';
import { createDocumentStructureProfile } from '../src/model/documentProfile.ts';
import { buildNoteNumberMap, createNoteAnnotation } from '../src/model/notes.ts';
import type {
  OmiBibliographicRecord,
  OmiBlock,
  OmiManuscriptState,
  OmiSection,
} from '../src/types/omi.ts';

test('note numbering can continue or restart per study or per section', () => {
  const manuscript = structureFixture();

  manuscript.documentStructure = {
    ...createDocumentStructureProfile('volume', 'edited-volume'),
    noteNumberingScope: 'continuous',
  };
  assert.deepEqual([...buildNoteNumberMap(manuscript)], [
    ['note-a', 1],
    ['note-b', 2],
    ['note-c', 3],
  ]);

  manuscript.documentStructure.noteNumberingScope = 'study';
  assert.deepEqual([...buildNoteNumberMap(manuscript)], [
    ['note-a', 1],
    ['note-b', 2],
    ['note-c', 1],
  ]);

  manuscript.documentStructure.noteNumberingScope = 'section';
  assert.deepEqual([...buildNoteNumberMap(manuscript)], [
    ['note-a', 1],
    ['note-b', 1],
    ['note-c', 1],
  ]);
});

test('references and generated lists follow independent volume placement rules', () => {
  const manuscript = structureFixture();
  manuscript.documentStructure = {
    ...createDocumentStructureProfile('volume', 'edited-volume'),
    referencesPlacement: 'study-end',
    listsPlacement: 'volume-end',
  };

  const references = buildReferencePlacementGroups(manuscript);
  const lists = buildListPlacementGroups(manuscript);

  assert.deepEqual(references.map((group) => group.id), ['study-a', 'study-b']);
  assert.deepEqual(references.map((group) => group.bibliographicRecordIds), [
    ['record-a', 'record-shared'],
    ['record-b', 'record-shared'],
  ]);
  assert.equal(lists.length, 1);
  assert.equal(lists[0]?.id, 'volume');
  assert.deepEqual(lists[0]?.sections.map((section) => section.id), [
    'study-a',
    'study-a-subsection',
    'study-b',
  ]);

  manuscript.documentStructure.referencesPlacement = 'volume-end';
  assert.deepEqual(
    buildReferencePlacementGroups(manuscript)[0]?.bibliographicRecordIds,
    ['record-a', 'record-shared', 'record-b'],
  );
});

function structureFixture(): OmiManuscriptState {
  const now = '2026-09-02T08:00:00.000Z';
  const sections: OmiSection[] = [
    section('study-a', 'Study A', block('block-a', 'note-a')),
    {
      ...section('study-a-subsection', 'Study A.1', block('block-a-sub', 'note-b')),
      parentSectionId: 'study-a',
    } as OmiSection,
    section('study-b', 'Study B', block('block-b', 'note-c')),
  ];
  const records: OmiBibliographicRecord[] = [
    record('record-a', 'Reference A'),
    record('record-b', 'Reference B'),
    record('record-shared', 'Shared reference'),
  ];

  return {
    schema: 'https://openmanuscript.org/schemas/omi-manuscript-0.1.json',
    id: 'volume',
    version: '0.1.0-alpha.1',
    identityModelVersion: 'OMI-SPEC-150@0.1.0',
    locale: 'en',
    title: 'Volume',
    keywords: [],
    agents: [],
    contributions: [],
    tombstones: [],
    sections,
    annotations: [
      createNoteAnnotation({ id: 'note-a', anchorId: 'anchor-note-a', targetBlockId: 'block-a', timestamp: now }),
      createNoteAnnotation({ id: 'note-b', anchorId: 'anchor-note-b', targetBlockId: 'block-a-sub', timestamp: now }),
      createNoteAnnotation({ id: 'note-c', anchorId: 'anchor-note-c', targetBlockId: 'block-b', timestamp: now }),
    ],
    bibliographicRecords: records,
    citations: [
      citation('citation-a', 'record-a', 'block-a'),
      citation('citation-shared-a', 'record-shared', 'block-a-sub'),
      citation('citation-b', 'record-b', 'block-b'),
      citation('citation-shared-b', 'record-shared', 'block-b'),
    ],
    createdAt: now,
    updatedAt: now,
  };
}

function section(id: string, title: string, content: OmiBlock): OmiSection {
  return { id, title, blocks: [content] };
}

function block(id: string, noteId: string): OmiBlock {
  return {
    id,
    type: 'paragraph',
    content: JSON.stringify({
      type: 'doc',
      content: [{
        type: 'paragraph',
        content: [{
          type: 'omiNote',
          attrs: {
            noteId,
            anchorId: `anchor-${noteId}`,
            label: '?',
            noteType: 'footnote',
          },
        }],
      }],
    }),
  };
}

function record(id: string, title: string): OmiBibliographicRecord {
  return {
    id,
    type: 'book',
    title,
    contributors: [],
    identifiers: [],
    status: 'resolved',
  };
}

function citation(id: string, target: string, targetBlockId: string) {
  return {
    id,
    target,
    anchorId: `anchor-${id}`,
    targetBlockId,
  };
}
