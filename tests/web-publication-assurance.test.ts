import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createAccountHolderApprovedAssurance,
  createStudioReviewedAssurance,
  webPublicationIdempotencyKey,
} from '../src/integrations/webPublicationContract.ts';
import {
  createInitialVersioningEnvelope,
  extractManuscriptState,
} from '../src/model/versioning.ts';
import { verifyPublicationBuildArtifact } from '../src/services/publicationBuildManifest.ts';
import { prepareWebPublicationArtifact } from '../src/services/webPublicationArtifact.ts';
import { createHtmlGalleyStudy } from './fixtures/htmlGalleyStudy.ts';

const editorialEvidenceBase = {
  type: 'studio-editorial-decision' as const,
  decisionId: '4c8140f0-57e5-41ff-b9f4-ebdd5262a931',
  evidenceDigest: '7'.repeat(64),
  reviewRound: 2,
  decidedAt: '2026-09-22T08:00:00.000Z',
};

test('unreviewed web publication carries a visible and machine-readable disclosure', async () => {
  const artifact = await prepareWebPublicationArtifact(
    createCommittedHtmlGalleyStudy(),
    createAccountHolderApprovedAssurance('popular-science'),
  );

  assert.equal(artifact.assurance.reviewStatus, 'not-peer-reviewed');
  assert.match(artifact.publicationContentDigest, /^[a-f0-9]{64}$/);
  assert.match(artifact.html, /<meta name="omi-review-status" content="not-peer-reviewed">/);
  assert.match(artifact.html, /data-omi-review-status="not-peer-reviewed"/);
  assert.match(artifact.html, /data-omi-assurance-version="1"/);
  assert.match(artifact.html, />OMI\nPEER REVIEW\nNOT VERIFIED</);
  assert.match(artifact.html, /border-radius:50%/);
  assert.match(artifact.html, /nincs igazolt tudományos lektorálás/);
  assert.doesNotMatch(artifact.html, /omi-editorial-decision-id/);
  assert.equal(verifyPublicationBuildArtifact(artifact.build, artifact.html), true);
});

test('peer-reviewed seal carries only revision-bound editorial evidence, never reviewer identity', async () => {
  const manuscript = createCommittedHtmlGalleyStudy();
  const unreviewed = await prepareWebPublicationArtifact(
    manuscript,
    createAccountHolderApprovedAssurance('scholarly-article'),
  );
  const editorialEvidence = {
    ...editorialEvidenceBase,
    publicationContentDigest: unreviewed.publicationContentDigest,
  };
  const artifact = await prepareWebPublicationArtifact(
    manuscript,
    createStudioReviewedAssurance('scholarly-article', editorialEvidence),
  );

  assert.equal(artifact.assurance.reviewStatus, 'peer-reviewed');
  assert.equal(artifact.publicationContentDigest, editorialEvidence.publicationContentDigest);
  assert.match(artifact.html, /<meta name="omi-review-status" content="peer-reviewed">/);
  assert.match(artifact.html, /data-omi-review-status="peer-reviewed"/);
  assert.match(artifact.html, />OMI\nPEER REVIEW\nVERIFIED</);
  assert.match(artifact.html, new RegExp(editorialEvidence.decisionId));
  assert.match(artifact.html, new RegExp(editorialEvidence.evidenceDigest));
  assert.doesNotMatch(artifact.html, /reviewer(?:Name|Email|UserId)/i);
  assert.equal(verifyPublicationBuildArtifact(artifact.build, artifact.html), true);
});

test('peer-reviewed assurance cannot be reused after publication content changes', async () => {
  const manuscript = createCommittedHtmlGalleyStudy();
  const unreviewed = await prepareWebPublicationArtifact(
    manuscript,
    createAccountHolderApprovedAssurance('scholarly-article'),
  );
  const evidence = {
    ...editorialEvidenceBase,
    publicationContentDigest: unreviewed.publicationContentDigest,
  };
  const changed = createCommittedHtmlGalleyStudy(' changed after acceptance');

  await assert.rejects(
    prepareWebPublicationArtifact(
      changed,
      createStudioReviewedAssurance('scholarly-article', evidence),
    ),
    /different publication content/i,
  );
});

test('review assurance changes the artifact and delivery idempotency identity', async () => {
  const manuscript = createCommittedHtmlGalleyStudy();
  const unreviewed = await prepareWebPublicationArtifact(
    manuscript,
    createAccountHolderApprovedAssurance('scholarly-article'),
  );
  const editorialEvidence = {
    ...editorialEvidenceBase,
    publicationContentDigest: unreviewed.publicationContentDigest,
  };
  const reviewed = await prepareWebPublicationArtifact(
    manuscript,
    createStudioReviewedAssurance('scholarly-article', editorialEvidence),
  );
  const common = {
    connectionId: 'e617bf0c-8670-4d50-aa07-e1cf79d96bf2',
    connectionVersion: '2026-09-22T08:00:00.000Z',
    status: 'publish' as const,
  };

  assert.notEqual(unreviewed.build.id, reviewed.build.id);
  assert.notEqual(
    webPublicationIdempotencyKey({
      ...common,
      buildId: unreviewed.build.id,
      assurance: unreviewed.assurance,
    }),
    webPublicationIdempotencyKey({
      ...common,
      buildId: reviewed.build.id,
      assurance: reviewed.assurance,
    }),
  );
  assert.notEqual(
    webPublicationIdempotencyKey({
      ...common,
      buildId: reviewed.build.id,
      assurance: reviewed.assurance,
    }),
    webPublicationIdempotencyKey({
      ...common,
      connectionVersion: '2026-09-22T08:01:00.000Z',
      buildId: reviewed.build.id,
      assurance: reviewed.assurance,
    }),
  );
});

function createCommittedHtmlGalleyStudy(titleSuffix = '') {
  const draft = createHtmlGalleyStudy();
  draft.title = `${draft.title}${titleSuffix}`;
  const state = extractManuscriptState(draft);
  return {
    ...state,
    ...createInitialVersioningEnvelope(state, {
      summary: 'Created synthetic web-publication fixture',
      timestamp: state.updatedAt,
      completeness: 'complete',
    }),
  };
}
