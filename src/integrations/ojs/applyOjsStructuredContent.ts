import type { OmiBlock, OmiManuscript } from '../../types/omi';
import type { OjsLaunchPayload } from './importOjsLaunch';

type ListInfo = { level: number; ordered: boolean };
type StructuredBlock =
  | { kind: 'paragraph'; text?: string; listLevel?: number; ordered?: boolean }
  | { kind: 'table'; cells?: unknown; headerRows?: unknown; afterText?: unknown }
  | { kind: 'image'; src?: unknown; mediaType?: unknown; fileName?: unknown; alt?: unknown; afterText?: unknown }
  | { kind: 'chart'; cells?: unknown; chartType?: unknown; title?: unknown; afterText?: unknown };

type TiptapNode = { type: string; text?: string; attrs?: Record<string, unknown>; marks?: Array<Record<string, unknown>>; content?: TiptapNode[] };

export function applyOjsStructuredContent(manuscript: OmiManuscript, launch: OjsLaunchPayload): OmiManuscript {
  const source = launch.sourceDocument as unknown as { structuredBlocks?: unknown[] } | undefined;
  const structured = Array.isArray(source?.structuredBlocks) ? source.structuredBlocks as StructuredBlock[] : [];
  if (!structured.length) return manuscript;

  const listQueues = new Map<string, ListInfo[]>();
  const visualsByAfter = new Map<string, OmiBlock[]>();
  const leadingVisuals: OmiBlock[] = [];

  for (const item of structured) {
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
    const afterText = typeof item.afterText === 'string' ? normalize(item.afterText) : '';
    if (!afterText) leadingVisuals.push(visual);
    else {
      const queue = visualsByAfter.get(afterText) ?? [];
      queue.push(visual);
      visualsByAfter.set(afterText, queue);
    }
  }

  const sections = manuscript.sections.map((section, sectionIndex) => {
    const output: OmiBlock[] = [];
    if (sectionIndex === 0 && leadingVisuals.length) output.push(...leadingVisuals);

    let index = 0;
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
        index += 1;
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
      for (const item of items) output.push(...takeVisuals(visualsByAfter, item.text));
      index = cursor;
    }
    return { ...section, blocks: output };
  });

  const leftovers = Array.from(visualsByAfter.values()).flat();
  if (leftovers.length && sections.length) {
    const last = sections.length - 1;
    const section = sections[last];
    if (section) sections[last] = { ...section, blocks: [...section.blocks, ...leftovers] };
  }

  return { ...manuscript, sections };
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

function takeVisuals(map: Map<string, OmiBlock[]>, text: string): OmiBlock[] {
  const key = normalize(text);
  const value = map.get(key) ?? [];
  map.delete(key);
  return value;
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
