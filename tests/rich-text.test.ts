import assert from 'node:assert/strict';
import test from 'node:test';

import {
  detectSemanticInlineStyle,
  normalizeExternalHref,
  normalizeInlineLanguageTag,
} from '../src/model/richText.ts';

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
