import assert from 'node:assert/strict';
import test from 'node:test';

import { supportedLocales } from '../src/i18n/config.ts';
import { translate } from '../src/i18n/translate.ts';
import type { SupportedLocale } from '../src/i18n/types.ts';
import {
  GOOGLE_PLAY_LOCALES,
  GOOGLE_PLAY_TO_STUDIO_LOCALE,
  STUDIO_UI_LOCALES,
  getStudioLocaleDirection,
  localeLabels,
  resolveStudioUiLocale,
} from '../src/i18n/platformLocales.ts';

const PREVIOUS_STUDIO_LOCALES = [
  'bg', 'cs', 'da', 'de', 'el', 'en', 'es', 'et', 'fi', 'fr', 'ga', 'hr',
  'hu', 'it', 'lt', 'lv', 'mt', 'nl', 'pl', 'pt', 'ro', 'sk', 'sl', 'sv',
] as const;

test('Google Play parity registry contains exactly 49 platform locale entries', () => {
  assert.equal(GOOGLE_PLAY_LOCALES.length, 49);
  assert.equal(new Set(GOOGLE_PLAY_LOCALES).size, 49);
});

test('all Google Play locale entries resolve to a shared Studio UI locale', () => {
  for (const locale of GOOGLE_PLAY_LOCALES) {
    const studioLocale = GOOGLE_PLAY_TO_STUDIO_LOCALE[locale];
    assert.ok(
      STUDIO_UI_LOCALES.includes(studioLocale),
      `${locale} resolves to unsupported Studio locale ${studioLocale}`,
    );
  }
});

test('shared UI registry covers Play languages while retaining Irish and Maltese', () => {
  assert.equal(STUDIO_UI_LOCALES.length, 47);
  assert.equal(new Set(STUDIO_UI_LOCALES).size, 47);
  assert.deepEqual(supportedLocales, [...STUDIO_UI_LOCALES]);

  for (const locale of PREVIOUS_STUDIO_LOCALES) {
    assert.ok(STUDIO_UI_LOCALES.includes(locale));
  }

  assert.ok(STUDIO_UI_LOCALES.includes('ga'));
  assert.ok(STUDIO_UI_LOCALES.includes('mt'));
});

test('every shared UI locale has a native language label', () => {
  for (const locale of STUDIO_UI_LOCALES) {
    assert.equal(typeof localeLabels[locale], 'string');
    assert.ok(localeLabels[locale].trim().length > 0);
  }
});

test('regional Play locales and legacy Android language codes normalize correctly', () => {
  assert.equal(resolveStudioUiLocale('en-GB'), 'en');
  assert.equal(resolveStudioUiLocale('en-US'), 'en');
  assert.equal(resolveStudioUiLocale('es-419'), 'es');
  assert.equal(resolveStudioUiLocale('fr-CA'), 'fr');
  assert.equal(resolveStudioUiLocale('pt-BR'), 'pt');
  assert.equal(resolveStudioUiLocale('iw-IL'), 'he');
  assert.equal(resolveStudioUiLocale('in-ID'), 'id');
  assert.equal(resolveStudioUiLocale('zh-Hant-TW'), 'zh-TW');
  assert.equal(resolveStudioUiLocale('zh-Hant-HK'), 'zh-HK');
  assert.equal(resolveStudioUiLocale('zh-Hans-CN'), 'zh-CN');
});

test('newly exposed platform locales use the English reference dictionary until translated', () => {
  assert.equal(translate('ja' as SupportedLocale, 'common.save'), 'Save');
  assert.equal(translate('he' as SupportedLocale, 'studio.menu'), 'Manuscript menu');
  assert.equal(translate('zh-TW' as SupportedLocale, 'navigation.editor'), 'Editor');
});

test('Hebrew selects RTL while the other parity locales stay LTR', () => {
  assert.equal(getStudioLocaleDirection('he'), 'rtl');
  assert.equal(getStudioLocaleDirection('en'), 'ltr');
  assert.equal(getStudioLocaleDirection('ja'), 'ltr');
  assert.equal(getStudioLocaleDirection('zh-TW'), 'ltr');
});
