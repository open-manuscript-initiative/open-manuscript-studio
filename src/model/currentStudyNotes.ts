import type {
  OmiAnnotation,
  OmiBlock,
  OmiManuscriptState,
} from '../types/omi';
import { getDocumentStructureProfile } from './documentProfile';
import {
  buildNoteNumberMap,
  collectNoteAnchors,
  isNoteAnnotation,
  sortNotesByDocumentOrder,
} from './notes';
import {
  partitionManuscriptStudies,
  type ManuscriptStudy,
} from './sectionStructure';

export interface CurrentStudyNotes {
  study: ManuscriptStudy;
  notes: OmiAnnotation[];
}

export interface StudyNoteOverview {
  notes: OmiAnnotation[];
  numberByNoteId: Map<string, number>;
}

/**
 * Resolves the independently edited study or chapter that owns the current
 * selection. Standalone studies deliberately use one document-wide unit.
 */
export function resolveCurrentStudy(
  manuscript: OmiManuscriptState,
  selectedSectionId: string | null,
): ManuscriptStudy | null {
  if (manuscript.sections.length === 0) return null;

  const structure = getDocumentStructureProfile(manuscript);
  if (structure.kind === 'study') {
    return {
      rootSectionId: manuscript.sections[0]!.id,
      sections: manuscript.sections,
    };
  }

  const studies = partitionManuscriptStudies(manuscript.sections);
  return studies.find((study) =>
    study.sections.some((section) => section.id === selectedSectionId),
  ) ?? studies[0] ?? null;
}

/** Returns every semantic note anchored in the supplied study subtree. */
export function collectStudyNotes(
  manuscript: OmiManuscriptState,
  study: ManuscriptStudy,
): OmiAnnotation[] {
  return collectStudyNoteOverview(manuscript, study).notes;
}

/** Builds ordered rows and display numbers from one anchor traversal. */
export function collectStudyNoteOverview(
  manuscript: OmiManuscriptState,
  study: ManuscriptStudy,
): StudyNoteOverview {
  const blockIds = collectStudyBlockIds(study);
  const occurrences = collectNoteAnchors(manuscript);

  return {
    notes: sortNotesByDocumentOrder(manuscript, occurrences).filter((note) =>
      blockIds.has(note.targetBlockId),
    ),
    numberByNoteId: buildNoteNumberMap(manuscript, occurrences),
  };
}

/** Counts current-study notes without parsing every rich-text anchor. */
export function countStudyNotes(
  manuscript: Pick<OmiManuscriptState, 'annotations'>,
  study: ManuscriptStudy,
): number {
  const blockIds = collectStudyBlockIds(study);
  return manuscript.annotations.filter(
    (annotation) =>
      isNoteAnnotation(annotation) && blockIds.has(annotation.targetBlockId),
  ).length;
}

export function getCurrentStudyNotes(
  manuscript: OmiManuscriptState,
  selectedSectionId: string | null,
): CurrentStudyNotes | null {
  const study = resolveCurrentStudy(manuscript, selectedSectionId);
  return study
    ? { study, notes: collectStudyNotes(manuscript, study) }
    : null;
}

function collectBlockIds(block: OmiBlock, result: Set<string>): void {
  result.add(block.id);
  for (const child of block.children ?? []) collectBlockIds(child, result);
}

function collectStudyBlockIds(study: ManuscriptStudy): Set<string> {
  const result = new Set<string>();
  for (const section of study.sections) {
    for (const block of section.blocks) collectBlockIds(block, result);
  }
  return result;
}
