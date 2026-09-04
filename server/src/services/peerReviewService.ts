import type { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';

export type ReviewWorkspaceRole = 'AUTHOR' | 'EDITOR';
export type ReviewAssignmentType =
  | 'SCIENTIFIC_REVIEW'
  | 'LANGUAGE_REVIEW'
  | 'TRANSLATION'
  | 'EDITORIAL_REVISION';
export type ReviewRecommendation =
  | 'ACCEPT'
  | 'MINOR_REVISION'
  | 'MAJOR_REVISION'
  | 'REJECT';
export type ReviewFeedbackVisibility =
  | 'AUTHOR_AND_EDITOR'
  | 'EDITOR_ONLY';
export type ReviewAnonymityMode =
  | 'DOUBLE_BLIND'
  | 'SINGLE_BLIND'
  | 'OPEN';

export interface CreateAssignmentInput {
  workspaceId: string;
  manuscriptId: string;
  reviewerEmail: string;
  reviewRound: number;
  assignmentType: ReviewAssignmentType;
  sourceLanguage?: string;
  targetLanguage?: string;
  anonymityMode?: ReviewAnonymityMode;
}

const assignmentPolicies: Record<ReviewAssignmentType, {
  alias: string;
  defaultAnonymity: ReviewAnonymityMode;
  requiresRecommendation: boolean;
}> = {
  SCIENTIFIC_REVIEW: {
    alias: 'Reviewer',
    defaultAnonymity: 'DOUBLE_BLIND',
    requiresRecommendation: true,
  },
  LANGUAGE_REVIEW: {
    alias: 'Language reviewer',
    defaultAnonymity: 'DOUBLE_BLIND',
    requiresRecommendation: false,
  },
  TRANSLATION: {
    alias: 'Translator',
    defaultAnonymity: 'DOUBLE_BLIND',
    requiresRecommendation: false,
  },
  EDITORIAL_REVISION: {
    alias: 'Editorial reviser',
    defaultAnonymity: 'OPEN',
    requiresRecommendation: false,
  },
};

export async function requireWorkspaceRole(
  workspaceId: string,
  userId: string,
  role: ReviewWorkspaceRole,
): Promise<void> {
  const access = await prisma.reviewWorkspaceAccess.findFirst({
    where: { workspaceId, userId, role },
    select: { id: true },
  });

  if (!access) {
    const error = new Error('You do not have permission to access this review workspace.');
    error.name = 'ForbiddenError';
    throw error;
  }
}

export async function createReviewAssignment(
  editorUserId: string,
  input: CreateAssignmentInput,
) {
  await requireWorkspaceRole(input.workspaceId, editorUserId, 'EDITOR');

  const access = await prisma.reviewWorkspaceAccess.findFirst({
    where: {
      workspaceId: input.workspaceId,
      manuscriptId: input.manuscriptId,
      userId: editorUserId,
      role: 'EDITOR',
    },
    select: { id: true },
  });

  if (!access) {
    throw new Error('The manuscript does not belong to this review workspace.');
  }

  validateAssignmentLanguages(input);

  const participant = await prisma.user.findUnique({
    where: { email: input.reviewerEmail.trim().toLowerCase() },
    select: { id: true, status: true },
  });

  if (!participant || participant.status !== 'ACTIVE') {
    throw new Error('The assigned participant account is not active or does not exist.');
  }

  const policy = assignmentPolicies[input.assignmentType];
  const aliasSequence = await prisma.peerReviewAssignment.count({
    where: {
      workspaceId: input.workspaceId,
      reviewRound: input.reviewRound,
      assignmentType: input.assignmentType,
    },
  });
  const reviewerAlias = `${policy.alias} ${aliasSequence + 1}`;

  const assignment = await prisma.peerReviewAssignment.create({
    data: {
      workspaceId: input.workspaceId,
      manuscriptId: input.manuscriptId,
      reviewerUserId: participant.id,
      assignedByUserId: editorUserId,
      reviewerAlias,
      assignmentType: input.assignmentType,
      sourceLanguage: normalizeLanguage(input.sourceLanguage),
      targetLanguage: normalizeLanguage(input.targetLanguage),
      reviewRound: input.reviewRound,
      anonymityMode: input.anonymityMode ?? policy.defaultAnonymity,
      status: 'INVITED',
    },
    include: reviewInclude,
  });

  return serializeForEditor(assignment);
}

export async function listEditorReviews(
  editorUserId: string,
  workspaceId: string,
) {
  await requireWorkspaceRole(workspaceId, editorUserId, 'EDITOR');

  const assignments = await prisma.peerReviewAssignment.findMany({
    where: { workspaceId },
    include: reviewInclude,
    orderBy: [
      { reviewRound: 'desc' },
      { assignmentType: 'asc' },
      { invitedAt: 'asc' },
    ],
  });

  return assignments.map(serializeForEditor);
}

export async function listAuthorReviews(
  authorUserId: string,
  workspaceId: string,
) {
  await requireWorkspaceRole(workspaceId, authorUserId, 'AUTHOR');

  const assignments = await prisma.peerReviewAssignment.findMany({
    where: { workspaceId, status: { in: ['SUBMITTED', 'COMPLETED'] } },
    include: reviewInclude,
    orderBy: [{ reviewRound: 'desc' }, { submittedAt: 'asc' }],
  });

  return assignments.map(serializeForAuthor);
}

export async function listReviewerAssignments(reviewerUserId: string) {
  const assignments = await prisma.peerReviewAssignment.findMany({
    where: { reviewerUserId },
    include: reviewInclude,
    orderBy: { invitedAt: 'desc' },
  });

  return assignments.map(serializeForReviewer);
}

export async function getReviewerAssignment(
  reviewerUserId: string,
  assignmentId: string,
) {
  const assignment = await getOwnedAssignment(reviewerUserId, assignmentId);
  return serializeForReviewer(assignment);
}

export async function acceptReview(
  reviewerUserId: string,
  assignmentId: string,
) {
  const assignment = await getOwnedAssignment(reviewerUserId, assignmentId);
  if (assignment.status !== 'INVITED') {
    throw new Error('Only an invited assignment can be accepted.');
  }

  const updated = await prisma.peerReviewAssignment.update({
    where: { id: assignmentId },
    data: { status: 'ACCEPTED', acceptedAt: new Date() },
    include: reviewInclude,
  });

  return serializeForReviewer(updated);
}

export async function declineReview(
  reviewerUserId: string,
  assignmentId: string,
) {
  const assignment = await getOwnedAssignment(reviewerUserId, assignmentId);
  if (assignment.status !== 'INVITED') {
    throw new Error('Only an invited assignment can be declined.');
  }

  const updated = await prisma.peerReviewAssignment.update({
    where: { id: assignmentId },
    data: { status: 'DECLINED' },
    include: reviewInclude,
  });

  return serializeForReviewer(updated);
}

export async function addReviewFeedback(
  reviewerUserId: string,
  assignmentId: string,
  visibility: ReviewFeedbackVisibility,
  body: string,
) {
  const assignment = await getOwnedAssignment(reviewerUserId, assignmentId);
  if (!['ACCEPTED', 'IN_PROGRESS'].includes(assignment.status)) {
    throw new Error('Feedback can only be added to an accepted assignment.');
  }

  await prisma.$transaction([
    prisma.peerReviewFeedback.create({
      data: { assignmentId, visibility, body: body.trim() },
    }),
    prisma.peerReviewAssignment.update({
      where: { id: assignmentId },
      data: { status: 'IN_PROGRESS' },
    }),
  ]);

  const updated = await getOwnedAssignment(reviewerUserId, assignmentId);
  return serializeForReviewer(updated);
}

export async function submitReview(
  reviewerUserId: string,
  assignmentId: string,
  recommendation?: ReviewRecommendation,
) {
  const assignment = await getOwnedAssignment(reviewerUserId, assignmentId);
  if (!['ACCEPTED', 'IN_PROGRESS'].includes(assignment.status)) {
    throw new Error('Only an accepted assignment can be submitted.');
  }

  const policy = assignmentPolicies[assignment.assignmentType];
  if (policy.requiresRecommendation && !recommendation) {
    throw new Error('A scientific review requires an editorial recommendation.');
  }

  const recommendationValue: ReviewRecommendation | null = policy.requiresRecommendation
    ? recommendation ?? null
    : null;

  const updated = await prisma.peerReviewAssignment.update({
    where: { id: assignmentId },
    data: {
      status: 'SUBMITTED',
      recommendation: recommendationValue,
      submittedAt: new Date(),
    },
    include: reviewInclude,
  });

  return serializeForReviewer(updated);
}

export async function completeReview(
  editorUserId: string,
  assignmentId: string,
) {
  const assignment = await prisma.peerReviewAssignment.findUnique({
    where: { id: assignmentId },
    include: reviewInclude,
  });

  if (!assignment) throw notFound();
  await requireWorkspaceRole(assignment.workspaceId, editorUserId, 'EDITOR');

  if (assignment.status !== 'SUBMITTED') {
    throw new Error('Only a submitted assignment can be completed.');
  }

  const updated = await prisma.peerReviewAssignment.update({
    where: { id: assignmentId },
    data: { status: 'COMPLETED', completedAt: new Date() },
    include: reviewInclude,
  });

  return serializeForEditor(updated);
}

async function getOwnedAssignment(reviewerUserId: string, assignmentId: string) {
  const assignment = await prisma.peerReviewAssignment.findFirst({
    where: { id: assignmentId, reviewerUserId },
    include: reviewInclude,
  });

  if (!assignment) throw notFound();
  return assignment;
}

const reviewInclude = {
  reviewer: {
    select: {
      id: true,
      email: true,
      fullName: true,
      affiliation: true,
      orcid: true,
    },
  },
  assignedBy: {
    select: { id: true, email: true, fullName: true },
  },
  feedback: {
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

type ReviewRecord = Prisma.PeerReviewAssignmentGetPayload<{
  include: typeof reviewInclude;
}>;

function serializeFeedback(feedback: ReviewRecord['feedback'][number]) {
  return {
    id: feedback.id,
    visibility: feedback.visibility.toLowerCase(),
    body: feedback.body,
    createdAt: feedback.createdAt.toISOString(),
    updatedAt: feedback.updatedAt.toISOString(),
  };
}

function commonReview(assignment: ReviewRecord) {
  return {
    id: assignment.id,
    workspaceId: assignment.workspaceId,
    manuscriptId: assignment.manuscriptId,
    reviewerAlias: assignment.reviewerAlias,
    assignmentType: assignment.assignmentType.toLowerCase(),
    ...(assignment.sourceLanguage ? { sourceLanguage: assignment.sourceLanguage } : {}),
    ...(assignment.targetLanguage ? { targetLanguage: assignment.targetLanguage } : {}),
    reviewRound: assignment.reviewRound,
    anonymityMode: assignment.anonymityMode.toLowerCase(),
    status: assignment.status.toLowerCase(),
    requiresRecommendation: assignmentPolicies[assignment.assignmentType].requiresRecommendation,
    ...(assignment.recommendation
      ? { recommendation: assignment.recommendation.toLowerCase() }
      : {}),
    invitedAt: assignment.invitedAt.toISOString(),
    ...(assignment.acceptedAt ? { acceptedAt: assignment.acceptedAt.toISOString() } : {}),
    ...(assignment.submittedAt ? { submittedAt: assignment.submittedAt.toISOString() } : {}),
    ...(assignment.completedAt ? { completedAt: assignment.completedAt.toISOString() } : {}),
  };
}

function serializeForAuthor(assignment: ReviewRecord) {
  return {
    ...commonReview(assignment),
    // Identity is deliberately not included here, even for OPEN assignments.
    // Identity disclosure can be added later as an explicit editorial policy;
    // omission is the privacy-preserving default.
    feedback: assignment.feedback
      .filter((item) => item.visibility === 'AUTHOR_AND_EDITOR')
      .map(serializeFeedback),
  };
}

function serializeForReviewer(assignment: ReviewRecord) {
  return {
    ...commonReview(assignment),
    feedback: assignment.feedback.map(serializeFeedback),
  };
}

function serializeForEditor(assignment: ReviewRecord) {
  return {
    ...commonReview(assignment),
    reviewer: {
      userId: assignment.reviewer.id,
      email: assignment.reviewer.email,
      fullName: assignment.reviewer.fullName,
      affiliation: assignment.reviewer.affiliation,
      orcid: assignment.reviewer.orcid,
    },
    assignedBy: assignment.assignedBy
      ? {
          userId: assignment.assignedBy.id,
          email: assignment.assignedBy.email,
          fullName: assignment.assignedBy.fullName,
        }
      : null,
    feedback: assignment.feedback.map(serializeFeedback),
  };
}

function validateAssignmentLanguages(input: CreateAssignmentInput): void {
  if (input.assignmentType === 'TRANSLATION') {
    if (!normalizeLanguage(input.sourceLanguage) || !normalizeLanguage(input.targetLanguage)) {
      throw new Error('Translation assignments require both sourceLanguage and targetLanguage.');
    }
    if (normalizeLanguage(input.sourceLanguage) === normalizeLanguage(input.targetLanguage)) {
      throw new Error('Translation source and target languages must be different.');
    }
  }
}

function normalizeLanguage(value?: string): string | null {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 32) : null;
}

function notFound(): Error {
  const error = new Error('The editorial assignment was not found.');
  error.name = 'NotFoundError';
  return error;
}
