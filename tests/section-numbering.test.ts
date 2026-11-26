import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSectionNumberMap,
  SECTION_NUMBERING_STYLES,
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

test('batched section numbering agrees with individual numbering for every style', () => {
  const fixtures: OmiSection[][] = [
    sections,
    [...sections, { id: 'orphan', parentSectionId: 'missing', title: 'Orphan', blocks: [] },
      { id: 'source-number', title: '12. Imported heading', blocks: [] },
      { id: 'cycle-a', parentSectionId: 'cycle-b', title: 'Cycle A', blocks: [] },
      { id: 'cycle-b', parentSectionId: 'cycle-a', title: 'Cycle B', blocks: [] },
      { id: 'cycle-child', parentSectionId: 'cycle-a', title: 'Child', blocks: [] }],
    Array.from({ length: 100 }, (_, index) => ({
      id: 's' + index, title: 'Heading ' + index, blocks: [],
      ...(index > 0 ? { parentSectionId: 's' + Math.floor((index - 1) / 3) } : {}),
    })),
  ];
  for (const fixture of fixtures) for (const style of SECTION_NUMBERING_STYLES) {
    assert.deepEqual(buildSectionNumberMap(fixture, style), new Map(fixture.map(section => [
      section.id, formatHierarchicalSectionNumber(fixture, section.id, style),
    ])));
  }
});

test('batched numbering supports a large flat publication and skips absent numbering', () => {
  const many: OmiSection[] = Array.from({ length: 5000 }, (_, index) => ({ id: 's' + index, title: 'Heading', blocks: [] }));
  const map = buildSectionNumberMap(many, 'decimal');
  assert.equal(map.size, 5000);
  assert.equal(map.get('s4999'), '5000.');
  assert.ok([...buildSectionNumberMap(many, 'none').values()].every(value => value === ''));
});
