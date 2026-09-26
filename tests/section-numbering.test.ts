import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatHierarchicalSectionHeading,
  formatHierarchicalSectionNumber,
  getSectionNumberToken,
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
  assert.equal(getSectionNumberToken(sections, 'a', undefined), '');
});

test('formats hierarchical decimal, roman and alphabetic numbering', () => {
  assert.equal(getSectionNumberToken(sections, 'a11', 'decimal'), '1.1.1');
  assert.equal(getSectionNumberToken(sections, 'b', 'upper-roman'), 'II');
  assert.equal(getSectionNumberToken(sections, 'a2', 'lower-alpha'), 'a.b');
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

test('provides hierarchy-aware examples for every numbering style', () => {
  assert.equal(sectionNumberingStyleExample('none'), '—');
  assert.equal(sectionNumberingStyleExample('decimal'), '1. 1.1. 1.1.1.');
  assert.equal(sectionNumberingStyleExample('upper-roman'), 'I. I.I. I.I.I.');
  assert.equal(sectionNumberingStyleExample('lower-alpha'), 'a. a.a. a.a.a.');
});
