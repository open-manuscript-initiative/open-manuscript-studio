import {
  assetPath,
  collectReferencedAssetIds,
  externalizeImageBlock,
  sha256Hex,
} from '../model/assets';
import {
  resolvePublicationProfile,
  type OmiPublicationProfile,
} from '../model/publicationProfile';
import type { OmiAsset } from '../types/assets';
import type { OmiBlock, OmiManuscript } from '../types/omi';
import { getAssetPayload } from './assetRepository';
import {
  jatsFileName,
  renderJatsArticle,
  type JatsDiagnostic,
  type JatsExportResult,
} from './exportJats';
import { createStoreZip } from './simpleZip';

export interface JatsPackageExportResult {
  xml: string;
  render: JatsExportResult;
  blob: Blob;
  fileName: string;
  mediaType: 'application/xml' | 'application/zip';
  diagnostics: JatsDiagnostic[];
  validForExport: boolean;
}

interface PreparedImages {
  blocks: OmiBlock[];
  assets: OmiAsset[];
  payloads: Map<string, Uint8Array>;
}

/**
 * Creates a JATS XML-and-media ZIP. Inline image data URIs are externalized
 * into package assets without changing the manuscript working state.
 */
export async function buildJatsPackage(
  manuscript: OmiManuscript,
  profile: OmiPublicationProfile = resolvePublicationProfile(manuscript),
): Promise<JatsPackageExportResult> {
  const prepared = await prepareImages(
    manuscript.sections.flatMap((section) => section.blocks),
  );
  const nextBlocksById = new Map(prepared.blocks.map((block) => [block.id, block]));
  const sections = manuscript.sections.map((section) => ({
    ...section,
    blocks: section.blocks.map((block) => nextBlocksById.get(block.id) ?? block),
  }));
  const packagedManuscript: OmiManuscript = {
    ...manuscript,
    sections,
    assets: [...(manuscript.assets ?? []), ...prepared.assets],
  };
  const render = renderJatsArticle(packagedManuscript, profile);
  const diagnostics = [...render.diagnostics];
  const assetsById = new Map(
    (packagedManuscript.assets ?? []).map((asset) => [asset.id, asset]),
  );
  const entries: Array<{ name: string; bytes: Uint8Array }> = [];
  const assetIds = collectReferencedAssetIds(
    packagedManuscript.sections.flatMap((section) => section.blocks),
  );

  for (const assetId of assetIds) {
    const asset = assetsById.get(assetId);
    if (!asset) {
      diagnostics.push({
        code: 'jats-package-asset-metadata-missing',
        severity: 'error',
        message: `Referenced JATS image asset metadata is missing: ${assetId}.`,
        targetId: assetId,
      });
      continue;
    }

    const bytes = prepared.payloads.get(assetId)
      ?? await getAssetPayload(manuscript.id, assetId);
    if (!bytes) {
      diagnostics.push({
        code: 'jats-package-asset-payload-missing',
        severity: 'error',
        message: `Referenced JATS image asset payload is unavailable: ${assetId}.`,
        targetId: assetId,
      });
      continue;
    }

    const digest = await sha256Hex(bytes);
    if (
      bytes.byteLength !== asset.size ||
      digest.toLowerCase() !== asset.checksum.value.toLowerCase()
    ) {
      diagnostics.push({
        code: 'jats-package-asset-integrity-mismatch',
        severity: 'error',
        message: `JATS image asset ${assetId} does not match its declared size or SHA-256 digest.`,
        targetId: assetId,
      });
      continue;
    }

    entries.push({ name: assetPath(asset), bytes });
  }

  const xmlFileName = jatsFileName(manuscript);
  const packageEntries = entries.length > 0;
  const zipBytes = packageEntries
    ? createStoreZip([
        { name: xmlFileName, bytes: new TextEncoder().encode(render.xml) },
        ...entries,
      ])
    : undefined;
  const artifact = zipBytes
    ? (() => {
        const zipBuffer = new ArrayBuffer(zipBytes.byteLength);
        new Uint8Array(zipBuffer).set(zipBytes);
        return new Blob([zipBuffer], { type: 'application/zip' });
      })()
    : new Blob([render.xml], { type: 'application/xml;charset=utf-8' });

  return {
    xml: render.xml,
    render,
    blob: artifact,
    fileName: packageEntries
      ? xmlFileName.replace(/\.jats\.xml$/i, '.jats.zip')
      : xmlFileName,
    mediaType: packageEntries ? 'application/zip' : 'application/xml',
    diagnostics,
    validForExport: !diagnostics.some((item) => item.severity === 'error'),
  };
}

async function prepareImages(blocks: readonly OmiBlock[]): Promise<PreparedImages> {
  const assets: OmiAsset[] = [];
  const payloads = new Map<string, Uint8Array>();
  const output: OmiBlock[] = [];

  for (const block of blocks) {
    const externalized = await externalizeImageBlock(block);
    const current = externalized?.block ?? block;
    if (externalized) {
      assets.push(externalized.asset);
      payloads.set(externalized.asset.id, externalized.bytes);
    }
    const children = current.children?.length
      ? await prepareImages(current.children)
      : undefined;
    if (children) {
      assets.push(...children.assets);
      for (const [id, bytes] of children.payloads) payloads.set(id, bytes);
    }
    output.push(children
      ? { ...current, children: children.blocks }
      : current);
  }

  return { blocks: output, assets, payloads };
}
