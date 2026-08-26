import assert from 'node:assert/strict';
import test from 'node:test';

import {
  collectCrossReferenceTargets,
  createCrossReference,
  formatCrossReferenceLabel,
  synchronizeCrossReferenceLabels,
  validateCrossReferences,
} from '../src/model/crossReferences.ts';
import { createNamedAnchor } from '../src/model/namedAnchors.ts';
import type { OmiSection } from '../src/types/omi.ts';

const paragraph: OmiSection['blocks'][number] = {
  id: 'paragraph-target',
  type: 'paragraph',
  content: JSON.stringify({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Important passage' }] }],
  }),
};

const sourceBlock: OmiSection['blocks'][number] = {
  id: 'paragraph-source',
  type: 'paragraph',
  content: JSON.stringify({
    type: 'doc',
    content: [{ type: 'paragraph', content: [] }],
  }),
};

const sections: OmiSection[] = [{
  id: 'section-a',
  title: 'Introduction',
  blocks: [sourceBlock, paragraph],
}];

const bookmark = createNamedAnchor({
  id: 'bookmark-important',
  name: 'Important argument',
  targetId: paragraph.id,
  targetKind: 'block',
});

test('named bookmark is a first-class cross-reference target even for an ordinary paragraph', () => {
  const targets = collectCrossReferenceTargets({
    sections,
    crossReferenceNumbering: 'document',
    namedAnchors: [bookmark],
  });
  const target = targets.find((item) => item.id === bookmark.id);

  assert.equal(target?.kind, 'bookmark');
  assert.equal(target?.title, 'Important argument');
  assert.equal(target?.destinationId, paragraph.id);
  assert.equal(target?.destinationKind, 'block');
});

test('bookmark references render the bookmark name in all display modes', () => {
  const target = collectCrossReferenceTargets({
    sections,
    namedAnchors: [bookmark],
  }).find((item) => item.id === bookmark.id);
  const reference = createCrossReference({
    id: 'xref-bookmark',
    anchorId: 'anchor-bookmark',
    sourceBlockId: sourceBlock.id,
    targetId: bookmark.id,
    targetKind: 'bookmark',
    displayStyle: 'title',
  });

  assert.equal(formatCrossReferenceLabel(reference, target, 'hu'), 'Important argument');
  assert.equal(formatCrossReferenceLabel({ ...reference, displayStyle: 'label-number' }, target, 'hu'), 'könyvjelző: Important argument');
  assert.equal(formatCrossReferenceLabel({ ...reference, displayStyle: 'label-number' }, target, 'de'), 'Textmarke: Important argument');
});

test('bookmark reference becomes unresolved when its named anchor is deleted', () => {
  const reference = createCrossReference({
    id: 'xref-bookmark',
    anchorId: 'anchor-bookmark',
    sourceBlockId: sourceBlock.id,
    targetId: bookmark.id,
    targetKind: 'bookmark',
    displayStyle: 'title',
  });
  const sourceSections: OmiSection[] = [{
    ...sections[0]!,
    blocks: [{
      ...sourceBlock,
      content: JSON.stringify({
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{
            type: 'omiCrossReference',
            attrs: {
              crossReferenceId: reference.id,
              anchorId: reference.anchorId,
              label: 'Important argument',
              unresolved: false,
            },
          }],
        }],
      }),
    }, paragraph],
  }];

  const synchronized = synchronizeCrossReferenceLabels(
    sourceSections,
    [reference],
    'document',
    'en',
    [],
  );
  const issues = validateCrossReferences({
    sections: synchronized,
    crossReferences: [reference],
    namedAnchors: [],
  });

  assert.ok(synchronized[0]?.blocks[0]?.content.includes('[unresolved reference]'));
  assert.deepEqual(issues.map((issue) => issue.type), ['missing-target']);
});
