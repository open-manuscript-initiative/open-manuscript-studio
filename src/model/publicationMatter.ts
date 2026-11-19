import { validatePublicationMatterFrames, type PublicationMatterFrame } from './publicationMatterFrames';
import { getDocumentStructureProfile } from './documentProfile';
import type { OmiManuscriptState } from '../types/omi';
import { publicationIdentifierLines } from './publicationIdentifiers';

export const PUBLICATION_MATTER_EXTENSION = 'urn:omi:studio:publication-matter:1';
export const PUBLICATION_MATTER_PAGES = [
  'front-cover', 'inside-front-cover', 'half-title', 'series-page',
  'title-page', 'imprint-page', 'inside-back-cover', 'back-cover', 'spine',
] as const;
export type PublicationMatterPageKind = typeof PUBLICATION_MATTER_PAGES[number];
export interface PublicationMatterPage {
  kind: PublicationMatterPageKind;
  enabled: boolean;
  content: string;
  appearance: {
    fontFamily: string; fontSizePt: number; color: string; background: string;
    alignment: 'left' | 'center' | 'right'; vertical: 'top' | 'center' | 'bottom'; paddingMm: number;
  };
  image?: { assetId: string; alt: string; fit: 'contain' | 'cover' };
  frames?: PublicationMatterFrame[];
}
export interface PublicationMatter {
  version: 1;
  publicationKind: 'volume' | 'journal-issue';
  spineWidthMm?: number;
  pages: PublicationMatterPage[];
}

export function publicationMatterTemplate(kind: PublicationMatterPageKind, manuscript: OmiManuscriptState): string {
  const metadata = manuscript.titleMatter;
  const publisher = [metadata?.publicationPlace, metadata?.publisherName, metadata?.publicationYear].filter(Boolean).join(' · ');
  const texts = kind === 'spine' ? [] : kind === 'front-cover' || kind === 'title-page'
    ? [metadata?.responsibilityStatement, manuscript.title, manuscript.subtitle, metadata?.editionStatement, publisher]
    : kind === 'half-title' ? [metadata?.halfTitle || manuscript.title]
      : kind === 'imprint-page' ? [metadata?.copyrightStatement, metadata?.colophon, ...publicationIdentifierLines(metadata), publisher]
        : [];
  const content = texts.filter(Boolean).map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] }));
  return JSON.stringify({ type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] });
}

export function createPublicationMatter(manuscript: OmiManuscriptState): PublicationMatter {
  return { version: 1, publicationKind: 'volume', spineWidthMm: 10, pages: PUBLICATION_MATTER_PAGES.map((kind) => ({
    kind, enabled: false, content: publicationMatterTemplate(kind, manuscript),
    appearance: { fontFamily: 'Georgia', fontSizePt: kind === 'front-cover' ? 24 : 14,
      color: '#25282d', background: '#ffffff', alignment: kind === 'imprint-page' ? 'left' : 'center',
      vertical: kind === 'imprint-page' ? 'bottom' : 'center', paddingMm: kind === 'spine' ? 0 : 20 },
  })) };
}

export function getPublicationMatter(manuscript: Pick<OmiManuscriptState, 'extensions'>): PublicationMatter | undefined {
  const value = manuscript.extensions?.[PUBLICATION_MATTER_EXTENSION];
  if (value === undefined) return undefined;
  validatePublicationMatter(value);
  return value as PublicationMatter;
}

export function publicationMatterPages(manuscript: OmiManuscriptState, position: 'before' | 'after'): PublicationMatterPage[] {
  if (getDocumentStructureProfile(manuscript).kind !== 'volume') return [];
  const pages = getPublicationMatter(manuscript)?.pages ?? [];
  return PUBLICATION_MATTER_PAGES.flatMap((kind) => {
    const page = pages.find((item) => item.kind === kind && item.enabled);
    return page && (['inside-back-cover', 'back-cover'].includes(kind) ? position === 'after' : position === 'before') ? [page] : [];
  });
}

export function publicationMatterAssetIds(manuscript: Pick<OmiManuscriptState, 'extensions'>): string[] {
  // Disabled pages still belong to the editable working document.
  return (getPublicationMatter(manuscript)?.pages ?? []).flatMap((page) => [...(page.image ? [page.image.assetId] : []), ...(page.frames ?? []).flatMap((frame) => frame.image ? [frame.image.assetId] : [])]);
}

export function validatePublicationMatter(value: unknown): asserts value is PublicationMatter {
  const fail = (): never => { throw new Error('Invalid publication cover/title-page data.'); };
  if (!record(value) || value.version !== 1 || !['volume', 'journal-issue'].includes(String(value.publicationKind))
    || (value.spineWidthMm !== undefined && (typeof value.spineWidthMm !== 'number' || !Number.isFinite(value.spineWidthMm) || value.spineWidthMm < 1 || value.spineWidthMm > 100))
    || !Array.isArray(value.pages) || value.pages.length > PUBLICATION_MATTER_PAGES.length) fail();
  const model = value as unknown as PublicationMatter;
  const seen = new Set<string>();
  for (const page of model.pages) {
    if (!record(page) || !PUBLICATION_MATTER_PAGES.includes(page.kind) || seen.has(page.kind)
      || typeof page.enabled !== 'boolean' || typeof page.content !== 'string' || page.content.length > 500_000) fail();
    seen.add(page.kind);
    const style = page.appearance;
    if (!record(style) || typeof style.fontFamily !== 'string' || !style.fontFamily.trim() || style.fontFamily.length > 128
      || !Number.isFinite(style.fontSizePt) || style.fontSizePt < 6 || style.fontSizePt > 120
      || !Number.isFinite(style.paddingMm) || style.paddingMm < 0 || style.paddingMm > 60
      || !/^#[a-f0-9]{6}$/i.test(style.color) || !/^#[a-f0-9]{6}$/i.test(style.background)
      || !['left', 'center', 'right'].includes(style.alignment) || !['top', 'center', 'bottom'].includes(style.vertical)) fail();
    if (page.image !== undefined && (!record(page.image) || typeof page.image.assetId !== 'string' || !page.image.assetId
      || typeof page.image.alt !== 'string' || !['contain', 'cover'].includes(page.image.fit))) fail();
    validatePublicationMatterContent(page.content);
    if (page.frames !== undefined) validatePublicationMatterFrames(page.frames, validatePublicationMatterContent);
  }
}

export function validatePublicationMatterContent(value: unknown): void {
  const fail = (): never => { throw new Error('Invalid publication page rich text.'); };
  if (typeof value !== 'string' || value.length > 500_000) return fail();
  let document: unknown;
  try { document = JSON.parse(value); } catch { fail(); }
  if (!record(document) || document.type !== 'doc') fail();
  let nodes = 0;
  const visit = (node: unknown, depth: number): void => {
    if (!record(node)) return fail();
    if (depth > 32 || ++nodes > 50_000 || ![
      'doc', 'paragraph', 'heading', 'blockquote', 'bulletList', 'orderedList', 'listItem', 'codeBlock', 'text', 'hardBreak',
    ].includes(String(node.type))) fail();
    if (node.text !== undefined && typeof node.text !== 'string') fail();
    if (node.marks !== undefined && (!Array.isArray(node.marks) || node.marks.some((mark: unknown) => !record(mark) || ![
      'bold', 'italic', 'strike', 'code', 'omiUnderline', 'omiSmallCaps', 'omiSuperscript', 'omiSubscript', 'omiLink', 'omiLanguage', 'omiSourceFont',
    ].includes(String(mark.type))))) fail();
    if (node.content !== undefined) {
      if (!Array.isArray(node.content)) fail();
      (node.content as unknown[]).forEach((child) => visit(child, depth + 1));
    }
  };
  visit(document, 0);
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
