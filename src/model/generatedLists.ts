import { resolveSemanticCaptions } from './captions';
import type { OmiSection } from '../types/omi';

export type OmiGeneratedListKind = 'toc' | 'figures' | 'tables' | 'index' | 'references' | 'custom';

export interface OmiGeneratedListDefinition {
  id: string;
  kind: OmiGeneratedListKind;
  title: string;
  source?: {
    format?: string;
    instruction?: string;
    captionLabel?: string;
    indexId?: string;
    categorizedReferenceListId?: string;
  };
}

export interface GeneratedListEntry {
  id: string;
  label: string;
  blockId?: string;
}

export function getGeneratedListDefinitions(manuscript: {
  generatedListDefinitions?: OmiGeneratedListDefinition[];
  tableOfContents?: unknown;
  indexDefinitions?: Array<{ id: string; title: string }>;
  categorizedReferenceLists?: Array<{ id: string; title: string }>;
}): OmiGeneratedListDefinition[] {
  const stored = manuscript.generatedListDefinitions ?? [];
  const result = [...stored];
  if (manuscript.tableOfContents && !result.some((item) => item.kind === 'toc')) {
    result.unshift({ id: 'toc', kind: 'toc', title: 'Table of contents' });
  }
  for (const index of manuscript.indexDefinitions ?? []) {
    if (!result.some((item) => item.kind === 'index' && item.source?.indexId === index.id)) {
      result.push({ id: `index:${index.id}`, kind: 'index', title: index.title, source: { indexId: index.id } });
    }
  }
  for (const list of manuscript.categorizedReferenceLists ?? []) {
    if (!result.some((item) => item.kind === 'references' && item.source?.categorizedReferenceListId === list.id)) {
      result.push({ id: `references:${list.id}`, kind: 'references', title: list.title, source: { categorizedReferenceListId: list.id } });
    }
  }
  return result;
}

/**
 * Builds generated figure/table lists from semantic captions first, while
 * retaining a compatibility fallback for older Tiptap-embedded caption nodes.
 */
export function buildCaptionListEntries(
  sections: readonly OmiSection[],
  kind: 'figures' | 'tables',
  captionLabel?: string,
): GeneratedListEntry[] {
  const normalizedLabel = captionLabel?.trim().toLocaleLowerCase();
  const semantic = resolveSemanticCaptions(sections).filter((caption) => {
    const kindMatches = kind === 'figures'
      ? caption.objectKind === 'image' || caption.objectKind === 'chart'
      : caption.objectKind === 'table';
    const labelMatches = !normalizedLabel || caption.label.toLocaleLowerCase() === normalizedLabel;
    return kindMatches && labelMatches;
  });

  const entries: GeneratedListEntry[] = semantic.map((caption) => ({
    id: caption.id,
    label: caption.renderedLabel,
    blockId: caption.blockId,
  }));
  const semanticBlockIds = new Set(semantic.map((caption) => caption.blockId));

  for (const section of sections) {
    for (const block of section.blocks) {
      if (semanticBlockIds.has(block.id)) continue;
      let value: unknown;
      try { value = JSON.parse(block.content); } catch { continue; }
      collectCaptionNodes(value, kind, block.id, entries);
    }
  }
  return entries;
}

function collectCaptionNodes(value: unknown, kind: 'figures' | 'tables', blockId: string, result: GeneratedListEntry[]): void {
  if (!value || typeof value !== 'object') return;
  const node = value as { type?: unknown; attrs?: unknown; content?: unknown };
  const type = typeof node.type === 'string' ? node.type.toLowerCase() : '';
  const attrs = node.attrs && typeof node.attrs === 'object' ? node.attrs as Record<string, unknown> : {};
  const matches = kind === 'figures'
    ? type === 'figure' || type === 'image' || type === 'caption'
    : type === 'table' || type === 'tablecaption';
  if (matches) {
    const caption = firstString(attrs.caption, attrs.title, attrs.alt, attrs.label) || collectText(node.content);
    if (caption.trim()) result.push({ id: `${blockId}:${result.length}`, label: caption.trim(), blockId });
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) collectCaptionNodes(child, kind, blockId, result);
  }
}

function collectText(value: unknown): string {
  if (!Array.isArray(value)) return '';
  return value.map((item) => {
    if (!item || typeof item !== 'object') return '';
    const node = item as { text?: unknown; content?: unknown };
    return `${typeof node.text === 'string' ? node.text : ''}${collectText(node.content)}`;
  }).join('');
}

function firstString(...values: unknown[]): string {
  return values.find((value): value is string => typeof value === 'string' && Boolean(value.trim())) ?? '';
}

declare module '../types/omi' {
  interface OmiManuscriptState {
    /** User-created and imported generated lists (TOC, figures, tables, indexes, references, custom lists). */
    generatedListDefinitions?: OmiGeneratedListDefinition[];
  }
}
