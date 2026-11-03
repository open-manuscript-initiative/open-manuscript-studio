import assert from 'node:assert/strict';
import test from 'node:test';
import { createAssetMetadata } from '../src/model/assets.ts';
import { createDocumentStructureProfile } from '../src/model/documentProfile.ts';
import { putAssetPayload } from '../src/services/assetRepository.ts';
import { buildPublicationHtmlArtifact } from '../src/services/publicationHtmlArtifact.ts';
import { createHtmlGalleyStudy } from './fixtures/htmlGalleyStudy.ts';

test('demo study produces a portable semantic HTML publication artifact', async () => {
  const html = await buildPublicationHtmlArtifact(createHtmlGalleyStudy());
  assert.match(html, /<html lang="hu">/);
  assert.match(html, /A strukturált kézirattól/);
  // Responsive tables carry presentation attributes. Verify their semantics
  // without requiring an attribute-free opening tag.
  const table = html.match(/<table(?:\s[^>]*)?>[\s\S]*?<\/table>/)?.[0];
  assert.ok(table, 'The publication artifact must contain a semantic HTML table.');
  assert.match(table, /<thead>[\s\S]*?<th\b[^>]*>[\s\S]*?Elem[\s\S]*?<\/th>/);
  assert.match(table, /<tbody>[\s\S]*?Szemantikus HTML[\s\S]*?<\/tbody>/);
  assert.match(html, /<style>/);
  assert.doesNotMatch(html, /<script|<link|<iframe/);
});

test('HTML publication artifacts retain responsive table widths and font settings', async () => {
  const manuscript = createHtmlGalleyStudy();
  const table = manuscript.sections.flatMap((section) => section.blocks)
    .find((block) => block.id === 'demo-table')?.visual;
  assert.equal(table?.kind, 'table');
  if (table?.kind !== 'table') throw new Error('Missing table fixture.');
  table.columnWidths = [30, 70];
  table.fontSizeReduction = 0;

  const html = await buildPublicationHtmlArtifact(manuscript);
  assert.match(html, /<table\s[^>]*--omi-table-font-reduction:0/);
  assert.match(html, /<colgroup><col style="width:30%"><col style="width:70%"><\/colgroup>/);
});

test('embeds checked raster payloads and rejects missing or changed images', async () => {
  const manuscript = createHtmlGalleyStudy();
  const bytes = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=', 'base64'));
  const asset = await createAssetMetadata(bytes, { id: 'galley-pixel', mediaType: 'image/png', fileName: 'sample.png' });
  manuscript.assets = [asset];
  manuscript.sections[0]!.blocks.push({ id: 'demo-image', type: 'image', content: '', visual: { kind: 'image', assetId: asset.id, src: '', mediaType: asset.mediaType, fileName: asset.fileName, alt: 'Test pixel' } });
  await assert.rejects(buildPublicationHtmlArtifact(manuscript), /integrity/);
  await putAssetPayload(manuscript.id, asset.id, bytes);
  const html = await buildPublicationHtmlArtifact(manuscript);
  assert.match(html, /src="data:image\/png;base64,/);
  assert.doesNotMatch(html, /src="media\//);
  await putAssetPayload(manuscript.id, asset.id, new Uint8Array([1]));
  await assert.rejects(buildPublicationHtmlArtifact(manuscript), /integrity/);
});

test('does not render an edited volume through the study HTML publication renderer', async () => {
  const manuscript = createHtmlGalleyStudy();
  manuscript.documentStructure = createDocumentStructureProfile('volume');
  await assert.rejects(buildPublicationHtmlArtifact(manuscript), /standalone study/);
});
