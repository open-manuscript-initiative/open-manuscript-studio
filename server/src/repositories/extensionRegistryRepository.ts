import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import type { z } from 'zod';
import type { extensionManifestSchema } from '../integrations/extensionManifestSchema.js';
export type ExtensionManifest = z.infer<typeof extensionManifestSchema>;
export const extensionRegistryRepository = {
  async list(userId: string) {
    const rows = await prisma.$queryRaw<Array<{
      id: string;
      extension_id: string;
      manifest: unknown;
      enabled: boolean;
      created_at: Date;
      updated_at: Date;
    }>>`
      SELECT id, extension_id, manifest, enabled, created_at, updated_at
      FROM integration_extension_manifests
      WHERE user_id = ${userId}::uuid
      ORDER BY extension_id ASC
    `;
    return rows;
  },
  async register(userId: string, input: ExtensionManifest) {
    const manifest = JSON.stringify(input);
    const rows = await prisma.$queryRaw<Array<{ id: string; created: boolean }>>`
      INSERT INTO integration_extension_manifests
        (id, user_id, extension_id, manifest, enabled)
      VALUES
        (${randomUUID()}::uuid, ${userId}::uuid, ${input.id}, ${manifest}::jsonb, TRUE)
      ON CONFLICT (user_id, extension_id)
      DO UPDATE SET manifest = EXCLUDED.manifest, enabled = TRUE, updated_at = CURRENT_TIMESTAMP
      RETURNING id, (created_at = updated_at) AS created
    `;
    return rows[0];
  },
  async remove(userId: string, extensionId: string) {
    await prisma.$executeRaw`
      DELETE FROM integration_extension_manifests
      WHERE user_id = ${userId}::uuid
        AND extension_id = ${extensionId}
    `;
  },
};
