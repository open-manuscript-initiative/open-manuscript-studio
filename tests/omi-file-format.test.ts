import assert from 'node:assert/strict';
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
} from '../src/services/omiPortableFormat.ts';
import {
  createTestManuscript,
  createVersionedTestManuscript,
} from './testManuscriptFixture.ts';

test('serializes Studio manuscripts as canonical OMI-SPEC-320@0.2.0 working files', () => {
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
  assert.equal('omi' in (reopened as unknown as Record<string, unknown>), false);
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
    version: '0.3.0',
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
      && error.code === 'invalid-document'
      && /title/.test(error.message),
  );
});
