import assert from 'node:assert/strict';
import { createManuscriptFromOjsLaunch } from '../src/integrations/ojs/importOjsLaunchLocalized.ts';
import type { OjsLaunchPayload } from '../src/integrations/ojs/importOjsLaunch.ts';
import { serializeOmiJson } from '../src/services/exportOmi.ts';
import { parseOmiJson } from '../src/services/omiPortableFormat.ts';
import { createInitialVersioningEnvelope, extractManuscriptState } from '../src/model/versioning.ts';
import { useStudioStore } from '../src/app/useStudioStore.ts';
import { setOjsOpenScienceField, setScholarlyLocalizedText } from '../src/app/scholarlyMetadataActions.ts';
import { validateStudioManuscript } from '../src/services/manuscriptValidation.ts';
import { runCoreModelReview } from '../src/services/coreModelReview.ts';
import { validateCoreSnapshot } from '../src/model/coreSnapshotValidator.mjs';
import { FRAME_LAYOUT_EXTENSION, FRAME_LAYOUT_PROFILE, createFrameLayout, validateFrameLayout } from '../src/model/publicationFrames.ts';
import { TRANSLATION_EXTENSION, getTranslationModel } from '../src/model/translation.ts';
import { buildDocxExport } from '../src/services/exportDocx.ts';
import { buildOdtExport } from '../src/services/exportOdt.ts';
import { ExportExchangeSession } from '../src/services/exchangeSession.ts';
import type { OmiManuscript } from '../src/types/omi.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';

export const extensionSpecifications = {
  'OMI-SPEC-000': '0.2.0', 'OMI-SPEC-100': '0.2.0', 'OMI-SPEC-120': '0.3.0', 'OMI-SPEC-140': '0.2.0',
};
const NS = 'https://example.org/scholarly/profile/1';
const OJS = 'https://pkp.sfu.ca/ojs/';
function opaque() {
  return { profile: 'urn:example:discipline:1', version: '7.2.0',
    vocabulary: { namespace: 'urn:example:terms', version: '2030.1', values: ['unknown-future-term', '中文', 'العربية'] },
    nested: [null, false, 0, '', { id: 'manuscript-test', meaning: 'opaque embedded ID' }] };
}
function fixture(): OmiManuscript {
  const source = createVersionedTestManuscript();
  source.extensions = { [NS]: opaque(), [OJS]: { version: '2.0', openScience: { openData: { en: 'Known declaration' } }, future: opaque() } };
  source.metadata = Object.assign({ rights: { en: 'Author statement' } }, { [NS]: opaque() });
  const state = extractManuscriptState(source);
  return { ...state, ...createInitialVersioningEnvelope(state, { timestamp: '2026-11-04T12:00:00Z', summary: 'Extension fixture', completeness: 'complete' }) };
}
function launch(): OjsLaunchPayload {
  const source: OjsLaunchPayload = { protocol: 'omi-integration/1', profile: 'omi-integration/1/ojs', contributors: [], files: [],
    submission: { externalId: 'extension-fixture', primaryLocale: 'en', title: { en: 'Imported title' }, subtitle: {}, abstract: { en: 'Abstract' }, keywords: { en: ['Keyword'] } } };
  Object.assign(source.submission!, { metadata: { rights: { en: 'Rights statement' }, [NS]: opaque() },
    extensions: { [NS]: opaque(), [OJS]: { version: '2.0', openScience: { openData: { en_US: '  Known statement  ' }, futureAssertion: opaque() }, future: opaque() } } });
  return source;
}
function reopen(source: OmiManuscript) { return parseOmiJson(serializeOmiJson(source)); }
function unknownMetadata(source: OmiManuscript) { return (source.metadata as unknown as Record<string, unknown>)[NS]; }
export const coreExtensionCases = [
  { id: 'opaque-extension-round-trip-retains-namespace-version-and-vocabulary', requirements: ['REQ-MET-014', 'REQ-OBJ-013', 'REQ-MET-018'], run() {
    const source = fixture(), before = structuredClone(source), result = reopen(source);
    assert.deepEqual(result.extensions?.[NS], opaque()); assert.deepEqual(unknownMetadata(result), opaque());
    assert.equal(result.id, source.id); assert.deepEqual(source, before);
  } },
  { id: 'ojs-import-retains-unknown-metadata-fields', requirements: ['REQ-MET-014', 'REQ-OBJ-013', 'REQ-MET-018'], run() {
    const input = launch(), before = structuredClone(input), result = createManuscriptFromOjsLaunch(input)!;
    assert.deepEqual(unknownMetadata(result), opaque()); assert.equal(result.metadata?.rights?.en, 'Rights statement');
    assert.deepEqual(unknownMetadata(reopen(result)), opaque()); assert.deepEqual(input, before);
  } },
  { id: 'ojs-import-keeps-unknown-open-science-values-opaque', requirements: ['REQ-MET-014', 'REQ-OBJ-013'], run() {
    const input = launch(), result = createManuscriptFromOjsLaunch(input)!;
    const openScience = result.extensions?.[OJS]?.openScience as unknown as Record<string, unknown>;
    assert.deepEqual(openScience.futureAssertion, opaque());
    assert.deepEqual(openScience.openData, { 'en-US': 'Known statement' });
    assert.equal(result.extensions?.[OJS]?.version, '2.0');
    assert.deepEqual(result.extensions?.[OJS]?.future, opaque());
  } },
  { id: 'ojs-import-detaches-all-opaque-extension-graphs', requirements: ['REQ-MET-018', 'REQ-OBJ-013'], run() {
    const input = launch(), before = structuredClone(input), result = createManuscriptFromOjsLaunch(input)!;
    const extension = result.extensions?.[NS] as ReturnType<typeof opaque>;
    extension.vocabulary.values.push('Changed result');
    (result.extensions?.[OJS]?.future as ReturnType<typeof opaque>).version = 'Edited';
    (unknownMetadata(result) as ReturnType<typeof opaque>).nested.push('Edited metadata');
    assert.deepEqual(input, before);
  } },
  { id: 'known-metadata-edit-keeps-opaque-siblings-and-history', requirements: ['REQ-MET-014', 'REQ-OBJ-013', 'REQ-MET-018'], run() {
    const previous = useStudioStore.getState();
    try {
      const source = fixture(); useStudioStore.setState({ manuscript: source, pendingChangeSet: null });
      setScholarlyLocalizedText('rights', 'hu', 'Szerzői nyilatkozat');
      setOjsOpenScienceField('openData', 'hu', 'Adatnyilatkozat');
      useStudioStore.getState().checkpoint('manual');
      const result = reopen(useStudioStore.getState().manuscript);
      assert.deepEqual(result.extensions?.[NS], opaque()); assert.deepEqual(unknownMetadata(result), opaque());
      assert.deepEqual(result.revisionHistory.revisions[0]!.snapshot.state.extensions?.[NS], opaque());
      assert.equal(result.extensions?.[OJS]?.openScience?.openData?.hu, 'Adatnyilatkozat');
      assert.deepEqual(result.extensions?.[OJS]?.future, opaque());
    } finally { useStudioStore.setState(previous); }
  } },
  { id: 'opaque-extension-fields-cannot-override-core-identity-or-prose', requirements: ['REQ-OBJ-013', 'REQ-DOC-014'], run() {
    const source = fixture(); Object.assign(source.extensions![NS] as object, { id: 'replacement-id', title: 'Replacement title', sections: [] });
    const before = structuredClone(source), result = reopen(source);
    assert.equal(result.id, source.id); assert.equal(result.title, source.title); assert.deepEqual(result.sections, source.sections);
    assert.deepEqual(source, before);
  } },
  { id: 'future-translation-profile-is-retained-with-incomplete-inspection', requirements: ['REQ-DOC-014', 'REQ-OBJ-013', 'REQ-PRI-008'], async run() {
    const source = fixture(), future = { profile: 'studio-translation-99.0', version: '99.0', variants: [{ unsupported: opaque() }] };
    source.extensions![TRANSLATION_EXTENSION] = future;
    const before = structuredClone(source), result = reopen(source);
    assert.deepEqual(result.extensions?.[TRANSLATION_EXTENSION], future);
    assert.throws(() => getTranslationModel(result), /Unsupported or invalid/);
    const report = await validateStudioManuscript(result);
    assert.equal(report.summary.complete, false); assert.equal(report.summary.outcome, 'indeterminate');
    assert.ok(report.diagnostics.some(item => item.code === 'unknown-translation-profile'));
    assert.deepEqual(source, before);
  } },
  { id: 'unknown-frame-profile-is-refused-without-rewriting-source', requirements: ['REQ-DOC-014', 'REQ-OBJ-013', 'REQ-PRI-008'], run() {
    const source = fixture(); source.extensions![FRAME_LAYOUT_EXTENSION] = { ...createFrameLayout(), profile: 'studio-publication-frames-99.0' };
    const before = structuredClone(source);
    assert.throws(() => serializeOmiJson(source), /unsupported profile/);
    assert.deepEqual(source, before);
  } },
  { id: 'recognized-layout-profile-retains-version-and-enforces-its-own-vocabulary', requirements: ['REQ-DOC-014'], run() {
    const source = fixture(), layout = createFrameLayout(); source.extensions![FRAME_LAYOUT_EXTENSION] = layout;
    assert.equal(layout.profile, FRAME_LAYOUT_PROFILE); assert.deepEqual(reopen(source).extensions?.[FRAME_LAYOUT_EXTENSION], layout);
    const invalid = structuredClone(layout); invalid.styles[0]!.properties.alignment = 'future-alignment' as never;
    assert.throws(() => validateFrameLayout(invalid), /invalid shared style/);
    assert.equal(invalid.styles[0]!.properties.alignment, 'future-alignment');
  } },
  { id: 'declared-core-metadata-profile-enforces-requirements-without-ui-inference', requirements: ['REQ-MET-015', 'REQ-OBJ-013'], run() {
    const source = fixture(); source.title = '';
    source.extensions![NS] = { ...opaque(), requiredTitle: false, locale: 'Invented locale' };
    const before = structuredClone(source), authoring = runCoreModelReview(source, 'authoring'), exchange = runCoreModelReview(source, 'exchange');
    assert.equal(authoring.result.profile, 'urn:omi:profile:core-snapshot-review:0.1.0');
    assert.equal(authoring.result.mode, 'authoring'); assert.equal(authoring.result.outcome, 'valid');
    assert.equal(exchange.result.mode, 'exchange'); assert.equal(exchange.result.outcome, 'invalid');
    assert.ok(exchange.result.diagnostics.some((item: { code: string }) => item.code === 'INVALID_TITLE'));
    const projection = JSON.parse(JSON.stringify(extractManuscriptState(fixture())));
    delete projection.locale;
    assert.ok(validateCoreSnapshot(projection, { mode: 'authoring' }).diagnostics.some((item: { path: string }) => item.path === '/locale'));
    assert.throws(() => validateCoreSnapshot(projection, { mode: 'imagined-profile' }), /Invalid core validation options/);
    assert.deepEqual(source, before);
  } },
  { id: 'office-export-discloses-extension-omission-without-claiming-interpretation', requirements: ['REQ-MET-014', 'REQ-PRI-008'], run() {
    const source = fixture(), before = structuredClone(source);
    for (const build of [buildDocxExport, buildOdtExport]) {
      const output = build(source);
      assert.ok(output.metadataConversion.some(item => item.sourceLocator === '/extensions' && item.disposition === 'omitted'));
      assert.ok(output.warnings.some(item => item.includes('/extensions')));
      assert.ok(output.metadataConversion.some(item => item.disposition === 'unverified'));
      assert.ok(!JSON.stringify({ warnings: output.warnings, observations: output.metadataConversion }).includes('unknown-future-term'));
    }
    assert.deepEqual(source, before);
  } },
  { id: 'extension-omission-survives-downloadable-exchange-receipt', requirements: ['REQ-MET-014', 'REQ-PRI-008'], async run() {
    const source = fixture(), output = buildOdtExport(source), session = await ExportExchangeSession.begin('odt', serializeOmiJson(source));
    session.recordAdapterDiagnostics(output); await session.inspectArtifact(output.blob);
    const report = session.finishDelivery(true);
    assert.ok(report.metadataConversion?.some(item => item.sourceLocator === '/extensions' && item.disposition === 'omitted'));
    assert.equal(report.coverage, 'incomplete'); assert.equal(report.lossless, false);
    assert.ok(report.events.some(item => item.code === 'ADAPTER_WARNING' && item.consequence.includes('/extensions')));
  } },
];
export async function runCoreExtensionCases() {
  const results = [];
  for (const item of coreExtensionCases) {
    await item.run(); results.push({ id: item.id, requirements: [...item.requirements], status: 'pass' as const });
  }
  return results;
}
