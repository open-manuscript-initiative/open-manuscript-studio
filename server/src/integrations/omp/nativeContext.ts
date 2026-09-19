import { randomUUID } from 'node:crypto';

import { prisma } from '../../lib/prisma.js';

export interface OmpNativeContext {
  id: string;
  assignmentId: string | null;
  userId: string | null;
  installationId: string;
  apiBaseUrl: string;
  externalSubmissionId: string;
  externalActorId: string;
  actorMode: 'author' | 'review';
  externalAssignmentId: string | null;
  externalReviewRoundId: string | null;
  reviewRound: number | null;
  stageId: number | null;
  componentExternalId: string | null;
  sourceSubmissionFileExternalId: string | null;
  sourceGenreExternalId: string | null;
  capabilities: Record<string, unknown>;
  writable: boolean;
}

interface OmpNativeContextRow {
  id: string;
  assignment_id: string | null;
  user_id: string | null;
  installation_id: string;
  api_base_url: string;
  external_submission_id: string;
  external_actor_id: string;
  actor_mode: string;
  external_assignment_id: string | null;
  external_review_round_id: string | null;
  review_round: number | null;
  stage_id: number | null;
  component_external_id: string | null;
  source_submission_file_external_id: string | null;
  source_genre_external_id: string | null;
  capabilities: unknown;
  writable: boolean;
}

export interface PersistReviewerOmpNativeContextInput {
  assignmentId: string;
  installationId: string;
  apiBaseUrl: string;
  externalSubmissionId: string;
  externalActorId: string;
  externalAssignmentId: string;
  externalReviewRoundId: string;
  reviewRound: number;
  stageId: number;
  componentExternalId: string;
  sourceSubmissionFileExternalId?: string;
  sourceGenreExternalId?: string;
  capabilities: Record<string, unknown>;
  writable: boolean;
}

export interface PersistAuthorOmpNativeContextInput {
  userId: string;
  installationId: string;
  apiBaseUrl: string;
  externalSubmissionId: string;
  externalActorId: string;
  externalReviewRoundId?: string;
  reviewRound?: number;
  stageId?: number;
  sourceSubmissionFileExternalId?: string;
  sourceGenreExternalId?: string;
  capabilities: Record<string, unknown>;
  writable: boolean;
}

export async function persistReviewerOmpNativeContext(
  input: PersistReviewerOmpNativeContextInput,
): Promise<OmpNativeContext> {
  const id = randomUUID();
  const capabilities = JSON.stringify(input.capabilities);

  await prisma.$executeRaw`
    INSERT INTO omp_native_contexts (
      id, assignment_id, user_id, installation_id, api_base_url,
      external_submission_id, external_actor_id, actor_mode,
      external_assignment_id, external_review_round_id, review_round,
      stage_id, component_external_id, source_submission_file_external_id,
      source_genre_external_id, capabilities, writable, updated_at
    )
    VALUES (
      ${id}::uuid, ${input.assignmentId}::uuid, NULL,
      ${input.installationId}, ${input.apiBaseUrl},
      ${input.externalSubmissionId}, ${input.externalActorId}, 'review',
      ${input.externalAssignmentId}, ${input.externalReviewRoundId},
      ${input.reviewRound}, ${input.stageId}, ${input.componentExternalId},
      ${input.sourceSubmissionFileExternalId ?? null},
      ${input.sourceGenreExternalId ?? null},
      ${capabilities}::jsonb, ${input.writable}, CURRENT_TIMESTAMP
    )
    ON CONFLICT (assignment_id) WHERE assignment_id IS NOT NULL
    DO UPDATE SET
      installation_id = EXCLUDED.installation_id,
      api_base_url = EXCLUDED.api_base_url,
      external_submission_id = EXCLUDED.external_submission_id,
      external_actor_id = EXCLUDED.external_actor_id,
      external_assignment_id = EXCLUDED.external_assignment_id,
      external_review_round_id = EXCLUDED.external_review_round_id,
      review_round = EXCLUDED.review_round,
      stage_id = EXCLUDED.stage_id,
      component_external_id = EXCLUDED.component_external_id,
      source_submission_file_external_id = EXCLUDED.source_submission_file_external_id,
      source_genre_external_id = EXCLUDED.source_genre_external_id,
      capabilities = EXCLUDED.capabilities,
      writable = EXCLUDED.writable,
      updated_at = CURRENT_TIMESTAMP
  `;

  const stored = await getReviewerOmpNativeContext(input.assignmentId);
  if (!stored) throw new Error('Unable to persist the OMP reviewer workflow context.');
  return stored;
}

export async function createPendingAuthorOmpNativeContext(
  input: Omit<PersistAuthorOmpNativeContextInput, 'userId'>,
): Promise<OmpNativeContext> {
  const id = randomUUID();
  const capabilities = JSON.stringify(input.capabilities);

  await prisma.$executeRaw`
    INSERT INTO omp_native_contexts (
      id, assignment_id, user_id, installation_id, api_base_url,
      external_submission_id, external_actor_id, actor_mode,
      external_assignment_id, external_review_round_id, review_round,
      stage_id, component_external_id, source_submission_file_external_id,
      source_genre_external_id, capabilities, writable, updated_at
    )
    VALUES (
      ${id}::uuid, NULL, NULL,
      ${input.installationId}, ${input.apiBaseUrl},
      ${input.externalSubmissionId}, ${input.externalActorId}, 'author',
      NULL, ${input.externalReviewRoundId ?? null},
      ${input.reviewRound ?? null}, ${input.stageId ?? null}, NULL,
      ${input.sourceSubmissionFileExternalId ?? null},
      ${input.sourceGenreExternalId ?? null},
      ${capabilities}::jsonb, ${input.writable}, CURRENT_TIMESTAMP
    )
  `;

  const rows = await prisma.$queryRaw<OmpNativeContextRow[]>`
    SELECT *
    FROM omp_native_contexts
    WHERE id = ${id}::uuid
    LIMIT 1
  `;
  if (!rows[0]) throw new Error('Unable to persist the pending OMP author workflow context.');
  return mapRow(rows[0]);
}

export async function claimAuthorOmpNativeContext(
  contextId: string,
  userId: string,
): Promise<OmpNativeContext | null> {
  const updated = await prisma.$executeRaw`
    UPDATE omp_native_contexts
    SET user_id = ${userId}::uuid, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${contextId}::uuid
      AND actor_mode = 'author'
      AND assignment_id IS NULL
      AND (user_id IS NULL OR user_id = ${userId}::uuid)
  `;
  if (updated < 1) return null;

  return getAuthorOmpNativeContext(contextId, userId);
}

export async function persistAuthorOmpNativeContext(
  input: PersistAuthorOmpNativeContextInput,
): Promise<OmpNativeContext> {
  const id = randomUUID();
  const capabilities = JSON.stringify(input.capabilities);

  await prisma.$executeRaw`
    INSERT INTO omp_native_contexts (
      id, assignment_id, user_id, installation_id, api_base_url,
      external_submission_id, external_actor_id, actor_mode,
      external_assignment_id, external_review_round_id, review_round,
      stage_id, component_external_id, source_submission_file_external_id,
      source_genre_external_id, capabilities, writable, updated_at
    )
    VALUES (
      ${id}::uuid, NULL, ${input.userId}::uuid,
      ${input.installationId}, ${input.apiBaseUrl},
      ${input.externalSubmissionId}, ${input.externalActorId}, 'author',
      NULL, ${input.externalReviewRoundId ?? null},
      ${input.reviewRound ?? null}, ${input.stageId ?? null}, NULL,
      ${input.sourceSubmissionFileExternalId ?? null},
      ${input.sourceGenreExternalId ?? null},
      ${capabilities}::jsonb, ${input.writable}, CURRENT_TIMESTAMP
    )
    ON CONFLICT (user_id, installation_id, external_submission_id, actor_mode)
      WHERE assignment_id IS NULL AND user_id IS NOT NULL
    DO UPDATE SET
      api_base_url = EXCLUDED.api_base_url,
      external_actor_id = EXCLUDED.external_actor_id,
      external_review_round_id = EXCLUDED.external_review_round_id,
      review_round = EXCLUDED.review_round,
      stage_id = EXCLUDED.stage_id,
      source_submission_file_external_id = EXCLUDED.source_submission_file_external_id,
      source_genre_external_id = EXCLUDED.source_genre_external_id,
      capabilities = EXCLUDED.capabilities,
      writable = EXCLUDED.writable,
      updated_at = CURRENT_TIMESTAMP
  `;

  const rows = await prisma.$queryRaw<OmpNativeContextRow[]>`
    SELECT *
    FROM omp_native_contexts
    WHERE user_id = ${input.userId}::uuid
      AND installation_id = ${input.installationId}
      AND external_submission_id = ${input.externalSubmissionId}
      AND actor_mode = 'author'
      AND assignment_id IS NULL
    LIMIT 1
  `;
  const stored = rows[0] ? mapRow(rows[0]) : null;
  if (!stored) throw new Error('Unable to persist the OMP author workflow context.');
  return stored;
}

export async function getReviewerOmpNativeContext(
  assignmentId: string,
): Promise<OmpNativeContext | null> {
  const rows = await prisma.$queryRaw<OmpNativeContextRow[]>`
    SELECT *
    FROM omp_native_contexts
    WHERE assignment_id = ${assignmentId}::uuid
      AND actor_mode = 'review'
    LIMIT 1
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function getAuthorOmpNativeContext(
  contextId: string,
  userId: string,
): Promise<OmpNativeContext | null> {
  const rows = await prisma.$queryRaw<OmpNativeContextRow[]>`
    SELECT *
    FROM omp_native_contexts
    WHERE id = ${contextId}::uuid
      AND user_id = ${userId}::uuid
      AND actor_mode = 'author'
      AND assignment_id IS NULL
    LIMIT 1
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

function mapRow(row: OmpNativeContextRow): OmpNativeContext {
  return {
    id: row.id,
    assignmentId: row.assignment_id,
    userId: row.user_id,
    installationId: row.installation_id,
    apiBaseUrl: row.api_base_url,
    externalSubmissionId: row.external_submission_id,
    externalActorId: row.external_actor_id,
    actorMode: row.actor_mode === 'review' ? 'review' : 'author',
    externalAssignmentId: row.external_assignment_id,
    externalReviewRoundId: row.external_review_round_id,
    reviewRound: row.review_round,
    stageId: row.stage_id,
    componentExternalId: row.component_external_id,
    sourceSubmissionFileExternalId: row.source_submission_file_external_id,
    sourceGenreExternalId: row.source_genre_external_id,
    capabilities: asRecord(row.capabilities),
    writable: row.writable,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
