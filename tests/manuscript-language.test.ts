import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ISO_639_1_LANGUAGE_CODES,
  SPECIAL_MANUSCRIPT_LANGUAGE_TAGS,
  getManuscriptLanguageOptions,
  isValidManuscriptLanguageTag,
  normalizeManuscriptLanguageTag,
} from '../src/model/manuscriptLanguage.ts';

test('contains the complete ISO 639-1 language code set without duplicates', () => {
  assert.equal(ISO_639_1_LANGUAGE_CODES.length, 184);
  assert.equal(
    new Set(ISO_639_1_LANGUAGE_CODES).size,
    ISO_639_1_LANGUAGE_CODES.length,
  );

  for (const code of ['en', 'hu', 'de', 'ar', 'zh', 'sw']) {
    assert.ok(
      ISO_639_1_LANGUAGE_CODES.includes(
        code as (typeof ISO_639_1_LANGUAGE_CODES)[number],
      ),
    );
  }
});

test('includes standard special manuscript language tags', () => {
  assert.deepEqual(
    [...SPECIAL_MANUSCRIPT_LANGUAGE_TAGS],
    ['mul', 'und', 'zxx'],
  );
});

test('normalizes BCP 47 language tags canonically', () => {
  assert.equal(normalizeManuscriptLanguageTag('EN_us'), 'en-US');
  assert.equal(normalizeManuscriptLanguageTag('zh-hant'), 'zh-Hant');
  assert.equal(normalizeManuscriptLanguageTag('sr_latn'), 'sr-Latn');
  assert.equal(normalizeManuscriptLanguageTag('grc'), 'grc');
});

test('rejects invalid manuscript language tags', () => {
  assert.equal(normalizeManuscriptLanguageTag(''), null);
  assert.equal(normalizeManuscriptLanguageTag('not a language'), null);
  assert.equal(isValidManuscriptLanguageTag('pt-BR'), true);
  assert.equal(isValidManuscriptLanguageTag('***'), false);
});

test('builds the full standard option list in the requested display locale', () => {
  const options = getManuscriptLanguageOptions('hu');

  assert.equal(options.length, 187);
  assert.ok(options.some((option) => option.tag === 'hu'));
  assert.ok(options.some((option) => option.tag === 'mul'));
  assert.ok(options.every((option) => option.label.length > 0));
});
