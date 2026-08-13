import type { OmiManuscript } from '../../types/omi';
import type { OjsLaunchPayload } from './importOjsLaunch';

type OjsInlineSemantic =
  | 'strong'
  | 'emphasis'
  | 'strike'
  | 'underline'
  | 'small-caps'
  | 'superscript'
  | 'subscript'
  | 'code';

interface StyledInlineText {
  kind?: string;
  text?: string;
  semantics?: unknown;
  language?: unknown;
}

interface StyledSourceParagraph {
  text?: unknown;
  inline?: unknown;
}

interface PortableSpan {
  text: string;
  marks: Array<Record<string, unknown>>;
}

/**
 * Enriches paragraph blocks created by the established OJS importer with the
 * inline semantics emitted by the server-side DOCX handoff.
 *
 * Existing OMI inline atoms (notes, citations and cross-references) are kept
 * intact. Styled text is projected onto the text nodes around those atoms, so
 * a paragraph can contain both italic/bold runs and note anchors.
 */
export function applyOjsInlineSemantics(
  manuscript: OmiManuscript,
  launch: OjsLaunchPayload,
): OmiManuscript {
  const source = launch.sourceDocument as unknown as {
    paragraphs?: StyledSourceParagraph[];
  } | undefined;
  const paragraphs = Array.isArray(source?.paragraphs) ? source.paragraphs : [];
  const queues = new Map<string, PortableSpan[][]>();

  for (const paragraph of paragraphs) {
    if (!Array.isArray(paragraph.inline)) continue;
    const inline = paragraph.inline as StyledInlineText[];
    if (!inline.some(hasPortableSemantics)) continue;

    const spans = buildPortableSpans(inline);
    const text = spans.map((span) => span.text).join('');
    if (!normalize(text) || !spans.length) continue;
    const queue = queues.get(normalize(text)) ?? [];
    queue.push(spans);
    queues.set(normalize(text), queue);
  }

  if (!queues.size) return manuscript;

  return {
    ...manuscript,
    sections: manuscript.sections.map((section) => ({
      ...section,
      blocks: section.blocks.map((block) => {
        if (block.visual || block.type !== 'paragraph') return block;
        const text = storedPlainText(block.content);
        const queue = queues.get(normalize(text));
        const spans = queue?.shift();
        if (!spans) return block;

        return {
          ...block,
          content: applySpansToStoredContent(block.content, spans),
        };
      }),
    })),
  };
}

function hasPortableSemantics(item: StyledInlineText): boolean {
  return (
    item.kind === 'text' &&
    ((Array.isArray(item.semantics) && item.semantics.length > 0) ||
      (typeof item.language === 'string' && Boolean(item.language.trim())))
  );
}

function buildPortableSpans(inline: readonly StyledInlineText[]): PortableSpan[] {
  const spans: PortableSpan[] = [];
  for (const item of inline) {
    if (item.kind !== 'text' || typeof item.text !== 'string' || !item.text) continue;
    const marks = Array.isArray(item.semantics)
      ? item.semantics.flatMap((value) => semanticMark(value))
      : [];
    if (typeof item.language === 'string' && item.language.trim()) {
      marks.push({ type: 'omiLanguage', attrs: { lang: item.language.trim() } });
    }
    spans.push({ text: item.text, marks });
  }
  return spans;
}

function applySpansToStoredContent(
  content: string,
  spans: readonly PortableSpan[],
): string {
  const input = content.trim();
  if (!input.startsWith('{')) {
    return buildTiptapContent(spans);
  }

  try {
    const parsed = JSON.parse(input) as unknown;
    const cursor = { span: 0, offset: 0 };
    const transformed = transformNode(parsed, spans, cursor);
    return JSON.stringify(transformed);
  } catch {
    return buildTiptapContent(spans);
  }
}

function transformNode(
  value: unknown,
  spans: readonly PortableSpan[],
  cursor: { span: number; offset: number },
): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const node = value as Record<string, unknown>;

  if (node.type === 'text' && typeof node.text === 'string') {
    const parts = styledTextNodes(node.text, spans, cursor);
    return parts.length === 1 ? parts[0] : { type: 'omiInlineGroup', content: parts };
  }

  if (!Array.isArray(node.content)) return node;

  const content: unknown[] = [];
  for (const child of node.content) {
    const transformed = transformNode(child, spans, cursor);
    if (
      transformed &&
      typeof transformed === 'object' &&
      !Array.isArray(transformed) &&
      (transformed as Record<string, unknown>).type === 'omiInlineGroup' &&
      Array.isArray((transformed as Record<string, unknown>).content)
    ) {
      content.push(...((transformed as Record<string, unknown>).content as unknown[]));
    } else {
      content.push(transformed);
    }
  }
  return { ...node, content };
}

function styledTextNodes(
  text: string,
  spans: readonly PortableSpan[],
  cursor: { span: number; offset: number },
): Array<Record<string, unknown>> {
  const nodes: Array<Record<string, unknown>> = [];
  let remaining = text.length;
  let fallbackOffset = 0;

  while (remaining > 0 && cursor.span < spans.length) {
    const span = spans[cursor.span];
    if (!span) break;
    const available = span.text.length - cursor.offset;
    if (available <= 0) {
      cursor.span += 1;
      cursor.offset = 0;
      continue;
    }

    const take = Math.min(remaining, available);
    const value = span.text.slice(cursor.offset, cursor.offset + take);
    nodes.push({
      type: 'text',
      text: value,
      ...(span.marks.length ? { marks: span.marks } : {}),
    });
    cursor.offset += take;
    remaining -= take;
    fallbackOffset += take;

    if (cursor.offset >= span.text.length) {
      cursor.span += 1;
      cursor.offset = 0;
    }
  }

  if (remaining > 0) {
    nodes.push({
      type: 'text',
      text: text.slice(fallbackOffset, fallbackOffset + remaining),
    });
  }

  return coalesceTextNodes(nodes);
}

function coalesceTextNodes(
  nodes: readonly Record<string, unknown>[],
): Array<Record<string, unknown>> {
  const result: Array<Record<string, unknown>> = [];
  for (const node of nodes) {
    const previous = result.at(-1);
    if (
      previous?.type === 'text' &&
      node.type === 'text' &&
      JSON.stringify(previous.marks ?? []) === JSON.stringify(node.marks ?? []) &&
      typeof previous.text === 'string' &&
      typeof node.text === 'string'
    ) {
      previous.text += node.text;
    } else {
      result.push({ ...node });
    }
  }
  return result;
}

function buildTiptapContent(spans: readonly PortableSpan[]): string {
  return JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: spans.map((span) => ({
          type: 'text',
          text: span.text,
          ...(span.marks.length ? { marks: span.marks } : {}),
        })),
      },
    ],
  });
}

function semanticMark(value: unknown): Array<Record<string, unknown>> {
  switch (value as OjsInlineSemantic) {
    case 'strong': return [{ type: 'bold' }];
    case 'emphasis': return [{ type: 'italic' }];
    case 'strike': return [{ type: 'strike' }];
    case 'underline': return [{ type: 'omiUnderline' }];
    case 'small-caps': return [{ type: 'omiSmallCaps' }];
    case 'superscript': return [{ type: 'omiSuperscript' }];
    case 'subscript': return [{ type: 'omiSubscript' }];
    case 'code': return [{ type: 'code' }];
    default: return [];
  }
}

function storedPlainText(content: string): string {
  const input = content.trim();
  if (!input.startsWith('{')) return content;
  try {
    return collectJsonText(JSON.parse(input) as unknown);
  } catch {
    return content;
  }
}

function collectJsonText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const node = value as { text?: unknown; content?: unknown[] };
  if (typeof node.text === 'string') return node.text;
  return (node.content ?? []).map(collectJsonText).join('');
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
