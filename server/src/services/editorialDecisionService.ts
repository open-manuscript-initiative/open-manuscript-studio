import { createHash } from 'node:crypto';

import {
  Prisma,
  type PeerReviewAssignment,
} from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';
import {
  assertVerifiedPublicationVenueEditorAuthority,
  type VerifiedPublicationVenueAuthority,
} from './publicationVenueAuthorityService.js';

export const EDITORIAL_ACCEPTANCE_CONFIRMATION =
  'editor-accepts-exact-revision-for-web-publication-v1' as const;

export interface CreateEditorialAcceptanceInput {
  workspaceId: string;
  manuscriptId: string;
  revisionId: string;
  stateDigest: string;
  publicationContentDigest: string;
  publicationVenueId?: string;
  reviewRound: number;
  basisAssignmentIds: string[];
}

export interface EditorialDecisionEvidence {
  type: 'studio-editorial-decision';
  decisionId: string;
  evidenceDigest: string;
  publicationContentDigest: string;
  authority?: VerifiedPublicationVenueAuthority;
  reviewRound: number;
  decidedAt: string;
}

export interface EligibleEditorialReviewRound {
  workspaceId: string;
  reviewRound: number;
  basisAssignmentIds: string[];
  completedScientificReviews: number;
}

export async function createEditorialAcceptance(
  editorUserId: string,
  input: CreateEditorialAcceptanceInput,
): Promise<EditorialDecisionEvidence> {
  assertDigest(input.stateDigest);
  assertDigest(input.publicationContentDigest);
  if (!input.revisionId.trim()) throw new Error('A committed revision is required.');
  if (!Number.isInteger(input.reviewRound) || input.reviewRound < 1) {
    throw new Error('A valid review round is required.');
  }
  const assignmentIds = uniqueSorted(input.basisAssignmentIds);
  if (!assignmentIds.length) {
    throw new Error('At least one completed scientific review is required.');
  }

  await requireManuscriptWorkspaceRole(
    editorUserId,
    input.workspaceId,
    input.manuscriptId,
    'EDITOR',
  );
  const assignments = await loadAcceptanceAssignments(input, assignmentIds);
  const authority = input.publicationVenueId
    ? await assertVerifiedPublicationVenueEditorAuthority(
        editorUserId,
        input.publicationVenueId,
      )
    : undefined;
  const evidenceDigest = calculateEvidenceDigest({
    ...input,
    basisAssignmentIds: assignmentIds,
    editorUserId,
    ...(authority ? { authority } : {}),
  }, assignments);
  const existing = await prisma.editorialDecision.findUnique({
    where: {
      workspaceId_manuscriptId_revisionId: {
        workspaceId: input.workspaceId,
        manuscriptId: input.manuscriptId,
        revisionId: input.revisionId,
      },
    },
  });
  if (existing) {
    if (
      existing.decision !== 'ACCEPT' ||
      existing.stateDigest.toLowerCase() !== input.stateDigest.toLowerCase() ||
      existing.publicationContentDigest.toLowerCase() !== input.publicationContentDigest.toLowerCase() ||
      (existing.publicationVenueId ?? null) !== (authority?.venueId ?? null) ||
      canonicalJson(parseAuthoritySnapshot(existing.authoritySnapshot) ?? null) !==
        canonicalJson(authority ?? null) ||
      existing.evidenceDigest !== evidenceDigest
    ) {
      throw conflict('This revision already has a different editorial decision or evidence set.');
    }
    return serializeEvidence(existing);
  }

  const decision = await prisma.editorialDecision.create({
    data: {
      workspaceId: input.workspaceId,
      manuscriptId: input.manuscriptId,
      revisionId: input.revisionId,
      stateDigest: input.stateDigest.toLowerCase(),
      publicationContentDigest: input.publicationContentDigest.toLowerCase(),
      ...(authority
        ? {
            publicationVenueId: authority.venueId,
            authoritySnapshot: authority as unknown as Prisma.InputJsonValue,
          }
        : {}),
      reviewRound: input.reviewRound,
      decision: 'ACCEPT',
      basisAssignmentIds: assignmentIds as Prisma.InputJsonValue,
      evidenceDigest,
      decidedByUserId: editorUserId,
    },
  });
  return serializeEvidence(decision);
}

export async function listEditorialPublicationEvidence(
  userId: string,
  manuscriptId: string,
  revisionId: string,
  stateDigest: string,
): Promise<{
  decisions: EditorialDecisionEvidence[];
  eligibleReviewRounds: EligibleEditorialReviewRound[];
}> {
  assertDigest(stateDigest);
  const access = await prisma.reviewWorkspaceAccess.findMany({
    where: {
      userId,
      manuscriptId,
      role: { in: ['AUTHOR', 'EDITOR'] },
    },
    select: { workspaceId: true, role: true },
  });
  const workspaceIds = uniqueSorted(access.map((item) => item.workspaceId));
  if (!workspaceIds.length) {
    return { decisions: [], eligibleReviewRounds: [] };
  }

  const decisions = await prisma.editorialDecision.findMany({
    where: {
      workspaceId: { in: workspaceIds },
      manuscriptId,
      revisionId,
      stateDigest: stateDigest.toLowerCase(),
      decision: 'ACCEPT',
    },
    orderBy: { decidedAt: 'desc' },
  });
  const validDecisions: EditorialDecisionEvidence[] = [];
  for (const decision of decisions) {
    if (await decisionEvidenceIsCurrent(decision)) {
      validDecisions.push(serializeEvidence(decision));
    }
  }

  const editorWorkspaceIds = new Set(
    access
      .filter((item) => item.role === 'EDITOR')
      .map((item) => item.workspaceId),
  );
  const reviewAssignments = editorWorkspaceIds.size
    ? await prisma.peerReviewAssignment.findMany({
        where: {
          workspaceId: { in: Array.from(editorWorkspaceIds) },
          manuscriptId,
          assignmentType: 'SCIENTIFIC_REVIEW',
        },
        orderBy: [{ workspaceId: 'asc' }, { reviewRound: 'desc' }, { id: 'asc' }],
      })
    : [];
  const groups = new Map<string, PeerReviewAssignment[]>();
  for (const assignment of reviewAssignments) {
    const key = `${assignment.workspaceId}\u0000${assignment.reviewRound}`;
    const group = groups.get(key) ?? [];
    group.push(assignment);
    groups.set(key, group);
  }
  const eligibleReviewRounds = Array.from(groups.values())
    .filter(isCompletedNativeScientificRound)
    .map((assignments) => ({
      workspaceId: assignments[0]!.workspaceId,
      reviewRound: assignments[0]!.reviewRound,
      basisAssignmentIds: assignments.map((assignment) => assignment.id).sort(),
      completedScientificReviews: assignments.length,
    }));

  return { decisions: validDecisions, eligibleReviewRounds };
}

export async function assertEditorialDecisionEvidence(input: {
  userId: string;
  manuscriptId: string;
  revisionId: string;
  stateDigest: string;
  publicationContentDigest: string;
  decisionId: string;
  evidenceDigest: string;
}): Promise<EditorialDecisionEvidence> {
  const decision = await prisma.editorialDecision.findFirst({
    where: {
      id: input.decisionId,
      manuscriptId: input.manuscriptId,
      revisionId: input.revisionId,
      stateDigest: input.stateDigest.toLowerCase(),
      publicationContentDigest: input.publicationContentDigest.toLowerCase(),
      evidenceDigest: input.evidenceDigest.toLowerCase(),
      decision: 'ACCEPT',
    },
  });
  if (!decision) throw forbidden('The Studio editorial-decision evidence does not match this revision.');
  await requireAnyManuscriptWorkspaceRole(
    input.userId,
    decision.workspaceId,
    input.manuscriptId,
  );
  if (!(await decisionEvidenceIsCurrent(decision))) {
    throw conflict('The Studio editorial-decision evidence is no longer consistent with its completed reviews.');
  }
  return serializeEvidence(decision);
}

async function loadAcceptanceAssignments(
  input: Pick<CreateEditorialAcceptanceInput, 'workspaceId' | 'manuscriptId' | 'reviewRound'>,
  assignmentIds: string[],
): Promise<PeerReviewAssignment[]> {
  const assignments = await prisma.peerReviewAssignment.findMany({
    where: {
      workspaceId: input.workspaceId,
      manuscriptId: input.manuscriptId,
      reviewRound: input.reviewRound,
      assignmentType: 'SCIENTIFIC_REVIEW',
    },
  });
  const completeAssignmentIds = assignments.map((assignment) => assignment.id).sort();
  if (
    !sameStrings(completeAssignmentIds, assignmentIds) ||
    !isCompletedNativeScientificRound(assignments)
  ) {
    throw new Error(
      'Editorial acceptance requires every scientific assignment in the selected Studio-native round to be completed with a recommendation and an assigned manuscript snapshot.',
    );
  }
  return assignments.sort((left, right) => left.id.localeCompare(right.id));
}

function isCompletedNativeScientificRound(
  assignments: PeerReviewAssignment[],
): boolean {
  return assignments.length > 0 &&
    assignments.length <= 100 &&
    assignments.every((assignment) =>
    assignment.assignmentType === 'SCIENTIFIC_REVIEW' &&
    assignment.status === 'COMPLETED' &&
    assignment.externalInstallationId === null &&
    assignment.externalAssignmentId === null &&
    assignment.assignedByUserId !== null &&
    assignment.submittedAt !== null &&
    assignment.completedAt !== null &&
    assignment.recommendation !== null &&
    assignment.manuscriptSnapshot !== null
  );
}

function sameStrings(left: string[], right: string[]): boolean {
  return left.length === right.length &&
    left.every((value, index) => value === right[index]);
}

async function decisionEvidenceIsCurrent(decision: {
  workspaceId: string;
  manuscriptId: string;
  revisionId: string;
  stateDigest: string;
  publicationContentDigest: string;
  publicationVenueId: string | null;
  authoritySnapshot: unknown;
  reviewRound: number;
  decision: string;
  basisAssignmentIds: unknown;
  evidenceDigest: string;
  decidedByUserId: string;
}): Promise<boolean> {
  const assignmentIds = jsonStringArray(decision.basisAssignmentIds);
  if (!assignmentIds.length || decision.decision !== 'ACCEPT') return false;
  try {
    const assignments = await loadAcceptanceAssignments(decision, assignmentIds);
    return calculateEvidenceDigest({
      workspaceId: decision.workspaceId,
      manuscriptId: decision.manuscriptId,
      revisionId: decision.revisionId,
      stateDigest: decision.stateDigest,
      publicationContentDigest: decision.publicationContentDigest,
      ...(decision.publicationVenueId
        ? { publicationVenueId: decision.publicationVenueId }
        : {}),
      reviewRound: decision.reviewRound,
      basisAssignmentIds: assignmentIds,
      editorUserId: decision.decidedByUserId,
      ...(parseAuthoritySnapshot(decision.authoritySnapshot)
        ? { authority: parseAuthoritySnapshot(decision.authoritySnapshot)! }
        : {}),
    }, assignments) === decision.evidenceDigest;
  } catch {
    return false;
  }
}

function calculateEvidenceDigest(
  input: CreateEditorialAcceptanceInput & {
    editorUserId: string;
    authority?: VerifiedPublicationVenueAuthority;
  },
  assignments: PeerReviewAssignment[],
): string {
  return sha256(canonicalJson({
    model: 'omi-studio-editorial-decision',
    version: '1',
    decision: 'ACCEPT',
    workspaceId: input.workspaceId,
    manuscriptId: input.manuscriptId,
    revisionId: input.revisionId,
    stateDigest: input.stateDigest.toLowerCase(),
    publicationContentDigest: input.publicationContentDigest.toLowerCase(),
    authority: input.authority ?? null,
    reviewRound: input.reviewRound,
    decidedByUserId: input.editorUserId,
    reviews: assignments.map((assignment) => ({
      id: assignment.id,
      reviewerUserId: assignment.reviewerUserId,
      assignedByUserId: assignment.assignedByUserId,
      sourceSnapshotDigest: sha256(canonicalJson(assignment.manuscriptSnapshot)),
      reviewRevisionSnapshotDigest: assignment.reviewRevisionSnapshot === null
        ? null
        : sha256(canonicalJson(assignment.reviewRevisionSnapshot)),
      submittedAt: assignment.submittedAt!.toISOString(),
      completedAt: assignment.completedAt!.toISOString(),
      recommendation: assignment.recommendation,
      anonymityMode: assignment.anonymityMode,
    })),
  }));
}

async function requireManuscriptWorkspaceRole(
  userId: string,
  workspaceId: string,
  manuscriptId: string,
  role: 'AUTHOR' | 'EDITOR',
): Promise<void> {
  const access = await prisma.reviewWorkspaceAccess.findFirst({
    where: { userId, workspaceId, manuscriptId, role },
    select: { id: true },
  });
  if (!access) throw forbidden(`The ${role.toLowerCase()} role is required for this manuscript workspace.`);
}

async function requireAnyManuscriptWorkspaceRole(
  userId: string,
  workspaceId: string,
  manuscriptId: string,
): Promise<void> {
  const access = await prisma.reviewWorkspaceAccess.findFirst({
    where: {
      userId,
      workspaceId,
      manuscriptId,
      role: { in: ['AUTHOR', 'EDITOR'] },
    },
    select: { id: true },
  });
  if (!access) throw forbidden('Author or editor access is required for this editorial decision.');
}

function serializeEvidence(decision: {
  id: string;
  evidenceDigest: string;
  publicationContentDigest: string;
  authoritySnapshot: unknown;
  workspaceId: string;
  reviewRound: number;
  decidedAt: Date;
}): EditorialDecisionEvidence {
  return {
    type: 'studio-editorial-decision',
    decisionId: decision.id,
    evidenceDigest: decision.evidenceDigest,
    publicationContentDigest: decision.publicationContentDigest,
    ...(parseAuthoritySnapshot(decision.authoritySnapshot)
      ? { authority: parseAuthoritySnapshot(decision.authoritySnapshot)! }
      : {}),
    reviewRound: decision.reviewRound,
    decidedAt: decision.decidedAt.toISOString(),
  };
}

function parseAuthoritySnapshot(
  value: unknown,
): VerifiedPublicationVenueAuthority | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const authority = value as Record<string, unknown>;
  if (
    authority.type !== 'verified-publication-venue' ||
    typeof authority.venueId !== 'string' ||
    typeof authority.venueName !== 'string' ||
    (authority.venueType !== 'JOURNAL' && authority.venueType !== 'BOOK_PUBLISHER') ||
    typeof authority.domain !== 'string' ||
    authority.verificationMethod !== 'DNS_TXT' ||
    typeof authority.verificationId !== 'string' ||
    typeof authority.verifiedAt !== 'string' ||
    (authority.editorRole !== 'EDITOR' && authority.editorRole !== 'EDITOR_IN_CHIEF')
  ) {
    return undefined;
  }
  return authority as unknown as VerifiedPublicationVenueAuthority;
}

function jsonStringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? uniqueSorted(value)
    : [];
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort();
}

function assertDigest(value: string): void {
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new Error('A valid SHA-256 manuscript-state digest is required.');
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function canonicalJson(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') {
    return JSON.stringify(value);
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalJson(record[key])}`
    ).join(',')}}`;
  }
  throw new Error('Editorial-decision evidence contains an unsupported value.');
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
