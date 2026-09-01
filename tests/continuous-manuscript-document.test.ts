import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildContinuousManuscriptDocument,
  OMI_VISUAL_NODE,
  projectContinuousManuscriptDocument,
} from '../src/editor/continuousManuscriptDocument.ts';
import { getParentSectionId } from '../src/model/sectionStructure.ts';
import { createTableBlock } from '../src/model/visualBlocks.ts';
import type { OmiBlock, OmiSection } from '../src/types/omi.ts';

test('continuous document round-trip preserves hierarchical OMI structure', () => {
  const sections: OmiSection[] = [
    section('section-a', 'First', [
      textBlock('heading-a', 'heading', 'heading', 'First', { level: 1 }),
      textBlock('paragraph-a', 'paragraph', 'paragraph', 'Alpha'),
    ]),
    {
      ...section('section-b', 'Second', [
        textBlock('heading-b', 'heading', 'heading', 'Second', { level: 2 }),
        textBlock('paragraph-b', 'paragraph', 'paragraph', 'Beta'),
      ]),
      parentSectionId: 'section-a',
    } as OmiSection,
  ];

  const projected = projectContinuousManuscriptDocument(
    buildContinuousManuscriptDocument(sections),
    sections,
  );

  assert.deepEqual(projected.map((item) => item.id), ['section-a', 'section-b']);
  assert.equal(getParentSectionId(projected[1]!), 'section-a');
  assert.deepEqual(
    projected.flatMap((item) => item.blocks.map((block) => block.id)),
    ['heading-a', 'paragraph-a', 'heading-b', 'paragraph-b'],
  );
  assert.equal(projected[1]?.title, 'Second');
});

test('a paragraph split keeps the original ID and assigns a new stable block ID', () => {
  const sections = [section('section-a', 'First', [
    textBlock('heading-a', 'heading', 'heading', 'First', { level: 1 }),
    textBlock('paragraph-a', 'paragraph', 'paragraph', 'Alpha'),
  ])];
  const document = buildContinuousManuscriptDocument(sections);
  const paragraph = document.content?.[1];
  assert.ok(paragraph);
  document.content?.splice(2, 0, {
    ...paragraph,
    content: [{ type: 'text', text: 'Beta' }],
  });

  const ids = ['new-block'];
  const projected = projectContinuousManuscriptDocument(document, sections, {
    createId: () => ids.shift() ?? 'fallback',
  });

  assert.deepEqual(
    projected[0]?.blocks.map((block) => block.id),
    ['heading-a', 'paragraph-a', 'new-block'],
  );
});

test('turning a paragraph into a heading creates a subsection automatically', () => {
  const sections = [section('section-a', 'First', [
    textBlock('heading-a', 'heading', 'heading', 'First', { level: 1 }),
    textBlock('paragraph-a', 'paragraph', 'paragraph', 'New subsection'),
  ])];
  const document = buildContinuousManuscriptDocument(sections);
  const paragraph = document.content?.[1];
  assert.ok(paragraph);
  paragraph.type = 'heading';
  paragraph.attrs = { ...paragraph.attrs, level: 2, omiBlockType: 'heading' };

  const projected = projectContinuousManuscriptDocument(document, sections, {
    createId: () => 'section-b',
  });

  assert.equal(projected.length, 2);
  assert.equal(projected[1]?.id, 'section-b');
  assert.equal(projected[1]?.title, 'New subsection');
  assert.equal(getParentSectionId(projected[1]!), 'section-a');
  assert.equal(projected[1]?.blocks[0]?.id, 'paragraph-a');
});

test('deleting a heading merges its following blocks into the preceding section', () => {
  const sections = [
    section('section-a', 'First', [
      textBlock('heading-a', 'heading', 'heading', 'First', { level: 1 }),
      textBlock('paragraph-a', 'paragraph', 'paragraph', 'Alpha'),
    ]),
    section('section-b', 'Second', [
      textBlock('heading-b', 'heading', 'heading', 'Second', { level: 1 }),
      textBlock('paragraph-b', 'paragraph', 'paragraph', 'Beta'),
    ]),
  ];
  const document = buildContinuousManuscriptDocument(sections);
  document.content = document.content?.filter(
    (node) => node.attrs?.omiBlockId !== 'heading-b',
  );

  const projected = projectContinuousManuscriptDocument(document, sections);

  assert.equal(projected.length, 1);
  assert.deepEqual(
    projected[0]?.blocks.map((block) => block.id),
    ['heading-a', 'paragraph-a', 'paragraph-b'],
  );
});

test('structured visual blocks remain atomic nodes and preserve their data', () => {
  const table = createTableBlock([['Name', 'Value'], ['A', '1']], {}, 'table-a');
  const sections = [section('section-a', 'First', [
    textBlock('heading-a', 'heading', 'heading', 'First', { level: 1 }),
    table,
  ])];

  const document = buildContinuousManuscriptDocument(sections);
  assert.equal(document.content?.[1]?.type, OMI_VISUAL_NODE);
  const projected = projectContinuousManuscriptDocument(document, sections);

  assert.deepEqual(projected[0]?.blocks[1], table);
});

function section(id: string, title: string, blocks: OmiBlock[]): OmiSection {
  return { id, title, blocks };
}

function textBlock(
  id: string,
  blockType: string,
  nodeType: string,
  text: string,
  attrs?: Record<string, unknown>,
): OmiBlock {
  return {
    id,
    type: blockType,
    content: JSON.stringify({
      type: 'doc',
      content: [{
        type: nodeType,
        ...(attrs ? { attrs } : {}),
        content: [{ type: 'text', text }],
      }],
    }),
  };
}
