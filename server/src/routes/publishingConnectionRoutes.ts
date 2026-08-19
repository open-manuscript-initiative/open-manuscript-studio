import { Router } from 'express';
import { z } from 'zod';

import { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../lib/prisma.js';
import {
  requireSession,
  type AuthenticatedRequest,
} from '../middleware/requireSession.js';

export const publishingConnectionRouter = Router();

const connectionIdSchema = z.string().uuid();
const publishingConnectionUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(200),
  baseUrl: z.string().trim().url().max(2048),
});

function normalizeBaseUrl(value: string): string {
  const url = new URL(value);
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('External integration base URL must use HTTPS in production.');
  }
  return url.toString().replace(/\/$/, '');
}

function readConfig(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

publishingConnectionRouter.put(
  '/integrations/connections/:connectionId/publishing',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const connectionId = connectionIdSchema.safeParse(request.params.connectionId);
    const body = publishingConnectionUpdateSchema.safeParse(request.body);
    if (!connectionId.success || !body.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_PUBLISHING_CONNECTION',
          message: 'The publishing connection configuration is invalid.',
          fields: body.success ? undefined : body.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const connection = await prisma.userIntegration.findFirst({
      where: {
        id: connectionId.data,
        userId: request.authUserId!,
        providerId: { in: ['ojs', 'omp'] },
      },
    });
    if (!connection) {
      response.status(404).json({
        error: {
          code: 'PUBLISHING_CONNECTION_NOT_FOUND',
          message: 'Publishing connection not found.',
        },
      });
      return;
    }

    const existingConfig = readConfig(connection.config);
    const installationId = existingConfig.installationId;
    if (typeof installationId !== 'string' || !installationId.trim()) {
      response.status(409).json({
        error: {
          code: 'PUBLISHING_INSTALLATION_ID_MISSING',
          message: 'The connection is missing its installation identifier.',
        },
      });
      return;
    }

    try {
      const baseUrl = normalizeBaseUrl(body.data.baseUrl);
      const config: Prisma.InputJsonValue = {
        ...existingConfig,
        installationId,
        baseUrl,
      } as Prisma.InputJsonObject;

      const updated = await prisma.$transaction(async (transaction) => {
        await transaction.externalInstallation.update({
          where: { installationId },
          data: {
            displayName: body.data.displayName,
            baseUrl,
          },
        });

        return transaction.userIntegration.update({
          where: { id: connection.id },
          data: {
            displayName: body.data.displayName,
            config,
            status: 'CONFIGURED',
            lastCheckedAt: null,
            lastError: null,
          },
        });
      });

      response.status(200).json({
        connection: {
          id: updated.id,
          providerId: updated.providerId,
          connectionKey: updated.connectionKey,
          displayName: updated.displayName,
          authenticationMode: updated.authenticationMode,
          enabled: updated.enabled,
          status: updated.status.toLowerCase(),
          config: updated.config,
          hasSecret: Boolean(updated.encryptedSecret),
          lastCheckedAt: updated.lastCheckedAt?.toISOString() ?? null,
          lastError: updated.lastError,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        },
      });
    } catch (error) {
      response.status(400).json({
        error: {
          code: 'PUBLISHING_CONNECTION_UPDATE_FAILED',
          message: error instanceof Error ? error.message : 'Publishing connection update failed.',
        },
      });
    }
  },
);
