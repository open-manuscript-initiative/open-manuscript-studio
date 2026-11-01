import assert from 'node:assert/strict';
import test from 'node:test';

import { resolvePublicationProfile } from '../src/model/publicationProfile.ts';
import { preparePublicationArtifactWithBuildSidecar } from '../src/services/publicationBuildSidecar.ts';
import { verifyPublicationBuildArtifact } from '../src/services/publicationBuildManifest.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';

test('web export prepares matching PDF and verification sidecar without initiating downloads', async () => {
  const manuscript = createVersionedTestManuscript();
  const profile = resolvePublicationProfile(manuscript);
  const bytes = new TextEncoder().encode('%PDF-1.7\nexample pdf bytes\n');
  const artifact = new Blob([bytes], { type: 'application/pdf' });
  const ready = await preparePublicationArtifactWithBuildSidecar({
    manuscript,
    profile,
    artifact,
    fileName: 'article.pdf',
    format: 'pdf-print',
    mediaType: 'application/pdf',
    renderer: 'vivliostyle-cli',
    rendererVersion: '11.0.4',
    rendererInput: {
      value: '<html><body>Example</body></html>',
      mediaType: 'text/html;charset=utf-8',
    },
  });

  assert.equal(ready.sidecarFileName, 'article.pdf.omi-build.json');
  const manifest = JSON.parse(ready.sidecarText);
  assert.equal(ready.buildId, manifest.id);
  assert.equal(manifest.output.fileName, 'article.pdf');
  assert.equal(manifest.output.byteLength, bytes.length);
  assert.equal(verifyPublicationBuildArtifact(manifest, bytes), true);
  assert.equal(manifest.rendererInput.mediaType, 'text/html;charset=utf-8');
});
