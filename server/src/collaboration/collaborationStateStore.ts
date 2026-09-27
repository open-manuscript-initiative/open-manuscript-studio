import { prisma } from '../lib/prisma.js';

export interface CollaborationStateStore {
  load(documentId: string): Promise<Uint8Array | null>;
  save(documentId: string, state: Uint8Array): Promise<void>;
}

/** Local PostgreSQL adapter used by the single-node deployment profile. */
export const postgresCollaborationStateStore: CollaborationStateStore = {
  async load(documentId) {
    const record = await prisma.collaborativeDocumentState.findUnique({
      where: { documentId },
      select: { state: true },
    });
    return record?.state ?? null;
  },

  async save(documentId, state) {
    await prisma.collaborativeDocumentState.upsert({
      where: { documentId },
      create: { documentId, state: Buffer.from(state) },
      update: { state: Buffer.from(state) },
    });
  },
};
