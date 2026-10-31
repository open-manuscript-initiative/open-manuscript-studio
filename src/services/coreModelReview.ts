import { validateCoreSnapshot } from '../model/coreSnapshotValidator.mjs';
import { extractManuscriptState } from '../model/versioning';
import { calculateManuscriptStateDigestValue } from '../model/stateDigest';
import type { OmiManuscript } from '../types/omi';

/** Separate experimental profile; existing OMI-SPEC-180 reports remain unchanged. */
export function runCoreModelReview(manuscript: OmiManuscript, mode: 'authoring' | 'exchange' = 'authoring') {
  const state = extractManuscriptState(manuscript);
  // Inspect the JSON value that a serializer would emit, excluding historical
  // snapshots from live identity scope. Undefined editor fields are not JSON.
  const source = JSON.parse(JSON.stringify(state));
  return { format: 'omi-studio-core-review', version: '0.1.0', experimental: true,
    createdAt: new Date().toISOString(), subject: { manuscriptId: manuscript.id, stateDigest: calculateManuscriptStateDigestValue(state) },
    result: validateCoreSnapshot(source, { mode }), conformance: 'not-assessed', independent: false };
}
export function isCoreReviewCurrent(manuscript: OmiManuscript, report: ReturnType<typeof runCoreModelReview>): boolean {
  return manuscript.id === report.subject.manuscriptId && calculateManuscriptStateDigestValue(extractManuscriptState(manuscript)) === report.subject.stateDigest;
}
