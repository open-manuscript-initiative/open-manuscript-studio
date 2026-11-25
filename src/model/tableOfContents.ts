import { getSectionDepth } from './sectionStructure';
import type { OmiSection } from '../types/omi';

export interface OmiTableOfContents {
  id: string;
  title?: string;
  minLevel: number;
  maxLevel: number;
  hyperlinks: boolean;
  useOutlineLevels: boolean;
  /** Omit all page numbers in the native Word TOC, when explicitly requested. */
  omitPageNumbers?: boolean;
  source?: {
    format: 'docx-toc' | 'manual' | string;
    instruction?: string;
    /** OMI navigation stays clickable even when the original Word field was not. */
    wordHyperlinks?: boolean;
  };
}

/** Rebuild only supported switches; never replay arbitrary source instructions. */
export function wordTocInstruction(toc:OmiTableOfContents):string|undefined{
  const min=toc.minLevel,max=toc.maxLevel;
  if(!Number.isInteger(min)||!Number.isInteger(max)||min<1||max>9||min>max)return undefined;
  const links=toc.source?.format==='docx-toc'&&typeof toc.source.wordHyperlinks==='boolean'?toc.source.wordHyperlinks:toc.hyperlinks;
  return ' TOC \\o "'+min+'-'+max+'"'+(links?' \\h':'')+(toc.useOutlineLevels?' \\u':'')+(toc.omitPageNumbers?' \\n':'')+' ';
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
