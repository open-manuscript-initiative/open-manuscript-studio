import { assetPath, collectReferencedAssetIds, sha256Hex } from '../model/assets';
import { getDocumentStructureProfile } from '../model/documentProfile';
import {
  resolvePublicationProfile,
  type OmiPublicationProfile,
} from '../model/publicationProfile';
import type { OmiManuscript } from '../types/omi';
import { getAssetPayload } from './assetRepository';
import { renderHtmlArticle } from './exportHtml';

export interface HtmlGalleyTarget {
  protocol: 'omi-html-galley/1';
  submissionId: number;
  publicationId: number;
  title: string;
  locales: string[];
  genres: { id: number; label: string }[];
}
export interface HtmlGalleyReceipt {
  protocol: 'omi-html-galley/1';
  submissionId: number;
  publicationId: number;
  galleyId: number;
  submissionFileId: number;
  sha256: string;
  unchanged: boolean;
  published: false;
}
export type HtmlGalleyRequest = {
  manuscriptId: string; submissionId: number;
} & ({ action: 'inspect' } | {
  action: 'transfer'; publicationId: number; locale: string; genreId: number; html: string; confirmed: true;
});

export const OMI_HTML_GALLEY_RENDERER_VERSION = '0.1.0' as const;

export function htmlGalleyFileName(
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

/** Use the semantic exporter, embedding only integrity-checked raster assets. */
export async function buildHtmlGalley(
  manuscript: OmiManuscript,
  profile: OmiPublicationProfile = resolvePublicationProfile(manuscript),
): Promise<string> {
  if (getDocumentStructureProfile(manuscript).kind !== 'study') throw new Error('Open a standalone study first.');
  const result = renderHtmlArticle(manuscript, profile);
  if (!result.validForExport) throw new Error(result.diagnostics.filter((d) => d.severity === 'error').map((d) => d.message).join('\n'));
  let html = result.html;
  for (const id of collectReferencedAssetIds(manuscript.sections.flatMap((s) => s.blocks))) {
    const asset = manuscript.assets?.find((a) => a.id === id);
    if (!asset || !['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(asset.mediaType)) throw new Error(`Unsupported or missing image: ${id}`);
    const bytes = await getAssetPayload(manuscript.id, id);
    if (!bytes || bytes.byteLength !== asset.size || await sha256Hex(bytes) !== asset.checksum.value.toLowerCase()) throw new Error(`Image integrity check failed: ${id}`);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    const escaped = assetPath(asset).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html = html.replaceAll(`src="${escaped}"`, `src="data:${asset.mediaType};base64,${btoa(binary)}"`);
  }
  for (const image of html.matchAll(/<img\b[^>]*\bsrc="([^"]*)"/g)) {
    if (!/^data:image\/(png|jpeg|gif|webp);base64,[a-zA-Z0-9+/=]+$/.test(image[1] ?? '')) {
      throw new Error('HTML galley images must be embedded PNG, JPEG, GIF or WebP files. Import remote images first.');
    }
  }
  if (new TextEncoder().encode(html).length > 8 * 1024 * 1024) throw new Error('The HTML exceeds the 8 MiB transfer limit.');
  return html;
}
