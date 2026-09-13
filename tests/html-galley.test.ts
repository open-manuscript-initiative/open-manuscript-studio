import assert from 'node:assert/strict';
import test from 'node:test';
import { createAssetMetadata } from '../src/model/assets.ts';
import { createDocumentStructureProfile } from '../src/model/documentProfile.ts';
import { putAssetPayload } from '../src/services/assetRepository.ts';
import { buildHtmlGalley } from '../src/services/htmlGalley.ts';
import { createHtmlGalleyStudy } from './fixtures/htmlGalleyStudy.ts';

test('demo study produces portable semantic HTML, table, headings and Hungarian text', async () => {
  const html = await buildHtmlGalley(createHtmlGalleyStudy());
  assert.match(html, /<html lang="hu">/);
  assert.match(html, /A strukturált kézirattól/);
  assert.match(html, /<table>/);
  assert.match(html, /<style>/);
  assert.doesNotMatch(html, /<script|<link|<iframe/);
});

test('embeds checked raster payloads and rejects missing or changed images', async () => {
  const manuscript = createHtmlGalleyStudy();
  const bytes = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=', 'base64'));
  const asset = await createAssetMetadata(bytes, { id: 'galley-pixel', mediaType: 'image/png', fileName: 'sample.png' });
  manuscript.assets = [asset];
  manuscript.sections[0]!.blocks.push({ id: 'demo-image', type: 'image', content: '', visual: { kind: 'image', assetId: asset.id, src: '', mediaType: asset.mediaType, fileName: asset.fileName, alt: 'Test pixel' } });
  await assert.rejects(buildHtmlGalley(manuscript), /integrity/);
  await putAssetPayload(manuscript.id, asset.id, bytes);
  const html = await buildHtmlGalley(manuscript);
  assert.match(html, /src="data:image\/png;base64,/);
  assert.doesNotMatch(html, /src="media\//);
  await putAssetPayload(manuscript.id, asset.id, new Uint8Array([1]));
  await assert.rejects(buildHtmlGalley(manuscript), /integrity/);
});

test('does not transfer an edited volume as one article', async () => {
  const manuscript = createHtmlGalleyStudy();
  manuscript.documentStructure = createDocumentStructureProfile('volume');
  await assert.rejects(buildHtmlGalley(manuscript), /standalone study/);
});
