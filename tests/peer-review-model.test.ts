import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  createPeerReviewAssignment,
  createPeerReviewFeedback,
  getPeerReviewIdentityPolicy,
  toAuthorVisibleReview,
  toEditorVisibleReview,
  toReviewerVisibleReview,
} from '../src/model/peerReview.ts';

const reviewPortalSource = readFileSync(
  new URL('../src/components/ReviewPortal.tsx', import.meta.url),
  'utf8',
);
const reviewModeSource = readFileSync(
  new URL('../src/components/ReviewMode.tsx', import.meta.url),
  'utf8',
);
const reviewSnapshotSource = readFileSync(
  new URL('../server/src/integrations/ojs/reviewSnapshot.ts', import.meta.url),
  'utf8',
);
const reviewManuscriptServiceSource = readFileSync(
  new URL('../server/src/services/reviewManuscriptService.ts', import.meta.url),
  'utf8',
);
const ojsVerifierSource = readFileSync(
  new URL('../server/src/integrations/ojs/launchVerifier.ts', import.meta.url),
  'utf8',
);
const ojsClientSource = readFileSync(
  new URL('../server/src/integrations/ojs/ojsClient.ts', import.meta.url),
  'utf8',
);
const ompVerifierSource = readFileSync(
  new URL('../server/src/integrations/omp/launchVerifier.ts', import.meta.url),
  'utf8',
);
const ompClientSource = readFileSync(
  new URL('../server/src/integrations/omp/ompClient.ts', import.meta.url),
  'utf8',
);
const ompReviewRouteSource = readFileSync(
  new URL('../server/src/routes/ompReviewRoutes.ts', import.meta.url),
  'utf8',
);

test('creates double-blind review assignments by default', () => {
  const review = createPeerReviewAssignment(
    {
      workspaceId: 'workspace-1',
      manuscriptId: 'manuscript-1',
      reviewerUserId: 'reviewer-user-1',
      assignedByUserId: 'editor-user-1',
      reviewerAlias: 'Reviewer 1',
    },
    'review-1',
  );

  assert.equal(review.id, 'review-1');
  assert.equal(review.status, 'invited');
  assert.equal(review.anonymityMode, 'double_blind');
  assert.equal(review.reviewRound, 1);
  assert.equal(review.reviewerAlias, 'Reviewer 1');
});

test('author projection hides reviewer and editor account identifiers', () => {
  const review = createPeerReviewAssignment(
    {
      workspaceId: 'workspace-1',
      manuscriptId: 'manuscript-1',
      reviewerUserId: 'reviewer-user-1',
      assignedByUserId: 'editor-user-1',
      reviewerAlias: 'Reviewer 1',
    },
    'review-1',
  );

  review.feedback = [
    createPeerReviewFeedback(
      {
        assignmentId: review.id,
        visibility: 'author_and_editor',
        body: 'Please clarify the method section.',
      },
      'feedback-public',
    ),
    createPeerReviewFeedback(
      {
        assignmentId: review.id,
        visibility: 'editor_only',
        body: 'Confidential note for the editor.',
      },
      'feedback-private',
    ),
  ];

  const authorView = toAuthorVisibleReview(review);
  const serialized = JSON.stringify(authorView);

  assert.equal('reviewerUserId' in authorView, false);
  assert.equal('assignedByUserId' in authorView, false);
  assert.equal(serialized.includes('reviewer-user-1'), false);
  assert.equal(serialized.includes('editor-user-1'), false);
  assert.equal(serialized.includes('Confidential note for the editor.'), false);
  assert.deepEqual(
    authorView.feedback.map((item) => item.id),
    ['feedback-public'],
  );
});

test('reviewer projection contains no author identity fields', () => {
  const review = createPeerReviewAssignment(
    {
      workspaceId: 'workspace-1',
      manuscriptId: 'manuscript-1',
      reviewerUserId: 'reviewer-user-1',
      assignedByUserId: 'editor-user-1',
      reviewerAlias: 'Reviewer 1',
    },
    'review-1',
  );

  const reviewerView = toReviewerVisibleReview(review);

  assert.equal('authorUserId' in reviewerView, false);
  assert.equal('authorProfile' in reviewerView, false);
  assert.equal('workspaceMembers' in reviewerView, false);
});

test('editor projection retains privileged reviewer identity', () => {
  const review = createPeerReviewAssignment(
    {
      workspaceId: 'workspace-1',
      manuscriptId: 'manuscript-1',
      reviewerUserId: 'reviewer-user-1',
      assignedByUserId: 'editor-user-1',
      reviewerAlias: 'Reviewer 1',
    },
    'review-1',
  );

  const editorView = toEditorVisibleReview(review);

  assert.equal(editorView.reviewerUserId, 'reviewer-user-1');
  assert.equal(editorView.assignedByUserId, 'editor-user-1');
});

test('double-blind identity policy hides each side from the other', () => {
  assert.deepEqual(
    getPeerReviewIdentityPolicy('reviewer', 'double_blind'),
    {
      canSeeAuthorIdentity: false,
      canSeeReviewerIdentity: true,
    },
  );

  assert.deepEqual(
    getPeerReviewIdentityPolicy('co-author', 'double_blind'),
    {
      canSeeAuthorIdentity: true,
      canSeeReviewerIdentity: false,
    },
  );

  assert.deepEqual(
    getPeerReviewIdentityPolicy('editor', 'double_blind'),
    {
      canSeeAuthorIdentity: true,
      canSeeReviewerIdentity: true,
    },
  );
});

test('an external reviewer launch remains scoped to its one verified assignment', () => {
  assert.match(reviewPortalSource, /url\.searchParams\.set\('reviewAssignment', claimedAssignmentId\)/);
  assert.match(reviewPortalSource, /<ReviewMode assignmentId=\{externalAssignmentId\}/);
  assert.match(reviewModeSource, /assignmentId\s*\? \[await getAssignedReview\(assignmentId\)\]/);
  assert.match(reviewModeSource, /review-mode__layout--single/);
});

test('review snapshots are an anonymous article-only projection', () => {
  assert.match(reviewSnapshotSource, /documentKind: 'article'/);
  assert.match(reviewSnapshotSource, /authorIdentity: 'hidden'/);
  assert.doesNotMatch(reviewSnapshotSource, /fileName: item\.fileName/);
  assert.match(reviewManuscriptServiceSource, /documentKind: 'article'/);
  assert.match(reviewManuscriptServiceSource, /authorIdentity: 'hidden'/);
  assert.doesNotMatch(reviewManuscriptServiceSource, /fileName\?: string/);
  assert.match(reviewManuscriptServiceSource, /anonymityMode: 'DOUBLE_BLIND'/);
  assert.match(ojsVerifierSource, /REVIEWER_FORBIDDEN_SCOPES[\s\S]*'contributors\.read'/);
  assert.match(ojsClientSource, /const hasContributorScope = !reviewerMode/);
  assert.match(reviewModeSource, /manuscript: 'Cikk'/);
});

test('OMP reviewer access is bound to the assigned study instead of its parent monograph', () => {
  assert.match(ompVerifierSource, /OMP reviewer launch does not identify the assigned study/);
  assert.match(ompVerifierSource, /'contributors\.read'/);
  assert.match(ompVerifierSource, /'review\.files\.read'/);
  assert.match(ompClientSource, /fileComponentExternalId/);
  assert.match(ompClientSource, /reviewerMode \? claims\.component\?\.externalId/);
  assert.match(ompReviewRouteSource, /reviewDocumentId: componentId/);
  assert.match(ompReviewRouteSource, /platform: 'omp'/);
  assert.match(ompReviewRouteSource, /includeSubmissionMetadata: false/);
  assert.match(ompReviewRouteSource, /setReviewManuscriptFromOjs\(assignment\.id, componentId, snapshot\)/);
});
