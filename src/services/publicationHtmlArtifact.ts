import {
  assetPath,
  sha256Hex,
} from '../model/assets';
import { getDocumentStructureProfile } from '../model/documentProfile';
import {
  resolvePublicationProfile,
  type OmiPublicationProfile,
} from '../model/publicationProfile';
import type { OmiManuscript } from '../types/omi';
import { getAssetPayload } from './assetRepository';
import { renderHtmlArticle } from './exportHtml';

export const OMI_HTML_PUBLICATION_RENDERER_VERSION = '0.1.0' as const;

export function publicationHtmlFileName(
  manuscript: Pick<OmiManuscript, 'title' | 'id'>,
): string {
  const stem = (manuscript.title.trim() || manuscript.id || 'manuscript')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'manuscript';
  return `${stem}.html`;
}

/**
 * Build a self-contained semantic HTML publication artifact.
 *
 * Article/study semantics are intentional. Whole-volume HTML needs its own
 * renderer and is therefore not synthesized through this code path.
 */
export async function buildPublicationHtmlArtifact(
  manuscript: OmiManuscript,
  profile: OmiPublicationProfile = resolvePublicationProfile(manuscript),
): Promise<string> {
  if (getDocumentStructureProfile(manuscript).kind !== 'study') {
    throw new Error(
      'Self-contained HTML publication artifacts currently require a standalone study.',
    );
  }

  const result = renderHtmlArticle(manuscript, profile);
  if (!result.validForExport) {
    throw new Error(
      result.diagnostics
        .filter((diagnostic) => diagnostic.severity === 'error')
        .map((diagnostic) => diagnostic.message)
        .join('\n'),
    );
  }

  return inlinePublicationArtifactImages(result.html, manuscript);
}

/** Validate only referenced resources and inline exact registered bytes; never fetch remotely. */
export async function inlinePublicationArtifactImages(
  input: string,
  manuscript: OmiManuscript,
  maxBytes = 8 * 1024 * 1024,
  allowSvg = false,
): Promise<string> {
  let html = input;
  for (const asset of manuscript.assets ?? []) {
    const escaped = assetPath(asset).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (!html.includes(`src="${escaped}"`)) continue;
    if (![ 'image/png','image/jpeg','image/gif','image/webp', ...(allowSvg ? ['image/svg+xml'] : []) ].includes(asset.mediaType)) {
      throw new Error(`Unsupported publication image: ${asset.id}`);
    }
    const bytes = await getAssetPayload(manuscript.id, asset.id);
    if (!bytes || bytes.byteLength !== asset.size || (await sha256Hex(bytes)) !== asset.checksum.value.toLowerCase()) {
      throw new Error(`Image integrity check failed: ${asset.id}`);
    }
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    html = html.replaceAll(`src="${escaped}"`, `src="data:${asset.mediaType};base64,${btoa(binary)}"`);
  }

  for (const image of html.matchAll(/<img\b[^>]*\bsrc="([^"]*)"/g)) {
    if (
      !(allowSvg ? /^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,[a-zA-Z0-9+/=]+$/ : /^data:image\/(png|jpeg|gif|webp);base64,[a-zA-Z0-9+/=]+$/).test(
        image[1] ?? '',
      )
    ) {
      throw new Error(
        'HTML publication images must be embedded PNG, JPEG, GIF or WebP files. Import remote images first.',
      );
    }
  }

  if (new TextEncoder().encode(html).length > maxBytes) {
    throw new Error(`The publication input exceeds the ${Math.floor(maxBytes / 1024 / 1024)} MiB limit.`);
  }

  return html;
}
