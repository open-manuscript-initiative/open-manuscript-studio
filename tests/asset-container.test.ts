import assert from 'node:assert/strict';
import test from 'node:test';

import { applyOmiContainerImportPlan } from '../src/app/omiContainerImportActions.ts';
import { useStudioStore } from '../src/app/useStudioStore.ts';
import {
  createAssetMetadata,
  decodeDataUrl,
  externalizeImageBlock,
  sha256Hex,
} from '../src/model/assets.ts';
import {
  commitManuscriptRevision,
  extractManuscriptState,
} from '../src/model/versioning.ts';
import {
  clearMemoryAssetCache,
  getAssetPayload,
  putAssetPayload,
} from '../src/services/assetRepository.ts';
import {
  buildOmiContainer,
  isSafeContainerPath,
  OMI_CONTAINER_MEDIA_TYPE,
} from '../src/services/omiContainer.ts';
import {
  inspectOmiContainer,
} from '../src/services/omiContainerImport.ts';
import type { OmiAsset } from '../src/types/assets.ts';
import type { OmiManuscript, OmiManuscriptState } from '../src/types/omi.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';

test('decodes embedded image data and produces deterministic SHA-256 evidence', async () => {
  const decoded = decodeDataUrl('data:text/plain;base64,aGVsbG8=');
  assert.ok(decoded);
  assert.equal(decoded.mediaType, 'text/plain');
  assert.equal(new TextDecoder().decode(decoded.bytes), 'hello');
  assert.equal(
    await sha256Hex(decoded.bytes),
    '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
  );
});

test('creates portable asset metadata without embedding payload bytes', async () => {
  const bytes = new TextEncoder().encode('figure payload');
  const asset = await createAssetMetadata(bytes, {
    id: 'asset-figure-1',
    mediaType: 'image/png',
    fileName: '../unsafe figure.png',
    role: 'figure',
    createdAt: '2026-08-07T00:00:00.000Z',
  });

  assert.equal(asset.id, 'asset-figure-1');
  assert.equal(asset.mediaType, 'image/png');
  assert.equal(asset.size, bytes.byteLength);
  assert.equal(asset.checksum.algorithm, 'sha256');
  assert.equal(asset.checksum.scope, 'raw-bytes');
  assert.equal(asset.fileName.includes('/'), false);
  assert.equal('bytes' in asset, false);
});

test('externalized image state no longer retains Base64 authoring preview data', async () => {
  const externalized = await externalizeImageBlock({
    id: 'image-block',
    type: 'image',
    content: '',
    visual: {
      kind: 'image',
      src: 'data:image/png;base64,ZmFrZS1wbmctcGF5bG9hZA==',
      mediaType: 'image/png',
      fileName: 'figure.png',
      alt: 'Figure',
    },
  });

  assert.ok(externalized);
  assert.ok(externalized.block.visual?.kind === 'image');
  assert.equal(externalized.block.visual.src, '');
  assert.equal(externalized.block.visual.assetId, externalized.asset.id);
  assert.equal(new TextDecoder().decode(externalized.bytes), 'fake-png-payload');
});

test('rejects archive traversal and ambiguous container paths', () => {
  assert.equal(isSafeContainerPath('media/images/figure.png'), true);
  assert.equal(isSafeContainerPath('../figure.png'), false);
  assert.equal(isSafeContainerPath('/absolute/path'), false);
  assert.equal(isSafeContainerPath('media\\figure.png'), false);
  assert.equal(isSafeContainerPath('media//figure.png'), false);
});

test('builds a portable OMI ZIP with external asset payload and clean document JSON', async () => {
  clearMemoryAssetCache();
  const { manuscript, asset, bytes } = await createCommittedAssetManuscript();
  await putAssetPayload(manuscript.id, asset.id, bytes);

  const result = await buildOmiContainer(manuscript);
  const entries = readStoreZipEntries(result.bytes);
  const documentJson = new TextDecoder().decode(entries.get('manuscript/document.json'));
  const jats = new TextDecoder().decode(entries.get('publication/article.jats.xml'));
  const manifest = new TextDecoder().decode(entries.get('META-INF/manifest.json'));

  assert.equal(result.validForExport, true);
  assert.equal(new TextDecoder().decode(entries.get('META-INF/mimetype')), OMI_CONTAINER_MEDIA_TYPE);
  assert.ok(entries.has('META-INF/checksums.json'));
  assert.ok(entries.has('media/images/asset-figure-1-figure.png'));
  assert.equal(documentJson.includes('data:image/png;base64'), false);
  assert.ok(documentJson.includes('"assetId": "asset-figure-1"'));
  assert.ok(jats.includes('xlink:href="media/images/asset-figure-1-figure.png"'));
  assert.ok(manifest.includes('OMI-SPEC-330@0.1.0'));
});

test('verifies an exported OMI package and preserves manuscript and revision identities', async () => {
  clearMemoryAssetCache();
  const { manuscript, asset, bytes } = await createCommittedAssetManuscript();
  await putAssetPayload(manuscript.id, asset.id, bytes);
  const exported = await buildOmiContainer(manuscript);

  const plan = await inspectOmiContainer(exported.bytes);

  assert.equal(plan.validForImport, true);
  assert.equal(plan.diagnostics.filter((item) => item.severity === 'error').length, 0);
  assert.equal(plan.manuscript?.id, manuscript.id);
  assert.equal(plan.manuscript?.headRevisionId, manuscript.headRevisionId);
  assert.equal(plan.summary.revisionCount, manuscript.revisionHistory.revisions.length);
  assert.equal(plan.summary.assetCount, 1);
  assert.equal(plan.summary.verifiedChecksums, plan.summary.declaredChecksums);
  assert.equal(plan.assets[0]?.metadata.id, asset.id);
  assert.equal(new TextDecoder().decode(plan.assets[0]?.bytes), 'fake-png-payload');
  const importedImage = plan.manuscript?.sections[0]?.blocks.find(
    (block) => block.id === 'figure-block-1',
  );
  assert.ok(importedImage?.visual?.kind === 'image');
  assert.equal(importedImage.visual.src, '');
  assert.equal(importedImage.visual.assetId, asset.id);
});

test('opens a verified package without creating a new manuscript or revision root', async () => {
  clearMemoryAssetCache();
  const { manuscript, asset, bytes } = await createCommittedAssetManuscript();
  await putAssetPayload(manuscript.id, asset.id, bytes);
  const exported = await buildOmiContainer(manuscript);
  clearMemoryAssetCache();
  const plan = await inspectOmiContainer(exported.bytes);

  await applyOmiContainerImportPlan(plan);
  const loaded = useStudioStore.getState().manuscript;

  assert.equal(loaded.id, manuscript.id);
  assert.equal(loaded.headRevisionId, manuscript.headRevisionId);
  assert.equal(loaded.revisionHistory.rootRevisionId, manuscript.revisionHistory.rootRevisionId);
  assert.equal(loaded.revisionHistory.revisions.length, manuscript.revisionHistory.revisions.length);
  assert.equal(new TextDecoder().decode(await getAssetPayload(loaded.id, asset.id)), 'fake-png-payload');

  useStudioStore.getState().resetSample();
});

test('rejects a package whose archived bytes were modified after checksums were created', async () => {
  clearMemoryAssetCache();
  const { manuscript, asset, bytes } = await createCommittedAssetManuscript();
  await putAssetPayload(manuscript.id, asset.id, bytes);
  const exported = await buildOmiContainer(manuscript);
  const corrupted = new Uint8Array(exported.bytes);
  const documentOffset = findStoreEntryDataOffset(corrupted, 'manuscript/document.json');
  assert.ok(documentOffset >= 0);
  corrupted[documentOffset] = (corrupted[documentOffset] ?? 0) ^ 0x01;

  const plan = await inspectOmiContainer(corrupted);

  assert.equal(plan.validForImport, false);
  assert.ok(
    plan.diagnostics.some((item) => item.code === 'invalid-omi-archive'),
  );
});

async function createCommittedAssetManuscript(): Promise<{
  manuscript: OmiManuscript;
  asset: OmiAsset;
  bytes: Uint8Array;
}> {
  const manuscript = createVersionedTestManuscript();
  const bytes = new TextEncoder().encode('fake-png-payload');
  const asset = await createAssetMetadata(bytes, {
    id: 'asset-figure-1',
    mediaType: 'image/png',
    fileName: 'figure.png',
    role: 'figure',
    createdAt: '2026-08-07T00:00:00.000Z',
  });
  const figureBlock = {
    id: 'figure-block-1',
    type: 'image',
    content: '',
    visual: {
      kind: 'image' as const,
      assetId: asset.id,
      src: '',
      mediaType: 'image/png',
      fileName: 'figure.png',
      alt: 'Test figure',
      caption: 'Portable figure',
    },
  };
  const currentState = extractManuscriptState(manuscript);
  const nextState: OmiManuscriptState = {
    ...currentState,
    assets: [asset],
    sections: currentState.sections.map((section, index) =>
      index === 0
        ? { ...section, blocks: [...section.blocks, figureBlock] }
        : section,
    ),
  };
  const committed = commitManuscriptRevision(manuscript, nextState, {
    summary: 'Attached test figure asset',
    timestamp: '2026-08-07T00:01:00.000Z',
    events: [
      {
        operation: 'asset.attach' as never,
        targetId: asset.id,
        path: '/assets/-',
        nextValue: asset,
      },
      {
        operation: 'block.update' as never,
        targetId: figureBlock.id,
        path: `/sections/${nextState.sections[0]?.id}/blocks/-`,
        nextValue: figureBlock,
      },
    ],
  });

  return { manuscript: committed, asset, bytes };
}

function readStoreZipEntries(bytes: Uint8Array): Map<string, Uint8Array> {
  const entries = new Map<string, Uint8Array>();
  const decoder = new TextDecoder();
  let offset = 0;

  while (offset + 30 <= bytes.length) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, bytes.byteLength - offset);
    if (view.getUint32(0, true) !== 0x04034b50) break;
    const method = view.getUint16(8, true);
    assert.equal(method, 0);
    const size = view.getUint32(18, true);
    const nameLength = view.getUint16(26, true);
    const extraLength = view.getUint16(28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLength));
    entries.set(name, bytes.slice(dataStart, dataStart + size));
    offset = dataStart + size;
  }

  return entries;
}

function findStoreEntryDataOffset(bytes: Uint8Array, target: string): number {
  const decoder = new TextDecoder();
  let offset = 0;
  while (offset + 30 <= bytes.byteLength) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, bytes.byteLength - offset);
    if (view.getUint32(0, true) !== 0x04034b50) return -1;
    const size = view.getUint32(18, true);
    const nameLength = view.getUint16(26, true);
    const extraLength = view.getUint16(28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(bytes.subarray(nameStart, nameStart + nameLength));
    if (name === target) return dataStart;
    offset = dataStart + size;
  }
  return -1;
}
