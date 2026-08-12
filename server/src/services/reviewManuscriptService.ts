import { Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma.js';
import { requireWorkspaceRole } from './peerReviewService.js';

export interface ReviewManuscriptBlock {
  type: 'heading' | 'paragraph' | 'note';
  text: string;
  level?: number;
}

export interface ReviewManuscriptSnapshot {
  title: string;
  subtitle?: string;
  abstract?: string;
  keywords: string[];
  blocks: ReviewManuscriptBlock[];
}

export interface AuthorFacingReviewRevision {
  reviewerAlias: string;
  manuscript: ReviewManuscriptSnapshot | null;
  revisionUpdatedAt?: string;
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
  externalSubmissionId: string,
  input: unknown,
): Promise<ReviewManuscriptSnapshot> {
  const assignment = await prisma.peerReviewAssignment.findUnique({
    where: { id: assignmentId },
    select: { id: true, manuscriptId: true },
  });

  if (!assignment) throw notFound();
  if (assignment.manuscriptId !== externalSubmissionId) {
    const error = new Error('The OJS submission does not match this review assignment.');
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
    select: { manuscriptSnapshot: true },
  });

  if (!assignment) throw notFound();
  if (!assignment.manuscriptSnapshot) return null;

  return sanitizeReviewManuscript(assignment.manuscriptSnapshot);
}

export async function getReviewRevisionForReviewer(
  reviewerUserId: string,
  assignmentId: string,
): Promise<ReviewManuscriptSnapshot | null> {
  const assignment = await prisma.peerReviewAssignment.findFirst({
    where: { id: assignmentId, reviewerUserId },
    select: { manuscriptSnapshot: true, reviewRevisionSnapshot: true },
  });

  if (!assignment) throw notFound();
  const source = assignment.reviewRevisionSnapshot ?? assignment.manuscriptSnapshot;
  return source ? sanitizeReviewManuscript(source) : null;
}

export async function saveReviewRevisionForReviewer(
  reviewerUserId: string,
  assignmentId: string,
  input: unknown,
): Promise<ReviewManuscriptSnapshot> {
  const assignment = await prisma.peerReviewAssignment.findFirst({
    where: { id: assignmentId, reviewerUserId },
    select: { id: true, status: true },
  });

  if (!assignment) throw notFound();
  if (!['ACCEPTED', 'IN_PROGRESS'].includes(assignment.status)) {
    throw new Error('The review revision can only be edited while the review is accepted or in progress.');
  }

  const revision = sanitizeReviewManuscript(input);
  await prisma.peerReviewAssignment.update({
    where: { id: assignmentId },
    data: {
      reviewRevisionSnapshot: revision as unknown as Prisma.InputJsonValue,
      revisionUpdatedAt: new Date(),
      status: 'IN_PROGRESS',
    },
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
      ? sanitizeReviewManuscript(assignment.reviewRevisionSnapshot)
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
  const snapshot = sanitizeReviewManuscript(input);
  await prisma.peerReviewAssignment.update({
    where: { id: assignmentId },
    data: {
      manuscriptSnapshot: snapshot as unknown as Prisma.InputJsonValue,
    },
  });
  return snapshot;
}

export function sanitizeReviewManuscript(input: unknown): ReviewManuscriptSnapshot {
  const record = asRecord(input);
  const title = cleanText(record.title, 500) || 'Untitled manuscript';
  const subtitle = cleanText(record.subtitle, 500);
  const abstract = cleanText(record.abstract, 20_000);
  const keywords = Array.isArray(record.keywords)
    ? record.keywords
        .map((value) => cleanText(value, 200))
        .filter((value): value is string => Boolean(value))
        .slice(0, 100)
    : [];

  const rawBlocks = Array.isArray(record.blocks) ? record.blocks : [];
  const blocks: ReviewManuscriptBlock[] = [];

  for (const rawBlock of rawBlocks.slice(0, 20_000)) {
    const block = asRecord(rawBlock);
    const text = cleanText(block.text, 200_000);
    if (!text) continue;

    const type = block.type === 'heading' || block.type === 'note'
      ? block.type
      : 'paragraph';
    const level = type === 'heading' && typeof block.level === 'number'
      ? Math.max(1, Math.min(6, Math.trunc(block.level)))
      : undefined;

    blocks.push({ type, text, ...(level !== undefined ? { level } : {}) });
  }

  return {
    title,
    ...(subtitle ? { subtitle } : {}),
    ...(abstract ? { abstract } : {}),
    keywords,
    blocks,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function cleanText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(/\u0000/g, '').trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
}

function notFound(): Error {
  const error = new Error('The review assignment was not found.');
  error.name = 'NotFoundError';
  return error;
}
