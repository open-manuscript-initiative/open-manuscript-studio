import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';
import { createEditorialAcceptance } from '../services/editorialDecisionService.js';
import type { EditorialProductionRepository } from '../ports/editorialProductionRepository.js';
const json = (value: unknown) => value as Prisma.InputJsonValue;
/** Keep the accepted source, proof files, CAS and acceptance in the same transaction. */
export function createEditorialProductionRepository(
  db: Prisma.TransactionClient = prisma,
): EditorialProductionRepository {
  return {
    async loadSubmission(id) {
      const row = await db.nativeEditorialSubmission.findUnique({
        where: { id },
        include: { production: true },
      });
      // Read-only authorization/status checks never load potentially large asset bytes.
      return row ? { ...row, assets: [] } : null;
    },
    async lockSubmission(id) {
      await db.$queryRaw`SELECT id FROM native_editorial_submissions WHERE id = ${id}::uuid FOR UPDATE`;
      return db.nativeEditorialSubmission.findUniqueOrThrow({
        where: { id },
        include: { production: true, assets: true },
      });
    },
    listFiles: (productionId) =>
      db.editorialProductionFile.findMany({
        where: { productionId },
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
      }),
    findFile: (productionId, id) =>
      db.editorialProductionFile.findFirst({ where: { id, productionId } }),
    findSourceRevision: (productionId, revisionId) =>
      db.editorialProductionFile.findFirst({
        where: { productionId, kind: 'SOURCE', revisionId },
      }),
    async listAssignedSubmissionIds(userId) {
      const rows = await db.$queryRaw<Array<{ submission_id: string }>>`
        SELECT p.submission_id FROM editorial_productions p
        JOIN native_editorial_submissions s ON s.id = p.submission_id
        WHERE s.status = 'ACCEPTED' AND p.state->'assignments' @> ${JSON.stringify([{ userId }])}::jsonb
        ORDER BY p.updated_at DESC LIMIT 100`;
      return rows.map((row) => row.submission_id);
    },
    async findActiveAssignee(email) {
      return (
        await db.user.findFirst({
          where: {
            email: { equals: email.trim(), mode: 'insensitive' },
            status: 'ACTIVE',
          },
          select: { id: true },
        })
      )?.id;
    },
    async deliveryStarted(manuscriptId, revisionId) {
      return !!(await db.webPublicationDelivery.findFirst({
        where: {
          manuscriptId,
          revisionId,
          targetStatus: 'PUBLISH',
          state: { in: ['IN_FLIGHT', 'UNKNOWN', 'SUCCEEDED'] },
        },
        select: { id: true },
      }));
    },
    async createProduction(id, submissionId, state) {
      await db.editorialProduction.create({
        data: { id, submissionId, state: json(state) },
      });
    },
    async addFile(file) {
      await db.editorialProductionFile.create({
        data: {
          ...file,
          bytes: Buffer.from(file.bytes),
          ...(file.build === undefined ? {} : { build: json(file.build) }),
        } as Prisma.EditorialProductionFileUncheckedCreateInput,
      });
    },
    async acceptanceBasis(workspaceId, manuscriptId, revisionId) {
      const row = await db.editorialDecision.findUniqueOrThrow({
        where: {
          workspaceId_manuscriptId_revisionId: {
            workspaceId,
            manuscriptId,
            revisionId,
          },
        },
      });
      return {
        reviewRound: row.reviewRound,
        basisAssignmentIds: row.basisAssignmentIds as string[],
      };
    },
    async acceptSource(userId, input) {
      await createEditorialAcceptance(userId, input, db);
    },
    async replaceAcceptedSource(submissionId, source) {
      const { assets, ...snapshot } = source;
      await db.nativeEditorialSubmission.update({
        where: { id: submissionId },
        data: {
          ...snapshot,
          manuscriptStateSnapshot: json(snapshot.manuscriptStateSnapshot),
          reviewSnapshot: json(snapshot.reviewSnapshot),
        },
      });
      await db.nativeEditorialSubmissionAsset.deleteMany({
        where: { submissionId },
      });
      if (assets.length)
        await db.nativeEditorialSubmissionAsset.createMany({
          data: assets.map((a) => ({
            submissionId,
            ...a,
            bytes: Buffer.from(a.bytes),
            size: a.bytes.byteLength,
          })),
        });
    },
    async compareAndSave(id, version, state) {
      return (
        (
          await db.editorialProduction.updateMany({
            where: { id, version },
            data: { state: json(state), version: { increment: 1 } },
          })
        ).count === 1
      );
    },
    async findPublicationSubmissions(manuscriptId, submissionId, venueId) {
      const rows = await db.nativeEditorialSubmission.findMany({
        where: {
          manuscriptId,
          ...(submissionId ? { id: submissionId } : {}),
          ...(venueId ? { publicationVenueId: venueId } : {}),
          status: { in: ['ACCEPTED', 'PUBLISHED'] },
        },
        include: { production: true },
      });
      return rows.map((row) => ({ ...row, assets: [] }));
    },
  };
}
export const editorialProductionRepository =
  createEditorialProductionRepository();
export function productionTransaction<T>(
  operation: (repository: EditorialProductionRepository) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(
    (tx) => operation(createEditorialProductionRepository(tx)),
    { timeout: 30_000 },
  );
}
/** Adapter bridge for the existing web-delivery outbox's atomic claim. */
export function productionDeliveryTransaction<T>(
  manuscriptId: string,
  check: (repository: EditorialProductionRepository) => Promise<void>,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM native_editorial_submissions WHERE manuscript_id = ${manuscriptId} ORDER BY id FOR UPDATE`;
    await check(createEditorialProductionRepository(tx));
    return operation(tx);
  });
}
