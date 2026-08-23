import assert from 'node:assert/strict';
import test from 'node:test';

import { accountPanelTranslations } from '../src/i18n/accountPanelTranslations.ts';
import { centralAdministrationTranslations } from '../src/i18n/centralAdministrationTranslations.ts';
import { cloudStorageTranslations } from '../src/i18n/cloudStorageTranslations.ts';
import { institutionalProfilesTranslations } from '../src/i18n/institutionalProfilesTranslations.ts';
import { linkedIdentitiesTranslations } from '../src/i18n/linkedIdentitiesTranslations.ts';
import {
  getLocalFileLabels,
  nativeStorageTranslationLocales,
} from '../src/i18n/nativeStorageTranslations.ts';

const SUPPORTED_LOCALES = [
  'bg', 'cs', 'da', 'de', 'el', 'en', 'es', 'et', 'fi', 'fr', 'ga', 'hr',
  'hu', 'it', 'lt', 'lv', 'mt', 'nl', 'pl', 'pt', 'ro', 'sk', 'sl', 'sv',
] as const;

function assertCompleteLocaleMap(
  name: string,
  map: Record<string, Record<string, unknown>>,
): void {
  assert.deepEqual(
    Object.keys(map).sort(),
    [...SUPPORTED_LOCALES].sort(),
    `${name} must have an explicit entry for every supported locale`,
  );

  for (const locale of SUPPORTED_LOCALES) {
    const copy = map[locale];
    assert.ok(copy, `${name} is missing ${locale}`);
    for (const [key, value] of Object.entries(copy)) {
      if (key === 'roles') continue;
      assert.equal(typeof value, 'string', `${name}.${locale}.${key} must be a string`);
      assert.ok((value as string).trim().length > 0, `${name}.${locale}.${key} must not be empty`);
    }
  }
}

test('Account surfaces have explicit copy in all 24 supported locales', () => {
  assertCompleteLocaleMap('accountPanel', accountPanelTranslations);
  assertCompleteLocaleMap('linkedIdentities', linkedIdentitiesTranslations);
  assertCompleteLocaleMap('institutionalProfiles', institutionalProfilesTranslations);
  assertCompleteLocaleMap('centralAdministration', centralAdministrationTranslations);
});

test('Storage and cloud settings have explicit copy in all 24 supported locales', () => {
  assertCompleteLocaleMap('cloudStorage', cloudStorageTranslations);
  assert.deepEqual(
    [...nativeStorageTranslationLocales].sort(),
    [...SUPPORTED_LOCALES].sort(),
    'native storage menu copy must have an explicit base entry for every supported locale',
  );

  for (const locale of SUPPORTED_LOCALES) {
    const desktop = getLocalFileLabels(locale, 'desktop');
    const android = getLocalFileLabels(locale, 'android');
    assert.ok(desktop.localTitle.trim().length > 0);
    assert.ok(desktop.openTitle.trim().length > 0);
    assert.ok(android.localTitle.trim().length > 0);
    assert.ok(android.androidProviderHint.trim().length > 0);
  }
});
