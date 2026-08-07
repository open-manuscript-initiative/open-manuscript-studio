import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectCrossReferenceAnchors,
  collectCrossReferenceTargets,
  createCrossReference,
  formatCrossReferenceLabel,
  removeCrossReferenceAnchorFromSections,
  synchronizeCrossReferenceLabels,
  validateCrossReferences,
} from '../src/model/crossReferences.ts';
import type {
  OmiCrossReference,
  OmiSection,
} from '../src/types/omi.ts';

function paragraphWithReference(
  blockId: string,
  crossReferenceId: string,
  anchorId: string,
  label = 'Figure 1',
): OmiSection['blocks'][number] {
  return {
    id: blockId,
    type: 'paragraph',
    content: JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'See ' },
            {
              type: 'omiCrossReference',
              attrs: {
                crossReferenceId,
                anchorId,
                label,
                unresolved: false,
              },
            },
          ],
        },
      ],
    }),
  };
}

function visualBlock(
  id: string,
  kind: 'image' | 'table' | 'chart' | 'equation',
  title = '',
): OmiSection['blocks'][number] {
  if (kind === 'image') {
    return {
      id,
      type: 'image',
      content: '',
      visual: {
        kind: 'image',
        src: 'data:image/png;base64,AA==',
        mediaType: 'image/png',
        alt: title || 'Image',
        caption: title || undefined,
      },
    };
  }

  if (kind === 'table') {
    return {
      id,
      type: 'table',
      content: '',
      visual: {
        kind: 'table',
        cells: [['A']],
        caption: title || undefined,
      },
    };
  }

  if (kind === 'chart') {
    return {
      id,
      type: 'chart',
      content: '',
      visual: {
        kind: 'chart',
        chartType: 'bar',
        cells: [['x', 'y'], ['A', '1']],
        title: title || undefined,
      },
    };
  }

  return {
    id,
    type: 'equation',
    content: '',
    visual: {
      kind: 'equation',
      notation: 'latex',
      source: 'x=1',
      latex: 'x=1',
      label: title || undefined,
    },
  };
}

const sections: OmiSection[] = [
  {
    id: 'section-a',
    title: 'Introduction',
    blocks: [
      visualBlock('figure-a', 'image', 'Overview'),
      visualBlock('table-a', 'table', 'Results'),
      visualBlock('chart-a', 'chart', 'Trend'),
      visualBlock('equation-a', 'equation', 'Energy'),
    ],
  },
  {
    id: 'section-b',
    title: 'Methods',
    blocks: [visualBlock('figure-b', 'image', 'Workflow')],
  },
];

test('derives document-wide object numbers without mutating scholarly titles', () => {
  const targets = collectCrossReferenceTargets({
    sections,
    crossReferenceNumbering: 'document',
  });

  assert.equal(targets.find((item) => item.id === 'section-a')?.number, '1');
  assert.equal(targets.find((item) => item.id === 'figure-a')?.number, '1');
  assert.equal(targets.find((item) => item.id === 'figure-b')?.number, '2');
  assert.equal(targets.find((item) => item.id === 'table-a')?.number, '1');
  assert.equal(targets.find((item) => item.id === 'chart-a')?.number, '1');
  assert.equal(targets.find((item) => item.id === 'equation-a')?.number, '1');
  assert.equal(sections[0]?.title, 'Introduction');
});

test('can restart visual numbering in each top-level section', () => {
  const targets = collectCrossReferenceTargets({
    sections,
    crossReferenceNumbering: 'section',
  });

  assert.equal(targets.find((item) => item.id === 'figure-a')?.number, '1.1');
  assert.equal(targets.find((item) => item.id === 'figure-b')?.number, '2.1');
  assert.equal(targets.find((item) => item.id === 'table-a')?.number, '1.1');
});

test('formats localized labels while target identity stays stable', () => {
  const target = collectCrossReferenceTargets({
    sections,
    crossReferenceNumbering: 'document',
  }).find((item) => item.id === 'figure-a');
  const reference = createCrossReference({
    id: 'xref-1',
    anchorId: 'anchor-1',
    targetId: 'figure-a',
    targetKind: 'figure',
    sourceBlockId: 'paragraph-a',
    displayStyle: 'label-number',
  });

  assert.equal(formatCrossReferenceLabel(reference, target, 'en'), 'Figure 1');
  assert.equal(formatCrossReferenceLabel(reference, target, 'hu'), '1. ábra');
  assert.equal(formatCrossReferenceLabel(reference, target, 'de'), 'Abbildung 1');
  assert.equal(reference.targetId, 'figure-a');
});

test('renumbering after structural reorder updates only the derived inline label', () => {
  const reference: OmiCrossReference = createCrossReference({
    id: 'xref-1',
    anchorId: 'anchor-1',
    targetId: 'figure-b',
    targetKind: 'figure',
    sourceBlockId: 'paragraph-a',
  });
  const sourceSections: OmiSection[] = [
    {
      ...sections[0]!,
      blocks: [
        paragraphWithReference('paragraph-a', reference.id, reference.anchorId, 'Figure 2'),
        ...sections[0]!.blocks,
      ],
    },
    sections[1]!,
  ];
  const reordered = [sourceSections[1]!, sourceSections[0]!];
  const synchronized = synchronizeCrossReferenceLabels(
    reordered,
    [reference],
    'document',
    'en',
  );
  const paragraph = synchronized[1]?.blocks.find(
    (block) => block.id === 'paragraph-a',
  );

  assert.ok(paragraph?.content.includes('Figure 1'));
  assert.equal(reference.targetId, 'figure-b');
});

test('missing targets remain visible as unresolved references and are validated', () => {
  const reference = createCrossReference({
    id: 'xref-missing',
    anchorId: 'anchor-missing',
    targetId: 'deleted-figure',
    targetKind: 'figure',
    sourceBlockId: 'paragraph-a',
  });
  const sourceSections: OmiSection[] = [
    {
      id: 'section-a',
      title: 'Introduction',
      blocks: [
        paragraphWithReference(
          'paragraph-a',
          reference.id,
          reference.anchorId,
        ),
      ],
    },
  ];
  const synchronized = synchronizeCrossReferenceLabels(
    sourceSections,
    [reference],
    'document',
    'hu',
  );
  const issues = validateCrossReferences({
    sections: synchronized,
    crossReferences: [reference],
    crossReferenceNumbering: 'document',
  });

  assert.ok(synchronized[0]?.blocks[0]?.content.includes('[feloldatlan hivatkozás]'));
  assert.deepEqual(issues.map((issue) => issue.type), ['missing-target']);
});

test('collects and removes stable inline cross-reference anchors', () => {
  const section: OmiSection = {
    id: 'section-a',
    title: 'Introduction',
    blocks: [
      paragraphWithReference('paragraph-a', 'xref-1', 'anchor-1'),
    ],
  };
  const anchors = collectCrossReferenceAnchors([section]);
  const removed = removeCrossReferenceAnchorFromSections(
    [section],
    'xref-1',
  );

  assert.deepEqual(anchors, [
    {
      crossReferenceId: 'xref-1',
      anchorId: 'anchor-1',
      sourceBlockId: 'paragraph-a',
    },
  ]);
  assert.equal(
    collectCrossReferenceAnchors(removed).length,
    0,
  );
});
