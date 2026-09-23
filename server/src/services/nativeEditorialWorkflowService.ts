import { createHash, randomUUID } from 'node:crypto';

import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';
import { calculatePortableStateDigest } from '../signatures/publicationSignatureCrypto.js';
import {
  createEditorialAcceptance,
  type EditorialDecisionEvidence,
} from './editorialDecisionService.js';
import {
  completeReview,
  createReviewAssignment,
  listAuthorReviews,
  listEditorReviews,
} from './peerReviewService.js';
import {
  sanitizeReviewManuscript,
  setReviewManuscript,
} from './reviewManuscriptService.js';
import {
  assertStudioNativePublicationVenue,
  assertStudioNativePublicationVenueEditorAuthority,
  listStudioNativePublicationVenuesForEditor,
} from './publicationVenueAuthorityService.js';

export interface NativeEditorialAssetInput {
  assetId: string;
  mediaType: string;
  checksum: string;
  bytesBase64: string;
}

export interface NativeEditorialRevisionInput {
  manuscriptId: string;
  title: string;
  revisionId: string;
  stateDigest: string;
  publicationContentDigest: string;
  manuscriptStateSnapshot: unknown;
  reviewSnapshot: unknown;
  assets?: NativeEditorialAssetInput[] | undefined;
}

export interface NativeEditorialSubmissionInput extends NativeEditorialRevisionInput {
  publicationVenueId: string;
}

const ACTIVE_EDITOR_STATUSES = new Set([
  'SUBMITTED',
  'IN_REVIEW',
  'REVISION_SUBMITTED',
]);

export async function submitNativeEditorialManuscript(
  authorUserId: string,
  input: NativeEditorialSubmissionInput,
) {
  const venue = await assertStudioNativePublicationVenue(input.publicationVenueId);
  const revision = validateRevisionInput(input);
  assertRevisionPublicationVenue(
    revision.manuscriptStateSnapshot,
    input.publicationVenueId,
  );
  const workspaceId = `native:${randomUUID()}`;

  try {
    const submission = await prisma.$transaction(async (transaction) => {
      const created = await transaction.nativeEditorialSubmission.create({
        data: {
          workspaceId,
          manuscriptId: revision.manuscriptId,
          publicationVenueId: venue.venueId,
          publicationVenueName: venue.venueName,
          publicationVenueDomain: venue.domain,
          authorUserId,
          title: revision.title,
          revisionId: revision.revisionId,
          stateDigest: revision.stateDigest,
          publicationContentDigest: revision.publicationContentDigest,
          manuscriptStateSnapshot:
            revision.manuscriptStateSnapshot as Prisma.InputJsonValue,
          reviewSnapshot: revision.reviewSnapshot as unknown as Prisma.InputJsonValue,
          status: 'SUBMITTED',
          reviewRound: 1,
        },
      });
      await transaction.reviewWorkspaceAccess.create({
        data: {
          workspaceId,
          manuscriptId: revision.manuscriptId,
          userId: authorUserId,
          role: 'AUTHOR',
        },
      });
      if (revision.assets.length) {
        await transaction.nativeEditorialSubmissionAsset.createMany({
          data: revision.assets.map((asset) => ({
            submissionId: created.id,
            assetId: asset.assetId,
            mediaType: asset.mediaType,
            checksum: asset.checksum,
            size: asset.bytes.byteLength,
            bytes: asset.bytes,
          })),
        });
      }
      await transaction.nativeEditorialSubmissionEvent.create({
        data: {
          submissionId: created.id,
          actorUserId: authorUserId,
          type: 'SUBMITTED',
          reviewRound: 1,
          revisionId: revision.revisionId,
          stateDigest: revision.stateDigest,
        },
      });
      return created;
    });
    return serializeSubmissionSummary(submission);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw conflict(
        'This manuscript has already been submitted to this publication venue.',
      );
    }
    throw error;
  }
}

export async function listNativeEditorialSubmissionsForAuthor(
  authorUserId: string,
  manuscriptId?: string,
) {
  const submissions = await prisma.nativeEditorialSubmission.findMany({
    where: {
      authorUserId,
      ...(manuscriptId ? { manuscriptId } : {}),
    },
    orderBy: { updatedAt: 'desc' },
  });
  return submissions.map(serializeSubmissionSummary);
}

export async function listNativeEditorialInbox(editorUserId: string) {
  const venues = await listStudioNativePublicationVenuesForEditor(editorUserId);
  const venueIds = venues.map((venue) => venue.venueId);
  if (!venueIds.length) return [];

  const submissions = await prisma.nativeEditorialSubmission.findMany({
    where: { publicationVenueId: { in: venueIds } },
    include: {
      author: {
        select: {
          id: true,
          email: true,
          fullName: true,
          affiliation: true,
          orcid: true,
        },
      },
    },
    orderBy: [{ updatedAt: 'desc' }, { submittedAt: 'desc' }],
  });

  return submissions.map((submission) => ({
    ...serializeSubmissionSummary(submission),
    author: serializePerson(submission.author),
  }));
}

export async function findNativeEditorialSubmissionForUser(
  userId: string,
  manuscriptId: string,
  publicationVenueId?: string,
) {
  const submissions = await prisma.nativeEditorialSubmission.findMany({
    where: {
      manuscriptId,
      ...(publicationVenueId ? { publicationVenueId } : {}),
    },
    orderBy: { updatedAt: 'desc' },
  });
  const authored = submissions.find((submission) => submission.authorUserId === userId);
  if (authored) return serializeSubmissionSummary(authored);

  const venues = await listStudioNativePublicationVenuesForEditor(userId);
  const venueIds = new Set(venues.map((venue) => venue.venueId));
  const editorial = submissions.find((submission) =>
    venueIds.has(submission.publicationVenueId)
  );
  return editorial ? serializeSubmissionSummary(editorial) : null;
}

export async function getNativeEditorialSubmission(
  userId: string,
  submissionId: string,
) {
  const submission = await loadSubmission(submissionId);
  if (submission.authorUserId === userId) {
    const reviews = await listAuthorReviews(userId, submission.workspaceId);
    return {
      submission: serializeSubmissionDetail(submission),
      actorMode: 'author' as const,
      reviews,
    };
  }

  await ensureSubmissionEditorAccess(userId, submission);
  const reviews = await listEditorReviews(userId, submission.workspaceId);
  return {
    submission: serializeSubmissionDetail(submission),
    actorMode: 'editor' as const,
    reviews,
  };
}

export async function assignNativeEditorialReviewer(
  editorUserId: string,
  submissionId: string,
  reviewerEmail: string,
) {
  const submission = await loadSubmission(submissionId);
  await ensureSubmissionEditorAccess(editorUserId, submission);
  if (!['SUBMITTED', 'REVISION_SUBMITTED', 'IN_REVIEW'].includes(submission.status)) {
    throw conflict(
      'A reviewer can be assigned only to a submitted or revised manuscript that is still under editorial review.',
    );
  }

  const normalizedReviewerEmail = reviewerEmail.trim().toLowerCase();
  if (submission.author.email.toLowerCase() === normalizedReviewerEmail) {
    throw conflict('The submitting author cannot review their own manuscript.');
  }
  const reviewSnapshot = sanitizeReviewManuscript(submission.reviewSnapshot);
  const review = await createReviewAssignment(editorUserId, {
    workspaceId: submission.workspaceId,
    manuscriptId: submission.manuscriptId,
    reviewerEmail: normalizedReviewerEmail,
    reviewRound: submission.reviewRound,
    assignmentType: 'SCIENTIFIC_REVIEW',
    anonymityMode: 'DOUBLE_BLIND',
  });
  try {
    await setReviewManuscript(
      editorUserId,
      review.id,
      reviewSnapshot,
    );
    const updated = await prisma.$transaction(async (transaction) => {
      const next = await transaction.nativeEditorialSubmission.update({
        where: { id: submission.id },
        data: { status: 'IN_REVIEW' },
      });
      await transaction.nativeEditorialSubmissionEvent.create({
        data: {
          submissionId: submission.id,
          actorUserId: editorUserId,
          type: 'REVIEWER_ASSIGNED',
          reviewRound: submission.reviewRound,
          revisionId: submission.revisionId,
          stateDigest: submission.stateDigest,
          note: review.reviewerAlias,
        },
      });
      return next;
    });
    return {
      submission: serializeSubmissionSummary(updated),
      review,
    };
  } catch (error) {
    await prisma.peerReviewAssignment.delete({
      where: { id: review.id },
    }).catch(() => undefined);
    throw error;
  }
}

export async function completeNativeEditorialReview(
  editorUserId: string,
  submissionId: string,
  assignmentId: string,
) {
  const submission = await loadSubmission(submissionId);
  await ensureSubmissionEditorAccess(editorUserId, submission);
  const assignment = await prisma.peerReviewAssignment.findFirst({
    where: {
      id: assignmentId,
      workspaceId: submission.workspaceId,
      manuscriptId: submission.manuscriptId,
    },
    select: { id: true, reviewRound: true },
  });
  if (!assignment) throw notFound('The review assignment was not found for this submission.');

  const review = await completeReview(editorUserId, assignment.id);
  await prisma.nativeEditorialSubmissionEvent.create({
    data: {
      submissionId: submission.id,
      actorUserId: editorUserId,
      type: 'REVIEW_COMPLETED',
      reviewRound: assignment.reviewRound,
      revisionId: submission.revisionId,
      stateDigest: submission.stateDigest,
    },
  });
  return review;
}

export async function requestNativeEditorialRevision(
  editorUserId: string,
  submissionId: string,
  note: string,
) {
  const submission = await loadSubmission(submissionId);
  await ensureSubmissionEditorAccess(editorUserId, submission);
  if (submission.status !== 'IN_REVIEW') {
    throw conflict('A revision can be requested only after the current review round has been completed.');
  }
  const round = await latestCompletedScientificRound(
    submission.workspaceId,
    submission.manuscriptId,
    submission.reviewRound,
  );
  if (!round) {
    throw conflict(
      'A revision request requires at least one completed Studio-native scientific review round.',
    );
  }
  const normalizedNote = note.trim();
  if (!normalizedNote) {
    throw new Error('Explain the requested revision to the author.');
  }
  const updated = await prisma.$transaction(async (transaction) => {
    const next = await transaction.nativeEditorialSubmission.update({
      where: { id: submission.id },
      data: {
        status: 'REVISION_REQUESTED',
        editorialNote: normalizedNote,
        revisionRequestedAt: new Date(),
      },
    });
    await transaction.nativeEditorialSubmissionEvent.create({
      data: {
        submissionId: submission.id,
        actorUserId: editorUserId,
        type: 'REVISION_REQUESTED',
        reviewRound: round.reviewRound,
        revisionId: submission.revisionId,
        stateDigest: submission.stateDigest,
        note: normalizedNote,
      },
    });
    return next;
  });
  return serializeSubmissionSummary(updated);
}

export async function submitNativeEditorialRevision(
  authorUserId: string,
  submissionId: string,
  input: NativeEditorialRevisionInput,
) {
  const submission = await loadSubmission(submissionId);
  if (submission.authorUserId !== authorUserId) {
    throw forbidden('Only the submitting author can send a revised manuscript.');
  }
  if (submission.status !== 'REVISION_REQUESTED') {
    throw conflict('A revised manuscript can be submitted only after an editorial revision request.');
  }
  if (input.manuscriptId !== submission.manuscriptId) {
    throw conflict('The revised manuscript does not match the original submission.');
  }
  await assertStudioNativePublicationVenue(submission.publicationVenueId);
  const revision = validateRevisionInput(input);
  assertRevisionPublicationVenue(
    revision.manuscriptStateSnapshot,
    submission.publicationVenueId,
  );
  if (revision.revisionId === submission.revisionId) {
    throw conflict('The revised manuscript must be a new committed revision.');
  }
  if (submission.reviewRound >= 99) {
    throw conflict('The maximum number of review rounds has been reached.');
  }

  const nextRound = submission.reviewRound + 1;
  const updated = await prisma.$transaction(async (transaction) => {
    const next = await transaction.nativeEditorialSubmission.update({
      where: { id: submission.id },
      data: {
        title: revision.title,
        revisionId: revision.revisionId,
        stateDigest: revision.stateDigest,
        publicationContentDigest: revision.publicationContentDigest,
        manuscriptStateSnapshot:
          revision.manuscriptStateSnapshot as Prisma.InputJsonValue,
        reviewSnapshot: revision.reviewSnapshot as unknown as Prisma.InputJsonValue,
        status: 'REVISION_SUBMITTED',
        reviewRound: nextRound,
        editorialNote: null,
        revisionSubmittedAt: new Date(),
      },
    });
    await transaction.nativeEditorialSubmissionAsset.deleteMany({
      where: { submissionId: submission.id },
    });
    if (revision.assets.length) {
      await transaction.nativeEditorialSubmissionAsset.createMany({
        data: revision.assets.map((asset) => ({
          submissionId: submission.id,
          assetId: asset.assetId,
          mediaType: asset.mediaType,
          checksum: asset.checksum,
          size: asset.bytes.byteLength,
          bytes: asset.bytes,
        })),
      });
    }
    await transaction.nativeEditorialSubmissionEvent.create({
      data: {
        submissionId: submission.id,
        actorUserId: authorUserId,
        type: 'REVISION_SUBMITTED',
        reviewRound: nextRound,
        revisionId: revision.revisionId,
        stateDigest: revision.stateDigest,
      },
    });
    return next;
  });
  return serializeSubmissionSummary(updated);
}

export async function rejectNativeEditorialSubmission(
  editorUserId: string,
  submissionId: string,
  note: string,
) {
  const submission = await loadSubmission(submissionId);
  await ensureSubmissionEditorAccess(editorUserId, submission);
  if (['ACCEPTED', 'REJECTED', 'PUBLISHED'].includes(submission.status)) {
    throw conflict('This submission already has a terminal editorial state.');
  }
  const normalizedNote = note.trim();
  const updated = await prisma.$transaction(async (transaction) => {
    const next = await transaction.nativeEditorialSubmission.update({
      where: { id: submission.id },
      data: {
        status: 'REJECTED',
        editorialNote: normalizedNote || null,
        rejectedAt: new Date(),
      },
    });
    await transaction.nativeEditorialSubmissionEvent.create({
      data: {
        submissionId: submission.id,
        actorUserId: editorUserId,
        type: 'REJECTED',
        reviewRound: submission.reviewRound,
        revisionId: submission.revisionId,
        stateDigest: submission.stateDigest,
        ...(normalizedNote ? { note: normalizedNote } : {}),
      },
    });
    return next;
  });
  return serializeSubmissionSummary(updated);
}

export async function acceptNativeEditorialSubmission(
  editorUserId: string,
  submissionId: string,
): Promise<{
  submission: ReturnType<typeof serializeSubmissionSummary>;
  evidence: EditorialDecisionEvidence;
}> {
  const submission = await loadSubmission(submissionId);
  await ensureSubmissionEditorAccess(editorUserId, submission);
  if (submission.status === 'ACCEPTED' || submission.status === 'PUBLISHED') {
    const existing = await prisma.editorialDecision.findUnique({
      where: {
        workspaceId_manuscriptId_revisionId: {
          workspaceId: submission.workspaceId,
          manuscriptId: submission.manuscriptId,
          revisionId: submission.revisionId,
        },
      },
    });
    if (!existing) {
      throw conflict('The accepted submission is missing its editorial-decision evidence.');
    }
  } else if (!ACTIVE_EDITOR_STATUSES.has(submission.status)) {
    throw conflict('This submission cannot be accepted in its current state.');
  }

  const round = await latestCompletedScientificRound(
    submission.workspaceId,
    submission.manuscriptId,
    submission.status === 'IN_REVIEW'
      ? submission.reviewRound
      : undefined,
  );
  if (!round) {
    throw conflict(
      'Editorial acceptance requires a completed Studio-native scientific review round.',
    );
  }

  const evidence = await createEditorialAcceptance(editorUserId, {
    workspaceId: submission.workspaceId,
    manuscriptId: submission.manuscriptId,
    revisionId: submission.revisionId,
    stateDigest: submission.stateDigest,
    publicationContentDigest: submission.publicationContentDigest,
    publicationVenueId: submission.publicationVenueId,
    reviewRound: round.reviewRound,
    basisAssignmentIds: round.assignmentIds,
  });

  const updated = await prisma.$transaction(async (transaction) => {
    const next = await transaction.nativeEditorialSubmission.update({
      where: { id: submission.id },
      data: {
        status: submission.status === 'PUBLISHED' ? 'PUBLISHED' : 'ACCEPTED',
        acceptedAt: submission.acceptedAt ?? new Date(),
        editorialNote: null,
      },
    });
    const existingEvent = await transaction.nativeEditorialSubmissionEvent.findFirst({
      where: {
        submissionId: submission.id,
        type: 'ACCEPTED',
        revisionId: submission.revisionId,
      },
      select: { id: true },
    });
    if (!existingEvent) {
      await transaction.nativeEditorialSubmissionEvent.create({
        data: {
          submissionId: submission.id,
          actorUserId: editorUserId,
          type: 'ACCEPTED',
          reviewRound: round.reviewRound,
          revisionId: submission.revisionId,
          stateDigest: submission.stateDigest,
          note: evidence.decisionId,
        },
      });
    }
    return next;
  });
  return {
    submission: serializeSubmissionSummary(updated),
    evidence,
  };
}

export async function markNativeEditorialSubmissionPublished(
  editorUserId: string,
  submissionId: string,
  revisionId: string,
  externalUrl: string,
) {
  const submission = await loadSubmission(submissionId);
  await ensureSubmissionEditorAccess(editorUserId, submission);
  if (submission.status !== 'ACCEPTED' && submission.status !== 'PUBLISHED') {
    throw conflict('Only an accepted Studio-native submission can be marked published.');
  }
  if (revisionId !== submission.revisionId) {
    throw conflict('The published revision does not match the accepted submission revision.');
  }
  const decision = await prisma.editorialDecision.findUnique({
    where: {
      workspaceId_manuscriptId_revisionId: {
        workspaceId: submission.workspaceId,
        manuscriptId: submission.manuscriptId,
        revisionId,
      },
    },
    select: { id: true, decision: true },
  });
  if (!decision || decision.decision !== 'ACCEPT') {
    throw conflict('Publisher-verified editorial acceptance is required before publication.');
  }
  assertPublicationUrlMatchesVenue(externalUrl, submission.publicationVenueDomain);
  const updated = await prisma.$transaction(async (transaction) => {
    const next = await transaction.nativeEditorialSubmission.update({
      where: { id: submission.id },
      data: {
        status: 'PUBLISHED',
        publishedAt: submission.publishedAt ?? new Date(),
      },
    });
    const existingEvent = await transaction.nativeEditorialSubmissionEvent.findFirst({
      where: {
        submissionId: submission.id,
        type: 'PUBLISHED',
        revisionId,
      },
      select: { id: true },
    });
    if (!existingEvent) {
      await transaction.nativeEditorialSubmissionEvent.create({
        data: {
          submissionId: submission.id,
          actorUserId: editorUserId,
          type: 'PUBLISHED',
          reviewRound: submission.reviewRound,
          revisionId,
          stateDigest: submission.stateDigest,
          note: externalUrl,
        },
      });
    }
    return next;
  });
  return serializeSubmissionSummary(updated);
}

function assertPublicationUrlMatchesVenue(
  externalUrl: string,
  publicationVenueDomain: string,
): void {
  let parsed: URL;
  try {
    parsed = new URL(externalUrl);
  } catch {
    throw conflict('A valid external publication URL is required.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw conflict('The external publication URL must use HTTP or HTTPS.');
  }
  const hostname = parsed.hostname.toLowerCase().replace(/\.$/u, '');
  const domain = publicationVenueDomain.toLowerCase().replace(/\.$/u, '');
  if (hostname !== domain && !hostname.endsWith(`.${domain}`)) {
    throw conflict(
      'The published URL is outside the verified publication-venue domain.',
    );
  }
}

async function ensureSubmissionEditorAccess(
  editorUserId: string,
  submission: {
    workspaceId: string;
    manuscriptId: string;
    publicationVenueId: string;
  },
): Promise<void> {
  await assertStudioNativePublicationVenueEditorAuthority(
    editorUserId,
    submission.publicationVenueId,
  );
  await prisma.reviewWorkspaceAccess.upsert({
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
}

async function latestCompletedScientificRound(
  workspaceId: string,
  manuscriptId: string,
  requiredRound?: number,
): Promise<{ reviewRound: number; assignmentIds: string[] } | null> {
  const assignments = await prisma.peerReviewAssignment.findMany({
    where: {
      workspaceId,
      manuscriptId,
      assignmentType: 'SCIENTIFIC_REVIEW',
    },
    orderBy: [{ reviewRound: 'desc' }, { id: 'asc' }],
  });
  const byRound = new Map<number, typeof assignments>();
  for (const assignment of assignments) {
    const group = byRound.get(assignment.reviewRound) ?? [];
    group.push(assignment);
    byRound.set(assignment.reviewRound, group);
  }
  const reviewRounds = requiredRound === undefined
    ? Array.from(byRound.keys()).sort((a, b) => b - a)
    : [requiredRound];
  for (const reviewRound of reviewRounds) {
    const group = (byRound.get(reviewRound) ?? [])
      .filter((assignment) => assignment.status !== 'DECLINED');
    if (
      group.length > 0 &&
      group.every((assignment) =>
        assignment.status === 'COMPLETED' &&
        assignment.externalInstallationId === null &&
        assignment.externalAssignmentId === null &&
        assignment.assignedByUserId !== null &&
        assignment.submittedAt !== null &&
        assignment.completedAt !== null &&
        assignment.recommendation !== null &&
        assignment.manuscriptSnapshot !== null
      )
    ) {
      return {
        reviewRound,
        assignmentIds: group.map((assignment) => assignment.id).sort(),
      };
    }
  }
  return null;
}

async function loadSubmission(submissionId: string) {
  const submission = await prisma.nativeEditorialSubmission.findUnique({
    where: { id: submissionId },
    include: {
      author: {
        select: {
          id: true,
          email: true,
          fullName: true,
          affiliation: true,
          orcid: true,
        },
      },
      events: { orderBy: { createdAt: 'asc' } },
      assets: { orderBy: { assetId: 'asc' } },
    },
  });
  if (!submission) throw notFound('The Studio-native submission was not found.');
  return submission;
}

function validateRevisionInput(input: NativeEditorialRevisionInput) {
  const manuscriptId = input.manuscriptId.trim();
  const title = input.title.trim().slice(0, 500);
  const revisionId = input.revisionId.trim();
  const stateDigest = input.stateDigest.trim().toLowerCase();
  const publicationContentDigest =
    input.publicationContentDigest.trim().toLowerCase();
  if (!manuscriptId || !revisionId) {
    throw new Error('A manuscript and committed revision are required.');
  }
  if (!/^[a-f0-9]{64}$/.test(stateDigest)) {
    throw new Error('A valid SHA-256 manuscript-state digest is required.');
  }
  if (!/^[a-f0-9]{64}$/.test(publicationContentDigest)) {
    throw new Error('A valid SHA-256 publication-content digest is required.');
  }
  const manuscriptStateSnapshot = asRecord(input.manuscriptStateSnapshot);
  if (
    typeof manuscriptStateSnapshot.id !== 'string' ||
    manuscriptStateSnapshot.id !== manuscriptId
  ) {
    throw conflict('The submitted manuscript state does not match the manuscript identifier.');
  }
  const calculatedDigest =
    calculatePortableStateDigest(manuscriptStateSnapshot).toLowerCase();
  if (calculatedDigest !== stateDigest) {
    throw conflict('The submitted manuscript-state digest does not match the supplied snapshot.');
  }
  const reviewSnapshot = sanitizeReviewManuscript(input.reviewSnapshot);
  const assets = validateSubmissionAssets(
    manuscriptStateSnapshot,
    input.assets ?? [],
  );
  return {
    manuscriptId,
    title: title || reviewSnapshot.title || 'Untitled manuscript',
    revisionId,
    stateDigest,
    publicationContentDigest,
    manuscriptStateSnapshot,
    reviewSnapshot,
    assets,
  };
}

function serializeSubmissionSummary(submission: {
  id: string;
  workspaceId: string;
  manuscriptId: string;
  publicationVenueId: string;
  publicationVenueName: string;
  publicationVenueDomain: string;
  authorUserId: string;
  title: string;
  revisionId: string;
  stateDigest: string;
  publicationContentDigest: string;
  status: string;
  reviewRound: number;
  editorialNote: string | null;
  submittedAt: Date;
  revisionRequestedAt: Date | null;
  revisionSubmittedAt: Date | null;
  acceptedAt: Date | null;
  rejectedAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: submission.id,
    workspaceId: submission.workspaceId,
    manuscriptId: submission.manuscriptId,
    publicationVenueId: submission.publicationVenueId,
    publicationVenueName: submission.publicationVenueName,
    publicationVenueDomain: submission.publicationVenueDomain,
    authorUserId: submission.authorUserId,
    title: submission.title,
    revisionId: submission.revisionId,
    stateDigest: submission.stateDigest,
    publicationContentDigest: submission.publicationContentDigest,
    status: submission.status.toLowerCase(),
    reviewRound: submission.reviewRound,
    ...(submission.editorialNote ? { editorialNote: submission.editorialNote } : {}),
    submittedAt: submission.submittedAt.toISOString(),
    ...(submission.revisionRequestedAt
      ? { revisionRequestedAt: submission.revisionRequestedAt.toISOString() }
      : {}),
    ...(submission.revisionSubmittedAt
      ? { revisionSubmittedAt: submission.revisionSubmittedAt.toISOString() }
      : {}),
    ...(submission.acceptedAt
      ? { acceptedAt: submission.acceptedAt.toISOString() }
      : {}),
    ...(submission.rejectedAt
      ? { rejectedAt: submission.rejectedAt.toISOString() }
      : {}),
    ...(submission.publishedAt
      ? { publishedAt: submission.publishedAt.toISOString() }
      : {}),
    updatedAt: submission.updatedAt.toISOString(),
  };
}

function serializeSubmissionDetail(
  submission: Awaited<ReturnType<typeof loadSubmission>>,
) {
  return {
    ...serializeSubmissionSummary(submission),
    manuscriptStateSnapshot: submission.manuscriptStateSnapshot,
    reviewSnapshot: submission.reviewSnapshot,
    author: serializePerson(submission.author),
    assets: submission.assets.map((asset) => ({
      assetId: asset.assetId,
      mediaType: asset.mediaType,
      checksum: asset.checksum,
      size: asset.size,
      bytesBase64: Buffer.from(asset.bytes).toString('base64'),
    })),
    events: submission.events.map((event) => ({
      id: event.id,
      type: event.type.toLowerCase(),
      actorUserId: event.actorUserId,
      reviewRound: event.reviewRound,
      ...(event.revisionId ? { revisionId: event.revisionId } : {}),
      ...(event.stateDigest ? { stateDigest: event.stateDigest } : {}),
      ...(event.note ? { note: event.note } : {}),
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

function serializePerson(person: {
  id: string;
  email: string;
  fullName: string;
  affiliation: string | null;
  orcid: string | null;
}) {
  return {
    userId: person.id,
    email: person.email,
    fullName: person.fullName,
    ...(person.affiliation ? { affiliation: person.affiliation } : {}),
    ...(person.orcid ? { orcid: person.orcid } : {}),
  };
}

function assertRevisionPublicationVenue(
  manuscriptStateSnapshot: Record<string, unknown>,
  publicationVenueId: string,
): void {
  const metadata = asOptionalRecord(manuscriptStateSnapshot.metadata);
  const venue = asOptionalRecord(metadata?.publicationVenue);
  const embeddedVenueId =
    typeof venue?.id === 'string' ? venue.id.trim() : '';
  if (embeddedVenueId !== publicationVenueId) {
    throw conflict(
      'The submitted manuscript revision is not bound to the selected publication venue.',
    );
  }
}

function asOptionalRecord(
  value: unknown,
): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function validateSubmissionAssets(
  manuscriptStateSnapshot: Record<string, unknown>,
  inputs: NativeEditorialAssetInput[],
): Array<{
  assetId: string;
  mediaType: string;
  checksum: string;
  bytes: Uint8Array<ArrayBuffer>;
}> {
  const declared = new Map<string, {
    mediaType: string;
    size: number;
    checksum: string;
  }>();
  const rawAssets = Array.isArray(manuscriptStateSnapshot.assets)
    ? manuscriptStateSnapshot.assets
    : [];
  for (const raw of rawAssets) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const asset = raw as Record<string, unknown>;
    const checksumRecord =
      asset.checksum && typeof asset.checksum === 'object' && !Array.isArray(asset.checksum)
        ? asset.checksum as Record<string, unknown>
        : null;
    const assetId = typeof asset.id === 'string' ? asset.id.trim() : '';
    const mediaType = typeof asset.mediaType === 'string' ? asset.mediaType.trim() : '';
    const size = typeof asset.size === 'number' && Number.isInteger(asset.size)
      ? asset.size
      : -1;
    const checksum = checksumRecord?.algorithm === 'sha256' &&
      typeof checksumRecord.value === 'string'
      ? checksumRecord.value.toLowerCase()
      : '';
    if (!assetId || !mediaType || size < 0 || !/^[a-f0-9]{64}$/.test(checksum)) {
      throw new Error('Submitted manuscript asset metadata is invalid.');
    }
    declared.set(assetId, { mediaType, size, checksum });
  }

  const supplied = new Map<string, NativeEditorialAssetInput>();
  for (const input of inputs) {
    const assetId = input.assetId.trim();
    if (!assetId || supplied.has(assetId)) {
      throw new Error('Submitted manuscript assets contain a duplicate or empty identifier.');
    }
    supplied.set(assetId, input);
  }
  if (declared.size !== supplied.size) {
    throw conflict(
      'The submitted asset payload set does not match the manuscript asset metadata.',
    );
  }

  const result: Array<{
    assetId: string;
    mediaType: string;
    checksum: string;
    bytes: Uint8Array<ArrayBuffer>;
  }> = [];
  let totalBytes = 0;
  for (const [assetId, metadata] of declared) {
    const input = supplied.get(assetId);
    if (!input) {
      throw conflict(`The submitted manuscript is missing asset payload ${assetId}.`);
    }
    let bytes: Uint8Array<ArrayBuffer>;
    try {
      const decoded = Buffer.from(input.bytesBase64, 'base64');
      bytes = new Uint8Array(decoded.byteLength);
      bytes.set(decoded);
    } catch {
      throw new Error(`Asset ${assetId} is not valid base64 data.`);
    }
    totalBytes += bytes.byteLength;
    if (bytes.byteLength !== metadata.size) {
      throw conflict(`Asset ${assetId} does not match its declared size.`);
    }
    const checksum = createHash('sha256').update(bytes).digest('hex');
    if (checksum !== metadata.checksum || input.checksum.toLowerCase() !== checksum) {
      throw conflict(`Asset ${assetId} does not match its declared SHA-256 checksum.`);
    }
    if (input.mediaType.trim() !== metadata.mediaType) {
      throw conflict(`Asset ${assetId} does not match its declared media type.`);
    }
    result.push({
      assetId,
      mediaType: metadata.mediaType,
      checksum,
      bytes,
    });
  }
  if (totalBytes > 48 * 1024 * 1024) {
    throw new Error('The submitted manuscript assets exceed the 48 MiB Studio-native workflow limit.');
  }
  return result;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('A canonical manuscript-state snapshot is required.');
  }
  return value as Record<string, unknown>;
}

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002',
  );
}

function notFound(message: string): Error {
  const error = new Error(message);
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
