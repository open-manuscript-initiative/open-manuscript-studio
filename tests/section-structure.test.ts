import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EMPTY_SECTION_CONTENT,
  buildSectionOutline,
  canIndentSection,
  canOutdentSection,
  createEmptySection,
  getParentSectionId,
  getSectionDescendantIds,
  indentSection,
  insertSectionAfter,
  insertSectionAtGap,
  insertSubsection,
  moveSectionAmongSiblings,
  moveSectionToGap,
  moveSectionToIndex,
  outdentSection,
  reparentSection,
  sectionOrder,
  validateSectionHierarchy,
} from '../src/model/sectionStructure.ts';
import type { OmiSection } from '../src/types/omi.ts';

function section(
  id: string,
  parentSectionId?: string,
): OmiSection {
  return {
    id,
    parentSectionId,
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
  const created = createEmptySection('section-new', 'block-new', 'parent');

  assert.equal(created.id, 'section-new');
  assert.equal(created.title, '');
  assert.equal(created.blocks[0]?.id, 'block-new');
  assert.equal(created.blocks[0]?.content, EMPTY_SECTION_CONTENT);
  assert.equal(getParentSectionId(created), 'parent');
});

test('keeps legacy flat insertion behavior for top-level manuscripts', () => {
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

test('inserts a subsection at the end of its parent subtree', () => {
  const sections = [
    section('a'),
    section('a1', 'a'),
    section('b'),
  ];
  const inserted = insertSubsection(sections, 'a', section('a2'));

  assert.deepEqual(sectionOrder(inserted), ['a', 'a1', 'a2', 'b']);
  assert.equal(getParentSectionId(inserted[2]!), 'a');
  assert.deepEqual(getSectionDescendantIds(inserted, 'a'), ['a1', 'a2']);
});

test('inserts a sibling after the complete preceding subtree', () => {
  const sections = [
    section('a'),
    section('a1', 'a'),
    section('a11', 'a1'),
    section('b'),
  ];
  const inserted = insertSectionAfter(sections, 'a', section('x'));

  assert.deepEqual(sectionOrder(inserted), ['a', 'a1', 'a11', 'x', 'b']);
  assert.equal(getParentSectionId(inserted[3]!), undefined);
});

test('outline depth is derived from parent relationships', () => {
  const sections = [
    section('a'),
    section('a1', 'a'),
    section('a11', 'a1'),
    section('b'),
  ];

  assert.deepEqual(
    buildSectionOutline(sections).map((entry) => [entry.section.id, entry.depth]),
    [['a', 0], ['a1', 1], ['a11', 2], ['b', 0]],
  );
  assert.deepEqual(validateSectionHierarchy(sections), []);
});

test('indent and outdent preserve the complete subtree and stable identities', () => {
  const a = section('a');
  const b = section('b');
  const b1 = section('b1', 'b');
  const c = section('c');
  const sections = [a, b, b1, c];

  assert.equal(canIndentSection(sections, 'b'), true);
  const indented = indentSection(sections, 'b');
  assert.deepEqual(sectionOrder(indented), ['a', 'b', 'b1', 'c']);
  assert.equal(getParentSectionId(indented[1]!), 'a');
  assert.equal(getParentSectionId(indented[2]!), 'b');
  assert.equal(indented[1]?.blocks[0], b.blocks[0]);

  assert.equal(canOutdentSection(indented, 'b'), true);
  const outdented = outdentSection(indented, 'b');
  assert.deepEqual(sectionOrder(outdented), ['a', 'b', 'b1', 'c']);
  assert.equal(getParentSectionId(outdented[1]!), undefined);
  assert.equal(getParentSectionId(outdented[2]!), 'b');
});

test('moves whole subtrees among siblings rather than detaching descendants', () => {
  const a = section('a');
  const a1 = section('a1', 'a');
  const b = section('b');
  const b1 = section('b1', 'b');
  const c = section('c');
  const sections = [a, a1, b, b1, c];

  const moved = moveSectionAmongSiblings(sections, 'b', -1);
  assert.deepEqual(sectionOrder(moved), ['b', 'b1', 'a', 'a1', 'c']);
  assert.equal(moved[0], b);
  assert.equal(moved[1], b1);
  assert.equal(getParentSectionId(moved[1]!), 'b');
});

test('reparents a subtree and prevents cyclic parent relationships', () => {
  const sections = [
    section('a'),
    section('a1', 'a'),
    section('b'),
  ];
  const nested = reparentSection(sections, 'b', 'a1');

  assert.deepEqual(sectionOrder(nested), ['a', 'a1', 'b']);
  assert.equal(getParentSectionId(nested[2]!), 'a1');
  assert.deepEqual(validateSectionHierarchy(nested), []);

  const rejectedCycle = reparentSection(nested, 'a', 'b');
  assert.deepEqual(sectionOrder(rejectedCycle), sectionOrder(nested));
  assert.equal(getParentSectionId(rejectedCycle[0]!), undefined);
});

test('legacy gap and index moves remain stable for flat documents', () => {
  const a = section('a');
  const b = section('b');
  const c = section('c');

  const movedToEnd = moveSectionToGap([a, b, c], 'a', 3);
  assert.deepEqual(sectionOrder(movedToEnd), ['b', 'c', 'a']);
  assert.equal(movedToEnd[2], a);
  assert.equal(movedToEnd[2]?.blocks[0], a.blocks[0]);

  assert.deepEqual(
    sectionOrder(moveSectionToIndex([a, b, c], 'c', 0)),
    ['c', 'a', 'b'],
  );
});
