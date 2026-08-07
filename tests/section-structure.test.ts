import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EMPTY_SECTION_CONTENT,
  createEmptySection,
  insertSectionAtGap,
  moveSectionToGap,
  moveSectionToIndex,
  sectionOrder,
} from '../src/model/sectionStructure.ts';
import type { OmiSection } from '../src/types/omi.ts';

function section(id: string): OmiSection {
  return {
    id,
    title: id.toUpperCase(),
    blocks: [
      {
        id: `block-${id}`,
        type: 'paragraph',
        content: `content-${id}`,
      },
    ],
  };
}

test('creates an empty editable section with stable section and block identities', () => {
  const created = createEmptySection('section-new', 'block-new');

  assert.equal(created.id, 'section-new');
  assert.equal(created.title, '');
  assert.equal(created.blocks[0]?.id, 'block-new');
  assert.equal(created.blocks[0]?.content, EMPTY_SECTION_CONTENT);
});

test('inserts a section at the beginning, middle or end without rewriting existing objects', () => {
  const a = section('a');
  const b = section('b');
  const inserted = section('x');

  const beginning = insertSectionAtGap([a, b], inserted, 0);
  assert.deepEqual(sectionOrder(beginning), ['x', 'a', 'b']);
  assert.equal(beginning[1], a);
  assert.equal(beginning[2], b);

  const middle = insertSectionAtGap([a, b], inserted, 1);
  assert.deepEqual(sectionOrder(middle), ['a', 'x', 'b']);

  const end = insertSectionAtGap([a, b], inserted, 99);
  assert.deepEqual(sectionOrder(end), ['a', 'b', 'x']);
});

test('rejects silent reuse of an existing section identity during insertion', () => {
  const a = section('a');

  assert.throws(
    () => insertSectionAtGap([a], section('a'), 1),
    /Section ID already exists/,
  );
});

test('moves a section through structural gaps while preserving the same object', () => {
  const a = section('a');
  const b = section('b');
  const c = section('c');

  const movedToEnd = moveSectionToGap([a, b, c], 'a', 3);
  assert.deepEqual(sectionOrder(movedToEnd), ['b', 'c', 'a']);
  assert.equal(movedToEnd[2], a);
  assert.equal(movedToEnd[2]?.blocks[0], a.blocks[0]);

  const movedToStart = moveSectionToGap(movedToEnd, 'a', 0);
  assert.deepEqual(sectionOrder(movedToStart), ['a', 'b', 'c']);
  assert.equal(movedToStart[0], a);
});

test('supports direct index moves for keyboard and touch-friendly controls', () => {
  const sections = [section('a'), section('b'), section('c'), section('d')];

  assert.deepEqual(
    sectionOrder(moveSectionToIndex(sections, 'c', 0)),
    ['c', 'a', 'b', 'd'],
  );
  assert.deepEqual(
    sectionOrder(moveSectionToIndex(sections, 'b', 3)),
    ['a', 'c', 'd', 'b'],
  );
});

test('dropping into an equivalent adjacent gap is a structural no-op', () => {
  const sections = [section('a'), section('b'), section('c')];

  assert.deepEqual(
    sectionOrder(moveSectionToGap(sections, 'b', 1)),
    ['a', 'b', 'c'],
  );
  assert.deepEqual(
    sectionOrder(moveSectionToGap(sections, 'b', 2)),
    ['a', 'b', 'c'],
  );
});
