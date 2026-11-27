import type { OmpMetadataSnapshot } from '../../server/src/contracts/ompMetadataContract';
import { importOjsMetadata } from '../model/ojsMetadataReconciliation';
import { extractManuscriptState } from '../model/versioning';
import { stagePendingChanges } from '../model/workingState';
import { useStudioStore } from './useStudioStore';
import type { OmiManuscript } from '../types/omi';
import type {
  OjsMetadataSnapshot,
  OjsPullMetadataField,
} from '../services/ojsMetadataTypes';

export function applyOjsMetadataImport(
  expected: OmiManuscript,
  snapshot: OjsMetadataSnapshot | OmpMetadataSnapshot,
  locale: string,
  fields: OjsPullMetadataField[],
): void {
  let changed = false;
  useStudioStore.setState((state) => {
    if (state.manuscript !== expected)
      throw new Error(
        'The OMI manuscript changed. Compare the metadata again.',
      );
    const previous = extractManuscriptState(state.manuscript);
    const next = importOjsMetadata(previous, snapshot, locale, fields);
    const changedKeys = (
      [
        'title',
        'subtitle',
        'abstract',
        'abstracts',
        'keywords',
        'keywordsByLocale',
        'metadata',
      ] as const
    ).filter(
      (key) => JSON.stringify(previous[key]) !== JSON.stringify(next[key]),
    );
    if (!changedKeys.length) return state;
    changed = true;
    const timestamp = new Date().toISOString();
    return {
      manuscript: { ...state.manuscript, ...next, updatedAt: timestamp },
      pendingChangeSet: stagePendingChanges(state.pendingChangeSet, {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: `Imported selected ${snapshot.authority} publication metadata`,
        events: changedKeys.map((key) => ({
          operation: 'manuscript.structure.set' as const,
          targetId: state.manuscript.id,
          path: `/${key}`,
          previousValue: previous[key],
          nextValue: next[key],
        })),
        timestamp,
      }),
    };
  });
  if (changed) useStudioStore.getState().checkpoint('manual');
}
