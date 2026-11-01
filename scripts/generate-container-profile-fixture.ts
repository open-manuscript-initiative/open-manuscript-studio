import { calculateManuscriptStateDigestValue } from '../src/model/stateDigest.ts';
import { writeFile } from 'node:fs/promises';
import { createVersionedTestManuscript } from '../tests/testManuscriptFixture.ts';
import { createAssetMetadata, sha256Hex } from '../src/model/assets.ts';
import { commitManuscriptRevision, extractManuscriptState } from '../src/model/versioning.ts';
import { putAssetPayload } from '../src/services/assetRepository.ts';
import { buildOmiContainer } from '../src/services/omiContainer.ts';
const manuscript = createVersionedTestManuscript();
const bytes = new TextEncoder().encode('synthetic-image-payload');
const asset = await createAssetMetadata(bytes, { id: 'golden-asset', mediaType: 'image/png', fileName: 'synthetic.png', role: 'figure', createdAt: '2026-11-01T00:00:00.000Z' });
const state = extractManuscriptState(manuscript);
state.assets = [asset];
state.sections[0]!.children = [{ id: 'golden-nested-section', title: 'Synthetic nested figure', blocks: [{ id: 'golden-image', type: 'image', content: '', visual: { kind: 'image', assetId: asset.id, src: 'data:image/png;base64,c3ludGhldGljLWltYWdlLXBheWxvYWQ=', mediaType: 'image/png', fileName: 'synthetic.png', alt: 'Synthetic fixture' } }] }];
const committed = commitManuscriptRevision(manuscript, state, { summary: 'Synthetic asset preview fixture', timestamp: '2026-11-01T00:00:00.000Z', events: [{ operation: 'manuscript.structure.set', targetId: manuscript.id }] });
await putAssetPayload(manuscript.id, asset.id, bytes);
const output = await buildOmiContainer(committed);
if (!output.validForExport) throw new Error(JSON.stringify(output.diagnostics));
await writeFile('tests/fixtures/container-profile-v1.json', JSON.stringify({
  revisionStateDigests: committed.revisionHistory.revisions.map(revision => calculateManuscriptStateDigestValue(revision.snapshot.state)),
  synthetic: true, serializationProfile: output.manifest.serializationProfile,
  sha256: await sha256Hex(output.bytes), packageBase64: Buffer.from(output.bytes).toString('base64'),
  manuscriptId: manuscript.id, assetId: asset.id, assetSha256: asset.checksum.value,
}, null, 2) + '\n');
