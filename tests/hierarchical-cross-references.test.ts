import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectCrossReferenceTargets,
  createCrossReference,
  synchronizeCrossReferenceLabels,
} from '../src/model/crossReferences.ts';
import { reparentSection } from '../src/model/sectionStructure.ts';
import type { OmiSection } from '../src/types/omi.ts';

function paragraphWithReference(
  crossReferenceId: string,
  anchorId: string,
): OmiSection['blocks'][number] {
  return {
    id: 'paragraph-source',
    type: 'paragraph',
    content: JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'omiCrossReference',
              attrs: {
                crossReferenceId,
                anchorId,
                label: 'Figure 1.1.1.1',
                unresolved: false,
              },
            },
          ],
        },
      ],
    }),
  };
}

function figure(id: string): OmiSection['blocks'][number] {
  return {
    id,
    type: 'image',
    content: '',
    visual: {
      kind: 'image',
      src: 'data:image/png;base64,AA==',
      mediaType: 'image/png',
      alt: 'Hierarchy figure',
      caption: 'Hierarchy figure',
    },
  };
}

test('section-scoped object numbering follows hierarchical section paths', () => {
  const sections: OmiSection[] = [
    { id: 'a', title: 'A', blocks: [] },
    { id: 'a1', parentSectionId: 'a', title: 'A1', blocks: [] },
    {
      id: 'a11',
      parentSectionId: 'a1',
      title: 'A11',
      blocks: [figure('figure-deep')],
    },
    { id: 'b', title: 'B', blocks: [] },
  ];
  const targets = collectCrossReferenceTargets({
    sections,
    crossReferenceNumbering: 'section',
  });

  assert.equal(targets.find((target) => target.id === 'a11')?.number, '1.1.1');
  assert.equal(
    targets.find((target) => target.id === 'figure-deep')?.number,
    '1.1.1.1',
  );
});

test('reparenting renumbers derived xref labels without changing target identity', () => {
  const reference = createCrossReference({
    id: 'xref-deep',
    anchorId: 'anchor-deep',
    sourceBlockId: 'paragraph-source',
    targetId: 'figure-deep',
    targetKind: 'figure',
  });
  const initial: OmiSection[] = [
    {
      id: 'a',
      title: 'A',
      blocks: [paragraphWithReference(reference.id, reference.anchorId)],
    },
    { id: 'a1', parentSectionId: 'a', title: 'A1', blocks: [] },
    {
      id: 'a11',
      parentSectionId: 'a1',
      title: 'A11',
      blocks: [figure('figure-deep')],
    },
    { id: 'b', title: 'B', blocks: [] },
  ];
  const reparented = reparentSection(initial, 'a1', 'b');
  const synchronized = synchronizeCrossReferenceLabels(
    reparented,
    [reference],
    'section',
    'en',
  );
  const source = synchronized
    .flatMap((section) => section.blocks)
    .find((block) => block.id === 'paragraph-source');
  const targets = collectCrossReferenceTargets({
    sections: synchronized,
    crossReferenceNumbering: 'section',
  });

  assert.equal(reference.targetId, 'figure-deep');
  assert.equal(targets.find((target) => target.id === 'a1')?.number, '2.1');
  assert.equal(
    targets.find((target) => target.id === 'figure-deep')?.number,
    '2.1.1.1',
  );
  assert.ok(source?.content.includes('Figure 2.1.1.1'));
});
