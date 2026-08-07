import type { OmiSection } from '../types/omi';

export const EMPTY_SECTION_CONTENT = JSON.stringify({
  type: 'doc',
  content: [{ type: 'paragraph' }],
});

export function createEmptySection(
  id = crypto.randomUUID(),
  blockId = crypto.randomUUID(),
): OmiSection {
  return {
    id,
    title: '',
    blocks: [
      {
        id: blockId,
        type: 'paragraph',
        content: EMPTY_SECTION_CONTENT,
      },
    ],
  };
}

export function clampSectionGapIndex(
  gapIndex: number,
  sectionCount: number,
): number {
  if (!Number.isFinite(gapIndex)) {
    return sectionCount;
  }

  return Math.max(0, Math.min(sectionCount, Math.trunc(gapIndex)));
}

export function insertSectionAtGap(
  sections: readonly OmiSection[],
  section: OmiSection,
  gapIndex: number,
): OmiSection[] {
  if (sections.some((candidate) => candidate.id === section.id)) {
    throw new Error(`Section ID already exists: ${section.id}`);
  }

  const index = clampSectionGapIndex(gapIndex, sections.length);
  const next = [...sections];
  next.splice(index, 0, section);
  return next;
}

/**
 * Moves an existing section to one of the gaps around the current section
 * sequence. Gap 0 is before the first section; gap N is after the last.
 *
 * The section object is moved without changing its stable identity or any of
 * its blocks, anchors, citations or annotations.
 */
export function moveSectionToGap(
  sections: readonly OmiSection[],
  sectionId: string,
  gapIndex: number,
): OmiSection[] {
  const sourceIndex = sections.findIndex((section) => section.id === sectionId);

  if (sourceIndex < 0 || sections.length < 2) {
    return [...sections];
  }

  const boundedGap = clampSectionGapIndex(gapIndex, sections.length);
  let insertionIndex = boundedGap;

  // Once the source is removed, gaps to its right shift one place left.
  if (sourceIndex < boundedGap) {
    insertionIndex -= 1;
  }

  const next = [...sections];
  const [moved] = next.splice(sourceIndex, 1);

  if (!moved) {
    return [...sections];
  }

  insertionIndex = Math.max(0, Math.min(next.length, insertionIndex));
  next.splice(insertionIndex, 0, moved);

  return arraysHaveSameOrder(sections, next) ? [...sections] : next;
}

export function moveSectionToIndex(
  sections: readonly OmiSection[],
  sectionId: string,
  targetIndex: number,
): OmiSection[] {
  const sourceIndex = sections.findIndex((section) => section.id === sectionId);

  if (sourceIndex < 0 || sections.length < 2) {
    return [...sections];
  }

  const boundedTarget = Math.max(
    0,
    Math.min(sections.length - 1, Math.trunc(targetIndex)),
  );

  if (boundedTarget === sourceIndex) {
    return [...sections];
  }

  const next = [...sections];
  const [moved] = next.splice(sourceIndex, 1);

  if (!moved) {
    return [...sections];
  }

  next.splice(boundedTarget, 0, moved);
  return next;
}

export function sectionOrder(
  sections: readonly OmiSection[],
): string[] {
  return sections.map((section) => section.id);
}

export function arraysHaveSameOrder(
  first: readonly OmiSection[],
  second: readonly OmiSection[],
): boolean {
  return (
    first.length === second.length &&
    first.every((section, index) => section.id === second[index]?.id)
  );
}
