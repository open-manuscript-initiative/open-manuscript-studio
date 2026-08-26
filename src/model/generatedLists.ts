import { defaultCaptionLabel, resolveSemanticCaptions } from './captions';
import type { OmiBlock, OmiSection, OmiVisualBlockData } from '../types/omi';

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
 * retaining compatibility fallbacks for older Tiptap-embedded captions and
 * structured visual blocks imported without semantic caption metadata.
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
  const structuredBlockIds = new Set<string>();

  for (const section of sections) {
    for (const block of flattenBlocks(section.blocks)) {
      if (semanticBlockIds.has(block.id)) continue;

      if (matchesStructuredVisual(block, kind)) {
        structuredBlockIds.add(block.id);
        const number = entries.length + 1;
        entries.push({
          id: `visual:${block.id}`,
          label: structuredVisualLabel(block, number, captionLabel),
          blockId: block.id,
        });
        continue;
      }

      let value: unknown;
      try { value = JSON.parse(block.content); } catch { continue; }
      collectCaptionNodes(value, kind, block.id, entries);
    }
  }

  return deduplicateGeneratedEntries(entries, structuredBlockIds);
}

function matchesStructuredVisual(block: OmiBlock, kind: 'figures' | 'tables'): boolean {
  if (!block.visual) return false;
  return kind === 'figures'
    ? block.visual.kind === 'image' || block.visual.kind === 'chart'
    : block.visual.kind === 'table';
}

function structuredVisualLabel(block: OmiBlock, number: number, captionLabel?: string): string {
  const visual = block.visual;
  if (!visual) return `${captionLabel?.trim() || 'Figure'} ${number}`;

  const label = captionLabel?.trim() || defaultCaptionLabel(visual.kind);
  const title = structuredVisualTitle(visual);
  return title ? `${label} ${number}. ${title}` : `${label} ${number}`;
}

function structuredVisualTitle(visual: OmiVisualBlockData): string {
  const caption = visual.caption?.trim();
  if (caption) return caption;

  if (visual.kind === 'image') {
    return visual.alt?.trim() || visual.fileName?.trim() || '';
  }
  if (visual.kind === 'chart') {
    return visual.title?.trim() || '';
  }
  return '';
}

function flattenBlocks(blocks: readonly OmiBlock[]): OmiBlock[] {
  return blocks.flatMap((block) => [block, ...flattenBlocks(block.children ?? [])]);
}

function deduplicateGeneratedEntries(
  entries: GeneratedListEntry[],
  structuredBlockIds: ReadonlySet<string>,
): GeneratedListEntry[] {
  const seenIds = new Set<string>();
  const seenStructuredBlocks = new Set<string>();

  return entries.filter((entry) => {
    if (seenIds.has(entry.id)) return false;
    seenIds.add(entry.id);

    if (entry.blockId && structuredBlockIds.has(entry.blockId)) {
      if (seenStructuredBlocks.has(entry.blockId)) return false;
      seenStructuredBlocks.add(entry.blockId);
    }
    return true;
  });
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
