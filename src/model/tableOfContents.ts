export interface OmiTableOfContents {
  id: string;
  title?: string;
  minLevel: number;
  maxLevel: number;
  hyperlinks: boolean;
  useOutlineLevels: boolean;
  source?: {
    format: 'docx-toc' | 'manual' | string;
    instruction?: string;
  };
}

export interface TableOfContentsEntry {
  sectionId: string;
  title: string;
  level: number;
}

export function buildTableOfContentsEntries(
  sections: readonly { id: string; title: string }[],
  toc: OmiTableOfContents,
): TableOfContentsEntry[] {
  const parentById = new Map<string, string | undefined>();
  for (const section of sections) {
    parentById.set(section.id, readParentSectionId(section));
  }

  const depthCache = new Map<string, number>();
  const depthOf = (sectionId: string): number => {
    const cached = depthCache.get(sectionId);
    if (cached) return cached;
    let depth = 1;
    let parentId = parentById.get(sectionId);
    const seen = new Set<string>([sectionId]);
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      depth += 1;
      parentId = parentById.get(parentId);
    }
    depthCache.set(sectionId, depth);
    return depth;
  };

  return sections
    .map((section) => ({
      sectionId: section.id,
      title: section.title,
      level: depthOf(section.id),
    }))
    .filter((entry) => entry.level >= toc.minLevel && entry.level <= toc.maxLevel);
}

function readParentSectionId(section: { id: string }): string | undefined {
  const candidate = section as { parentSectionId?: unknown };
  return typeof candidate.parentSectionId === 'string' && candidate.parentSectionId
    ? candidate.parentSectionId
    : undefined;
}

declare module '../types/omi' {
  interface OmiManuscriptState {
    /** Semantic generated table of contents, including imported Word TOC fields. */
    tableOfContents?: OmiTableOfContents;
  }
}
