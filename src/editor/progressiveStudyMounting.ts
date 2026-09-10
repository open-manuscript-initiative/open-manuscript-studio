import type { ManuscriptStudy } from '../model/sectionStructure';

export interface StudyMountMetrics {
  editingUnits: number;
  sections: number;
  blocks: number;
  estimatedModelBytes: number;
}

const EDITING_UNIT_THRESHOLD = 8;
const BLOCK_THRESHOLD = 600;
const MODEL_BYTES_THRESHOLD = 1_000_000;

/**
 * Enables viewport-driven editor mounting only when constructing every study
 * editor eagerly would be material work. Small documents keep the simpler
 * eager path and therefore retain their existing rendering behaviour.
 */
export function shouldProgressivelyMountStudyEditors(
  studies: readonly ManuscriptStudy[],
): boolean {
  const metrics = measureStudyMountWork(studies);
  return metrics.editingUnits >= EDITING_UNIT_THRESHOLD
    || metrics.blocks >= BLOCK_THRESHOLD
    || metrics.estimatedModelBytes >= MODEL_BYTES_THRESHOLD;
}

export function measureStudyMountWork(
  studies: readonly ManuscriptStudy[],
): StudyMountMetrics {
  let sections = 0;
  let blocks = 0;
  let estimatedModelBytes = 0;

  for (const study of studies) {
    sections += study.sections.length;
    for (const section of study.sections) {
      estimatedModelBytes += section.title.length;
      blocks += section.blocks.length;
      for (const block of section.blocks) {
        estimatedModelBytes += block.content.length;
        estimatedModelBytes += estimateJsonValueBytes(block.visual);
      }
    }
  }

  return {
    editingUnits: studies.length,
    sections,
    blocks,
    estimatedModelBytes,
  };
}

/**
 * Reserves approximately the study's eventual document-flow height so that a
 * deferred editor does not collapse the scrollbar before it enters the
 * viewport. The estimate is intentionally bounded; it is a navigation aid,
 * not pagination data.
 */
export function estimateDeferredStudyHeight(study: ManuscriptStudy): number {
  let textBytes = 0;
  let visualBlocks = 0;
  let blocks = 0;

  for (const section of study.sections) {
    textBytes += section.title.length;
    for (const block of section.blocks) {
      blocks += 1;
      textBytes += block.content.length;
      if (block.visual) visualBlocks += 1;
    }
  }

  const estimatedTextLines = Math.ceil(textBytes / 105);
  return clamp(
    240,
    120_000,
    120 + estimatedTextLines * 29 + blocks * 10 + visualBlocks * 260,
  );
}

function estimateJsonValueBytes(value: unknown): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'string') return value.length;
  if (typeof value === 'number' || typeof value === 'boolean') return 8;
  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + estimateJsonValueBytes(item), 0);
  }
  if (typeof value === 'object') {
    return Object.entries(value).reduce(
      (total, [key, item]) => total + key.length + estimateJsonValueBytes(item),
      0,
    );
  }
  return 0;
}

function clamp(minimum: number, maximum: number, value: number): number {
  return Math.max(minimum, Math.min(maximum, Math.round(value)));
}
