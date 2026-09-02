import type { OmiSection } from '../types/omi';

export type HierarchicalOmiSection = OmiSection & {
  /**
   * Stable parent relationship for semantic subsection hierarchy.
   * Undefined means the section is a top-level manuscript section.
   */
  parentSectionId?: string;
};

export interface SectionOutlineEntry {
  section: OmiSection;
  parentSectionId?: string;
  depth: number;
}

export interface SectionHierarchyIssue {
  sectionId: string;
  type: 'missing-parent' | 'self-parent' | 'cycle' | 'non-preorder';
  parentSectionId?: string;
}

/**
 * One independently editable contribution in an edited volume. The root is a
 * top-level section; every descendant section stays in the same Tiptap host.
 */
export interface ManuscriptStudy {
  rootSectionId: string;
  sections: OmiSection[];
}

export const EMPTY_SECTION_CONTENT = JSON.stringify({
  type: 'doc',
  content: [{ type: 'paragraph' }],
});

export const EMPTY_STUDY_HEADING_CONTENT = JSON.stringify({
  type: 'doc',
  content: [{ type: 'heading', attrs: { level: 1 } }],
});

export function createEmptySection(
  id = crypto.randomUUID(),
  blockId = crypto.randomUUID(),
  parentSectionId?: string,
): OmiSection {
  const section: HierarchicalOmiSection = {
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

  if (parentSectionId) {
    section.parentSectionId = parentSectionId;
  }

  return section;
}

/** Creates a new top-level study with an editable title and body paragraph. */
export function createEmptyStudy(
  id = crypto.randomUUID(),
  headingBlockId = crypto.randomUUID(),
  bodyBlockId = crypto.randomUUID(),
): OmiSection {
  return {
    id,
    title: '',
    blocks: [
      {
        id: headingBlockId,
        type: 'heading',
        content: EMPTY_STUDY_HEADING_CONTENT,
      },
      {
        id: bodyBlockId,
        type: 'paragraph',
        content: EMPTY_SECTION_CONTENT,
      },
    ],
  };
}

/**
 * Splits the linear OMI section array into top-level studies while preserving
 * the exact order and object identity of every section.
 */
export function partitionManuscriptStudies(
  sections: readonly OmiSection[],
): ManuscriptStudy[] {
  const sectionMap = new Map(sections.map((section) => [section.id, section]));
  const studies = new Map<string, ManuscriptStudy>();

  for (const section of sections) {
    const rootSectionId = resolveStudyRootId(section, sectionMap);
    const study = studies.get(rootSectionId);
    if (study) {
      study.sections.push(section);
    } else {
      studies.set(rootSectionId, { rootSectionId, sections: [section] });
    }
  }

  return [...studies.values()];
}

/** Replaces one study subtree without disturbing the other editor documents. */
export function replaceManuscriptStudySections(
  sections: readonly OmiSection[],
  rootSectionId: string,
  replacement: readonly OmiSection[],
): OmiSection[] {
  const study = partitionManuscriptStudies(sections).find(
    (candidate) => candidate.rootSectionId === rootSectionId,
  );
  if (!study) return [...sections];

  const studyIds = new Set(study.sections.map((section) => section.id));
  const insertionIndex = sections.findIndex((section) =>
    studyIds.has(section.id),
  );
  const remaining = sections.filter((section) => !studyIds.has(section.id));
  const next = [...remaining];
  next.splice(Math.max(0, insertionIndex), 0, ...replacement);
  return next;
}

export function getParentSectionId(
  section: OmiSection,
): string | undefined {
  const value = (section as HierarchicalOmiSection).parentSectionId;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function withParentSectionId(
  section: OmiSection,
  parentSectionId: string | undefined,
): OmiSection {
  const next: HierarchicalOmiSection = { ...section };

  if (parentSectionId) {
    next.parentSectionId = parentSectionId;
  } else {
    delete next.parentSectionId;
  }

  return next;
}

export function buildSectionOutline(
  sections: readonly OmiSection[],
): SectionOutlineEntry[] {
  const depthMap = buildSectionDepthMap(sections);

  return sections.map((section) => ({
    section,
    parentSectionId: getParentSectionId(section),
    depth: depthMap.get(section.id) ?? 0,
  }));
}

export function buildSectionDepthMap(
  sections: readonly OmiSection[],
): Map<string, number> {
  const sectionMap = new Map(sections.map((section) => [section.id, section]));
  const result = new Map<string, number>();

  const depthFor = (section: OmiSection, visiting = new Set<string>()): number => {
    const cached = result.get(section.id);
    if (cached !== undefined) return cached;

    const parentId = getParentSectionId(section);
    if (!parentId) {
      result.set(section.id, 0);
      return 0;
    }

    if (parentId === section.id || visiting.has(section.id)) {
      result.set(section.id, 0);
      return 0;
    }

    const parent = sectionMap.get(parentId);
    if (!parent) {
      result.set(section.id, 0);
      return 0;
    }

    const nextVisiting = new Set(visiting);
    nextVisiting.add(section.id);
    const depth = depthFor(parent, nextVisiting) + 1;
    result.set(section.id, depth);
    return depth;
  };

  for (const section of sections) depthFor(section);
  return result;
}

export function getSectionDepth(
  sections: readonly OmiSection[],
  sectionId: string,
): number {
  return buildSectionDepthMap(sections).get(sectionId) ?? 0;
}

export function getSectionDescendantIds(
  sections: readonly OmiSection[],
  sectionId: string,
): string[] {
  const descendants: string[] = [];

  for (const section of sections) {
    if (section.id === sectionId) continue;
    if (isDescendantOf(sections, section.id, sectionId)) {
      descendants.push(section.id);
    }
  }

  return descendants;
}

export function getSectionSubtree(
  sections: readonly OmiSection[],
  sectionId: string,
): OmiSection[] {
  const ids = new Set([sectionId, ...getSectionDescendantIds(sections, sectionId)]);
  return sections.filter((section) => ids.has(section.id));
}

export function isDescendantOf(
  sections: readonly OmiSection[],
  sectionId: string,
  ancestorId: string,
): boolean {
  const sectionMap = new Map(sections.map((section) => [section.id, section]));
  let current = sectionMap.get(sectionId);
  const visited = new Set<string>();

  while (current) {
    const parentId = getParentSectionId(current);
    if (!parentId) return false;
    if (parentId === ancestorId) return true;
    if (visited.has(parentId)) return false;
    visited.add(parentId);
    current = sectionMap.get(parentId);
  }

  return false;
}

export function validateSectionHierarchy(
  sections: readonly OmiSection[],
): SectionHierarchyIssue[] {
  const sectionMap = new Map(sections.map((section) => [section.id, section]));
  const issues: SectionHierarchyIssue[] = [];
  const indexMap = new Map(sections.map((section, index) => [section.id, index]));

  for (const section of sections) {
    const parentId = getParentSectionId(section);
    if (!parentId) continue;

    if (parentId === section.id) {
      issues.push({ sectionId: section.id, type: 'self-parent', parentSectionId: parentId });
      continue;
    }

    const parent = sectionMap.get(parentId);
    if (!parent) {
      issues.push({ sectionId: section.id, type: 'missing-parent', parentSectionId: parentId });
      continue;
    }

    if (isDescendantOf(sections, parentId, section.id)) {
      issues.push({ sectionId: section.id, type: 'cycle', parentSectionId: parentId });
      continue;
    }

    const parentIndex = indexMap.get(parentId) ?? -1;
    const childIndex = indexMap.get(section.id) ?? -1;
    if (parentIndex >= childIndex) {
      issues.push({ sectionId: section.id, type: 'non-preorder', parentSectionId: parentId });
    }
  }

  return issues;
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
  assertUniqueSectionId(sections, section.id);
  const index = clampSectionGapIndex(gapIndex, sections.length);
  const next = [...sections];
  next.splice(index, 0, section);
  return next;
}

export function insertTopLevelSectionAtEnd(
  sections: readonly OmiSection[],
  section: OmiSection,
): OmiSection[] {
  return insertSectionAtGap(
    sections,
    withParentSectionId(section, undefined),
    sections.length,
  );
}

export function insertSubsection(
  sections: readonly OmiSection[],
  parentSectionId: string,
  section: OmiSection,
): OmiSection[] {
  assertUniqueSectionId(sections, section.id);
  if (!sections.some((candidate) => candidate.id === parentSectionId)) {
    throw new Error(`Parent section does not exist: ${parentSectionId}`);
  }

  const insertionIndex = endOfSubtreeIndex(sections, parentSectionId);
  const next = [...sections];
  next.splice(
    insertionIndex,
    0,
    withParentSectionId(section, parentSectionId),
  );
  return next;
}

export function insertSectionAfter(
  sections: readonly OmiSection[],
  siblingSectionId: string,
  section: OmiSection,
): OmiSection[] {
  assertUniqueSectionId(sections, section.id);
  const sibling = sections.find((candidate) => candidate.id === siblingSectionId);
  if (!sibling) return [...sections];

  const insertionIndex = endOfSubtreeIndex(sections, siblingSectionId);
  const next = [...sections];
  next.splice(
    insertionIndex,
    0,
    withParentSectionId(section, getParentSectionId(sibling)),
  );
  return next;
}

/**
 * Moves one complete section subtree to a raw structural gap. The root keeps
 * its current parent. This legacy-compatible helper is safe for flat documents
 * and remains available for older callers.
 */
export function moveSectionToGap(
  sections: readonly OmiSection[],
  sectionId: string,
  gapIndex: number,
): OmiSection[] {
  const sourceIndex = sections.findIndex((section) => section.id === sectionId);
  if (sourceIndex < 0 || sections.length < 2) return [...sections];

  const subtreeIds = new Set([
    sectionId,
    ...getSectionDescendantIds(sections, sectionId),
  ]);
  const subtree = sections.filter((section) => subtreeIds.has(section.id));
  const remaining = sections.filter((section) => !subtreeIds.has(section.id));
  const boundedGap = clampSectionGapIndex(gapIndex, sections.length);
  const removedBeforeGap = sections
    .slice(0, boundedGap)
    .filter((section) => subtreeIds.has(section.id)).length;
  const insertionIndex = clampSectionGapIndex(
    boundedGap - removedBeforeGap,
    remaining.length,
  );
  const next = [...remaining];
  next.splice(insertionIndex, 0, ...subtree);

  return hierarchyOrderIsValid(next) ? next : [...sections];
}

export function moveSectionToIndex(
  sections: readonly OmiSection[],
  sectionId: string,
  targetIndex: number,
): OmiSection[] {
  const sourceIndex = sections.findIndex((section) => section.id === sectionId);
  if (sourceIndex < 0 || sections.length < 2) return [...sections];

  const boundedTarget = Math.max(
    0,
    Math.min(sections.length - 1, Math.trunc(targetIndex)),
  );
  if (boundedTarget === sourceIndex) return [...sections];

  return moveSectionToGap(
    sections,
    sectionId,
    boundedTarget > sourceIndex ? boundedTarget + 1 : boundedTarget,
  );
}

/** Move a complete subtree one position among siblings. */
export function moveSectionAmongSiblings(
  sections: readonly OmiSection[],
  sectionId: string,
  direction: -1 | 1,
): OmiSection[] {
  const section = sections.find((candidate) => candidate.id === sectionId);
  if (!section) return [...sections];

  const parentId = getParentSectionId(section);
  const siblings = sections.filter(
    (candidate) => getParentSectionId(candidate) === parentId,
  );
  const siblingIndex = siblings.findIndex((candidate) => candidate.id === sectionId);
  const targetSibling = siblings[siblingIndex + direction];
  if (!targetSibling) return [...sections];

  if (direction < 0) {
    return moveSubtreeBeforeSibling(sections, sectionId, targetSibling.id);
  }

  return moveSubtreeAfterSibling(sections, sectionId, targetSibling.id);
}

/**
 * Makes a section the final child of another section. The complete source
 * subtree moves with it. Cycles and self-parenting are rejected.
 */
export function reparentSection(
  sections: readonly OmiSection[],
  sectionId: string,
  parentSectionId: string | undefined,
): OmiSection[] {
  const section = sections.find((candidate) => candidate.id === sectionId);
  if (!section) return [...sections];

  if (parentSectionId === sectionId) return [...sections];
  if (
    parentSectionId &&
    (!sections.some((candidate) => candidate.id === parentSectionId) ||
      isDescendantOf(sections, parentSectionId, sectionId))
  ) {
    return [...sections];
  }

  if (getParentSectionId(section) === parentSectionId) return [...sections];

  const subtreeIds = new Set([
    sectionId,
    ...getSectionDescendantIds(sections, sectionId),
  ]);
  const subtree = sections
    .filter((candidate) => subtreeIds.has(candidate.id))
    .map((candidate) =>
      candidate.id === sectionId
        ? withParentSectionId(candidate, parentSectionId)
        : candidate,
    );
  const remaining = sections.filter((candidate) => !subtreeIds.has(candidate.id));
  const insertionIndex = parentSectionId
    ? endOfSubtreeIndex(remaining, parentSectionId)
    : remaining.length;
  const next = [...remaining];
  next.splice(insertionIndex, 0, ...subtree);
  return next;
}

/** Standard outline-indent: the previous sibling becomes the new parent. */
export function indentSection(
  sections: readonly OmiSection[],
  sectionId: string,
): OmiSection[] {
  const section = sections.find((candidate) => candidate.id === sectionId);
  if (!section) return [...sections];

  const parentId = getParentSectionId(section);
  const siblings = sections.filter(
    (candidate) => getParentSectionId(candidate) === parentId,
  );
  const index = siblings.findIndex((candidate) => candidate.id === sectionId);
  const previousSibling = siblings[index - 1];
  if (!previousSibling) return [...sections];

  return reparentSection(sections, sectionId, previousSibling.id);
}

/** Standard outline-outdent: the section becomes a sibling after its parent. */
export function outdentSection(
  sections: readonly OmiSection[],
  sectionId: string,
): OmiSection[] {
  const section = sections.find((candidate) => candidate.id === sectionId);
  if (!section) return [...sections];

  const parentId = getParentSectionId(section);
  if (!parentId) return [...sections];
  const parent = sections.find((candidate) => candidate.id === parentId);
  if (!parent) return [...sections];

  const newParentId = getParentSectionId(parent);
  const reparented = reparentSection(sections, sectionId, newParentId);
  return moveSubtreeAfterSibling(reparented, sectionId, parentId);
}

export function canIndentSection(
  sections: readonly OmiSection[],
  sectionId: string,
): boolean {
  const section = sections.find((candidate) => candidate.id === sectionId);
  if (!section) return false;
  const parentId = getParentSectionId(section);
  const siblings = sections.filter(
    (candidate) => getParentSectionId(candidate) === parentId,
  );
  return siblings.findIndex((candidate) => candidate.id === sectionId) > 0;
}

export function canOutdentSection(
  sections: readonly OmiSection[],
  sectionId: string,
): boolean {
  const section = sections.find((candidate) => candidate.id === sectionId);
  return Boolean(section && getParentSectionId(section));
}

export function moveSubtreeAfterSibling(
  sections: readonly OmiSection[],
  sectionId: string,
  siblingSectionId: string,
): OmiSection[] {
  if (sectionId === siblingSectionId) return [...sections];
  const section = sections.find((candidate) => candidate.id === sectionId);
  const sibling = sections.find((candidate) => candidate.id === siblingSectionId);
  if (!section || !sibling) return [...sections];
  if (getParentSectionId(section) !== getParentSectionId(sibling)) return [...sections];

  const sourceIds = new Set([
    sectionId,
    ...getSectionDescendantIds(sections, sectionId),
  ]);
  const subtree = sections.filter((candidate) => sourceIds.has(candidate.id));
  const remaining = sections.filter((candidate) => !sourceIds.has(candidate.id));
  const insertionIndex = endOfSubtreeIndex(remaining, siblingSectionId);
  const next = [...remaining];
  next.splice(insertionIndex, 0, ...subtree);
  return next;
}

export function moveSubtreeBeforeSibling(
  sections: readonly OmiSection[],
  sectionId: string,
  siblingSectionId: string,
): OmiSection[] {
  if (sectionId === siblingSectionId) return [...sections];
  const section = sections.find((candidate) => candidate.id === sectionId);
  const sibling = sections.find((candidate) => candidate.id === siblingSectionId);
  if (!section || !sibling) return [...sections];
  if (getParentSectionId(section) !== getParentSectionId(sibling)) return [...sections];

  const sourceIds = new Set([
    sectionId,
    ...getSectionDescendantIds(sections, sectionId),
  ]);
  const subtree = sections.filter((candidate) => sourceIds.has(candidate.id));
  const remaining = sections.filter((candidate) => !sourceIds.has(candidate.id));
  const insertionIndex = remaining.findIndex((candidate) => candidate.id === siblingSectionId);
  if (insertionIndex < 0) return [...sections];
  const next = [...remaining];
  next.splice(insertionIndex, 0, ...subtree);
  return next;
}

export function sectionOrder(
  sections: readonly OmiSection[],
): string[] {
  return sections.map((section) => section.id);
}

export function sectionParentMap(
  sections: readonly OmiSection[],
): Record<string, string | null> {
  return Object.fromEntries(
    sections.map((section) => [section.id, getParentSectionId(section) ?? null]),
  );
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

export function hierarchiesAreEqual(
  first: readonly OmiSection[],
  second: readonly OmiSection[],
): boolean {
  if (!arraysHaveSameOrder(first, second)) return false;
  return first.every(
    (section, index) =>
      getParentSectionId(section) === getParentSectionId(second[index]!),
  );
}

function endOfSubtreeIndex(
  sections: readonly OmiSection[],
  sectionId: string,
): number {
  const rootIndex = sections.findIndex((section) => section.id === sectionId);
  if (rootIndex < 0) return sections.length;

  let index = rootIndex + 1;
  while (
    index < sections.length &&
    isDescendantOf(sections, sections[index]!.id, sectionId)
  ) {
    index += 1;
  }
  return index;
}

function hierarchyOrderIsValid(sections: readonly OmiSection[]): boolean {
  return validateSectionHierarchy(sections).every(
    (issue) => issue.type !== 'non-preorder',
  );
}

function resolveStudyRootId(
  section: OmiSection,
  sectionMap: ReadonlyMap<string, OmiSection>,
): string {
  let current = section;
  const visited = new Set([section.id]);

  while (true) {
    const parentId = getParentSectionId(current);
    if (!parentId) return current.id;
    if (visited.has(parentId)) return section.id;

    const parent = sectionMap.get(parentId);
    if (!parent) return section.id;
    visited.add(parentId);
    current = parent;
  }
}

function assertUniqueSectionId(
  sections: readonly OmiSection[],
  sectionId: string,
): void {
  if (sections.some((candidate) => candidate.id === sectionId)) {
    throw new Error(`Section ID already exists: ${sectionId}`);
  }
}
