import { getDocumentStructureProfile, type OmiBackMatterPlacement } from './documentProfile';
import { partitionManuscriptStudies } from './sectionStructure';
import type { OmiManuscriptState, OmiSection } from '../types/omi';

export interface OmiBackMatterGroup {
  id: string;
  title: string;
  rootSectionId?: string;
  sections: OmiSection[];
  bibliographicRecordIds: string[];
}

export function buildBackMatterGroups(
  manuscript: OmiManuscriptState,
  placement: OmiBackMatterPlacement,
): OmiBackMatterGroup[] {
  if (placement === 'volume-end') {
    return [{
      id: 'volume',
      title: manuscript.title,
      sections: [...manuscript.sections],
      bibliographicRecordIds: citedRecordsForSections(manuscript, manuscript.sections),
    }];
  }

  return partitionManuscriptStudies(manuscript.sections).map((study) => {
    const root = study.sections.find((section) => section.id === study.rootSectionId);
    return {
      id: study.rootSectionId,
      title: root?.title ?? '',
      rootSectionId: study.rootSectionId,
      sections: [...study.sections],
      bibliographicRecordIds: citedRecordsForSections(manuscript, study.sections),
    };
  });
}

export function buildReferencePlacementGroups(
  manuscript: OmiManuscriptState,
): OmiBackMatterGroup[] {
  return buildBackMatterGroups(
    manuscript,
    getDocumentStructureProfile(manuscript).referencesPlacement,
  );
}

export function buildListPlacementGroups(
  manuscript: OmiManuscriptState,
): OmiBackMatterGroup[] {
  return buildBackMatterGroups(
    manuscript,
    getDocumentStructureProfile(manuscript).listsPlacement,
  );
}

function citedRecordsForSections(
  manuscript: OmiManuscriptState,
  sections: readonly OmiSection[],
): string[] {
  const blockIds = new Set(
    sections.flatMap((section) => flattenBlocks(section.blocks).map((block) => block.id)),
  );
  const seen = new Set<string>();
  const result: string[] = [];

  for (const citation of manuscript.citations ?? []) {
    if (!blockIds.has(citation.targetBlockId) || seen.has(citation.target)) continue;
    seen.add(citation.target);
    result.push(citation.target);
  }

  for (const annotation of manuscript.annotations ?? []) {
    if (!blockIds.has(annotation.targetBlockId)) continue;
    for (const citation of annotation.noteCitations ?? []) {
      if (seen.has(citation.target)) continue;
      seen.add(citation.target);
      result.push(citation.target);
    }
  }

  return result;
}

function flattenBlocks<T extends { children?: T[] }>(blocks: readonly T[]): T[] {
  return blocks.flatMap((block) => [block, ...flattenBlocks(block.children ?? [])]);
}
