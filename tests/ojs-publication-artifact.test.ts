import assert from 'node:assert/strict';
import test from 'node:test';

import {
  prepareOjsPublicationArtifact,
} from '../src/services/ojsPublicationArtifact.ts';
import { createHtmlGalleyStudy } from './fixtures/htmlGalleyStudy.ts';

test('HTML publication artifact carries exact OMI build provenance', async () => {
  const manuscript = createHtmlGalleyStudy();
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
  const manuscript = createHtmlGalleyStudy();
  manuscript.documentStructure = {
    ...manuscript.documentStructure!,
    kind: 'volume',
  };

  await assert.rejects(
    prepareOjsPublicationArtifact(manuscript, 'html'),
    /standalone study/i,
  );
});
