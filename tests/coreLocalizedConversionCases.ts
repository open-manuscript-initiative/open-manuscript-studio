import assert from 'node:assert/strict';
import { normalizeLocale, normalizeLocalizedText, normalizeLocalizedTerms } from '../src/model/scholarlyMetadata.ts';
import { createManuscriptFromOjsLaunch } from '../src/integrations/ojs/importOjsLaunchLocalized.ts';
import type { OjsLaunchPayload } from '../src/integrations/ojs/importOjsLaunch.ts';
import { setLocalizedAbstract, setLocalizedKeywords } from '../src/app/localizedMetadataActions.ts';
import { useStudioStore } from '../src/app/useStudioStore.ts';
import { buildDocxExport } from '../src/services/exportDocx.ts';
import { buildOdtExport } from '../src/services/exportOdt.ts';
import { serializeOmiJson } from '../src/services/exportOmi.ts';
import { parseOmiJson } from '../src/services/omiPortableFormat.ts';
import { createInitialVersioningEnvelope, extractManuscriptState } from '../src/model/versioning.ts';
import { ExportExchangeSession } from '../src/services/exchangeSession.ts';
import type { OmiManuscript } from '../src/types/omi.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';

export const localizedConversionSpecifications = {
  'OMI-SPEC-000': '0.2.0', 'OMI-SPEC-140': '0.2.0',
};
function fixture(): OmiManuscript {
  const source = createVersionedTestManuscript();
  Object.assign(source, { title: 'Árvíztűrő 中文 العربية', locale: 'en-US', abstract: 'Primary abstract', keywords: ['Primary'],
    abstracts: { 'en-US': 'Primary abstract', 'en-GB': 'British abstract', 'zh-Hant': '繁體摘要' },
    keywordsByLocale: { 'en-US': ['Primary'], 'en-GB': ['British'], ar: ['العربية'] } });
  const state = extractManuscriptState(source);
  return { ...state, ...createInitialVersioningEnvelope(state, { timestamp: '2026-11-04T12:00:00Z', summary: 'Localized fixture', completeness: 'complete' }) };
}
function launch(): OjsLaunchPayload {
  return { protocol: 'omi-integration/1', profile: 'omi-integration/1/ojs', contributors: [], files: [],
    submission: { externalId: 'localized-fixture', primaryLocale: 'en-US', title: { 'en-US': 'Regional title' },
      subtitle: {}, abstract: { 'en-US': 'US abstract', 'en-GB': 'UK abstract', 'de-AT': 'Österreich' },
      keywords: { 'en-US': ['US term'], 'en-GB': ['UK term'], 'de-AT': ['Österreich'] } } };
}
function reopen(source: OmiManuscript) { return parseOmiJson(serializeOmiJson(source)); }
function zipText(bytes: Uint8Array, name: string): string {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), decoder = new TextDecoder();
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true), length = view.getUint16(offset + 26, true), extra = view.getUint16(offset + 28, true);
    const file = decoder.decode(bytes.subarray(offset + 30, offset + 30 + length));
    const start = offset + 30 + length + extra;
    if (file === name) return decoder.decode(bytes.subarray(start, start + size));
    offset = start + size;
  }
  throw new Error(`Missing ZIP entry: ${name}`);
}
export const coreLocalizedConversionCases = [
  { id: 'regional-and-script-language-tags-stay-distinct', requirements: ['REQ-MET-011'], run() {
    assert.equal(normalizeLocale('en_US'), 'en-US'); assert.equal(normalizeLocale('en_GB'), 'en-GB');
    assert.equal(normalizeLocale('de_AT'), 'de-AT'); assert.equal(normalizeLocale('zh_hant_TW'), 'zh-Hant-TW');
    assert.equal(normalizeLocale('x-custom'), 'x-custom');
  } },
  { id: 'localized-text-keeps-regional-unicode-values', requirements: ['REQ-MET-011', 'REQ-MET-018'], run() {
    const input = { en_US: 'Color', en_GB: 'Colour', de_AT: 'Jänner', zh_Hant: '繁體字', ar: 'العربية' };
    const before = structuredClone(input), result = normalizeLocalizedText(input);
    assert.deepEqual(result, { 'en-US': 'Color', 'en-GB': 'Colour', 'de-AT': 'Jänner', 'zh-Hant': '繁體字', ar: 'العربية' });
    assert.deepEqual(input, before);
  } },
  { id: 'localized-keywords-retain-regional-associations', requirements: ['REQ-MET-011'], run() {
    assert.deepEqual(normalizeLocalizedTerms({ en_US: ['Color'], en_GB: ['Colour'], zh_Hant: [{ name: '繁體字' }] }),
      { 'en-US': ['Color'], 'en-GB': ['Colour'], 'zh-Hant': ['繁體字'] });
  } },
  { id: 'conflicting-locale-aliases-refuse-silent-overwrite', requirements: ['REQ-MET-011', 'REQ-PRI-008'], run() {
    const source = { en_US: 'Original', 'en-US': 'Different' }, before = structuredClone(source);
    assert.throws(() => normalizeLocalizedText(source), /LOCALIZED_METADATA_LOCALE_COLLISION/);
    assert.throws(() => normalizeLocalizedTerms({ en_US: ['A'], 'en-US': ['B'] }), /LOCALIZED_METADATA_LOCALE_COLLISION/);
    assert.deepEqual(normalizeLocalizedText({ en_US: 'Same', 'en-US': 'Same' }), { 'en-US': 'Same' });
    assert.deepEqual(source, before);
  } },
  { id: 'ojs-import-preserves-regional-abstracts-and-keywords', requirements: ['REQ-MET-011', 'REQ-MET-017'], run() {
    const input = launch(), before = structuredClone(input), result = createManuscriptFromOjsLaunch(input)!;
    assert.equal(result.locale, 'en-US'); assert.equal(result.abstracts?.['en-US'], 'US abstract');
    assert.equal(result.abstracts?.['en-GB'], 'UK abstract'); assert.equal(result.abstracts?.['de-AT'], 'Österreich');
    assert.deepEqual(result.keywordsByLocale?.['en-US'], ['US term']); assert.deepEqual(result.keywordsByLocale?.['en-GB'], ['UK term']);
    assert.equal(result.metadata?.licenseUrl, undefined); assert.equal(result.metadata?.publicationVenue, undefined);
    assert.deepEqual(input, before);
  } },
  { id: 'ojs-alias-collision-never-returns-lossy-candidate', requirements: ['REQ-MET-011', 'REQ-PRI-008'], run() {
    for (const field of ['abstract', 'keywords'] as const) {
      const input = launch();
      Object.assign(input.submission!, { [field]: field === 'abstract' ? { en_US: 'One', 'en-US': 'Two' } : { en_US: ['One'], 'en-US': ['Two'] } });
      const before = structuredClone(input);
      assert.throws(() => createManuscriptFromOjsLaunch(input), /LOCALIZED_METADATA_LOCALE_COLLISION/);
      assert.deepEqual(input, before);
    }
  } },
  { id: 'localized-edits-seed-legacy-primary-variants', requirements: ['REQ-MET-011', 'REQ-MET-018'], run() {
    const previous = useStudioStore.getState();
    try {
      const source = fixture(); source.abstracts = { 'en-GB': 'UK' }; source.keywordsByLocale = { 'en-GB': ['UK'] };
      useStudioStore.setState({ manuscript: source, pendingChangeSet: null });
      setLocalizedAbstract('zh-Hant', '新增摘要'); setLocalizedKeywords('ar', ['جديد']);
      const updated = useStudioStore.getState().manuscript;
      assert.equal(updated.abstracts?.['en-US'], source.abstract); assert.deepEqual(updated.keywordsByLocale?.['en-US'], source.keywords);
      assert.equal(updated.abstracts?.['en-GB'], 'UK'); assert.deepEqual(updated.keywordsByLocale?.['en-GB'], ['UK']);
      assert.equal(updated.abstract, source.abstract); assert.deepEqual(updated.keywords, source.keywords);
      useStudioStore.getState().checkpoint('manual');
      assert.deepEqual(reopen(useStudioStore.getState().manuscript).abstracts, updated.abstracts);
    } finally { useStudioStore.setState(previous); }
  } },
  { id: 'portable-backup-retains-all-localized-variants', requirements: ['REQ-MET-011', 'REQ-MET-018'], run() {
    const source = fixture(), result = reopen(source);
    assert.deepEqual(result.abstracts, source.abstracts); assert.deepEqual(result.keywordsByLocale, source.keywordsByLocale);
    assert.equal(result.title, source.title); assert.equal(result.locale, source.locale);
  } },
  ...(['docx', 'odt'] as const).map(format => ({
    id: `${format}-export-discloses-omitted-language-variants`, requirements: ['REQ-MET-011', 'REQ-MET-017', 'REQ-PRI-008'], run() {
      const source = fixture(), before = structuredClone(source), output = format === 'docx' ? buildDocxExport(source) : buildOdtExport(source);
      const text = zipText(output.bytes, format === 'docx' ? 'word/document.xml' : 'content.xml');
      assert.ok(text.includes('Primary abstract')); assert.ok(!text.includes('British abstract')); assert.ok(!text.includes('繁體摘要'));
      const omissions = output.metadataConversion.filter(item => item.disposition === 'omitted').map(item => item.sourceLocator);
      for (const path of ['/abstracts/en-GB', '/abstracts/zh-Hant', '/keywordsByLocale/en-GB', '/keywordsByLocale/ar']) {
        assert.ok(omissions.includes(path)); assert.ok(output.warnings.some(warning => warning.includes(path)));
      }
      assert.deepEqual(source, before);
    },
  })),
  { id: 'office-metadata-report-distinguishes-normalization-and-unknown-mapping', requirements: ['REQ-MET-017', 'REQ-PRI-008'], run() {
    const source = fixture(); source.abstract = '  Primary abstract  '; source.abstracts!['en-US'] = source.abstract;
    source.metadata = { rights: { en: 'Synthetic rights claim' }, source: { en: 'Source claim' } };
    for (const build of [buildDocxExport, buildOdtExport]) {
      const result = build(source), observations = result.metadataConversion;
      assert.ok(observations.some(item => item.sourceLocator === '/title' && item.disposition === 'preserved'));
      assert.ok(observations.some(item => item.sourceLocator === '/abstract' && item.disposition === 'normalized'));
      assert.ok(observations.some(item => item.sourceLocator === '/metadata' && item.disposition === 'omitted'));
      assert.ok(observations.some(item => item.disposition === 'unverified'));
      const report = JSON.stringify({ observations, warnings: result.warnings });
      assert.ok(!report.includes('Synthetic rights claim')); assert.ok(!report.includes('Primary abstract'));
      const part = build === buildDocxExport ? 'word/document.xml' : 'content.xml';
      assert.ok(!zipText(result.bytes, part).includes('Synthetic rights claim'));
      assert.equal(source.metadata.licenseUrl, undefined); assert.equal(source.metadata.publicationVenue, undefined);
      const empty = fixture(); empty.abstract = ''; empty.abstracts = { 'en-US': '' };
      const emptyResult = build(empty);
      assert.ok(emptyResult.metadataConversion.some(item => item.sourceLocator === '/abstracts/en-US' && item.disposition === 'omitted'));
    }
  } },
  { id: 'office-delivery-receipt-retains-typed-metadata-loss-observations', requirements: ['REQ-MET-017', 'REQ-PRI-008'], async run() {
    const source = fixture(), output = buildDocxExport(source);
    const session = await ExportExchangeSession.begin('docx', serializeOmiJson(source));
    session.recordAdapterDiagnostics(output); await session.inspectArtifact(output.blob);
    const report = session.finishDelivery(true);
    assert.deepEqual(report.metadataConversion, output.metadataConversion);
    assert.equal(report.lossless, false); assert.equal(report.coverage, 'incomplete'); assert.equal(report.status, 'completed-with-loss');
    assert.ok(report.events.some(item => item.code === 'ADAPTER_WARNING' && item.consequence.includes('/abstracts/en-GB')));
    output.metadataConversion.length = 0;
    assert.ok(session.fail().metadataConversion!.length > 0);
  } },
];
export async function runCoreLocalizedConversionCases() {
  const results = [];
  for (const item of coreLocalizedConversionCases) {
    await item.run(); results.push({ id: item.id, requirements: [...item.requirements], status: 'pass' as const });
  }
  return results;
}
