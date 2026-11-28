import { assertTranslationAssignmentScope } from './translationAssignmentScope.js';
import { requiresDocumentTranslation, translationLanguage } from './translationAssignmentPolicy.js';
import { assertReviewDocumentAccess, writableReviewStatuses } from './reviewAccessPolicy.js';
import { createHash } from 'node:crypto';

import { Prisma } from '../generated/prisma/client.js';

import { prisma } from '../lib/prisma.js';
import {
  requireWorkspaceRole,
  type ReviewRecommendationOption,
  type ReviewRecommendationStorage,
} from './peerReviewService.js';

import { sanitizeReviewManuscript, authorVisibleReviewManuscript, type ReviewManuscriptSnapshot } from './reviewManuscriptModel.js';
export * from './reviewManuscriptModel.js';

export interface AuthorFacingReviewRevision {
  reviewerAlias: string;
  manuscript: ReviewManuscriptSnapshot | null;
  revisionUpdatedAt?: string;
}

export interface OjsReviewAssignmentInput {
  reviewerUserId: string;
  installationId: string;
  contextId: string;
  externalAssignmentId: string;
  externalSubmissionId: string;
  reviewDocumentId?: string;
  reviewRound?: number;
  platform?: 'ojs' | 'omp';
  recommendationOptions?: ReviewRecommendationOption[];
  recommendationExternalId?: string | null;
  recommendationStorage?: ReviewRecommendationStorage;
}

export async function upsertOjsReviewAssignment(
  input: OjsReviewAssignmentInput,
): Promise<{ id: string }> {
  const reviewDocumentId = input.reviewDocumentId ?? input.externalSubmissionId;
  const recommendationData = input.recommendationStorage === undefined
    ? {}
    : {
        externalRecommendationStorage: input.recommendationStorage,
        externalRecommendationId: input.recommendationExternalId ?? null,
        externalRecommendationOptions: (input.recommendationOptions ?? []) as unknown as Prisma.InputJsonValue,
      };
  const existing = await prisma.peerReviewAssignment.findUnique({
    where: {
      externalInstallationId_externalAssignmentId: {
        externalInstallationId: input.installationId,
        externalAssignmentId: input.externalAssignmentId,
      },
    },
    select: {
      id: true,
      reviewerUserId: true,
      manuscriptId: true,
      externalSubmissionId: true,
    },
  });

  if (existing) {
    const legacyParentBinding = existing.manuscriptId === input.externalSubmissionId
      && (existing.externalSubmissionId === null
        || existing.externalSubmissionId === input.externalSubmissionId);
    if (
      existing.reviewerUserId !== input.reviewerUserId ||
      (!legacyParentBinding && existing.manuscriptId !== reviewDocumentId) ||
      (!legacyParentBinding
        && existing.externalSubmissionId !== null
        && existing.externalSubmissionId !== input.externalSubmissionId)
    ) {
      const error = new Error('The external review assignment is already linked to a different Studio account or article.');
      error.name = 'ForbiddenError';
      throw error;
    }

    await prisma.peerReviewAssignment.update({
      where: { id: existing.id },
      data: {
        manuscriptId: reviewDocumentId,
        externalSubmissionId: input.externalSubmissionId,
        anonymityMode: 'DOUBLE_BLIND',
        ...recommendationData,
      },
    });
    return { id: existing.id };
  }

  const workspaceId = `${input.platform ?? 'ojs'}:${createHash('sha256')
    .update(`${input.installationId}:${input.contextId}`)
    .digest('hex')
    .slice(0, 40)}`;
  const reviewRound = Number.isInteger(input.reviewRound) && (input.reviewRound ?? 0) > 0
    ? Math.min(99, input.reviewRound as number)
    : 1;

  const assignment = await prisma.peerReviewAssignment.create({
    data: {
      workspaceId,
      manuscriptId: reviewDocumentId,
      reviewerUserId: input.reviewerUserId,
      assignedByUserId: null,
      externalInstallationId: input.installationId,
      externalAssignmentId: input.externalAssignmentId,
      externalSubmissionId: input.externalSubmissionId,
      reviewerAlias: 'Reviewer',
      assignmentType: 'SCIENTIFIC_REVIEW',
      reviewRound,
      anonymityMode: 'DOUBLE_BLIND',
      status: 'INVITED',
      ...recommendationData,
    },
    select: { id: true },
  });

  return assignment;
}

export async function setReviewManuscript(
  editorUserId: string,
  assignmentId: string,
  input: unknown,
): Promise<ReviewManuscriptSnapshot> {
  const assignment = await prisma.peerReviewAssignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, workspaceId: true },
  });

  if (!assignment) throw notFound();
  await requireWorkspaceRole(assignment.workspaceId, editorUserId, 'EDITOR');
  return storeSnapshot(assignmentId, input);
}

export async function setReviewManuscriptFromOjs(
  assignmentId: string,
  reviewDocumentId: string,
  input: unknown,
): Promise<ReviewManuscriptSnapshot> {
  const assignment = await prisma.peerReviewAssignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, manuscriptId: true },
  });

  if (!assignment) throw notFound();
  if (assignment.manuscriptId !== reviewDocumentId) {
    const error = new Error('The external article does not match this review assignment.');
    error.name = 'ForbiddenError';
    throw error;
  }

  return storeSnapshot(assignmentId, input);
}

export async function getReviewManuscriptForReviewer(
  reviewerUserId: string,
  assignmentId: string,
): Promise<ReviewManuscriptSnapshot | null> {
  const assignment = await prisma.peerReviewAssignment.findFirst({
    where: { id: assignmentId, reviewerUserId },
    select: { manuscriptSnapshot: true, assignmentType: true, status: true, sourceLanguage: true, targetLanguage: true, publicationLanguages: true },
  });

  if (!assignment) throw notFound();
  await assertTranslationAssignmentScope(reviewerUserId, assignment);
  assertReviewDocumentAccess(assignment.assignmentType, assignment.status);
  if (!assignment.manuscriptSnapshot) return null;

  return sanitizeReviewManuscript(assignment.manuscriptSnapshot, assignment.assignmentType !== 'SCIENTIFIC_REVIEW');
}

export async function getReviewRevisionForReviewer(
  reviewerUserId: string,
  assignmentId: string,
): Promise<ReviewManuscriptSnapshot | null> {
  const assignment = await prisma.peerReviewAssignment.findFirst({
    where: { id: assignmentId, reviewerUserId },
    select: { manuscriptSnapshot: true, reviewRevisionSnapshot: true, assignmentType: true, status: true, sourceLanguage: true, targetLanguage: true, publicationLanguages: true },
  });

  if (!assignment) throw notFound();
  await assertTranslationAssignmentScope(reviewerUserId, assignment);
  assertReviewDocumentAccess(assignment.assignmentType, assignment.status);
  const source = assignment.reviewRevisionSnapshot ?? assignment.manuscriptSnapshot;
  if (!source) return null;
  const snapshot = sanitizeReviewManuscript(source, assignment.assignmentType !== 'SCIENTIFIC_REVIEW');
  if (assignment.assignmentType === 'TRANSLATION' && !snapshot.translation) snapshot.translation = {
    sourceLanguage: translationLanguage(assignment.sourceLanguage), targetLanguage: translationLanguage(assignment.targetLanguage),
    title: '', abstract: '', keywords: [], documentCompleted: false,
  };
  return snapshot;
}

export async function saveReviewRevisionForReviewer(
  reviewerUserId: string,
  assignmentId: string,
  input: unknown,
): Promise<ReviewManuscriptSnapshot> {
  const assignment = await prisma.peerReviewAssignment.findFirst({
    where: { id: assignmentId, reviewerUserId },
    select: { id: true, status: true, assignmentType: true, sourceLanguage: true, targetLanguage: true, publicationLanguages: true, manuscriptSnapshot: true, reviewer: { select: { fullName: true } } },
  });

  if (!assignment) throw notFound();
  await assertTranslationAssignmentScope(reviewerUserId, assignment);
  assertReviewDocumentAccess(assignment.assignmentType, assignment.status, true);

  const revision = sanitizeReviewManuscript(input, assignment.assignmentType !== 'SCIENTIFIC_REVIEW');
  if (assignment.assignmentType === 'TRANSLATION') {
    if (revision.translation && (revision.translation.sourceLanguage !== translationLanguage(assignment.sourceLanguage) || revision.translation.targetLanguage !== translationLanguage(assignment.targetLanguage))) throw new Error('The draft language pair does not match this task.');
    if (!requiresDocumentTranslation(assignment.targetLanguage, assignment.publicationLanguages)) {
      const original = sanitizeReviewManuscript(assignment.manuscriptSnapshot, true);
      revision.blocks = original.blocks; revision.annotations = original.annotations ?? [];
    }
  }
  if (assignment.assignmentType !== 'SCIENTIFIC_REVIEW') for (const note of revision.annotations ?? []) note.authorName ??= assignment.reviewer.fullName;
  await prisma.$transaction(async tx => {
    const changed = await tx.peerReviewAssignment.updateMany({
      where: { id: assignmentId, reviewerUserId, status: { in: writableReviewStatuses(assignment.assignmentType) as Array<'ACCEPTED' | 'IN_PROGRESS' | 'SUBMITTED'> } },
      data: { reviewRevisionSnapshot: revision as unknown as Prisma.InputJsonValue, revisionUpdatedAt: new Date(), status: 'IN_PROGRESS' },
    });
    if (changed.count !== 1) { const error = new Error('The task was closed while saving.'); error.name = 'ForbiddenError'; throw error; }
    await tx.$executeRaw`UPDATE ojs_review_writeback_contexts SET receipt = NULL, synced_at = NULL, last_error = NULL WHERE assignment_id = ${assignmentId}::uuid`;
  });
  return revision;
}

export async function getReviewRevisionForAuthor(
  authorUserId: string,
  assignmentId: string,
): Promise<AuthorFacingReviewRevision> {
  const assignment = await prisma.peerReviewAssignment.findUnique({
    where: { id: assignmentId },
    select: {
      workspaceId: true,
      assignmentType: true,
      reviewerAlias: true,
      status: true,
      reviewRevisionSnapshot: true,
      revisionUpdatedAt: true,
    },
  });

  if (!assignment) throw notFound();
  await requireWorkspaceRole(assignment.workspaceId, authorUserId, 'AUTHOR');
  if (!['SUBMITTED', 'COMPLETED'].includes(assignment.status)) {
    const error = new Error('The review revision is not available to the author until the review has been submitted.');
    error.name = 'ForbiddenError';
    throw error;
  }

  return {
    reviewerAlias: assignment.reviewerAlias,
    manuscript: assignment.reviewRevisionSnapshot
      ? authorVisibleReviewManuscript(assignment.reviewRevisionSnapshot, assignment.assignmentType !== 'SCIENTIFIC_REVIEW')
      : null,
    ...(assignment.revisionUpdatedAt
      ? { revisionUpdatedAt: assignment.revisionUpdatedAt.toISOString() }
      : {}),
  };
}

async function storeSnapshot(
  assignmentId: string,
  input: unknown,
): Promise<ReviewManuscriptSnapshot> {
  const assignment = await prisma.peerReviewAssignment.findUniqueOrThrow({ where: { id: assignmentId }, select: { assignmentType: true } });
  const snapshot = sanitizeReviewManuscript(input, assignment.assignmentType !== 'SCIENTIFIC_REVIEW');
  await prisma.peerReviewAssignment.update({
    where: { id: assignmentId },
    data: {
      manuscriptSnapshot: snapshot as unknown as Prisma.InputJsonValue,
    },
  });
  return snapshot;
}

function notFound(): Error {
  const error = new Error('The review assignment was not found.');
  error.name = 'NotFoundError';
  return error;
}
