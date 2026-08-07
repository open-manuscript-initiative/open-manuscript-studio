import type { IdentityMigratedManuscript } from './migrateIdentityModel';
import {
  OMI_VERSIONING_MODEL_VERSION,
  createInitialVersioningEnvelope,
  isValidLinearRevisionHistory,
} from '../model/versioning';
import { ensureManuscriptRevisionStateDigests } from '../model/revisionIntegrity';
import type {
  OmiManuscript,
  OmiManuscriptState,
} from '../types/omi';

/**
 * Adds the OMI-SPEC-160 Core Revision History envelope to manuscripts that
 * previously exposed only mutable state and timestamps.
 *
 * Existing valid linear histories are retained. Timestamp-only documents are
 * represented as one disclosed shallow root snapshot; the migration does not
 * invent unobserved earlier revisions or authorship.
 *
 * Missing state digests are derived from immutable snapshots. Existing digest
 * declarations are never overwritten, so mismatches remain detectable.
 */
export function migrateVersioningModel(
  manuscript: IdentityMigratedManuscript,
): OmiManuscript {
  const state = extractState(manuscript);
  const existingHistory = manuscript.revisionHistory;

  if (
    existingHistory &&
    isValidLinearRevisionHistory(existingHistory)
  ) {
    return ensureManuscriptRevisionStateDigests({
      ...state,
      versioningModelVersion: OMI_VERSIONING_MODEL_VERSION,
      headRevisionId: existingHistory.headRevisionId,
      revisionHistory: existingHistory,
    });
  }

  return ensureManuscriptRevisionStateDigests({
    ...state,
    ...createInitialVersioningEnvelope(state, {
      summary: 'Imported legacy manuscript snapshot',
      timestamp: state.updatedAt || new Date().toISOString(),
      completeness: 'shallow',
    }),
  });
}

function extractState(
  manuscript: IdentityMigratedManuscript,
): OmiManuscriptState {
  const {
    versioningModelVersion: _versioningModelVersion,
    headRevisionId: _headRevisionId,
    revisionHistory: _revisionHistory,
    ...state
  } = manuscript;
  const portableState: OmiManuscriptState = {
    ...state,
  };

  delete portableState.authors;

  return portableState;
}
