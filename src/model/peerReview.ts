import type { UserId } from './user';
import type { WorkspaceId, WorkspaceRole } from './workspace';

/**
 * Open Manuscript Studio
 * Peer review domain model
 *
 * The central rule of this module is that double-blind review identities are
 * separated from the representations shown to authors and reviewers. UI code
 * should consume the role-specific projections below rather than exposing the
 * persistence object directly.
 */

export type PeerReviewId = string;
export type PeerReviewFeedbackId = string;

export type ReviewStatus =
  | 'invited'
  | 'accepted'
  | 'declined'
  | 'in_progress'
  | 'submitted'
  | 'completed';

export type ReviewRecommendation =
  | 'accept'
  | 'minor_revision'
  | 'major_revision'
  | 'reject';

export type ReviewAnonymityMode =
  | 'double_blind'
  | 'single_blind'
  | 'open';

export type ReviewFeedbackVisibility =
  | 'author_and_editor'
  | 'editor_only';

export interface PeerReviewFeedback {
  id: PeerReviewFeedbackId;
  assignmentId: PeerReviewId;
  visibility: ReviewFeedbackVisibility;
  body: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Internal review assignment.
 *
 * reviewerUserId and assignedByUserId are privileged identity fields. Never
 * serialize this object directly to author-facing API responses.
 */
export interface PeerReviewAssignment {
  id: PeerReviewId;
  workspaceId: WorkspaceId;
  manuscriptId: string;
  reviewerUserId: UserId;
  assignedByUserId: UserId;
  reviewerAlias: string;
  reviewRound: number;
  anonymityMode: ReviewAnonymityMode;
  status: ReviewStatus;
  recommendation?: ReviewRecommendation;
  feedback: PeerReviewFeedback[];
  invitedAt: string;
  acceptedAt?: string;
  submittedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePeerReviewAssignmentInput {
  workspaceId: WorkspaceId;
  manuscriptId: string;
  reviewerUserId: UserId;
  assignedByUserId: UserId;
  reviewerAlias: string;
  reviewRound?: number;
  anonymityMode?: ReviewAnonymityMode;
}

export interface CreatePeerReviewFeedbackInput {
  assignmentId: PeerReviewId;
  visibility: ReviewFeedbackVisibility;
  body: string;
}

/**
 * Safe representation returned to a manuscript author.
 *
 * The reviewer account identifier and editor assignment identifier are
 * deliberately absent. Only feedback explicitly intended for the author is
 * included.
 */
export interface AuthorVisibleReview {
  id: PeerReviewId;
  workspaceId: WorkspaceId;
  manuscriptId: string;
  reviewerAlias: string;
  reviewRound: number;
  status: ReviewStatus;
  recommendation?: ReviewRecommendation;
  feedback: PeerReviewFeedback[];
  submittedAt?: string;
  completedAt?: string;
}

/**
 * Safe representation returned to the assigned reviewer.
 *
 * It contains no author identity. Author profile data must be obtained through
 * a separate reviewer-safe manuscript projection, never through the normal
 * workspace member list.
 */
export interface ReviewerVisibleReview {
  id: PeerReviewId;
  workspaceId: WorkspaceId;
  manuscriptId: string;
  reviewerAlias: string;
  reviewRound: number;
  anonymityMode: ReviewAnonymityMode;
  status: ReviewStatus;
  recommendation?: ReviewRecommendation;
  feedback: PeerReviewFeedback[];
  invitedAt: string;
  acceptedAt?: string;
  submittedAt?: string;
}

/**
 * Full representation for editors/owners who administer the review process.
 */
export type EditorVisibleReview = PeerReviewAssignment;

export interface PeerReviewIdentityPolicy {
  canSeeAuthorIdentity: boolean;
  canSeeReviewerIdentity: boolean;
}

export function createPeerReviewAssignment(
  input: CreatePeerReviewAssignmentInput,
  id: PeerReviewId = crypto.randomUUID(),
): PeerReviewAssignment {
  const workspaceId = input.workspaceId.trim();
  const manuscriptId = input.manuscriptId.trim();
  const reviewerUserId = input.reviewerUserId.trim();
  const assignedByUserId = input.assignedByUserId.trim();
  const reviewerAlias = input.reviewerAlias.trim();
  const reviewRound = input.reviewRound ?? 1;

  if (!workspaceId) {
    throw new Error('The workspace identifier is required.');
  }

  if (!manuscriptId) {
    throw new Error('The manuscript identifier is required.');
  }

  if (!reviewerUserId) {
    throw new Error('The reviewer user identifier is required.');
  }

  if (!assignedByUserId) {
    throw new Error('The assigning editor identifier is required.');
  }

  if (!reviewerAlias) {
    throw new Error('The reviewer alias is required.');
  }

  if (!Number.isInteger(reviewRound) || reviewRound < 1) {
    throw new Error('The review round must be a positive integer.');
  }

  const timestamp = new Date().toISOString();

  return {
    id,
    workspaceId,
    manuscriptId,
    reviewerUserId,
    assignedByUserId,
    reviewerAlias,
    reviewRound,
    anonymityMode: input.anonymityMode ?? 'double_blind',
    status: 'invited',
    feedback: [],
    invitedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createPeerReviewFeedback(
  input: CreatePeerReviewFeedbackInput,
  id: PeerReviewFeedbackId = crypto.randomUUID(),
): PeerReviewFeedback {
  const body = input.body.trim();

  if (!input.assignmentId.trim()) {
    throw new Error('The peer review assignment identifier is required.');
  }

  if (!body) {
    throw new Error('Review feedback cannot be empty.');
  }

  const timestamp = new Date().toISOString();

  return {
    id,
    assignmentId: input.assignmentId,
    visibility: input.visibility,
    body,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

/**
 * Project a review for the manuscript author without exposing reviewer
 * identity or confidential editor-only feedback.
 */
export function toAuthorVisibleReview(
  review: PeerReviewAssignment,
): AuthorVisibleReview {
  return {
    id: review.id,
    workspaceId: review.workspaceId,
    manuscriptId: review.manuscriptId,
    reviewerAlias: review.reviewerAlias,
    reviewRound: review.reviewRound,
    status: review.status,
    recommendation: review.recommendation,
    feedback: review.feedback.filter(
      (item) => item.visibility === 'author_and_editor',
    ),
    submittedAt: review.submittedAt,
    completedAt: review.completedAt,
  };
}

/**
 * Project a review for its assigned reviewer without providing any author
 * identity fields. Confidential reviewer-to-editor feedback remains visible
 * to the reviewer who authored it.
 */
export function toReviewerVisibleReview(
  review: PeerReviewAssignment,
): ReviewerVisibleReview {
  return {
    id: review.id,
    workspaceId: review.workspaceId,
    manuscriptId: review.manuscriptId,
    reviewerAlias: review.reviewerAlias,
    reviewRound: review.reviewRound,
    anonymityMode: review.anonymityMode,
    status: review.status,
    recommendation: review.recommendation,
    feedback: [...review.feedback],
    invitedAt: review.invitedAt,
    acceptedAt: review.acceptedAt,
    submittedAt: review.submittedAt,
  };
}

export function toEditorVisibleReview(
  review: PeerReviewAssignment,
): EditorVisibleReview {
  return {
    ...review,
    feedback: [...review.feedback],
  };
}

/**
 * Identity policy for the review context.
 *
 * Double blind:
 * - editors/owners may resolve both sides;
 * - authors/co-authors do not see reviewer identity;
 * - reviewers do not see author identity.
 *
 * Single blind keeps reviewer identity hidden from authors while reviewers may
 * see the authors. Open review exposes both sides.
 */
export function getPeerReviewIdentityPolicy(
  role: WorkspaceRole,
  anonymityMode: ReviewAnonymityMode = 'double_blind',
): PeerReviewIdentityPolicy {
  if (role === 'owner' || role === 'editor') {
    return {
      canSeeAuthorIdentity: true,
      canSeeReviewerIdentity: true,
    };
  }

  if (anonymityMode === 'open') {
    return {
      canSeeAuthorIdentity: true,
      canSeeReviewerIdentity: true,
    };
  }

  if (role === 'reviewer') {
    return {
      canSeeAuthorIdentity: anonymityMode === 'single_blind',
      canSeeReviewerIdentity: true,
    };
  }

  if (role === 'co-author') {
    return {
      canSeeAuthorIdentity: true,
      canSeeReviewerIdentity: false,
    };
  }

  return {
    canSeeAuthorIdentity: false,
    canSeeReviewerIdentity: false,
  };
}
