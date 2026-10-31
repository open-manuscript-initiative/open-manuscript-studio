import type { OmiSection } from '../types/omi';
import { walkManuscriptStructure } from './manuscriptTreeTraversal';

/**
 * Record every derived citation-label change in the revision event log,
 * including edits inside embedded sections and child blocks. Author text is
 * never modified by this projection: callers compare old and new snapshots.
 */
export function collectCitationBlockContentChanges(
  previousSections: readonly OmiSection[],
  nextSections: readonly OmiSection[],
): Array<{
  operation: 'block.content.set';
  targetId: string;
  path: string;
  previousValue: string;
  nextValue: string;
}> {
  const previous = new Map<string, string>();
  for (const entry of walkManuscriptStructure(previousSections)) {
    if (entry.kind === 'block') previous.set(entry.block.id, entry.block.content);
  }
  const changes: ReturnType<typeof collectCitationBlockContentChanges> = [];
  for (const entry of walkManuscriptStructure(nextSections)) {
    if (entry.kind !== 'block') continue;
    const oldContent = previous.get(entry.block.id);
    if (oldContent === undefined || oldContent === entry.block.content) continue;
    changes.push({
      operation: 'block.content.set',
      targetId: entry.block.id,
      path: `/blocks/${entry.block.id}/content`,
      previousValue: oldContent,
      nextValue: entry.block.content,
    });
  }
  return changes;
}
