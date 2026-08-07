import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatHierarchicalSectionHeading,
  formatHierarchicalSectionNumber,
  formatSectionHeading,
  formatSectionNumber,
  getSectionNumberToken,
  getSectionOrdinalPath,
  normalizeSectionNumberingStyle,
  sectionNumberingStyleExample,
} from '../src/model/sectionNumbering.ts';
import type { OmiSection } from '../src/types/omi.ts';

const sections: OmiSection[] = [
  { id: 'a', title: 'A', blocks: [] },
  { id: 'a1', parentSectionId: 'a', title: 'A.1', blocks: [] },
  { id: 'a11', parentSectionId: 'a1', title: 'A.1.1', blocks: [] },
  { id: 'a2', parentSectionId: 'a', title: 'A.2', blocks: [] },
  { id: 'b', title: 'B', blocks: [] },
];

test('section numbering is optional and defaults to none', () => {
  assert.equal(normalizeSectionNumberingStyle(undefined), 'none');
  assert.equal(formatSectionNumber(0, undefined), '');
  assert.equal(formatSectionHeading('Introduction', 0, 'none'), 'Introduction');
});

test('formats decimal and roman section numbering', () => {
  assert.equal(formatSectionNumber(0, 'decimal'), '1.');
  assert.equal(formatSectionNumber(3, 'upper-roman'), 'IV.');
  assert.equal(formatSectionNumber(8, 'lower-roman'), 'ix.');
});

test('formats alphabetic numbering beyond the first alphabet cycle', () => {
  assert.equal(formatSectionNumber(0, 'upper-alpha'), 'A.');
  assert.equal(formatSectionNumber(25, 'upper-alpha'), 'Z.');
  assert.equal(formatSectionNumber(26, 'upper-alpha'), 'AA.');
  assert.equal(formatSectionNumber(27, 'lower-alpha'), 'ab.');
});

test('derives hierarchical ordinal paths from sibling order', () => {
  assert.deepEqual(getSectionOrdinalPath(sections, 'a'), [1]);
  assert.deepEqual(getSectionOrdinalPath(sections, 'a1'), [1, 1]);
  assert.deepEqual(getSectionOrdinalPath(sections, 'a11'), [1, 1, 1]);
  assert.deepEqual(getSectionOrdinalPath(sections, 'a2'), [1, 2]);
  assert.deepEqual(getSectionOrdinalPath(sections, 'b'), [2]);
});

test('renders hierarchical numbering without storing it in titles', () => {
  assert.equal(getSectionNumberToken(sections, 'a11', 'decimal'), '1.1.1');
  assert.equal(formatHierarchicalSectionNumber(sections, 'a2', 'decimal'), '1.2.');
  assert.equal(
    formatHierarchicalSectionHeading('Methods', sections, 'a2', 'decimal'),
    '1.2. Methods',
  );
  assert.equal(formatHierarchicalSectionNumber(sections, 'a11', 'upper-roman'), 'I.I.I.');
  assert.equal(sections[3]?.title, 'A.2');
});

test('keeps generated numbering separate from the semantic title', () => {
  const title = 'Methods';
  const rendered = formatSectionHeading(title, 1, 'upper-roman');

  assert.equal(title, 'Methods');
  assert.equal(rendered, 'II. Methods');
});

test('provides hierarchy-aware examples for every numbering style', () => {
  assert.equal(sectionNumberingStyleExample('none'), '—');
  assert.equal(sectionNumberingStyleExample('decimal'), '1. 1.1. 1.1.1.');
  assert.equal(sectionNumberingStyleExample('upper-roman'), 'I. I.I. I.I.I.');
  assert.equal(sectionNumberingStyleExample('lower-alpha'), 'a. a.a. a.a.a.');
});
