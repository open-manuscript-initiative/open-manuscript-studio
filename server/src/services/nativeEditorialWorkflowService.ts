import { randomUUID } from 'node:crypto';

import {
  Prisma,
  type NativeSubmission,
} from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';
import {
  assertVerifiedNativePublicationVenue,
  assertVerifiedPublicationVenueEditorAuthority,
  listVerifiedNativeEditorVenueIds,
} from './publicationVenueAuthorityService.js';
import {
  completeReview,
  createReviewAssignment,
} from './peerReviewService.js';
import { setReviewManuscript } from './reviewManuscriptService.js';
import {
  createEditorialAcceptance,
  type EditorialDecisionEvidence,
} from './editorialDecisionService.js';

export interface NativeSubmissionSnapshotInput {
  publicationVenueId: string;
  manuscriptId: string;
  title: string;
  revisionId: string;
  stateDigest: string;
  manuscriptSnapshot: unknown;
}

export interface NativeEditorialAcceptanceInput {
  publicationContentDigest: string;
  basisAssignmentIds: string[];
}

export async function createNativeSubmission(
  authorUserId: string,
  input: NativeSubmissionSnapshotInput,
) {
  assertDigest(input.stateDigest);
  assertSnapshot(input.manuscriptSnapshot);
  await assertVerifiedNativePublicationVenue(input.publicationVenueId);

  const workspaceId = randomUUID();
  const id = randomUUID();
  try {
    return await prisma.$transaction(async (transaction) => {
      const submission = await transaction.nativeSubmission.create({
        data: {
          id,
          publicationVenueId: input.publicationVenueId,
          workspaceId,
          manuscriptId: input.manuscriptId.trim(),
          authorUserId,
          title: input.title.trim(),
          revisionId: input.revisionId.trim(),
          stateDigest: input.stateDigest.toLowerCase(),
          manuscriptSnapshot: input.manuscriptSnapshot as Prisma.InputJsonValue,
          status: 'SUBMITTED',
        },
        include: submissionInclude,
      });
      await transaction.reviewWorkspaceAccess.create({
        data: {
          workspaceId,
          manuscriptId: input.manuscriptId.trim(),
          userId: authorUserId,
          role: 'AUTHOR',
        },
      });
      await transaction.nativeSubmissionEvent.create({
        data: {
          submissionId: id,
          actorUserId: authorUserId,
          kind: 'SUBMITTED',
          detail: {
            revisionId: input.revisionId.trim(),
            stateDigest: input.stateDigest.toLowerCase(),
          },
        },
      });
      return serializeSubmission(submission);
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw conflict(
        'This manuscript has already been submitted to the selected publication venue.',
      );
    }
    throw error;
  }
}

export async function listAuthorNativeSubmissions(authorUserId: string) {
  const submissions = await prisma.nativeSubmission.findMany({
    where: { authorUserId },
    include: submissionInclude,
    orderBy: { updatedAt: 'desc' },
  });
  return submissions.map(serializeSubmission);
}

export async function listNativeEditorialInbox(editorUserId: string) {
  const venueIds = await listVerifiedNativeEditorVenueIds(editorUserId);
  if (!venueIds.length) return [];
  const submissions = await prisma.nativeSubmission.findMany({
    where: {
      publicationVenueId: { in: venueIds },
      status: { notIn: ['PUBLISHED'] },
    },
    include: submissionInclude,
    orderBy: [{ status: 'asc' }, { submittedAt: 'asc' }],
  });
  return submissions.map(serializeSubmission);
}

export async function getNativeSubmissionForParticipant(
  userId: string,
  submissionId: string,
) {
  const submission = await requireParticipantSubmission(userId, submissionId);
  return serializeSubmission(submission);
}

export async function claimNativeSubmission(
  editorUserId: string,
  submissionId: string,
) {
  const submission = await prisma.nativeSubmission.findUnique({
    where: { id: submissionId },
    include: submissionInclude,
  });
  if (!submission) throw notFound();
  await assertVerifiedPublicationVenueEditorAuthority(
    editorUserId,
    submission.publicationVenueId,
  );
  if (submission.editorUserId && submission.editorUserId !== editorUserId) {
    throw conflict('This submission is already assigned to another editor.');
  }
  if (['ACCEPTED', 'REJECTED', 'PUBLISHED'].includes(submission.status)) {
    throw conflict('This submission is already closed.');
  }

  const updated = await prisma.$transaction(async (transaction) => {
    await transaction.reviewWorkspaceAccess.upsert({
      where: {
        workspaceId_userId_role: {
          workspaceId: submission.workspaceId,
          userId: editorUserId,
          role: 'EDITOR',
        },
      },
      update: { manuscriptId: submission.manuscriptId },
      create: {
        workspaceId: submission.workspaceId,
        manuscriptId: submission.manuscriptId,
        userId: editorUserId,
        role: 'EDITOR',
      },
    });
    const result = await transaction.nativeSubmission.update({
      where: { id: submission.id },
      data: {
        editorUserId,
        status: submission.status === 'SUBMITTED' ? 'EDITOR_ASSIGNED' : submission.status,
        editorAssignedAt: submission.editorAssignedAt ?? new Date(),
      },
      include: submissionInclude,
    });
    await transaction.nativeSubmissionEvent.create({
      data: {
        submissionId: submission.id,
        actorUserId: editorUserId,
        kind: 'EDITOR_ASSIGNED',
      },
    });
    return result;
  });
  return serializeSubmission(updated);
}

export async function assignNativeReviewer(
  editorUserId: string,
  submissionId: string,
  input: {
    reviewerEmail: string;
    anonymityMode?: 'DOUBLE_BLIND' | 'SINGLE_BLIND' | 'OPEN';
  },
) {
  const submission = await requireAssignedEditor(editorUserId, submissionId);
  const review = await createReviewAssignment(editorUserId, {
    workspaceId: submission.workspaceId,
    manuscriptId: submission.manuscriptId,
    reviewerEmail: input.reviewerEmail,
    reviewRound: submission.reviewRound,
    assignmentType: 'SCIENTIFIC_REVIEW',
    ...(input.anonymityMode ? { anonymityMode: input.anonymityMode } : {}),
  });
  await setReviewManuscript(
    editorUserId,
    review.id,
    toAnonymousReviewSnapshot(submission.manuscriptSnapshot),
  );

  await prisma.$transaction([
    prisma.nativeSubmission.update({
      where: { id: submission.id },
      data: { status: 'UNDER_REVIEW' },
    }),
    prisma.nativeSubmissionEvent.create({
      data: {
        submissionId: submission.id,
        actorUserId: editorUserId,
        kind: 'REVIEWER_ASSIGNED',
        detail: {
          assignmentId: review.id,
          reviewRound: submission.reviewRound,
        },
      },
    }),
  ]);
  return review;
}

export async function completeNativeReview(
  editorUserId: string,
  submissionId: string,
  assignmentId: string,
) {
  const submission = await requireAssignedEditor(editorUserId, submissionId);
  const review = await completeReview(editorUserId, assignmentId);
  if (
    review.workspaceId !== submission.workspaceId ||
    review.manuscriptId !== submission.manuscriptId
  ) {
    throw forbidden('The review assignment does not belong to this submission.');
  }
  await prisma.nativeSubmissionEvent.create({
    data: {
      submissionId: submission.id,
      actorUserId: editorUserId,
      kind: 'REVIEW_COMPLETED',
      detail: { assignmentId: review.id, reviewRound: review.reviewRound },
    },
  });
  return review;
}

export async function requestNativeRevision(
  editorUserId: string,
  submissionId: string,
  note: string,
) {
  const submission = await requireAssignedEditor(editorUserId, submissionId);
  if (!['UNDER_REVIEW', 'EDITOR_ASSIGNED', 'REVISION_SUBMITTED'].includes(submission.status)) {
    throw conflict('A revision cannot be requested from the current submission state.');
  }
  const updated = await prisma.nativeSubmission.update({
    where: { id: submission.id },
    data: {
      status: 'REVISION_REQUESTED',
      latestEditorialNote: note.trim() || null,
      revisionRequestedAt: new Date(),
    },
    include: submissionInclude,
  });
  await prisma.nativeSubmissionEvent.create({
    data: {
      submissionId: submission.id,
      actorUserId: editorUserId,
      kind: 'REVISION_REQUESTED',
      detail: note.trim() ? { note: note.trim() } : undefined,
    },
  });
  return serializeSubmission(updated);
}

export async function submitNativeRevision(
  authorUserId: string,
  submissionId: string,
  input: Omit<NativeSubmissionSnapshotInput, 'publicationVenueId' | 'manuscriptId'>,
) {
  assertDigest(input.stateDigest);
  assertSnapshot(input.manuscriptSnapshot);
  const submission = await prisma.nativeSubmission.findFirst({
    where: { id: submissionId, authorUserId },
    include: submissionInclude,
  });
  if (!submission) throw notFound();
  if (submission.status !== 'REVISION_REQUESTED') {
    throw conflict('A revised manuscript can be submitted only after an editor requested revision.');
  }
  const updated = await prisma.nativeSubmission.update({
    where: { id: submission.id },
    data: {
      title: input.title.trim(),
      revisionId: input.revisionId.trim(),
      stateDigest: input.stateDigest.toLowerCase(),
      manuscriptSnapshot: input.manuscriptSnapshot as Prisma.InputJsonValue,
      status: 'REVISION_SUBMITTED',
      revisionSubmittedAt: new Date(),
    },
    include: submissionInclude,
  });
  await prisma.nativeSubmissionEvent.create({
    data: {
      submissionId: submission.id,
      actorUserId: authorUserId,
      kind: 'REVISION_SUBMITTED',
      detail: {
        revisionId: input.revisionId.trim(),
        stateDigest: input.stateDigest.toLowerCase(),
      },
    },
  });
  return serializeSubmission(updated);
}

export async function rejectNativeSubmission(
  editorUserId: string,
  submissionId: string,
  note: string,
) {
  const submission = await requireAssignedEditor(editorUserId, submissionId);
  if (['ACCEPTED', 'REJECTED', 'PUBLISHED'].includes(submission.status)) {
    throw conflict('This submission is already closed.');
  }
  const updated = await prisma.nativeSubmission.update({
    where: { id: submission.id },
    data: {
      status: 'REJECTED',
      latestEditorialNote: note.trim() || null,
      rejectedAt: new Date(),
    },
    include: submissionInclude,
  });
  await prisma.nativeSubmissionEvent.create({
    data: {
      submissionId: submission.id,
      actorUserId: editorUserId,
      kind: 'REJECTED',
      detail: note.trim() ? { note: note.trim() } : undefined,
    },
  });
  return serializeSubmission(updated);
}

export async function acceptNativeSubmission(
  editorUserId: string,
  submissionId: string,
  input: NativeEditorialAcceptanceInput,
): Promise<{ submission: ReturnType<typeof serializeSubmission>; evidence: EditorialDecisionEvidence }> {
  const submission = await requireAssignedEditor(editorUserId, submissionId);
  if (['ACCEPTED', 'REJECTED', 'PUBLISHED'].includes(submission.status)) {
    throw conflict('This submission is already closed.');
  }
  const evidence = await createEditorialAcceptance(editorUserId, {
    workspaceId: submission.workspaceId,
    manuscriptId: submission.manuscriptId,
    revisionId: submission.revisionId,
    stateDigest: submission.stateDigest,
    publicationContentDigest: input.publicationContentDigest,
    publicationVenueId: submission.publicationVenueId,
    reviewRound: submission.reviewRound,
    basisAssignmentIds: input.basisAssignmentIds,
  });
  const updated = await prisma.nativeSubmission.update({
    where: { id: submission.id },
    data: {
      status: 'ACCEPTED',
      acceptedAt: new Date(),
      latestEditorialNote: null,
    },
    include: submissionInclude,
  });
  await prisma.nativeSubmissionEvent.create({
    data: {
      submissionId: submission.id,
      actorUserId: editorUserId,
      kind: 'ACCEPTED',
      detail: {
        decisionId: evidence.decisionId,
        evidenceDigest: evidence.evidenceDigest,
      },
    },
  });
  return { submission: serializeSubmission(updated), evidence };
}

export async function markNativeSubmissionPublished(
  userId: string,
  submissionId: string,
) {
  const submission = await requireParticipantSubmission(userId, submissionId);
  if (submission.status !== 'ACCEPTED') {
    throw conflict('Only an accepted Studio-native submission can be marked as published.');
  }
  const updated = await prisma.nativeSubmission.update({
    where: { id: submission.id },
    data: { status: 'PUBLISHED', publishedAt: new Date() },
    include: submissionInclude,
  });
  await prisma.nativeSubmissionEvent.create({
    data: {
      submissionId: submission.id,
      actorUserId: userId,
      kind: 'PUBLISHED',
    },
  });
  return serializeSubmission(updated);
}

async function requireAssignedEditor(editorUserId: string, submissionId: string) {
  const submission = await prisma.nativeSubmission.findUnique({
    where: { id: submissionId },
    include: submissionInclude,
  });
  if (!submission) throw notFound();
  await assertVerifiedPublicationVenueEditorAuthority(
    editorUserId,
    submission.publicationVenueId,
  );
  if (submission.editorUserId !== editorUserId) {
    throw forbidden('The submission must be assigned to this editor first.');
  }
  return submission;
}

async function requireParticipantSubmission(userId: string, submissionId: string) {
  const submission = await prisma.nativeSubmission.findUnique({
    where: { id: submissionId },
    include: submissionInclude,
  });
  if (!submission) throw notFound();
  if (submission.authorUserId === userId || submission.editorUserId === userId) {
    return submission;
  }
  const access = await prisma.reviewWorkspaceAccess.findFirst({
    where: {
      workspaceId: submission.workspaceId,
      manuscriptId: submission.manuscriptId,
      userId,
      role: { in: ['AUTHOR', 'EDITOR'] },
    },
    select: { id: true },
  });
  if (!access) throw forbidden('This account cannot access the Studio-native submission.');
  return submission;
}

const submissionInclude = {
  author: { select: { id: true, email: true, fullName: true } },
  editor: { select: { id: true, email: true, fullName: true } },
  events: { orderBy: { createdAt: 'asc' as const } },
};

function serializeSubmission(submission: NativeSubmission & {
  author: { id: string; email: string; fullName: string };
  editor: { id: string; email: string; fullName: string } | null;
  events: Array<{
    id: string;
    actorUserId: string;
    kind: string;
    detail: unknown;
    createdAt: Date;
  }>;
}) {
  return {
    id: submission.id,
    publicationVenueId: submission.publicationVenueId,
    workspaceId: submission.workspaceId,
    manuscriptId: submission.manuscriptId,
    title: submission.title,
    revisionId: submission.revisionId,
    stateDigest: submission.stateDigest,
    manuscriptSnapshot: submission.manuscriptSnapshot,
    reviewRound: submission.reviewRound,
    status: submission.status,
    latestEditorialNote: submission.latestEditorialNote,
    author: submission.author,
    editor: submission.editor,
    submittedAt: submission.submittedAt.toISOString(),
    editorAssignedAt: submission.editorAssignedAt?.toISOString() ?? null,
    revisionRequestedAt: submission.revisionRequestedAt?.toISOString() ?? null,
    revisionSubmittedAt: submission.revisionSubmittedAt?.toISOString() ?? null,
    acceptedAt: submission.acceptedAt?.toISOString() ?? null,
    rejectedAt: submission.rejectedAt?.toISOString() ?? null,
    publishedAt: submission.publishedAt?.toISOString() ?? null,
    updatedAt: submission.updatedAt.toISOString(),
    events: submission.events.map((event) => ({
      id: event.id,
      actorUserId: event.actorUserId,
      kind: event.kind,
      detail: event.detail,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

function toAnonymousReviewSnapshot(value: unknown) {
  const manuscript = asRecord(value);
  const blocks: Array<Record<string, unknown>> = [];
  const sections = Array.isArray(manuscript.sections) ? manuscript.sections : [];
  for (const section of sections) appendSection(blocks, section, 1);
  const keywords = Array.isArray(manuscript.keywords)
    ? manuscript.keywords.filter((item): item is string => typeof item === 'string')
    : [];
  return {
    documentKind: 'article' as const,
    authorIdentity: 'hidden' as const,
    title: textValue(manuscript.title) || 'Untitled article',
    ...(textValue(manuscript.subtitle)
      ? { subtitle: textValue(manuscript.subtitle) }
      : {}),
    ...(textValue(manuscript.abstract)
      ? { abstract: textValue(manuscript.abstract) }
      : {}),
    keywords,
    blocks,
    bibliographicRecords: [],
  };
}

function appendSection(
  target: Array<Record<string, unknown>>,
  value: unknown,
  level: number,
): void {
  const section = asRecord(value);
  const title = textValue(section.title);
  if (title) target.push({ type: 'heading', text: title, level: Math.min(6, level) });
  const blocks = Array.isArray(section.blocks) ? section.blocks : [];
  for (const blockValue of blocks) {
    const block = asRecord(blockValue);
    const type = textValue(block.type);
    const text = extractPortableText(block.content);
    if (type === 'heading' && text) {
      target.push({ type: 'heading', text, level: Math.min(6, level + 1) });
    } else if ((type === 'paragraph' || type === 'quote') && text) {
      target.push({ type: 'paragraph', text });
    } else {
      const visual = asRecord(block.visual);
      if ((type === 'image' || visual.kind === 'image') && textValue(visual.src)) {
        target.push({
          type: 'image',
          src: textValue(visual.src),
          mediaType: textValue(visual.mediaType) || 'application/octet-stream',
          ...(textValue(visual.alt) ? { alt: textValue(visual.alt) } : {}),
        });
      } else if ((type === 'table' || visual.kind === 'table') && Array.isArray(visual.cells)) {
        target.push({
          type: 'table',
          cells: visual.cells,
          headerRows: typeof visual.headerRows === 'number' ? visual.headerRows : 0,
        });
      } else if (text) {
        target.push({ type: 'paragraph', text });
      }
    }
    const children = Array.isArray(block.children) ? block.children : [];
    for (const child of children) {
      const childRecord = asRecord(child);
      const childText = extractPortableText(childRecord.content);
      if (childText) target.push({ type: 'paragraph', text: childText });
    }
  }
}

function extractPortableText(value: unknown): string {
  if (typeof value !== 'string') return '';
  const source = value.trim();
  if (!source) return '';
  if (!source.startsWith('{') && !source.startsWith('[')) return source;
  try {
    return collectJsonText(JSON.parse(source)).replace(/\s+/gu, ' ').trim();
  } catch {
    return source;
  }
}

function collectJsonText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(collectJsonText).filter(Boolean).join(' ');
  const record = asRecord(value);
  const own = typeof record.text === 'string' ? record.text : '';
  const content = Array.isArray(record.content)
    ? record.content.map(collectJsonText).filter(Boolean).join(' ')
    : '';
  return [own, content].filter(Boolean).join(' ');
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function assertDigest(value: string): void {
  if (!/^[a-f0-9]{64}$/iu.test(value)) {
    throw new Error('A valid SHA-256 manuscript-state digest is required.');
  }
}

function assertSnapshot(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('A complete manuscript snapshot is required.');
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002',
  );
}

function notFound(): Error {
  const error = new Error('The Studio-native submission was not found.');
  error.name = 'NotFoundError';
  return error;
}

function forbidden(message: string): Error {
  const error = new Error(message);
  error.name = 'ForbiddenError';
  return error;
}

function conflict(message: string): Error {
  const error = new Error(message);
  error.name = 'ConflictError';
  return error;
}
