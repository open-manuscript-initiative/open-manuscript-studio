import { readOmpVolumeOrigin } from './ompVolumeOrigin';
import type { OmiManuscriptState } from '../types/omi';
import { partitionManuscriptStudies } from './sectionStructure';
export interface OmpChapterTransferTarget {
  rootSectionId: string; title: string; installationId: string; contextId: number;
  submissionId: number; publicationId: number; chapterId: number; sourceChapterId: number | null;
}
type Data = Record<string, unknown>;
function object(value: unknown): Data {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid OMP volume provenance.');
  return value as Data;
}
function identifier(value: unknown): number {
  if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error('Invalid OMP identity.');
  return Number(value);
}
/** No inferred mappings for a single complete manuscript. Only exact chapter provenance. */
export function listOmpChapterTransferTargets(state: OmiManuscriptState): OmpChapterTransferTarget[] {
  const raw = readOmpVolumeOrigin(state);
  if (!raw) return [];
  const origin = object(raw);
  if (origin.version !== 1 || typeof origin.installationId !== 'string' || !origin.installationId.trim() ||
      !Array.isArray(origin.chapters) || !Array.isArray(origin.mappings)) throw new Error('Invalid OMP volume provenance.');
  if (origin.mode !== 'chapters') return [];
  const publicationId = identifier(origin.publicationExternalId), submissionId = identifier(origin.submissionExternalId);
  const contextId = identifier(origin.contextExternalId);
  const chapters = new Map<number, Data>();
  for (const value of origin.chapters) {
    const chapter = object(value), id = identifier(chapter.externalId);
    if (chapters.has(id) || identifier(chapter.publicationExternalId) !== publicationId) throw new Error('Ambiguous OMP chapter version.');
    chapters.set(id, chapter);
  }
  const roots = new Map<string, OmpChapterTransferTarget>(), used = new Set<number>();
  for (const value of origin.mappings) {
    const mapping = object(value), chapterId = identifier(mapping.chapterExternalId), root = mapping.rootSectionId;
    const chapter = chapters.get(chapterId);
    if (!chapter || typeof root !== 'string' || !root || roots.has(root) || used.has(chapterId)) throw new Error('Ambiguous OMP chapter mapping.');
    used.add(chapterId);
    roots.set(root, { rootSectionId: root, title: '', installationId: origin.installationId,
      contextId, submissionId, publicationId, chapterId,
      sourceChapterId: chapter.sourceChapterId == null ? null : identifier(chapter.sourceChapterId) });
  }
  return partitionManuscriptStudies(state.sections).flatMap(study => {
    const target = roots.get(study.rootSectionId);
    return target ? [{ ...target, title: study.sections.find(section => section.id === study.rootSectionId)?.title ?? '' }] : [];
  });
}
