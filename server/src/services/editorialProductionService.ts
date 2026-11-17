import { z } from 'zod';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';
import {
  createProductionState,
  isProductionParticipant,
  ProductionError,
  transitionProduction,
  type ProductionAction,
  type ProductionActor,
  type ProductionState,
} from '../domain/editorialProduction.js';
import {
  assertStudioNativePublicationVenue,
  assertStudioNativePublicationVenueEditorAuthority,
} from './publicationVenueAuthorityService.js';
import { createEditorialAcceptance } from './editorialDecisionService.js';
import {
  ensureSubmissionEditorAccess,
  validateRevisionInput,
  type NativeEditorialRevisionInput,
} from './nativeEditorialWorkflowService.js';

export type ProductionCommand =
  | { type: 'START' }
  | Exclude<
      ProductionAction,
      | { type: 'SOURCE' }
      | { type: 'PROOF' }
      | { type: 'CORRECTION' }
      | { type: 'ASSIGN' }
    >
  | {
      type: 'ASSIGN';
      email: string;
      role: 'COPYEDITOR' | 'LAYOUT_EDITOR' | 'PROOFREADER';
      dueAt?: string;
    }
  | { type: 'SOURCE'; source: NativeEditorialRevisionInput }
  | { type: 'PROOF'; artifactBase64: string; build: Record<string, unknown> }
  | { type: 'CORRECTION'; fileId: string; locator: string; note: string };

const digestSchema = z.object({
  algorithm: z.literal('sha256'),
  value: z.string().regex(/^[a-f0-9]{64}$/),
});
const proofBuildSchema = z
  .object({
    model: z.literal('omi-publication-build'),
    version: z.literal('0.1.0'),
    id: z.string().regex(/^urn:omi:publication-build:sha256:[a-f0-9]{64}$/),
    createdAt: z.string().datetime(),
    manuscript: z.object({
      id: z.string().min(1).max(128),
      revisionId: z.string().min(1).max(128),
      stateDigest: digestSchema.extend({
        canonicalization: z.literal('omi-manuscript-state-json-v1'),
      }),
    }),
    profile: z.object({
      id: z.string().min(1),
      version: z.string().min(1),
      digest: digestSchema.extend({
        canonicalization: z.literal('omi-publication-profile-json-v1'),
      }),
    }),
    output: z.object({
      format: z.enum(['html', 'pdf-print', 'pdf-interactive']),
      mediaType: z.string().min(1),
      fileName: z.string().min(1).max(255),
      byteLength: z.number().int().positive(),
      digest: digestSchema,
    }),
    rendererInput: z
      .object({
        mediaType: z.string().min(1),
        byteLength: z.number().int().positive(),
        digest: digestSchema,
      })
      .optional(),
    generator: z.object({
      application: z.literal('open-manuscript-studio'),
      applicationVersion: z.string().min(1),
      applicationBuild: z.string().optional(),
      applicationCommit: z.string().optional(),
      renderer: z.string().min(1),
      rendererVersion: z.string().min(1),
    }),
  })
  .strict();

function stateOf(value: unknown): ProductionState {
  const state = value as ProductionState;
  if (state?.model !== 'omi-editorial-production/1')
    throw new ProductionError('Unsupported production state.');
  return state;
}
async function access(userId: string, submissionId: string) {
  const submission = await prisma.nativeEditorialSubmission.findUnique({
    where: { id: submissionId },
    include: { production: true },
  });
  if (!submission) throw new ProductionError('Submission not found.', 404);
  await assertStudioNativePublicationVenue(submission.publicationVenueId);
  let editor = false;
  try {
    await assertStudioNativePublicationVenueEditorAuthority(
      userId,
      submission.publicationVenueId,
    );
    editor = true;
  } catch (error) {
    if (
      (error as { status?: number }).status !== 403 &&
      (error as Error).name !== 'ForbiddenError'
    )
      throw error;
  }
  const actor: ProductionActor = {
    userId,
    author: userId === submission.authorUserId,
    editor,
  };
  if (
    submission.production
      ? !isProductionParticipant(stateOf(submission.production.state), actor)
      : !actor.author && !actor.editor
  )
    throw new ProductionError('No active production assignment.', 403);
  return { submission, actor };
}
export async function getEditorialProduction(
  userId: string,
  submissionId: string,
) {
  const { submission, actor } = await access(userId, submissionId);
  const row = submission.production;
  return {
    version: row?.version ?? 0,
    state: row ? stateOf(row.state) : null,
    actor,
    published: submission.status === 'PUBLISHED',
    files: row
      ? await prisma.editorialProductionFile.findMany({
          where: { productionId: row.id },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            kind: true,
            revisionId: true,
            stateDigest: true,
            sha256: true,
            fileName: true,
            mediaType: true,
            createdAt: true,
          },
        })
      : [],
  };
}
export async function getEditorialProductionFile(
  userId: string,
  submissionId: string,
  fileId: string,
) {
  const { submission } = await access(userId, submissionId);
  if (!submission.production)
    throw new ProductionError('Production has not started.', 404);
  const file = await prisma.editorialProductionFile.findFirst({
    where: { id: fileId, productionId: submission.production.id },
  });
  if (!file) throw new ProductionError('Production file not found.', 404);
  return file;
}
export async function listProductionTasks(userId: string) {
  // JSON containment is evaluated in PostgreSQL: do not enumerate other venues' submissions.
  const rows = await prisma.$queryRaw<Array<{ submission_id: string }>>`
    SELECT p.submission_id FROM editorial_productions p
    JOIN native_editorial_submissions s ON s.id = p.submission_id
    WHERE s.status = 'ACCEPTED'
      AND p.state->'assignments' @> ${JSON.stringify([{ userId }])}::jsonb
    ORDER BY p.updated_at DESC LIMIT 100`;
  const tasks = [];
  for (const row of rows) {
    try {
      const result = await access(userId, row.submission_id);
      tasks.push({
        submissionId: row.submission_id,
        title: result.submission.title,
        venueName: result.submission.publicationVenueName,
      });
    } catch (error) {
      if (
        (error as { status?: number }).status !== 403 &&
        (error as Error).name !== 'ForbiddenError'
      )
        throw error;
    }
  }
  return tasks;
}
export async function changeEditorialProduction(
  userId: string,
  submissionId: string,
  version: number,
  command: ProductionCommand,
) {
  const { submission: initial, actor } = await access(userId, submissionId);
  if (initial.status !== 'ACCEPTED')
    throw new ProductionError(
      'Production requires an accepted, unpublished native submission.',
    );
  if (command.type === 'START' && !actor.editor)
    throw new ProductionError('Editorial authority is required.', 403);
  if (actor.editor) await ensureSubmissionEditorAccess(userId, initial);
  let assigneeId: string | undefined;
  if (command.type === 'ASSIGN') {
    if (!actor.editor)
      throw new ProductionError('Editorial authority is required.', 403);
    const assignee = await prisma.user.findFirst({
      where: {
        email: { equals: command.email.trim(), mode: 'insensitive' },
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    if (!assignee)
      throw new ProductionError(
        'An active Studio account is required for the assignment.',
        400,
      );
    assigneeId = assignee.id;
  }
  await prisma.$transaction(
    async (tx) => {
      // Serialize production changes and native publication transitions on the same parent row.
      await tx.$queryRaw`SELECT id FROM native_editorial_submissions WHERE id = ${submissionId}::uuid FOR UPDATE`;
      const submission = await tx.nativeEditorialSubmission.findUniqueOrThrow({
        where: { id: submissionId },
        include: { production: true, assets: true },
      });
      if (submission.status !== 'ACCEPTED')
        throw new ProductionError(
          'This submission is no longer in unpublished production.',
        );
      const delivered = await tx.webPublicationDelivery.findFirst({
        where: {
          manuscriptId: submission.manuscriptId,
          revisionId: submission.revisionId,
          targetStatus: 'PUBLISH',
          state: { in: ['IN_FLIGHT', 'UNKNOWN', 'SUCCEEDED'] },
        },
        select: { id: true },
      });
      if (delivered)
        throw new ProductionError(
          'Publication delivery has started. Reconcile that delivery before changing production.',
        );
      const row = submission.production;
      if ((row?.version ?? 0) !== version)
        throw new ProductionError(
          'The production workflow changed. Reload before trying again.',
        );
      const at = new Date().toISOString();
      if (command.type === 'START') {
        if (row) throw new ProductionError('Production has already started.');
        const productionId = randomUUID();
        const fileId = randomUUID();
        const source = {
          fileId,
          revisionId: submission.revisionId,
          stateDigest: submission.stateDigest,
          publicationContentDigest: submission.publicationContentDigest,
        };
        const state = createProductionState(source, actor, at);
        await tx.editorialProduction.create({
          data: { id: productionId, submissionId, state: json(state) },
        });
        const bytes = Buffer.from(
          JSON.stringify({
            manuscriptId: submission.manuscriptId,
            title: submission.title,
            revisionId: submission.revisionId,
            stateDigest: submission.stateDigest,
            publicationContentDigest: submission.publicationContentDigest,
            manuscriptStateSnapshot: submission.manuscriptStateSnapshot,
            reviewSnapshot: submission.reviewSnapshot,
            assets: submission.assets.map((asset) => ({
              assetId: asset.assetId,
              mediaType: asset.mediaType,
              checksum: asset.checksum,
              bytesBase64: Buffer.from(asset.bytes).toString('base64'),
            })),
          }),
        );
        await tx.editorialProductionFile.create({
          data: {
            id: fileId,
            productionId,
            kind: 'SOURCE',
            revisionId: source.revisionId,
            stateDigest: source.stateDigest,
            sha256: sha256(bytes),
            fileName: 'accepted-source.json',
            mediaType: 'application/json',
            bytes,
          },
        });
        return;
      }
      if (!row) throw new ProductionError('Start production first.');
      const state = stateOf(row.state);
      // Re-evaluate current assignments after taking the lock (revocation is immediate).
      if (!isProductionParticipant(state, actor))
        throw new ProductionError(
          'The production assignment was revoked.',
          403,
        );
      let action: ProductionAction;
      if (command.type === 'ASSIGN') {
        action = {
          type: 'ASSIGN',
          userId: assigneeId!,
          role: command.role,
          ...(command.dueAt ? { dueAt: command.dueAt } : {}),
        };
      } else if (command.type === 'SOURCE') {
        const checked = validateRevisionInput(command.source);
        const metadata = checked.manuscriptStateSnapshot.metadata as
          | { publicationVenue?: { id?: string } }
          | undefined;
        if (
          checked.manuscriptId !== submission.manuscriptId ||
          metadata?.publicationVenue?.id !== submission.publicationVenueId
        )
          throw new ProductionError(
            'The copyedited source belongs to a different manuscript or venue.',
          );
        if (
          typeof checked.manuscriptStateSnapshot.title !== 'string' ||
          checked.title !== checked.manuscriptStateSnapshot.title.trim()
        )
          throw new ProductionError(
            'The source title does not match its committed manuscript state.',
          );
        const knownRevision = await tx.editorialProductionFile.findFirst({
          where: {
            productionId: row.id,
            kind: 'SOURCE',
            revisionId: checked.revisionId,
          },
        });
        if (knownRevision && knownRevision.stateDigest !== checked.stateDigest)
          throw new ProductionError(
            'A committed revision cannot identify two different manuscript states.',
          );
        const bytes = Buffer.from(JSON.stringify(command.source));
        const fileId = knownRevision?.id ?? randomUUID();
        action = {
          type: 'SOURCE',
          source: {
            fileId,
            revisionId: checked.revisionId,
            stateDigest: checked.stateDigest,
            publicationContentDigest: checked.publicationContentDigest,
          },
        };
        // Authorize the transition before storing bytes.
        transitionProduction(state, action, actor, at);
        if (!knownRevision)
          await tx.editorialProductionFile.create({
            data: {
              id: fileId,
              productionId: row.id,
              kind: 'SOURCE',
              revisionId: checked.revisionId,
              stateDigest: checked.stateDigest,
              sha256: sha256(bytes),
              fileName: 'copyedited-source.json',
              mediaType: 'application/json',
              bytes,
            },
          });
      } else if (command.type === 'PROOF') {
        const proof = validateProductionProof(
          command.artifactBase64,
          command.build,
          submission.manuscriptId,
          state,
        );
        const same =
          state.proof?.buildId === proof.buildId &&
          state.proof.sha256 === proof.sha256;
        const fileId = same ? state.proof!.fileId : randomUUID();
        action = {
          type: 'PROOF',
          proof: {
            fileId,
            revisionId: state.source.revisionId,
            stateDigest: state.source.stateDigest,
            sha256: proof.sha256,
            buildId: proof.buildId,
            fileName: proof.fileName,
            mediaType: proof.mediaType,
          },
        };
        transitionProduction(state, action, actor, at);
        if (!same)
          await tx.editorialProductionFile.create({
            data: {
              id: fileId,
              productionId: row.id,
              kind: 'PROOF',
              revisionId: state.source.revisionId,
              stateDigest: state.source.stateDigest,
              sha256: proof.sha256,
              fileName: proof.fileName,
              mediaType: proof.mediaType,
              bytes: proof.bytes,
              build: json(command.build),
            },
          });
      } else if (command.type === 'CORRECTION') {
        action = { ...command, id: randomUUID() };
      } else action = command;
      const next = transitionProduction(state, action, actor, at);
      if (command.type === 'LAYOUT') {
        const file = await tx.editorialProductionFile.findFirstOrThrow({
          where: {
            id: state.source.fileId,
            productionId: row.id,
            kind: 'SOURCE',
          },
        });
        const source = JSON.parse(
          Buffer.from(file.bytes).toString('utf8'),
        ) as NativeEditorialRevisionInput;
        const checked = validateRevisionInput(source);
        if (
          source.revisionId !== submission.revisionId ||
          source.stateDigest !== submission.stateDigest
        ) {
          const original = await tx.editorialDecision.findUniqueOrThrow({
            where: {
              workspaceId_manuscriptId_revisionId: {
                workspaceId: submission.workspaceId,
                manuscriptId: submission.manuscriptId,
                revisionId: state.acceptedSource.revisionId,
              },
            },
          });
          // A copyeditor cannot inherit acceptance. The editor explicitly accepts this exact new source.
          await createEditorialAcceptance(
            userId,
            {
              workspaceId: submission.workspaceId,
              manuscriptId: submission.manuscriptId,
              revisionId: source.revisionId,
              stateDigest: source.stateDigest,
              publicationContentDigest: source.publicationContentDigest,
              publicationVenueId: submission.publicationVenueId,
              reviewRound: original.reviewRound,
              basisAssignmentIds: original.basisAssignmentIds as string[],
            },
            tx,
          );
          await tx.nativeEditorialSubmission.update({
            where: { id: submissionId },
            data: {
              title: checked.title,
              revisionId: checked.revisionId,
              stateDigest: checked.stateDigest,
              publicationContentDigest: checked.publicationContentDigest,
              manuscriptStateSnapshot: json(checked.manuscriptStateSnapshot),
              reviewSnapshot: json(checked.reviewSnapshot),
            },
          });
          await tx.nativeEditorialSubmissionAsset.deleteMany({
            where: { submissionId },
          });
          if (checked.assets.length)
            await tx.nativeEditorialSubmissionAsset.createMany({
              data: checked.assets.map((a) => ({
                submissionId,
                assetId: a.assetId,
                mediaType: a.mediaType,
                checksum: a.checksum,
                size: a.bytes.byteLength,
                bytes: a.bytes,
              })),
            });
        }
      }
      const changed = await tx.editorialProduction.updateMany({
        where: { id: row.id, version },
        data: { state: json(next), version: { increment: 1 } },
      });
      if (changed.count !== 1)
        throw new ProductionError(
          'The production workflow changed. Reload before trying again.',
        );
    },
    { timeout: 30_000 },
  );
  return getEditorialProduction(userId, submissionId);
}

export function validateProductionProof(
  base64: string,
  raw: Record<string, unknown>,
  manuscriptId: string,
  state: ProductionState,
) {
  if (base64.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(base64))
    throw new ProductionError('Invalid proof encoding.', 400);
  const bytes = Buffer.from(base64, 'base64');
  if (!bytes.length || bytes.length > 32 * 1024 * 1024)
    throw new ProductionError(
      'Proof size must be between 1 byte and 32 MiB.',
      400,
    );
  if (bytes.toString('base64') !== base64)
    throw new ProductionError('Invalid proof encoding.', 400);
  const parsed = proofBuildSchema.safeParse(raw);
  if (!parsed.success)
    throw new ProductionError(
      'A complete publication-build manifest is required.',
      400,
    );
  const build = parsed.data;
  const { id, createdAt: _createdAt, ...identity } = raw;
  const output = build.output;
  const hash = sha256(bytes);
  if (
    build.model !== 'omi-publication-build' ||
    build.version !== '0.1.0' ||
    id !==
      `urn:omi:publication-build:sha256:${sha256(Buffer.from(canonicalJson(identity)))}` ||
    build.manuscript?.id !== manuscriptId ||
    build.manuscript.revisionId !== state.source.revisionId ||
    build.manuscript.stateDigest?.value !== state.source.stateDigest ||
    output?.byteLength !== bytes.length ||
    output.digest?.value !== hash
  )
    throw new ProductionError(
      'The proof bytes or build provenance do not match the approved source.',
    );
  if (
    !output.fileName ||
    /[\\/]/.test(output.fileName) ||
    [...output.fileName].some(
      (c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127,
    ) ||
    output.fileName.length > 255
  )
    throw new ProductionError('Invalid proof filename.', 400);
  if (!['html', 'pdf-print', 'pdf-interactive'].includes(output.format ?? ''))
    throw new ProductionError(
      'Proofreading currently supports HTML and PDF.',
      400,
    );
  if (output.format !== 'html' && !build.rendererInput)
    throw new ProductionError(
      'PDF proof provenance requires the renderer input digest.',
      400,
    );
  const mediaType =
    output.format === 'html' ? 'text/html;charset=utf-8' : 'application/pdf';
  if (output.mediaType !== mediaType)
    throw new ProductionError(
      'The proof media type does not match its format.',
      400,
    );
  if (
    output.format !== 'html' &&
    (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-')) ||
      !bytes.subarray(-1024).includes(Buffer.from('%%EOF')))
  )
    throw new ProductionError('Invalid PDF proof.', 400);
  return {
    bytes,
    sha256: hash,
    buildId: String(id),
    fileName: output.fileName,
    mediaType,
  };
}
export interface ProductionReadinessInput {
  userId: string;
  manuscriptId: string;
  revisionId: string;
  stateDigest?: string;
  artifactSha256?: string;
  submissionId?: string;
  publicationVenueId?: string;
}
async function checkNativeProductionReady(
  input: ProductionReadinessInput,
  db: Pick<Prisma.TransactionClient, 'nativeEditorialSubmission'> = prisma,
) {
  const submissions = await db.nativeEditorialSubmission.findMany({
    where: {
      manuscriptId: input.manuscriptId,
      ...(input.submissionId ? { id: input.submissionId } : {}),
      ...(input.publicationVenueId
        ? { publicationVenueId: input.publicationVenueId }
        : {}),
      status: { in: ['ACCEPTED', 'PUBLISHED'] },
    },
    include: { production: true },
  });
  if (submissions.length > 1)
    throw new ProductionError(
      'Select the exact native publication venue before publishing.',
    );
  const submission = submissions[0];
  if (!submission) return;
  const { actor } = await access(input.userId, submission.id);
  if (!actor.editor)
    throw new ProductionError(
      'An active venue editor must publish a native submission.',
      403,
    );
  const state = submission.production
    ? stateOf(submission.production.state)
    : null;
  if (
    !state ||
    state.stage !== 'READY' ||
    !state.proof ||
    !state.proofApprovals.AUTHOR ||
    !state.proofApprovals.EDITOR ||
    state.source.revisionId !== input.revisionId ||
    (input.stateDigest && state.source.stateDigest !== input.stateDigest) ||
    (input.artifactSha256 && state.proof.sha256 !== input.artifactSha256)
  )
    throw new ProductionError(
      'Complete production and approve this exact proof before publication.',
    );
}
export async function assertNativeProductionReady(
  input: ProductionReadinessInput,
) {
  return checkNativeProductionReady(input);
}
/** Lock production and claim the durable delivery in one transaction. */
export async function withNativeProductionReady<T>(
  input: ProductionReadinessInput,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM native_editorial_submissions WHERE manuscript_id = ${input.manuscriptId} ORDER BY id FOR UPDATE`;
    await checkNativeProductionReady(input, tx);
    return operation(tx);
  });
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
function sha256(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex');
}
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
      )
      .join(',')}}`;
  return JSON.stringify(value);
}
