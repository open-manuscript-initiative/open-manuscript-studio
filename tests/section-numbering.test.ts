import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatSectionHeading,
  formatSectionNumber,
  normalizeSectionNumberingStyle,
  sectionNumberingStyleExample,
} from '../src/model/sectionNumbering.ts';

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

test('keeps generated numbering separate from the semantic title', () => {
  const title = 'Methods';
  const rendered = formatSectionHeading(title, 1, 'upper-roman');

  assert.equal(title, 'Methods');
  assert.equal(rendered, 'II. Methods');
});

test('provides neutral examples for every numbering style', () => {
  assert.equal(sectionNumberingStyleExample('none'), '—');
  assert.equal(sectionNumberingStyleExample('decimal'), '1. 2. 3.');
  assert.equal(sectionNumberingStyleExample('upper-roman'), 'I. II. III.');
  assert.equal(sectionNumberingStyleExample('lower-alpha'), 'a. b. c.');
});
