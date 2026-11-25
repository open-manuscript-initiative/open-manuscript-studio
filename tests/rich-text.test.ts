import assert from 'node:assert/strict';
import test from 'node:test';

import {
  detectSemanticInlineStyle,
  detectWordHeadingLevel,
  normalizeExternalHref,
  normalizeInlineLanguageTag,
} from '../src/model/richText.ts';
import { normalizeManuscriptLanguageTag } from '../src/model/manuscriptLanguage.ts';

test('normalizes browser-safe external links and rejects active protocols', () => {
  assert.equal(
    normalizeExternalHref('example.org/article'),
    'https://example.org/article',
  );
  assert.equal(
    normalizeExternalHref('https://example.org/a?b=1'),
    'https://example.org/a?b=1',
  );
  assert.equal(
    normalizeExternalHref('mailto:author@example.org'),
    'mailto:author@example.org',
  );
  assert.equal(normalizeExternalHref('javascript:alert(1)'), undefined);
  assert.equal(normalizeExternalHref('data:text/html,hello'), undefined);
});

test('normalizes BCP 47 inline language tags independently from UI locales', () => {
  assert.equal(normalizeInlineLanguageTag('de-de'), 'de-DE');
  assert.equal(normalizeInlineLanguageTag('en-gb'), 'en-GB');
  assert.equal(normalizeInlineLanguageTag('la'), 'la');
  assert.equal(normalizeInlineLanguageTag('zh-Hant-TW'), 'zh-Hant-TW');
  assert.equal(normalizeInlineLanguageTag('not_a_language'), undefined);
});

test('shares canonical manuscript and inline language tags without collapsing regions or scripts', () => {
  for (const [input, expected] of [
    ['hu', 'hu'], ['hu_HU', 'hu-HU'], ['HU-hu', 'hu-HU'],
    ['de_DE', 'de-DE'], ['en_GB', 'en-GB'], ['el_GR', 'el-GR'],
    ['he_IL', 'he-IL'], ['ar_SA', 'ar-SA'], ['sr_Latn_RS', 'sr-Latn-RS'],
    ['zh_Hant_TW', 'zh-Hant-TW'], ['en-US-u-ca-gregory', 'en-US-u-ca-gregory'],
    ['und', 'und'], ['grc', 'grc'],
  ] as const) {
    assert.equal(normalizeInlineLanguageTag(input), expected);
    assert.equal(normalizeManuscriptLanguageTag(input), expected);
    assert.equal(normalizeInlineLanguageTag(expected), expected);
  }
  for (const input of ['', 'not_a_language', 'hu__HU', 'hu HU', 'en_US.UTF-8', 'x'.repeat(101)]) {
    assert.equal(normalizeInlineLanguageTag(input), undefined);
    assert.equal(normalizeManuscriptLanguageTag(input), null);
  }
  assert.equal(normalizeInlineLanguageTag(undefined), undefined);
});

test('extracts semantic emphasis from common Word inline CSS only', () => {
  assert.deepEqual(
    detectSemanticInlineStyle(
      'font-family: Calibri; font-weight: 700; font-style: italic; color: red',
    ),
    {
      strong: true,
      emphasis: true,
      strike: false,
      underline: false,
      smallCaps: false,
      verticalAlign: undefined,
    },
  );

  assert.deepEqual(
    detectSemanticInlineStyle(
      'vertical-align: super; text-decoration-line: line-through underline; font-variant: small-caps; margin-left: 12pt',
    ),
    {
      strong: false,
      emphasis: false,
      strike: true,
      underline: true,
      smallCaps: true,
      verticalAlign: 'super',
    },
  );
});

test('recognizes Microsoft Word heading styles during clipboard paste', () => {
  assert.equal(detectWordHeadingLevel('MsoHeading1', undefined), 1);
  assert.equal(detectWordHeadingLevel('Heading 3', undefined), 3);
  assert.equal(detectWordHeadingLevel(undefined, 'mso-style-name:"Heading 2"'), 2);
  assert.equal(detectWordHeadingLevel(undefined, 'mso-outline-level:4'), 5);
  assert.equal(detectWordHeadingLevel('MsoNormal', 'font-weight:bold'), undefined);
});

