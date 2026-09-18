import assert from 'node:assert/strict';
import test from 'node:test';

import { resolvePublicationProfile } from '../src/model/publicationProfile.ts';
import {
  createPublicationBuildManifest,
  publicationBuildManifestFileName,
  serializePublicationBuildManifest,
  verifyPublicationBuildArtifact,
} from '../src/services/publicationBuildManifest.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';

const GENERATOR = {
  applicationVersion: '0.1.1-beta.1',
  applicationBuild: '437',
  applicationCommit: 'abcdef1',
  renderer: 'omi-jats',
  rendererVersion: '0.1.0-alpha.1',
};

test('creates deterministic publication-build provenance for a committed revision', () => {
  const manuscript = createVersionedTestManuscript();
  const profile = resolvePublicationProfile(manuscript);
  const artifact = '<?xml version="1.0"?><article/>';

  const first = createPublicationBuildManifest({
    manuscript,
    profile,
    artifact,
    output: {
      format: 'jats',
      mediaType: 'application/xml',
      fileName: 'article.xml',
    },
    generator: GENERATOR,
    createdAt: '2026-09-18T05:00:00.000Z',
  });
  const second = createPublicationBuildManifest({
    manuscript,
    profile,
    artifact,
    output: {
      format: 'jats',
      mediaType: 'application/xml',
      fileName: 'article.xml',
    },
    generator: GENERATOR,
    createdAt: '2026-09-18T06:00:00.000Z',
  });

  assert.equal(first.id, second.id);
  assert.match(
    first.id,
    /^urn:omi:publication-build:sha256:[a-f0-9]{64}$/,
  );
  assert.equal(first.manuscript.id, manuscript.id);
  assert.equal(first.manuscript.revisionId, manuscript.headRevisionId);
  assert.match(first.manuscript.stateDigest.value, /^[a-f0-9]{64}$/);
  assert.match(first.profile.digest.value, /^[a-f0-9]{64}$/);
  assert.equal(first.output.byteLength, new TextEncoder().encode(artifact).byteLength);
  assert.match(first.output.digest.value, /^[a-f0-9]{64}$/);
  assert.equal(first.generator.application, 'open-manuscript-studio');
  assert.equal(first.createdAt, '2026-09-18T05:00:00.000Z');
  assert.equal(verifyPublicationBuildArtifact(first, artifact), true);
  assert.equal(verifyPublicationBuildArtifact(first, artifact + 'changed'), false);
});

test('requires a checkpoint when working state differs from the committed head', () => {
  const manuscript = createVersionedTestManuscript();
  manuscript.title = 'Uncommitted title change';
  const profile = resolvePublicationProfile(manuscript);

  assert.throws(
    () =>
      createPublicationBuildManifest({
        manuscript,
        profile,
        artifact: '<article/>',
        output: {
          format: 'jats',
          mediaType: 'application/xml',
          fileName: 'article.xml',
        },
        generator: GENERATOR,
      }),
    /requires a checkpoint/i,
  );
});

test('profile or artifact changes produce a distinct publication-build identity', () => {
  const manuscript = createVersionedTestManuscript();
  const profile = resolvePublicationProfile(manuscript);
  const changedProfile = {
    ...profile,
    description: profile.description + ' Changed without a version bump.',
  };

  const base = createPublicationBuildManifest({
    manuscript,
    profile,
    artifact: 'alpha',
    output: {
      format: 'html',
      mediaType: 'text/html',
      fileName: 'article.html',
    },
    generator: {
      ...GENERATOR,
      renderer: 'omi-html',
    },
    createdAt: '2026-09-18T05:00:00.000Z',
  });
  const profileChanged = createPublicationBuildManifest({
    manuscript,
    profile: changedProfile,
    artifact: 'alpha',
    output: {
      format: 'html',
      mediaType: 'text/html',
      fileName: 'article.html',
    },
    generator: {
      ...GENERATOR,
      renderer: 'omi-html',
    },
    createdAt: '2026-09-18T05:00:00.000Z',
  });
  const artifactChanged = createPublicationBuildManifest({
    manuscript,
    profile,
    artifact: 'beta',
    output: {
      format: 'html',
      mediaType: 'text/html',
      fileName: 'article.html',
    },
    generator: {
      ...GENERATOR,
      renderer: 'omi-html',
    },
    createdAt: '2026-09-18T05:00:00.000Z',
  });

  assert.notEqual(base.profile.digest.value, profileChanged.profile.digest.value);
  assert.notEqual(base.id, profileChanged.id);
  assert.notEqual(base.output.digest.value, artifactChanged.output.digest.value);
  assert.notEqual(base.id, artifactChanged.id);
});

test('serializes a portable sidecar manifest with a predictable filename', () => {
  const manuscript = createVersionedTestManuscript();
  const profile = resolvePublicationProfile(manuscript);
  const build = createPublicationBuildManifest({
    manuscript,
    profile,
    artifact: 'artifact',
    output: {
      format: 'pdf-print',
      mediaType: 'application/pdf',
      fileName: 'article.pdf',
    },
    generator: {
      ...GENERATOR,
      renderer: 'vivliostyle',
      rendererVersion: '0.0-test',
    },
    createdAt: '2026-09-18T05:00:00.000Z',
  });

  assert.equal(
    publicationBuildManifestFileName('article.pdf'),
    'article.pdf.omi-build.json',
  );
  const serialized = serializePublicationBuildManifest(build);
  assert.equal(serialized.endsWith('\n'), true);
  assert.deepEqual(JSON.parse(serialized), build);
});
