import { z } from 'zod';
export const productionId = z.string().uuid();
const role = z.enum(['COPYEDITOR', 'LAYOUT_EDITOR', 'PROOFREADER']);
const approvalRole = z.enum(['AUTHOR', 'EDITOR']);
const source = z
  .object({
    manuscriptId: z.string().trim().min(1).max(128),
    title: z.string().max(500),
    revisionId: z.string().trim().min(1).max(128),
    stateDigest: z.string().regex(/^[0-9a-f]{64}$/),
    publicationContentDigest: z.string().regex(/^[0-9a-f]{64}$/),
    manuscriptStateSnapshot: z.record(z.string(), z.unknown()),
    reviewSnapshot: z.record(z.string(), z.unknown()),
    assets: z
      .array(
        z
          .object({
            assetId: z.string().max(128),
            mediaType: z.string().max(200),
            checksum: z.string().regex(/^[0-9a-f]{64}$/),
            bytesBase64: z.string().max(70_000_000),
          })
          .strict(),
      )
      .max(2000),
  })
  .strict();
export const productionCommandSchema = z
  .object({
    version: z.number().int().min(0),
    command: z.discriminatedUnion('type', [
      z.object({ type: z.literal('START') }).strict(),
      z
        .object({
          type: z.literal('ASSIGN'),
          email: z.string().email().max(320),
          role,
          dueAt: z.string().datetime().optional(),
        })
        .strict(),
      z
        .object({ type: z.literal('REVOKE'), userId: productionId, role })
        .strict(),
      z.object({ type: z.literal('SOURCE'), source }).strict(),
      z
        .object({
          type: z.literal('APPROVE_SOURCE'),
          role: approvalRole,
          fileId: productionId,
        })
        .strict(),
      z.object({ type: z.literal('LAYOUT') }).strict(),
      z
        .object({
          type: z.literal('PROOF'),
          artifactBase64: z.string().min(1).max(46_000_000),
          build: z.record(z.string(), z.unknown()),
        })
        .strict(),
      z
        .object({
          type: z.literal('CORRECTION'),
          fileId: productionId,
          locator: z.string().trim().min(1).max(500),
          note: z.string().trim().min(1).max(10_000),
        })
        .strict(),
      z
        .object({
          type: z.literal('RESOLVE'),
          id: productionId,
          note: z.string().trim().min(1).max(10_000),
        })
        .strict(),
      z
        .object({
          type: z.literal('APPROVE_PROOF'),
          role: approvalRole,
          fileId: productionId,
        })
        .strict(),
      z.object({ type: z.literal('READY') }).strict(),
    ]),
  })
  .strict();

export const productionSourceSchema = z
  .object({
    fileId: productionId,
    revisionId: z.string().min(1).max(128),
    stateDigest: z.string().regex(/^[0-9a-f]{64}$/),
    publicationContentDigest: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();
const approval = z
  .object({ userId: productionId, at: z.string().datetime() })
  .strict();
const approvals = z
  .object({ AUTHOR: approval.optional(), EDITOR: approval.optional() })
  .strict();
export const productionStateSchema = z
  .object({
    model: z.literal('omi-editorial-production/1'),
    stage: z.enum(['COPYEDITING', 'LAYOUT', 'PROOFREADING', 'READY']),
    acceptedSource: productionSourceSchema,
    source: productionSourceSchema,
    sourceApprovals: approvals,
    assignments: z.array(
      z
        .object({
          userId: productionId,
          role,
          dueAt: z.string().datetime().optional(),
        })
        .strict(),
    ),
    proof: z
      .object({
        fileId: productionId,
        revisionId: z.string(),
        stateDigest: z.string().regex(/^[0-9a-f]{64}$/),
        sha256: z.string().regex(/^[0-9a-f]{64}$/),
        buildId: z.string(),
        fileName: z.string(),
        mediaType: z.string(),
      })
      .strict()
      .nullable(),
    proofApprovals: approvals,
    corrections: z.array(
      z
        .object({
          id: productionId,
          proofFileId: productionId,
          locator: z.string(),
          note: z.string(),
          userId: productionId,
          createdAt: z.string().datetime(),
          resolution: z
            .object({
              userId: productionId,
              note: z.string(),
              at: z.string().datetime(),
            })
            .strict()
            .optional(),
        })
        .strict(),
    ),
    events: z.array(
      z
        .object({
          type: z.string(),
          userId: productionId,
          at: z.string().datetime(),
          reference: z.string().optional(),
        })
        .strict(),
    ),
  })
  .strict();
export const productionResponseSchema = z
  .object({
    version: z.number().int().nonnegative(),
    state: productionStateSchema.nullable(),
    actor: z
      .object({
        userId: productionId,
        author: z.boolean(),
        editor: z.boolean(),
      })
      .strict(),
    published: z.boolean(),
    files: z.array(
      z
        .object({
          id: productionId,
          kind: z.enum(['SOURCE', 'PROOF']),
          revisionId: z.string(),
          stateDigest: z.string(),
          sha256: z.string(),
          fileName: z.string(),
          mediaType: z.string(),
          createdAt: z.string().datetime(),
        })
        .strict(),
    ),
  })
  .strict();
export const productionTasksSchema = z
  .object({
    tasks: z.array(
      z
        .object({
          submissionId: productionId,
          title: z.string(),
          venueName: z.string(),
        })
        .strict(),
    ),
  })
  .strict();
export type EditorialProductionResponse = z.infer<
  typeof productionResponseSchema
>;
export type ProductionCommandRequest = z.infer<typeof productionCommandSchema>;
