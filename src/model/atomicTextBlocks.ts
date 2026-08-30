import { getSectionDepth } from './sectionStructure';
import type { OmiBlock, OmiSection } from '../types/omi';

/**
 * Section headings are stored as ordinary addressable text blocks so they use
 * the same Tiptap editing path as paragraphs. `section.title` remains a
 * synchronized semantic label for outlines, numbering, exports and xrefs.
 */
export function materializeSectionHeadingBlocks(
  sections: readonly OmiSection[],
): OmiSection[] {
  return sections.map((section) => {
    if (isSectionHeadingBlock(section.blocks[0])) return section;

    const level = Math.max(
      1,
      Math.min(6, getSectionDepth(sections, section.id) + 1),
    );

    return {
      ...section,
      blocks: [
        createSectionHeadingBlock(section.title, level),
        ...section.blocks,
      ],
    };
  });
}

export function createSectionHeadingBlock(
  title: string,
  level = 1,
  id = crypto.randomUUID(),
): OmiBlock {
  const normalizedLevel = Math.max(1, Math.min(6, Math.trunc(level)));
  const text = title.replace(/[\r\n]+/g, ' ').trim();

  return {
    id,
    type: 'heading',
    content: JSON.stringify({
      type: 'doc',
      content: [
        text
          ? {
              type: 'heading',
              attrs: { level: normalizedLevel },
              content: [{ type: 'text', text }],
            }
          : {
              type: 'heading',
              attrs: { level: normalizedLevel },
            },
      ],
    }),
  };
}

/**
 * The marker is deliberately the stable OMI block type rather than the current
 * Tiptap node type. This lets an imported heading be converted to a paragraph
 * without reintroducing the legacy section-title textarea on the next render.
 */
export function isSectionHeadingBlock(
  block: OmiBlock | undefined,
): block is OmiBlock {
  return block?.type === 'heading';
}

export function textFromAtomicBlock(content: string): string {
  try {
    return collectText(JSON.parse(content) as unknown)
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    return content.replace(/\s+/g, ' ').trim();
  }
}

function collectText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const node = value as { text?: unknown; content?: unknown[] };
  if (typeof node.text === 'string') return node.text;
  return (node.content ?? []).map(collectText).join(' ');
}
