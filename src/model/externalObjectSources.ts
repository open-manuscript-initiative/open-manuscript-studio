import type { OmiBlock } from '../types/omi';

export interface ExternalObjectDraft {
  block: OmiBlock;
  source: string;
}

/** Keep object and visible source adjacent in the portable manuscript. */
export function buildSourcedVisualBlocks(
  drafts: readonly ExternalObjectDraft[],
  sourceLabel: string,
  newId: () => string = () => crypto.randomUUID(),
): OmiBlock[] {
  if (drafts.length === 0 || drafts.some(({ block, source }) => !block.visual || !source.trim())) {
    throw new Error('Every imported visual object requires a source.');
  }
  return drafts.flatMap(({ block, source }) => [
    block,
    {
      id: newId(),
      type: 'paragraph',
      content: JSON.stringify({
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: `${sourceLabel}: ${source.trim()}` }],
        }],
      }),
    },
  ]);
}

export function prefillExternalSource(fileName: string, sourcePart?: string): string {
  return [fileName.trim(), sourcePart?.trim()].filter(Boolean).join(' · ');
}
