import {
  createManuscriptStateDigest,
  verifyManuscriptStateDigest,
  type OmiStateDigest,
  type OmiStateDigestVerificationStatus,
} from './stateDigest';
import type {
  OmiRevision,
  OmiRevisionHistory,
} from './versioning';
import type { OmiManuscript } from '../types/omi';

export interface OmiRevisionIntegritySummary {
  total: number;
  verified: number;
  missing: number;
  mismatch: number;
  unsupported: number;
}

export interface OmiRevisionIntegrityResult {
  revisionId: string;
  status: OmiStateDigestVerificationStatus;
  digest?: OmiStateDigest;
  actual?: string;
}

type RevisionWithDigest = OmiRevision & {
  stateDigest?: OmiStateDigest;
};

export function getRevisionStateDigest(
  revision: OmiRevision,
): OmiStateDigest | undefined {
  return (revision as RevisionWithDigest).stateDigest;
}

/**
 * Adds derived digest evidence only where it is absent.
 * Existing digest declarations are never overwritten, including mismatches.
 */
export function ensureManuscriptRevisionStateDigests(
  manuscript: OmiManuscript,
): OmiManuscript {
  let changed = false;
  const revisions = manuscript.revisionHistory.revisions.map((revision) => {
    if (getRevisionStateDigest(revision)) return revision;
    changed = true;
    return {
      ...revision,
      stateDigest: createManuscriptStateDigest(
        revision.snapshot.state,
        revision.createdAt,
      ),
    };
  });

  if (!changed) return manuscript;
  return {
    ...manuscript,
    revisionHistory: {
      ...manuscript.revisionHistory,
      revisions,
    },
  };
}

export function inspectRevisionStateIntegrity(
  revision: OmiRevision,
): OmiRevisionIntegrityResult {
  const digest = getRevisionStateDigest(revision);
  const verification = verifyManuscriptStateDigest(
    revision.snapshot.state,
    digest,
  );
  return {
    revisionId: revision.id,
    status: verification.status,
    digest,
    actual: verification.actual,
  };
}

export function inspectRevisionHistoryIntegrity(
  history: OmiRevisionHistory,
): {
  results: OmiRevisionIntegrityResult[];
  summary: OmiRevisionIntegritySummary;
} {
  const results = history.revisions.map(inspectRevisionStateIntegrity);
  const summary: OmiRevisionIntegritySummary = {
    total: results.length,
    verified: 0,
    missing: 0,
    mismatch: 0,
    unsupported: 0,
  };

  for (const result of results) {
    summary[result.status] += 1;
  }

  return { results, summary };
}

export function assertNoInvalidRevisionStateDigests(
  manuscript: OmiManuscript,
): void {
  const { results } = inspectRevisionHistoryIntegrity(
    manuscript.revisionHistory,
  );
  const invalid = results.find(
    (result) =>
      result.status === 'mismatch' ||
      result.status === 'unsupported',
  );
  if (invalid) {
    throw new Error(
      `Revision state integrity verification failed for ${invalid.revisionId} (${invalid.status}).`,
    );
  }
}
