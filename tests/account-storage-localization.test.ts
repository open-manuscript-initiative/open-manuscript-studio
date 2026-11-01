import assert from 'node:assert/strict';
import test from 'node:test';

import { accountPanelTranslations } from '../src/i18n/accountPanelTranslations.ts';
import { centralAdministrationTranslations } from '../src/i18n/centralAdministrationTranslations.ts';
import { cloudStorageTranslations, getSavedDocumentOpenConfirmation } from '../src/i18n/cloudStorageTranslations.ts';
import { institutionalProfilesTranslations } from '../src/i18n/institutionalProfilesTranslations.ts';
import { linkedIdentitiesTranslations } from '../src/i18n/linkedIdentitiesTranslations.ts';
import { personalPublishingCredentialsTranslations } from '../src/i18n/personalPublishingCredentials.ts';
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

  assert.deepEqual(
    Object.keys(personalPublishingCredentialsTranslations).sort(),
    [...SUPPORTED_LOCALES].sort(),
    'personal publishing credentials must have an explicit entry for every supported locale',
  );
  for (const locale of SUPPORTED_LOCALES) {
    const copy = personalPublishingCredentialsTranslations[locale];
    assert.ok(copy, `personalPublishingCredentials is missing ${locale}`);
    for (const [key, value] of Object.entries(copy)) {
      if (key === 'removeConfirmation' || key === 'profileEmailRemoveConfirmation') {
        assert.equal(typeof value, 'function');
        continue;
      }
      assert.equal(typeof value, 'string');
      assert.ok((value as string).trim().length > 0);
    }
  }
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

test('saved cloud documents confirm an additional tab, never replacement', () => {
  const documentTitle = 'Example OMI manuscript';
  const hu = getSavedDocumentOpenConfirmation('hu', documentTitle);
  const en = getSavedDocumentOpenConfirmation('en', documentTitle);
  const de = getSavedDocumentOpenConfirmation('de', documentTitle);

  assert.match(hu, /Meg szeretnéd nyitni a Stúdióban ezt a dokumentumot:/);
  assert.match(hu, /Új fülön fog megnyílni\. A jelenlegi dokumentum nyitva marad\./);
  assert.match(en, /new tab\. The current document will remain open\./);
  assert.match(de, /neuen Tab geöffnet\. Das aktuell geöffnete Dokument bleibt geöffnet\./);

  for (const locale of SUPPORTED_LOCALES) {
    const prompt = getSavedDocumentOpenConfirmation(locale, documentTitle);
    assert.ok(prompt.includes(documentTitle), `${locale}: selected title should be shown`);
    assert.doesNotMatch(prompt, /replac(e|ed)|felváltja|ersetzt/i, `${locale}: must not claim replacement`);
  }

  // Locales without a dedicated saved-document prompt must not reuse the
  // misleading cloud-backup restore prompt.
  assert.match(getSavedDocumentOpenConfirmation('cs', documentTitle), /new tab/);
});
