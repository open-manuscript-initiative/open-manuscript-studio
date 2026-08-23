import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cloudOAuthTranslationLocales,
  getCloudOAuthCopy,
} from '../src/i18n/cloudOAuthTranslations.ts';

const expectedLocales = [
  'bg', 'cs', 'da', 'de', 'el', 'en', 'es', 'et', 'fi', 'fr', 'ga', 'hr',
  'hu', 'it', 'lt', 'lv', 'mt', 'nl', 'pl', 'pt', 'ro', 'sk', 'sl', 'sv',
] as const;

test('OAuth and Proton help is available for all 24 supported Studio locales', () => {
  assert.deepEqual(
    [...cloudOAuthTranslationLocales].sort(),
    [...expectedLocales].sort(),
  );

  for (const locale of expectedLocales) {
    const copy = getCloudOAuthCopy(locale);
    const values = Object.values(copy);

    assert.equal(values.length > 0, true, `${locale}: translation object is empty`);
    for (const value of values) {
      assert.equal(value.trim().length > 0, true, `${locale}: contains an empty OAuth help string`);
    }

    assert.match(copy.connectWith, /\{provider\}/, `${locale}: connectWith must preserve {provider}`);
    assert.match(copy.connected, /\{provider\}/, `${locale}: connected must preserve {provider}`);
    assert.equal(copy.protonPreviewTitle, 'Proton Drive');
  }
});

test('unknown OAuth locale falls back to English', () => {
  assert.deepEqual(getCloudOAuthCopy('unsupported-locale'), getCloudOAuthCopy('en'));
});

test('Proton help clearly describes the SDK preview and system-storage fallback in every locale', () => {
  for (const locale of expectedLocales) {
    const copy = getCloudOAuthCopy(locale);
    assert.equal(copy.protonMethod.trim().length > 0, true);
    assert.equal(copy.protonAuth.trim().length > 0, true);
    assert.equal(copy.protonPreviewText.trim().length > 0, true);
    assert.equal(copy.protonSystemStorageText.trim().length > 0, true);
    assert.equal(copy.protonSdkStatus.trim().length > 0, true);
  }
});
