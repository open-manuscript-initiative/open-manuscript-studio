import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createPeerReviewAssignment,
  createPeerReviewFeedback,
  getPeerReviewIdentityPolicy,
  toAuthorVisibleReview,
  toEditorVisibleReview,
  toReviewerVisibleReview,
} from '../src/model/peerReview.ts';

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
