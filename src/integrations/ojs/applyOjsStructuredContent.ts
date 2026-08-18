import type { OmiBlock, OmiManuscript } from '../../types/omi';
import type { OjsLaunchPayload } from './importOjsLaunch';

type ListInfo = { level: number; ordered: boolean };
type StructuredBlock =
  | { kind: 'paragraph'; text?: string; listLevel?: number; ordered?: boolean }
  | { kind: 'table'; cells?: unknown; headerRows?: unknown; afterText?: unknown }
  | { kind: 'image'; src?: unknown; mediaType?: unknown; fileName?: unknown; alt?: unknown; afterText?: unknown }
  | { kind: 'chart'; cells?: unknown; chartType?: unknown; title?: unknown; afterText?: unknown };

type TiptapNode = { type: string; text?: string; attrs?: Record<string, unknown>; marks?: Array<Record<string, unknown>>; content?: TiptapNode[] };

type VisualFallback = {
  anchorBlockId?: string;
};

export function applyOjsStructuredContent(manuscript: OmiManuscript, launch: OjsLaunchPayload): OmiManuscript {
  const source = launch.sourceDocument as unknown as { structuredBlocks?: unknown[] } | undefined;
  const structured = Array.isArray(source?.structuredBlocks) ? source.structuredBlocks as StructuredBlock[] : [];
  if (!structured.length) return manuscript;

  // structuredBlocks already arrive in the original DOCX XML order. Map the
  // paragraph entries in that sequence to the actual imported manuscript
  // blocks before any list/table transformations occur. Visuals can then use
  // the nearest preceding mapped paragraph as a stable positional fallback
  // when their textual afterText anchor cannot be resolved.
  const fallbackByVisualIndex = buildSourceOrderFallbacks(manuscript, structured);

  const listQueues = new Map<string, ListInfo[]>();
  const visualsByAfter = new Map<string, OmiBlock[]>();
  const tableCleanupByAfter = new Map<string, string[][]>();
  const leadingVisuals: OmiBlock[] = [];
  const leadingTableCleanup: string[][] = [];
  const fallbackByVisualId = new Map<string, VisualFallback>();

  for (let structuredIndex = 0; structuredIndex < structured.length; structuredIndex += 1) {
    const item = structured[structuredIndex];
    if (!item) continue;

    if (item.kind === 'paragraph') {
      if (typeof item.text !== 'string' || !Number.isInteger(item.listLevel) || typeof item.ordered !== 'boolean') continue;
      const key = normalize(item.text);
      const queue = listQueues.get(key) ?? [];
      queue.push({ level: Math.max(0, item.listLevel ?? 0), ordered: item.ordered });
      listQueues.set(key, queue);
      continue;
    }

    const visual = toVisualBlock(item);
    if (!visual) continue;
    fallbackByVisualId.set(visual.id, fallbackByVisualIndex.get(structuredIndex) ?? {});

    const afterText = typeof item.afterText === 'string' ? normalize(item.afterText) : '';
    if (!afterText) {
      leadingVisuals.push(visual);
      const cleanup = tableCleanupSequence(item);
      if (cleanup.length) leadingTableCleanup.push(cleanup);
    } else {
      const queue = visualsByAfter.get(afterText) ?? [];
      queue.push(visual);
      visualsByAfter.set(afterText, queue);

      const cleanup = tableCleanupSequence(item);
      if (cleanup.length) {
        const cleanupQueue = tableCleanupByAfter.get(afterText) ?? [];
        cleanupQueue.push(cleanup);
        tableCleanupByAfter.set(afterText, cleanupQueue);
      }
    }
  }

  let sections = manuscript.sections.map((section, sectionIndex) => {
    const output: OmiBlock[] = [];
    if (sectionIndex === 0 && leadingVisuals.length) output.push(...leadingVisuals);

    let index = sectionIndex === 0
      ? skipStructuredTableCellParagraphs(section.blocks, 0, leadingTableCleanup)
      : 0;
    while (index < section.blocks.length) {
      const block = section.blocks[index];
      if (!block) break;
      if (block.visual || block.type !== 'paragraph') {
        output.push(block);
        index += 1;
        continue;
      }

      const firstText = storedPlainText(block.content);
      const firstInfo = listQueues.get(normalize(firstText))?.[0];
      if (!firstInfo) {
        output.push(block);
        output.push(...takeVisuals(visualsByAfter, firstText));
        const cleanup = takeTableCleanup(tableCleanupByAfter, firstText);
        index = skipStructuredTableCellParagraphs(section.blocks, index + 1, cleanup);
        continue;
      }

      const items: Array<{ block: OmiBlock; info: ListInfo; text: string }> = [];
      let cursor = index;
      while (cursor < section.blocks.length) {
        const candidate = section.blocks[cursor];
        if (!candidate || candidate.visual || candidate.type !== 'paragraph') break;
        const text = storedPlainText(candidate.content);
        const queue = listQueues.get(normalize(text));
        const info = queue?.shift();
        if (!info) break;
        items.push({ block: candidate, info, text });
        cursor += 1;
      }

      if (!items.length) {
        output.push(block);
        index += 1;
        continue;
      }

      output.push(buildListBlock(items));
      for (const item of items) {
        output.push(...takeVisuals(visualsByAfter, item.text));
        const cleanup = takeTableCleanup(tableCleanupByAfter, item.text);
        cursor = skipStructuredTableCellParagraphs(section.blocks, cursor, cleanup);
      }
      index = cursor;
    }
    return { ...section, blocks: output };
  });

  const leftovers = Array.from(visualsByAfter.values()).flat();
  if (leftovers.length) {
    sections = insertLeftoversBySourceOrder(sections, leftovers, fallbackByVisualId);
  }

  return { ...manuscript, sections };
}

function buildSourceOrderFallbacks(
  manuscript: OmiManuscript,
  structured: StructuredBlock[],
): Map<number, VisualFallback> {
  const paragraphBlocks = manuscript.sections.flatMap((section) =>
    section.blocks.filter((block) => !block.visual && block.type === 'paragraph'),
  );

  const mappedParagraphs = new Map<number, string>();
  let manuscriptCursor = 0;

  for (let structuredIndex = 0; structuredIndex < structured.length; structuredIndex += 1) {
    const item = structured[structuredIndex];
    if (item?.kind !== 'paragraph' || typeof item.text !== 'string') continue;
    const expected = normalize(item.text);
    if (!expected) continue;

    for (let cursor = manuscriptCursor; cursor < paragraphBlocks.length; cursor += 1) {
      const candidate = paragraphBlocks[cursor];
      if (!candidate) continue;
      if (normalize(storedPlainText(candidate.content)) !== expected) continue;
      mappedParagraphs.set(structuredIndex, candidate.id);
      manuscriptCursor = cursor + 1;
      break;
    }
  }

  const result = new Map<number, VisualFallback>();
  let lastAnchorBlockId: string | undefined;
  for (let structuredIndex = 0; structuredIndex < structured.length; structuredIndex += 1) {
    const mapped = mappedParagraphs.get(structuredIndex);
    if (mapped) lastAnchorBlockId = mapped;

    const item = structured[structuredIndex];
    if (!item || item.kind === 'paragraph') continue;
    result.set(structuredIndex, lastAnchorBlockId ? { anchorBlockId: lastAnchorBlockId } : {});
  }
  return result;
}

function insertLeftoversBySourceOrder(
  sections: OmiManuscript['sections'],
  leftovers: OmiBlock[],
  fallbackByVisualId: Map<string, VisualFallback>,
): OmiManuscript['sections'] {
  const pendingByAnchor = new Map<string, OmiBlock[]>();
  const stillUnresolved: OmiBlock[] = [];

  for (const visual of leftovers) {
    const anchorBlockId = fallbackByVisualId.get(visual.id)?.anchorBlockId;
    if (!anchorBlockId) {
      stillUnresolved.push(visual);
      continue;
    }
    const queue = pendingByAnchor.get(anchorBlockId) ?? [];
    queue.push(visual);
    pendingByAnchor.set(anchorBlockId, queue);
  }

  const result = sections.map((section) => {
    const blocks: OmiBlock[] = [];
    for (const block of section.blocks) {
      blocks.push(block);
      const pending = pendingByAnchor.get(block.id);
      if (!pending?.length) continue;
      blocks.push(...pending);
      pendingByAnchor.delete(block.id);
    }
    return { ...section, blocks };
  });

  // A mapped paragraph can disappear when multiple source paragraphs collapse
  // into a single list block. In that rare compatibility case keep the former
  // behaviour rather than dropping content: unresolved visuals are appended to
  // the document end.
  for (const pending of pendingByAnchor.values()) stillUnresolved.push(...pending);
  if (stillUnresolved.length && result.length) {
    const lastIndex = result.length - 1;
    const last = result[lastIndex];
    if (last) result[lastIndex] = { ...last, blocks: [...last.blocks, ...stillUnresolved] };
  }
  return result;
}

function buildListBlock(items: Array<{ block: OmiBlock; info: ListInfo }>): OmiBlock {
  const parsed = items.map((item) => ({ ...item.info, content: paragraphInline(item.block.content) }));
  const roots: TiptapNode[] = [];
  let index = 0;
  while (index < parsed.length) {
    const level = parsed[index]?.level ?? 0;
    const consumed = consumeList(parsed, index, level);
    roots.push(consumed.node);
    index = consumed.nextIndex;
  }
  return {
    ...items[0]!.block,
    content: JSON.stringify({ type: 'doc', content: roots }),
  };
}

function consumeList(
  items: Array<ListInfo & { content: TiptapNode[] }>,
  start: number,
  level: number,
): { node: TiptapNode; nextIndex: number } {
  const ordered = items[start]?.ordered ?? false;
  const node: TiptapNode = { type: ordered ? 'orderedList' : 'bulletList', content: [] };
  let index = start;
  while (index < items.length) {
    const item = items[index];
    if (!item || item.level < level) break;
    if (item.level > level) {
      const last = node.content?.at(-1);
      if (!last) break;
      const nested = consumeList(items, index, item.level);
      last.content = [...(last.content ?? []), nested.node];
      index = nested.nextIndex;
      continue;
    }
    if (item.ordered !== ordered) break;
    node.content?.push({ type: 'listItem', content: [{ type: 'paragraph', content: item.content }] });
    index += 1;
  }
  return { node, nextIndex: index };
}

function paragraphInline(content: string): TiptapNode[] {
  const input = content.trim();
  if (!input.startsWith('{')) return input ? [{ type: 'text', text: content }] : [];
  try {
    const doc = JSON.parse(input) as TiptapNode;
    const paragraph = doc.content?.find((node) => node.type === 'paragraph');
    return paragraph?.content ?? (storedPlainText(content) ? [{ type: 'text', text: storedPlainText(content) }] : []);
  } catch {
    return content ? [{ type: 'text', text: content }] : [];
  }
}

function toVisualBlock(item: StructuredBlock): OmiBlock | undefined {
  if (item.kind === 'table' && isCells(item.cells)) {
    return {
      id: crypto.randomUUID(), type: 'table', content: '',
      visual: { kind: 'table', cells: item.cells, headerRows: typeof item.headerRows === 'number' ? item.headerRows : 0 },
    } as OmiBlock;
  }
  if (item.kind === 'image' && typeof item.src === 'string') {
    return {
      id: crypto.randomUUID(), type: 'image', content: '',
      visual: {
        kind: 'image', src: item.src,
        mediaType: typeof item.mediaType === 'string' ? item.mediaType : 'application/octet-stream',
        fileName: typeof item.fileName === 'string' ? item.fileName : undefined,
        alt: typeof item.alt === 'string' ? item.alt : '',
      },
    } as OmiBlock;
  }
  if (item.kind === 'chart' && isCells(item.cells)) {
    return {
      id: crypto.randomUUID(), type: 'chart', content: '',
      visual: {
        kind: 'chart', cells: item.cells,
        chartType: isChartType(item.chartType) ? item.chartType : 'bar',
        title: typeof item.title === 'string' ? item.title : undefined,
      },
    } as OmiBlock;
  }
  return undefined;
}

function tableCleanupSequence(item: StructuredBlock): string[] {
  if (item.kind !== 'table' || !isCells(item.cells)) return [];
  return item.cells
    .flat()
    .map((cell) => normalize(cell))
    .filter(Boolean);
}

function takeVisuals(map: Map<string, OmiBlock[]>, text: string): OmiBlock[] {
  const key = normalize(text);
  const value = map.get(key) ?? [];
  map.delete(key);
  return value;
}

function takeTableCleanup(map: Map<string, string[][]>, text: string): string[][] {
  const key = normalize(text);
  const value = map.get(key) ?? [];
  map.delete(key);
  return value;
}

function skipStructuredTableCellParagraphs(
  blocks: OmiBlock[],
  startIndex: number,
  sequences: string[][],
): number {
  let index = startIndex;
  for (const sequence of sequences) {
    if (!sequence.length) continue;
    let cursor = index;
    let matched = true;
    for (const expected of sequence) {
      const block = blocks[cursor];
      if (!block || block.visual || block.type !== 'paragraph') {
        matched = false;
        break;
      }
      if (normalize(storedPlainText(block.content)) !== expected) {
        matched = false;
        break;
      }
      cursor += 1;
    }
    if (matched) index = cursor;
  }
  return index;
}

function isCells(value: unknown): value is string[][] {
  return Array.isArray(value) && value.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === 'string'));
}

function isChartType(value: unknown): value is 'bar' | 'line' | 'pie' | 'scatter' | 'area' {
  return value === 'bar' || value === 'line' || value === 'pie' || value === 'scatter' || value === 'area';
}

function storedPlainText(content: string): string {
  const input = content.trim();
  if (!input.startsWith('{')) return content;
  try { return collectJsonText(JSON.parse(input) as unknown); } catch { return content; }
}

function collectJsonText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const node = value as { text?: unknown; content?: unknown[] };
  if (typeof node.text === 'string') return node.text;
  return (node.content ?? []).map(collectJsonText).join('');
}

function normalize(value: string): string { return value.replace(/\s+/g, ' ').trim(); }
