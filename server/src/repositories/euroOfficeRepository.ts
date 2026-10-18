import { createHash } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
const hash = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
export const euroOfficeRepository = {
  list: (userId: string) => prisma.plainDocument.findMany({ where: { userId }, select: { id: true, title: true, revision: true, createdAt: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 100 }),
  create: (userId: string, title: string, content: Uint8Array) => prisma.plainDocument.create({ data: { userId, title, content: Uint8Array.from(content) }, select: { id: true, title: true, revision: true, createdAt: true, updatedAt: true } }),
  owned: (id: string, userId: string) => prisma.plainDocument.findFirst({ where: { id, userId }, select: { id: true, title: true, revision: true } }),
  user: (id: string) => prisma.user.findUnique({ where: { id }, select: { fullName: true } }),
  session: (data: { documentId: string; userId: string; tokenHash: string; documentKey: string; baseRevision: number; expiresAt: Date }) => prisma.euroOfficeSession.create({ data }),
  capability: (documentId: string, tokenHash: string) => prisma.euroOfficeSession.findFirst({ where: { documentId, tokenHash, expiresAt: { gt: new Date() } }, include: { document: true } }),
  receipt: (documentId: string, callbackDigest: string) => prisma.euroOfficeSave.findUnique({ where: { documentId_callbackDigest: { documentId, callbackDigest } } }),
  saves: (documentId: string, userId: string) => prisma.euroOfficeSave.findMany({ where: { documentId, document: { userId } }, select: { id: true, status: true, applied: true, contentHash: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 100 }),
  savedContent: (id: string, documentId: string, userId: string) => prisma.euroOfficeSave.findFirst({ where: { id, documentId, document: { userId } }, select: { content: true } }),
  /** Serialize on the document row; receipt, base backup and head CAS commit atomically. */
  async save(input: { documentId: string; userId: string; documentKey: string; baseRevision: number; callbackDigest: string; status: number; bytes: Buffer }) {
    return prisma.$transaction(async tx => {
      // Lock across API processes without advancing the document revision.
      await tx.$queryRaw`SELECT 1 FROM plain_documents WHERE id = ${input.documentId}::uuid AND user_id = ${input.userId}::uuid FOR UPDATE`;
      const previous = await tx.euroOfficeSave.findUnique({ where: { documentId_callbackDigest: { documentId: input.documentId, callbackDigest: input.callbackDigest } } });
      if (previous) return { duplicate: true, applied: previous.applied };
      const document = await tx.plainDocument.findFirst({ where: { id: input.documentId, userId: input.userId } });
      if (!document) throw new Error('DOCUMENT_NOT_FOUND');
      // Retain even conflicting saves for authenticated download/recovery; never overwrite a newer head.
      const applied = input.status === 2 && document.revision === input.baseRevision;
      if (applied) {
        await tx.euroOfficeSave.upsert({
          where: { documentId_callbackDigest: { documentId: input.documentId, callbackDigest: hash(`base:${document.revision}`) } },
          create: { documentId: input.documentId, documentKey: input.documentKey, callbackDigest: hash(`base:${document.revision}`), contentHash: hash(document.content), content: document.content, status: 0, applied: false }, update: {},
        });
        const changed = await tx.plainDocument.updateMany({ where: { id: input.documentId, userId: input.userId, revision: input.baseRevision }, data: { content: Uint8Array.from(input.bytes), revision: { increment: 1 } } });
        if (changed.count !== 1) throw new Error('DOCUMENT_CONFLICT');
      }
      await tx.euroOfficeSave.create({ data: { documentId: input.documentId, documentKey: input.documentKey, callbackDigest: input.callbackDigest, contentHash: hash(input.bytes), content: Uint8Array.from(input.bytes), status: input.status, applied } });
      return { duplicate: false, applied };
    });
  },
};
