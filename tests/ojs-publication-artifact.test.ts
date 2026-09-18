import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createInitialVersioningEnvelope,
  extractManuscriptState,
} from '../src/model/versioning.ts';
import {
  assertJatsDirectTransferHasNoPackageLocalAssets,
  prepareOjsPublicationArtifact,
} from '../src/services/ojsPublicationArtifact.ts';
import type { OmiManuscript } from '../src/types/omi.ts';
import { createHtmlGalleyStudy } from './fixtures/htmlGalleyStudy.ts';

function createCommittedHtmlStudy(): OmiManuscript {
  const draft = createHtmlGalleyStudy();
  const state = extractManuscriptState(draft);
  const envelope = createInitialVersioningEnvelope(state, {
    summary: 'Created publication artifact fixture',
    timestamp: state.updatedAt,
    completeness: 'complete',
  });
  return { ...state, ...envelope };
}

test('HTML publication artifact carries exact OMI build provenance', async () => {
  const manuscript = createCommittedHtmlStudy();
  const prepared = await prepareOjsPublicationArtifact(manuscript, 'html');

  assert.equal(prepared.format, 'html');
  assert.equal(prepared.mediaType, 'text/html;charset=utf-8');
  assert.match(prepared.fileName, /\.html$/);
  assert.ok(prepared.bytes.byteLength > 0);
  assert.equal(prepared.build.model, 'omi-publication-build');
  assert.equal(prepared.build.version, '0.1.0');
  assert.equal(prepared.build.manuscript.id, manuscript.id);
  assert.equal(prepared.build.output.format, 'html');
  assert.equal(prepared.build.output.fileName, prepared.fileName);
  assert.equal(prepared.build.output.byteLength, prepared.bytes.byteLength);
  assert.equal(prepared.build.output.digest.algorithm, 'sha256');
  assert.match(prepared.build.output.digest.value, /^[a-f0-9]{64}$/);
  assert.match(
    prepared.build.id,
    /^urn:omi:publication-build:sha256:[a-f0-9]{64}$/,
  );
  assert.equal(
    Buffer.from(prepared.artifactBase64, 'base64').byteLength,
    prepared.bytes.byteLength,
  );
  assert.match(prepared.previewText ?? '', /^<!doctype html>/i);
});

test('publication artifact preparation rejects non-study HTML targets', async () => {
  const manuscript = createCommittedHtmlStudy();
  manuscript.documentStructure = {
    ...manuscript.documentStructure!,
    kind: 'volume',
  };

  await assert.rejects(
    prepareOjsPublicationArtifact(manuscript, 'html'),
    /standalone study/i,
  );
});


test('JATS direct transfer rejects package-local binary references', () => {
  assert.doesNotThrow(() =>
    assertJatsDirectTransferHasNoPackageLocalAssets(
      '<article><graphic xlink:href="https://cdn.example.test/figure.png"/></article>',
    ),
  );
  assert.rejects(
    async () =>
      assertJatsDirectTransferHasNoPackageLocalAssets(
        '<article><graphic xlink:href="omi-assets/figure.png"/></article>',
      ),
    /package-local binary assets/i,
  );
});
