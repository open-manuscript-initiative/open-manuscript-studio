import { Router } from 'express';
import { z } from 'zod';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';
import { extensionRegistryService } from '../services/extensionRegistryService.js';
import { extensionManifestSchema, INTEGRATION_EXTENSION_API_CAPABILITIES } from '../integrations/extensionManifestSchema.js';
export const extensionRegistryRouter = Router();
extensionRegistryRouter.use('/integrations/extensions', (_request, response, next) => {
  response.setHeader('Cache-Control', 'private, no-store');
  next();
});
// Explicit, versioned capability discovery. Registration is not execution or
// authorization to access a manuscript, review, secret or publication action.
extensionRegistryRouter.get(
  '/integrations/extensions/capabilities',
  requireSession,
  (_request: AuthenticatedRequest, response) => {
    response.status(200).json(INTEGRATION_EXTENSION_API_CAPABILITIES);
  },
);

extensionRegistryRouter.get(
  '/integrations/extensions',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const rows = await extensionRegistryService.list(request.authUserId!);
    response.status(200).json({
      extensions: rows.map((row) => ({
        id: row.id,
        extensionId: row.extension_id,
        manifest: row.manifest,
        enabled: row.enabled,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      })),
    });
  },
);

extensionRegistryRouter.post(
  '/integrations/extensions',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const input = extensionManifestSchema.safeParse(request.body);
    if (!input.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_EXTENSION_MANIFEST',
          message: 'The OMI integration extension manifest is invalid.',
          fields: input.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const result = await extensionRegistryService.register(request.authUserId!, input.data);
    response.status(result?.created ? 201 : 200).json({
      id: result?.id,
      manifest: input.data,
      enabled: true,
    });
  },
);

extensionRegistryRouter.delete(
  '/integrations/extensions/:extensionId',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const extensionId = z.string().trim().min(1).max(128).safeParse(request.params.extensionId);
    if (!extensionId.success) {
      response.status(400).json({ error: { code: 'INVALID_EXTENSION_ID', message: 'Invalid extension id.' } });
      return;
    }
    await extensionRegistryService.remove(request.authUserId!, extensionId.data);
    response.status(204).end();
  },
);

