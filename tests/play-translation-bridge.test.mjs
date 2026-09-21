import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  PLAY_TRANSLATION_RESOURCE_PREFIX,
  buildPlayTranslationResourceCatalog,
  encodeAndroidStringResource,
  renderPlayTranslationResources,
} from '../scripts/generate-play-translation-resources.mjs';
import {
  parseAapt2StudioTranslations,
} from '../scripts/import-play-translations.mjs';

const reference = JSON.parse(
  readFileSync(
    new URL('../src/i18n/locales/en/studio.json', import.meta.url),
    'utf8',
  ),
);
const androidDistribution = readFileSync(
  new URL('../scripts/build-android-distribution.mjs', import.meta.url),
  'utf8',
);

test('Play translation bridge exports every unique English Studio source once', () => {
  const catalog = buildPlayTranslationResourceCatalog(reference);
  const sources = new Set(catalog.map((entry) => entry.source));
  const resources = new Set(catalog.map((entry) => entry.resource));

  assert.equal(catalog.length, 665);
  assert.equal(sources.size, catalog.length);
  assert.equal(resources.size, catalog.length);
  assert.ok(
    catalog.every((entry) =>
      entry.resource.startsWith(PLAY_TRANSLATION_RESOURCE_PREFIX),
    ),
  );
});

test('Play translation bridge renders safe Android XML resources', () => {
  assert.equal(
    encodeAndroidStringResource(`Author's "draft" & <review>`),
    `&quot;Author\\'s \\&quot;draft\\&quot; &amp; &lt;review&gt;&quot;`,
  );

  const rendered = renderPlayTranslationResources(reference);
  assert.match(rendered.xml, /^<\?xml version="1\.0" encoding="utf-8"\?>/);
  assert.match(rendered.xml, /formatted="false" translatable="true"/);
  assert.equal(
    rendered.xml.match(/<string name="omi_i18n_/g)?.length,
    rendered.entries.length,
  );
});

test('Play builds add and then remove translation bridge resources', () => {
  assert.match(androidDistribution, /writePlayTranslationResources\(\)/);
  assert.match(androidDistribution, /removePlayTranslationResources\(\)/);
  assert.match(
    androidDistribution,
    /if \(channel === 'play'\)[\s\S]*?writePlayTranslationResources\(\)/,
  );
  assert.match(
    androidDistribution,
    /finally \{[\s\S]*?removePlayTranslationResources\(\)/,
  );
});

test('aapt2 resource dump is normalized into canonical Studio locales', () => {
  const catalog = buildPlayTranslationResourceCatalog(reference);
  const save = catalog.find((entry) => entry.source === 'Save');
  const close = catalog.find((entry) => entry.source === 'Close');
  assert.ok(save);
  assert.ok(close);

  const dump = [
    'Binary APK',
    `    resource 0x7f120001 string/${save.resource}`,
    '      () "Save"',
    '      (af) "Stoor"',
    '      (fr-rCA) "Enregistrer CA"',
    '      (fr-rFR) "Enregistrer"',
    '      (pt-rBR) "Salvar"',
    '      (pt-rPT) "Guardar"',
    '      (b+zh+Hans+CN) "保存"',
    '      (b+zh+Hant+TW) "儲存"',
    '      (b+zh+Hant+HK) "儲存"',
    `    resource 0x7f120002 string/${close.resource}`,
    '      () "Close"',
    '      (iw) "סגירה"',
    '      (in) "Tutup"',
  ].join('\n');

  const parsed = parseAapt2StudioTranslations(dump, reference);
  assert.equal(parsed.get('af')?.get('Save'), 'Stoor');
  assert.equal(parsed.get('fr')?.get('Save'), 'Enregistrer');
  assert.equal(parsed.get('pt')?.get('Save'), 'Guardar');
  assert.equal(parsed.get('zh-CN')?.get('Save'), '保存');
  assert.equal(parsed.get('zh-TW')?.get('Save'), '儲存');
  assert.equal(parsed.get('zh-HK')?.get('Save'), '儲存');
  assert.equal(parsed.get('he')?.get('Close'), 'סגירה');
  assert.equal(parsed.get('id')?.get('Close'), 'Tutup');
});
