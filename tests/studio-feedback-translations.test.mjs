import test from 'node:test';
import assert from 'node:assert/strict';
import { getStudioFeedbackCopy, resolveStudioFeedbackLocale } from '../src/i18n/studioFeedbackTranslations.ts';

const locales = ['hu', 'de', 'en', 'fr', 'it', 'es', 'nl', 'pl'];
const categories = ['bug', 'suggestion', 'test'];
const areas = ['editor', 'import', 'export', 'notes', 'collaboration', 'publishing', 'account', 'other'];
const outcomes = ['success', 'problem', 'not_applicable'];

test('all eight feedback translations provide every user-facing field and enum', () => {
  const english = getStudioFeedbackCopy('en');
  const keys = Object.keys(english);
  for (const locale of locales) {
    const copy = getStudioFeedbackCopy(locale);
    assert.deepEqual(Object.keys(copy), keys, locale);
    for (const [key, value] of Object.entries(copy)) {
      if (typeof value === 'string') {
        assert.ok(value.trim().length > 0, locale + ': ' + key);
      }
    }
    for (const key of categories) assert.ok(copy.categories[key], locale + ': category ' + key);
    for (const key of areas) assert.ok(copy.areas[key], locale + ': area ' + key);
    for (const key of outcomes) assert.ok(copy.outcomes[key], locale + ': outcome ' + key);
    assert.ok(copy.privacy.includes(' '));
  }
});

test('primary languages do not incorrectly display English menu label', () => {
  for (const locale of ['hu', 'de', 'fr', 'it', 'es', 'nl', 'pl']) {
    assert.notEqual(getStudioFeedbackCopy(locale).heading, getStudioFeedbackCopy('en').heading, locale);
  }
});

test('regional variants and unsupported languages use deterministic fallback', () => {
  assert.equal(resolveStudioFeedbackLocale('fr-CA'), 'fr');
  assert.equal(resolveStudioFeedbackLocale('de-DE'), 'de');
  assert.equal(resolveStudioFeedbackLocale('pt-BR'), 'en');
  assert.equal(getStudioFeedbackCopy('fr-CA').heading, getStudioFeedbackCopy('fr').heading);
  assert.equal(getStudioFeedbackCopy('zh-CN').heading, getStudioFeedbackCopy('en').heading);
});
