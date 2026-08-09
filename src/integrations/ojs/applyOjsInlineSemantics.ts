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

/**
 * Enriches the plain paragraph blocks created by the established OJS importer
 * with the inline semantics emitted by the server-side DOCX handoff.
 */
export function applyOjsInlineSemantics(
  manuscript: OmiManuscript,
  launch: OjsLaunchPayload,
): OmiManuscript {
  const source = launch.sourceDocument as unknown as {
    paragraphs?: StyledSourceParagraph[];
  } | undefined;
  const paragraphs = Array.isArray(source?.paragraphs) ? source.paragraphs : [];
  const queues = new Map<string, string[]>();

  for (const paragraph of paragraphs) {
    if (!Array.isArray(paragraph.inline)) continue;
    const inline = paragraph.inline as StyledInlineText[];
    if (inline.some((item) => item.kind !== 'text')) continue;
    if (!inline.some(hasPortableSemantics)) continue;

    const text = inline.map((item) => typeof item.text === 'string' ? item.text : '').join('');
    const content = buildTiptapContent(inline);
    if (!normalize(text) || !content) continue;
    const queue = queues.get(normalize(text)) ?? [];
    queue.push(content);
    queues.set(normalize(text), queue);
  }

  if (!queues.size) return manuscript;

  return {
    ...manuscript,
    sections: manuscript.sections.map((section) => ({
      ...section,
      blocks: section.blocks.map((block) => {
        if (block.visual || block.type !== 'paragraph') return block;
        if (/"type"\s*:\s*"omi(?:Note|Citation|CrossReference)"/.test(block.content)) return block;
        const text = storedPlainText(block.content);
        const queue = queues.get(normalize(text));
        const content = queue?.shift();
        return content ? { ...block, content } : block;
      }),
    })),
  };
}

function hasPortableSemantics(item: StyledInlineText): boolean {
  return (
    Array.isArray(item.semantics) && item.semantics.length > 0
  ) || (
    typeof item.language === 'string' && Boolean(item.language.trim())
  );
}

function buildTiptapContent(inline: readonly StyledInlineText[]): string | undefined {
  const nodes: Array<Record<string, unknown>> = [];
  for (const item of inline) {
    if (item.kind !== 'text' || typeof item.text !== 'string' || !item.text) continue;
    const marks = Array.isArray(item.semantics)
      ? item.semantics.flatMap((value) => semanticMark(value))
      : [];
    if (typeof item.language === 'string' && item.language.trim()) {
      marks.push({ type: 'omiLanguage', attrs: { lang: item.language.trim() } });
    }
    nodes.push({
      type: 'text',
      text: item.text,
      ...(marks.length ? { marks } : {}),
    });
  }
  if (!nodes.length) return undefined;
  return JSON.stringify({
    type: 'doc',
    content: [{ type: 'paragraph', content: nodes }],
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
