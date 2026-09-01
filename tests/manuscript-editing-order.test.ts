import assert from 'node:assert/strict';
import test from 'node:test';

import {
  areBlocksEditingAdjacent,
  findAdjacentManuscriptBlock,
  findManuscriptBlock,
  getManuscriptBlockOrder,
} from '../src/model/manuscriptEditingOrder.ts';
import type { OmiSection } from '../src/types/omi.ts';

function section(id: string, blockIds: string[]): OmiSection {
  return {
    id,
    title: id,
    blocks: blockIds.map((blockId) => ({
      id: blockId,
      type: 'paragraph',
      content: blockId,
    })),
  };
}

test('exposes one continuous editing order across section boundaries', () => {
  const sections = [
    section('a', ['a1', 'a2']),
    section('empty', []),
    section('b', ['b1', 'b2']),
  ];

  assert.deepEqual(
    getManuscriptBlockOrder(sections).map((entry) => entry.block.id),
    ['a1', 'a2', 'b1', 'b2'],
  );
  assert.equal(findAdjacentManuscriptBlock(sections, 'a2', 'forward')?.block.id, 'b1');
  assert.equal(findAdjacentManuscriptBlock(sections, 'b1', 'backward')?.block.id, 'a2');
  assert.equal(areBlocksEditingAdjacent(sections, 'a2', 'b1'), true);
});

test('preserves real semantic blocks as editing boundaries', () => {
  const sections = [
    {
      id: 'a',
      title: 'a',
      blocks: [
        { id: 'p1', type: 'paragraph', content: 'one' },
        { id: 'figure', type: 'figure', content: '' },
      ],
    },
    section('b', ['p2']),
  ];

  assert.equal(findAdjacentManuscriptBlock(sections, 'p1', 'forward')?.block.id, 'figure');
  assert.equal(findAdjacentManuscriptBlock(sections, 'figure', 'forward')?.block.id, 'p2');
  assert.equal(areBlocksEditingAdjacent(sections, 'p1', 'p2'), false);
});

test('returns stable section and block coordinates for structural edits', () => {
  const sections = [section('a', ['a1']), section('b', ['b1'])];
  const location = findManuscriptBlock(sections, 'b1');

  assert.equal(location?.sectionIndex, 1);
  assert.equal(location?.blockIndex, 0);
  assert.equal(location?.sectionId, 'b');
  assert.equal(location?.block.id, 'b1');
});
