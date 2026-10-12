import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  OMI_FILE_FORMAT_VERSION,
  OMI_MANUSCRIPT_SCHEMA_URI,
} from '../src/model/omiFormatConstants.ts';
import { serializeOmiJson } from '../src/services/exportOmi.ts';
import {
  OmiPortableFormatError,
  parseOmiJson,
  toPortableOmiManuscript,
  validateOmiConformanceJson,
} from '../src/services/omiPortableFormat.ts';
import {
  createTestManuscript,
  createVersionedTestManuscript,
} from './testManuscriptFixture.ts';

test('serializes Studio manuscripts as canonical OMI-SPEC-320@0.3.0 working files', () => {
  const manuscript = createVersionedTestManuscript();
  const serialized = serializeOmiJson(manuscript);
  const portable = JSON.parse(serialized) as Record<string, any>;

  assert.equal(portable.schema, OMI_MANUSCRIPT_SCHEMA_URI);
  assert.equal(portable.omi.format, 'manuscript');
  assert.equal(portable.omi.version, OMI_FILE_FORMAT_VERSION);
  assert.deepEqual(
    portable.omi.profiles,
    ['core-snapshot', 'history-exchange'],
  );
  assert.equal(portable.omi.specifications['OMI-SPEC-160'], '0.1.0');
  assert.equal(portable.versioningModelVersion, 'OMI-SPEC-160@0.1.0');
  assert.equal(portable.headRevisionId, manuscript.headRevisionId);
  assert.equal('authors' in portable, false);

  const reopened = parseOmiJson(serialized);
  assert.equal(reopened.id, manuscript.id);
  assert.equal(reopened.schema, OMI_MANUSCRIPT_SCHEMA_URI);
  assert.equal(reopened.headRevisionId, manuscript.headRevisionId);
  assert.equal(reopened.omi?.version, OMI_FILE_FORMAT_VERSION);
});

test('preserves semantic source attribution through OMI save and reopen', () => {
  const portable = toPortableOmiManuscript(createVersionedTestManuscript()) as unknown as Record<string, any>;
  portable.bibliographicRecords = [{ id: 'source-record', type: 'dataset', title: 'Public dataset' }];
  portable.sourceAttributions = [{
    id: 'source-link',
    sourceObjectId: 'block-one',
    targetBibliographicRecordId: 'source-record',
    predicate: 'prov:wasDerivedFrom',
    assertionStatus: 'author-confirmed',
  }];
  portable.annotations = [{
    id: 'own-work-origin',
    type: 'semantic',
    targetBlockId: 'block-one',
    targetText: 'omi:source-origin',
    body: 'author-declared:self-authored-outside-omi',
    renderingHint: 'hidden',
    createdAt: '2026-10-12T00:00:00.000Z',
    modifiedAt: '2026-10-12T00:00:00.000Z',
  }];

  const reopened = parseOmiJson(JSON.stringify(portable));
  assert.deepEqual(reopened.sourceAttributions, portable.sourceAttributions);
  assert.deepEqual(reopened.annotations, portable.annotations);
  const saved = toPortableOmiManuscript(reopened);
  assert.deepEqual(saved.sourceAttributions, portable.sourceAttributions);
  assert.deepEqual(saved.annotations, portable.annotations);
});

test('rejects the experimental pre-0.2 standalone schema instead of migrating it', () => {
  const portable = toPortableOmiManuscript(createVersionedTestManuscript()) as unknown as Record<string, any>;
  portable.schema = 'https://openmanuscript.org/schemas/omi-manuscript-0.1.json';

  assert.throws(
    () => parseOmiJson(JSON.stringify(portable)),
    (error: unknown) =>
      error instanceof OmiPortableFormatError
      && error.code === 'unsupported-schema',
  );
});

test('rejects an unsupported OMI file-format version independently from the Studio version', () => {
  const portable = toPortableOmiManuscript(createVersionedTestManuscript()) as unknown as Record<string, any>;
  portable.omi = {
    ...portable.omi,
    version: '0.4.0',
  };

  assert.throws(
    () => parseOmiJson(JSON.stringify(portable)),
    (error: unknown) =>
      error instanceof OmiPortableFormatError
      && error.code === 'unsupported-version',
  );
});

test('requires the history-exchange profile for editable Studio working files', () => {
  const portable = toPortableOmiManuscript(createVersionedTestManuscript()) as unknown as Record<string, any>;
  portable.omi = {
    ...portable.omi,
    profiles: ['core-snapshot'],
  };
  delete portable.revisionHistory;
  delete portable.headRevisionId;
  delete portable.versioningModelVersion;

  assert.throws(
    () => parseOmiJson(JSON.stringify(portable)),
    /history-exchange profile/,
  );
});

test('adds the required omission notice when exporting shallow history', () => {
  const manuscript = createVersionedTestManuscript();
  manuscript.revisionHistory = {
    ...manuscript.revisionHistory,
    completeness: 'shallow',
  };

  const portable = toPortableOmiManuscript(manuscript) as unknown as Record<string, any>;
  assert.equal(
    portable.revisionHistory.omissionNotice,
    'Revision history is intentionally shallow in this Studio manuscript.',
  );
});

test('refuses structurally invalid portable manuscripts before serialization', () => {
  const manuscript = createVersionedTestManuscript();
  const section = manuscript.sections[0];
  const block = section?.blocks[0];
  assert.ok(section);
  assert.ok(block);

  block.id = section.id;

  assert.throws(
    () => serializeOmiJson(manuscript),
    (error: unknown) =>
      error instanceof OmiPortableFormatError
      && error.code === 'invalid-document'
      && /Duplicate OMI identifier/.test(error.message),
  );
});

test('does not emit a canonical OMI file until required portable metadata is present', () => {
  const manuscript = createTestManuscript();
  manuscript.title = '';

  assert.throws(
    () => serializeOmiJson(manuscript),
    (error: unknown) =>
      error instanceof OmiPortableFormatError
      && ['invalid-document', 'schema-validation'].includes(error.code)
      && /title/.test(error.message),
  );
});


test('portable OMI preserves explicit uncited bibliography selections', () => {
  const portable = toPortableOmiManuscript(
    createVersionedTestManuscript(),
  ) as unknown as Record<string, any>;
  portable.bibliographicRecords = [{
    id: 'bib-background',
    type: 'book',
    title: 'Reusable background work',
    contributors: [],
    identifiers: [],
    status: 'resolved',
  }];
  portable.bibliographyAdditionalRecordIds = ['bib-background'];

  const reopened = parseOmiJson(JSON.stringify(portable));
  assert.deepEqual(
    reopened.bibliographyAdditionalRecordIds,
    ['bib-background'],
  );
});

test('portable OMI rejects bibliography selections that do not resolve to a record', () => {
  const portable = toPortableOmiManuscript(
    createVersionedTestManuscript(),
  ) as unknown as Record<string, any>;
  portable.bibliographyAdditionalRecordIds = ['missing-record'];

  assert.throws(
    () => parseOmiJson(JSON.stringify(portable)),
    /Unresolved OMI reference at \/bibliographyAdditionalRecordIds\/0/,
  );
});


test('preserves the complete portable envelope and unknown data through an edit/save round trip', async () => {
  const fixtureRoot = new URL('./fixtures/omi-spec-320/0.3.0/', import.meta.url);
  const source = JSON.parse(await readFile(
    new URL('valid-history-extension.omi.json', fixtureRoot),
    'utf8',
  )) as Record<string, any>;
  source.opaqueVendorData = { future: { orderedValues: ['first', 'second'] } };
  source.omi.opaqueEnvelopeData = { producerMode: 'future', options: ['a', 'b'] };
  source.extensions['https://example.org/omi/extensions/research-project/1'].futureField = {
    retained: true,
  };
  source.sections.push({
    id: 'section-afterword',
    title: 'Utószó',
    blocks: [],
  });

  const imported = parseOmiJson(JSON.stringify(source));
  imported.title = 'Szerkesztett kézirat';

  const saved = JSON.parse(serializeOmiJson(imported)) as Record<string, any>;
  assert.equal(saved.title, 'Szerkesztett kézirat');
  assert.deepEqual(saved.opaqueVendorData, source.opaqueVendorData);
  assert.deepEqual(saved.omi.opaqueEnvelopeData, source.omi.opaqueEnvelopeData);
  assert.deepEqual(saved.omi.generator, source.omi.generator);
  assert.deepEqual(saved.omi.profiles, source.omi.profiles);
  for (const [specification, version] of Object.entries(source.omi.specifications)) {
    assert.equal(saved.omi.specifications[specification], version);
  }

  assert.deepEqual(saved.extensions, source.extensions);
  assert.deepEqual(saved.agents, source.agents);
  assert.deepEqual(saved.contributions, source.contributions);
  assert.deepEqual(saved.sections, source.sections);
  assert.deepEqual(saved.annotations, source.annotations);
  assert.deepEqual(saved.bibliographicRecords, source.bibliographicRecords);
  assert.deepEqual(saved.citations, source.citations);
  assert.deepEqual(saved.revisionHistory, source.revisionHistory);
  assert.equal(saved.headRevisionId, source.headRevisionId);

  const reopened = parseOmiJson(JSON.stringify(saved));
  assert.deepEqual(reopened.extensions, source.extensions);
  assert.deepEqual(reopened.sections, source.sections);
  assert.deepEqual(reopened.revisionHistory, source.revisionHistory);
});



test('rejects JSON numbers and strings that JavaScript would silently corrupt', () => {
  const portable = toPortableOmiManuscript(createVersionedTestManuscript());
  const json = JSON.stringify(portable);
  const invalidSources = [
    [json.replace('{', '{"unsafeInteger":9007199254740993,'), 'FMT-UNSAFE-INTEGER', 'safe integer range'],
    [json.replace('{', '{"nonFinite":1e400,'), 'FMT-NONFINITE-NUMBER', 'not finite'],
    [json.replace('{', String.raw\`{"unpaired":"\\uD800",\`), 'FMT-INVALID-UNICODE', 'unpaired Unicode surrogate'],
  ] as const;

  for (const [source, code, message] of invalidSources) {
    assert.throws(
      () => parseOmiJson(source),
      (error: unknown) =>
        error instanceof OmiPortableFormatError
        && error.code === 'invalid-document'
        && error.message.includes(message)
        && !error.message.includes('9007199254740993')
        && !error.message.includes('1e400'),
    );
    assert.deepEqual(validateOmiConformanceJson(source), [code]);
  }
});

test('keeps __proto__ as inert JSON data while preserving object prototypes', () => {
  const portable = toPortableOmiManuscript(createVersionedTestManuscript());
  const source = JSON.stringify(portable).replace(
    '{',
    '{"__proto__":{"polluted":true},',
  );
  const reopened = parseOmiJson(source) as unknown as Record<string, unknown>;
  assert.equal(Object.hasOwn(reopened, '__proto__'), true);
  assert.deepEqual(reopened.__proto__, { polluted: true });
  assert.equal(Object.getPrototypeOf(reopened), Object.prototype);
  assert.equal(({} as { polluted?: boolean }).polluted, undefined);
});

test('requires absolute asset URIs and validates timestamp calendar boundaries', () => {
  const template = toPortableOmiManuscript(createVersionedTestManuscript());
  const relativeAsset = structuredClone(template) as unknown as Record<string, any>;
  relativeAsset.assets = [{ id: 'asset-relative', mediaType: 'image/png', uri: 'images/a.png' }];
  assert.throws(
    () => parseOmiJson(JSON.stringify(relativeAsset)),
    (error: unknown) =>
      error instanceof OmiPortableFormatError
      && error.code === 'invalid-document'
      && error.message.includes('/assets/0/uri must be an absolute URI'),
  );

  const absoluteAsset = structuredClone(relativeAsset);
  absoluteAsset.assets[0].uri = 'https://example.org/images/a.png';
  assert.doesNotThrow(() => parseOmiJson(JSON.stringify(absoluteAsset)));

  const validOffset = structuredClone(template);
  validOffset.createdAt = '2026-10-10T12:00:00+02:00';
  validOffset.updatedAt = '2026-10-10T10:00:00Z';
  assert.doesNotThrow(() => parseOmiJson(JSON.stringify(validOffset)));

  for (const timestamp of ['2026-10-10T12:00:00', '2026-02-30T12:00:00Z']) {
    const invalidTimestamp = structuredClone(template);
    invalidTimestamp.createdAt = timestamp;
    assert.throws(() => parseOmiJson(JSON.stringify(invalidTimestamp)));
  }
});

test('rejects session identifiers in portable manuscript data', () => {
  const portable = toPortableOmiManuscript(createVersionedTestManuscript()) as unknown as Record<string, any>;
  portable.sessionId = 'synthetic-session-secret';
  assert.throws(
    () => parseOmiJson(JSON.stringify(portable)),
    (error: unknown) =>
      error instanceof OmiPortableFormatError
      && error.message.includes('credential field')
      && !error.message.includes('synthetic-session-secret'),
  );
});

test('validates well-formed BCP 47 tags in manuscript and section metadata', () => {
  const template = toPortableOmiManuscript(createVersionedTestManuscript());
  for (const tag of ['en-US', 'zh-Hant-TW', 'en-GB-oed', 'i-klingon', 'x-project']) {
    const portable = structuredClone(template);
    portable.locale = tag;
    assert.doesNotThrow(() => parseOmiJson(JSON.stringify(portable)), tag);
  }

  for (const tag of ['en-US-AB', 'de-1901-1901', 'en-a-foo-a-bar']) {
    const invalidLocale = structuredClone(template);
    invalidLocale.locale = tag;
    assert.throws(
      () => parseOmiJson(JSON.stringify(invalidLocale)),
      (error: unknown) =>
        error instanceof OmiPortableFormatError
        && error.code === 'invalid-document'
        && /\/locale/.test(error.message)
        && !error.message.includes(tag),
      tag,
    );
  }

  const invalidSectionLanguage = structuredClone(template);
  const section = invalidSectionLanguage.sections[0];
  assert.ok(section);
  section.language = 'en-US-AB';
  assert.throws(
    () => parseOmiJson(JSON.stringify(invalidSectionLanguage)),
    (error: unknown) =>
      error instanceof OmiPortableFormatError
      && /\/sections\/0\/language/.test(error.message),
  );
  const invalidBlockLanguage = structuredClone(template);
  const block = invalidBlockLanguage.sections[0]?.blocks[0];
  assert.ok(block);
  block.language = 'en-US-AB';
  assert.throws(
    () => parseOmiJson(JSON.stringify(invalidBlockLanguage)),
    (error: unknown) =>
      error instanceof OmiPortableFormatError
      && /\/sections\/0\/blocks\/0\/language/.test(error.message),
  );
});

test('redacts manuscript identifiers and reference values from Studio validation errors', () => {
  const privateValue = 'restricted-manuscript-value-592c';
  const duplicate = toPortableOmiManuscript(createVersionedTestManuscript()) as unknown as Record<string, any>;
  const section = duplicate.sections[0];
  assert.ok(section);
  section.id = privateValue;
  section.blocks[0].id = privateValue;
  assert.throws(
    () => parseOmiJson(JSON.stringify(duplicate)),
    (error: unknown) =>
      error instanceof OmiPortableFormatError
      && error.message.includes('Duplicate OMI identifier')
      && !error.message.includes(privateValue),
  );

  const unresolved = toPortableOmiManuscript(createVersionedTestManuscript()) as unknown as Record<string, any>;
  unresolved.annotations = [{
    id: 'annotation-private',
    targetBlockId: privateValue,
  }];
  assert.throws(
    () => parseOmiJson(JSON.stringify(unresolved)),
    (error: unknown) =>
      error instanceof OmiPortableFormatError
      && error.message.includes('/annotations/0/targetBlockId')
      && !error.message.includes(privateValue),
  );
});

test('enforces complete history parents and allows declared partial or shallow boundaries', async () => {
  const fixtureRoot = new URL('./fixtures/omi-spec-320/0.3.0/', import.meta.url);
  const historyFixture = JSON.parse(await readFile(
    new URL('valid-history-extension.omi.json', fixtureRoot),
    'utf8',
  )) as Record<string, any>;
  const missingParent = 'restricted-parent-revision-71d4';
  const complete = structuredClone(historyFixture);
  complete.revisionHistory.revisions[1].parentRevisionIds = [missingParent];
  assert.throws(
    () => parseOmiJson(JSON.stringify(complete)),
    (error: unknown) =>
      error instanceof OmiPortableFormatError
      && error.message.includes('/revisionHistory/revisions/1/parentRevisionIds/0')
      && !error.message.includes(missingParent),
  );

  for (const completeness of ['partial', 'shallow']) {
    const bounded = structuredClone(complete);
    bounded.revisionHistory.completeness = completeness;
    bounded.revisionHistory.omissionNotice = 'Earlier history is outside this package.';
    assert.doesNotThrow(
      () => parseOmiJson(JSON.stringify(bounded)),
      `${completeness} history declares its omitted boundary`,
    );
  }
});

test('passes the version-pinned OMI-SPEC-320@0.3.0 conformance fixtures', async () => {
  const fixtureRoot = new URL('./fixtures/omi-spec-320/0.3.0/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', fixtureRoot), 'utf8')) as {
    specification: string; schema: string; suiteVersion: string;
    fixtures: Array<{ path: string; valid: boolean; expectedDiagnostics: string[] }>;
  };
  assert.equal(manifest.specification, 'OMI-SPEC-320@0.3.0');
  assert.equal(manifest.schema, OMI_MANUSCRIPT_SCHEMA_URI);
  assert.equal(manifest.suiteVersion, '0.3.0-draft.4');
  for (const fixture of manifest.fixtures) {
    const source = await readFile(new URL(fixture.path, fixtureRoot), 'utf8');
    const actualDiagnostics = validateOmiConformanceJson(source);
    assert.equal(actualDiagnostics.length === 0, fixture.valid, `${fixture.path}: validity differs`);
    assert.deepEqual(actualDiagnostics, fixture.expectedDiagnostics, `${fixture.path}: diagnostic codes differ`);
  }
});
