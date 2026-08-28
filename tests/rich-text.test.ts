import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isMicrosoftWordClipboardHtml,
  plainTextToPasteHtml,
} from '../src/editor/clipboardPaste.ts';
import {
  detectSemanticInlineStyle,
  detectWordHeadingLevel,
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

test('recognizes Microsoft Word heading styles during clipboard paste', () => {
  assert.equal(detectWordHeadingLevel('MsoHeading1', undefined), 1);
  assert.equal(detectWordHeadingLevel('Heading 3', undefined), 3);
  assert.equal(detectWordHeadingLevel(undefined, 'mso-style-name:"Heading 2"'), 2);
  assert.equal(detectWordHeadingLevel(undefined, 'mso-outline-level:4'), 5);
  assert.equal(detectWordHeadingLevel('MsoNormal', 'font-weight:bold'), undefined);
});

test('recognizes Word HTML clipboard payloads', () => {
  assert.equal(
    isMicrosoftWordClipboardHtml('<p class="MsoNormal">Word</p>'),
    true,
  );
  assert.equal(
    isMicrosoftWordClipboardHtml('<p style="mso-list:l0 level1 lfo1">Item</p>'),
    true,
  );
  assert.equal(isMicrosoftWordClipboardHtml('<p>Browser HTML</p>'), false);
});

test('turns plain clipboard text into safe paragraph HTML', () => {
  assert.equal(
    plainTextToPasteHtml('One\nline\n\nTwo < three'),
    '<p>One<br>line</p><p>Two &lt; three</p>',
  );
});