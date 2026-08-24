import { getSectionDepth } from './sectionStructure';
import type { OmiSection } from '../types/omi';

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
  sections: readonly OmiSection[],
  toc: OmiTableOfContents,
): TableOfContentsEntry[] {
  return sections
    .map((section) => ({
      sectionId: section.id,
      title: section.title,
      level: getSectionDepth(sections, section.id) + 1,
    }))
    .filter(
      (entry) =>
        entry.title.trim() &&
        entry.level >= toc.minLevel &&
        entry.level <= toc.maxLevel,
    );
}

declare module '../types/omi' {
  interface OmiManuscriptState {
    /** Semantic generated table of contents, including imported Word TOC fields. */
    tableOfContents?: OmiTableOfContents;
  }
}
