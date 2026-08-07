import { useStudioStore } from './useStudioStore';
import { ensureManuscriptRevisionStateDigests } from '../model/revisionIntegrity';

let initialized = false;

/**
 * Enriches newly committed revisions with derived state digests without
 * creating another scholarly revision. The digest is integrity evidence about
 * an immutable snapshot, not a manuscript edit.
 */
export function initializeRevisionIntegrity(): void {
  if (initialized) return;
  initialized = true;

  enrichCurrentManuscript();
  useStudioStore.subscribe((state, previous) => {
    if (state.manuscript === previous.manuscript) return;
    enrichCurrentManuscript();
  });
}

function enrichCurrentManuscript(): void {
  const current = useStudioStore.getState().manuscript;
  const enriched = ensureManuscriptRevisionStateDigests(current);
  if (enriched === current) return;
  useStudioStore.setState({ manuscript: enriched });
}
