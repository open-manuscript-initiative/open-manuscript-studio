import { assetPath, sha256Hex } from '../model/assets';
import { resolvePublicationProfile, type OmiPublicationProfile } from '../model/publicationProfile';
import type { OmiManuscript } from '../types/omi';
import { getAssetPayload } from './assetRepository';
import { htmlFileName } from './exportHtml';
import { renderPublisherHtmlArticle } from './exportPublisherHtmlPackage';

export const OMI_STANDALONE_HTML_VERSION = '0.1.0' as const;
export type HtmlExportPackaging = 'standalone' | 'package';

/** One readable HTML document with inline CSS and integrity-checked images. */
export async function buildStandaloneHtmlExport(
  manuscript: OmiManuscript,
  profile: OmiPublicationProfile = resolvePublicationProfile(manuscript),
): Promise<{ html: string; blob: Blob; fileName: string }> {
  const rendered = renderPublisherHtmlArticle(manuscript, profile);
  if (!rendered.validForExport) {
    throw new Error(rendered.diagnostics.filter((item) => item.severity === 'error')
      .map((item) => item.message).join('\n'));
  }

  let html = rendered.html;
  for (const asset of manuscript.assets ?? []) {
    const source = escapeAttribute(assetPath(asset));
    if (!html.includes(`src="${source}"`)) continue;
    if (!/^image\/(png|jpeg|gif|webp)$/.test(asset.mediaType)) {
      throw new Error(`Unsupported standalone HTML image type: ${asset.mediaType}.`);
    }
    const bytes = await getAssetPayload(manuscript.id, asset.id);
    if (!bytes || bytes.byteLength !== asset.size ||
      (await sha256Hex(bytes)).toLowerCase() !== asset.checksum.value.toLowerCase()) {
      throw new Error(`HTML image "${asset.originalFileName || asset.fileName}" is missing or failed its integrity check. Restore it before exporting.`);
    }
    html = html.replaceAll(`src="${source}"`, `src="data:${asset.mediaType};base64,${base64(bytes)}"`);
  }

  for (const image of html.matchAll(/<img\b[^>]*\bsrc="([^"]*)"/g)) {
    if (!/^data:image\/(png|jpeg|gif|webp);base64,[a-zA-Z0-9+/=]+$/.test(image[1] ?? '')) {
      throw new Error('Standalone HTML images must be embedded PNG, JPEG, GIF or WebP files. Import remote images before exporting.');
    }
  }

  return {
    html,
    blob: new Blob([html], { type: 'text/html;charset=utf-8' }),
    fileName: htmlFileName(manuscript),
  };
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
}
