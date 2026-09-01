import type { OmiBlock, OmiSection } from '../types/omi';

export type ManuscriptDirection = 'backward' | 'forward';

export interface ManuscriptBlockLocation {
  sectionIndex: number;
  blockIndex: number;
  sectionId: string;
  block: OmiBlock;
}

/**
 * Canonical authoring order used by Word-like editing commands.
 *
 * Section boundaries remain semantic manuscript structure, but they are not
 * editor-navigation barriers. Block order is the visible reading order across
 * sections; empty sections therefore contribute no synthetic editing stop.
 */
export function getManuscriptBlockOrder(
  sections: readonly OmiSection[],
): ManuscriptBlockLocation[] {
  const order: ManuscriptBlockLocation[] = [];
  sections.forEach((section, sectionIndex) => {
    section.blocks.forEach((block, blockIndex) => {
      order.push({
        sectionIndex,
        blockIndex,
        sectionId: section.id,
        block,
      });
    });
  });
  return order;
}

export function findManuscriptBlock(
  sections: readonly OmiSection[],
  blockId: string,
): ManuscriptBlockLocation | null {
  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    const section = sections[sectionIndex];
    if (!section) continue;
    const blockIndex = section.blocks.findIndex((block) => block.id === blockId);
    if (blockIndex < 0) continue;
    const block = section.blocks[blockIndex];
    if (!block) return null;
    return {
      sectionIndex,
      blockIndex,
      sectionId: section.id,
      block,
    };
  }
  return null;
}

/**
 * Return the physically adjacent block in manuscript reading order.
 *
 * This intentionally does not skip semantic blocks. A table, figure, quote or
 * heading between two paragraphs remains a real structural boundary and must
 * not disappear as a side effect of Backspace/Delete.
 */
export function findAdjacentManuscriptBlock(
  sections: readonly OmiSection[],
  blockId: string,
  direction: ManuscriptDirection,
): ManuscriptBlockLocation | null {
  const order = getManuscriptBlockOrder(sections);
  const index = order.findIndex((location) => location.block.id === blockId);
  if (index < 0) return null;
  return order[index + (direction === 'backward' ? -1 : 1)] ?? null;
}

export function areBlocksEditingAdjacent(
  sections: readonly OmiSection[],
  firstBlockId: string,
  secondBlockId: string,
): boolean {
  const next = findAdjacentManuscriptBlock(sections, firstBlockId, 'forward');
  return next?.block.id === secondBlockId;
}
