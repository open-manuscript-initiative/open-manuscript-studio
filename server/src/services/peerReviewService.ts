import { prisma } from '../lib/prisma.js';

export type ReviewWorkspaceRole = 'AUTHOR' | 'EDITOR';
export type ReviewRecommendation =
  | 'ACCEPT'
  | 'MINOR_REVISION'
  | 'MAJOR_REVISION'
  | 'REJECT';
export type ReviewFeedbackVisibility =
  | 'AUTHOR_AND_EDITOR'
  | 'EDITOR_ONLY';

export interface CreateAssignmentInput {
  workspaceId: string;
  manuscriptId: string;
  reviewerEmail: string;
  reviewRound: number;
}

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

  const reviewer = await prisma.user.findUnique({
    where: { email: input.reviewerEmail.trim().toLowerCase() },
    select: { id: true, status: true },
  });

  if (!reviewer || reviewer.status !== 'ACTIVE') {
    throw new Error('The reviewer account is not active or does not exist.');
  }

  const aliasSequence = await prisma.peerReviewAssignment.count({
    where: {
      workspaceId: input.workspaceId,
      reviewRound: input.reviewRound,
    },
  });
  const reviewerAlias = `Reviewer ${aliasSequence + 1}`;

  const assignment = await prisma.peerReviewAssignment.create({
    data: {
      workspaceId: input.workspaceId,
      manuscriptId: input.manuscriptId,
      reviewerUserId: reviewer.id,
      assignedByUserId: editorUserId,
      reviewerAlias,
      reviewRound: input.reviewRound,
      anonymityMode: 'DOUBLE_BLIND',
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
    orderBy: [{ reviewRound: 'desc' }, { invitedAt: 'asc' }],
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
    throw new Error('Only an invited review can be accepted.');
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
    throw new Error('Only an invited review can be declined.');
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
    throw new Error('Feedback can only be added to an accepted review.');
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
  recommendation: ReviewRecommendation,
) {
  const assignment = await getOwnedAssignment(reviewerUserId, assignmentId);
  if (!['ACCEPTED', 'IN_PROGRESS'].includes(assignment.status)) {
    throw new Error('Only an accepted review can be submitted.');
  }

  const updated = await prisma.peerReviewAssignment.update({
    where: { id: assignmentId },
    data: {
      status: 'SUBMITTED',
      recommendation,
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
    throw new Error('Only a submitted review can be completed.');
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

type ReviewRecord = Awaited<ReturnType<typeof getReviewShape>>;
async function getReviewShape() {
  return prisma.peerReviewAssignment.findFirstOrThrow({ include: reviewInclude });
}

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
    reviewRound: assignment.reviewRound,
    anonymityMode: assignment.anonymityMode.toLowerCase(),
    status: assignment.status.toLowerCase(),
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
    assignedBy: {
      userId: assignment.assignedBy.id,
      email: assignment.assignedBy.email,
      fullName: assignment.assignedBy.fullName,
    },
    feedback: assignment.feedback.map(serializeFeedback),
  };
}

function notFound(): Error {
  const error = new Error('The review assignment was not found.');
  error.name = 'NotFoundError';
  return error;
}
