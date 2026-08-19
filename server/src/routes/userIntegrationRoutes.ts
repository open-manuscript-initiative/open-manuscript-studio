import { randomBytes, randomUUID } from 'node:crypto';

import { Router } from 'express';
import { z } from 'zod';

import {
  ExternalInstallationStatus,
  ExternalPlatform,
  Prisma,
} from '../generated/prisma/client.js';
import { upsertExternalInstallation } from '../integrations/externalInstallations.js';
import { encryptSecret } from '../integrations/secretCrypto.js';
import {
  getIntegrationProvider,
  listIntegrationProviders,
  testIntegrationProvider,
} from '../integrations/providerRegistry.js';
import { prisma } from '../lib/prisma.js';
import {
  requireSession,
  type AuthenticatedRequest,
} from '../middleware/requireSession.js';

export const userIntegrationRouter = Router();

const providerIdSchema = z.string().trim().min(1).max(128);
const connectionIdSchema = z.string().uuid();
const connectionSchema = z.object({
  connectionKey: z.string().trim().min(1).max(128).default('default'),
  displayName: z.string().trim().min(1).max(200).optional(),
  authenticationMode: z.enum([
    'none',
    'server_secret',
    'user_api_key',
    'oauth2',
    'oidc',
    'integration_token',
  ]),
  secret: z.string().min(1).max(16384).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().default(true),
});
const publishingConnectionSchema = z.object({
  displayName: z.string().trim().min(1).max(200),
  baseUrl: z.string().trim().url().max(2048),
});

function publicConnection(connection: {
  id: string;
  providerId: string;
  connectionKey: string;
  displayName: string | null;
  authenticationMode: string;
  enabled: boolean;
  status: string;
  config: unknown;
  encryptedSecret: string | null;
  lastCheckedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: connection.id,
    providerId: connection.providerId,
    connectionKey: connection.connectionKey,
    displayName: connection.displayName,
    authenticationMode: connection.authenticationMode,
    enabled: connection.enabled,
    status: connection.status.toLowerCase(),
    config: connection.config,
    hasSecret: Boolean(connection.encryptedSecret),
    lastCheckedAt: connection.lastCheckedAt?.toISOString() ?? null,
    lastError: connection.lastError,
    createdAt: connection.createdAt.toISOString(),
    updatedAt: connection.updatedAt.toISOString(),
  };
}

function publishingPlatform(providerId: string): ExternalPlatform | null {
  if (providerId === 'ojs') return ExternalPlatform.OJS;
  if (providerId === 'omp') return ExternalPlatform.OMP;
  return null;
}

function readInstallationId(config: unknown): string | null {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
  const installationId = (config as Record<string, unknown>).installationId;
  return typeof installationId === 'string' && installationId.trim()
    ? installationId.trim()
    : null;
}

userIntegrationRouter.get(
  '/integrations/catalog',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const userId = request.authUserId!;
    const [connections, serverConfigs] = await Promise.all([
      prisma.userIntegration.findMany({
        where: { userId },
        orderBy: [{ providerId: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.integrationProviderConfig.findMany({
        orderBy: { providerId: 'asc' },
      }),
    ]);

    const serverByProvider = new Map(
      serverConfigs.map((config) => [config.providerId, config]),
    );

    response.status(200).json({
      providers: listIntegrationProviders().map((provider) => {
        const serverConfig = serverByProvider.get(provider.id);
        return {
          ...provider,
          server: {
            enabled: serverConfig?.enabled ?? true,
            configured: Boolean(serverConfig?.encryptedSecret || serverConfig?.config),
            status: serverConfig?.status?.toLowerCase() ?? 'unconfigured',
            lastCheckedAt: serverConfig?.lastCheckedAt?.toISOString() ?? null,
            lastError: serverConfig?.lastError ?? null,
          },
          connections: connections
            .filter((connection) => connection.providerId === provider.id)
            .map(publicConnection),
        };
      }),
    });
  },
);

userIntegrationRouter.get(
  '/integrations/:providerId/status',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const providerId = providerIdSchema.safeParse(request.params.providerId);
    if (!providerId.success || !getIntegrationProvider(providerId.data)) {
      response.status(404).json({
        error: { code: 'INTEGRATION_PROVIDER_NOT_FOUND', message: 'Unknown integration provider.' },
      });
      return;
    }

    const status = await testIntegrationProvider(providerId.data, request.authUserId!);
    response.status(200).json({
      providerId: providerId.data,
      enabled: true,
      configured: status.configured,
      healthy: status.healthy,
      message: status.message,
    });
  },
);

userIntegrationRouter.post(
  '/integrations/:providerId/publishing-connections',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const providerId = providerIdSchema.safeParse(request.params.providerId);
    const body = publishingConnectionSchema.safeParse(request.body);
    const platform = providerId.success ? publishingPlatform(providerId.data) : null;

    if (!providerId.success || !platform || !body.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_PUBLISHING_CONNECTION',
          message: 'The OJS/OMP connection configuration is invalid.',
          fields: body.success ? undefined : body.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const installationId = `${providerId.data}-${randomUUID()}`;
    const sharedSecret = randomBytes(32).toString('hex');

    try {
      await upsertExternalInstallation({
        installationId,
        platform,
        displayName: body.data.displayName,
        baseUrl: body.data.baseUrl,
        sharedSecret,
      });

      const encryptedSecret = JSON.stringify(encryptSecret(sharedSecret));
      const config: Prisma.InputJsonValue = {
        installationId,
        baseUrl: body.data.baseUrl,
      };
      const connection = await prisma.userIntegration.create({
        data: {
          userId: request.authUserId!,
          providerId: providerId.data,
          connectionKey: installationId,
          displayName: body.data.displayName,
          authenticationMode: 'integration_token',
          enabled: true,
          config,
          encryptedSecret,
          status: 'CONFIGURED',
        },
      });

      response.status(201).json({
        connection: publicConnection(connection),
        credentials: {
          installationId,
          sharedSecret,
        },
      });
    } catch (error) {
      response.status(400).json({
        error: {
          code: 'PUBLISHING_CONNECTION_REGISTRATION_FAILED',
          message: error instanceof Error ? error.message : 'Publishing connection registration failed.',
        },
      });
    }
  },
);

userIntegrationRouter.post(
  '/integrations/:providerId/connections',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const providerId = providerIdSchema.safeParse(request.params.providerId);
    const body = connectionSchema.safeParse(request.body);
    if (!providerId.success || !body.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_INTEGRATION_CONNECTION',
          message: 'The integration connection configuration is invalid.',
          fields: body.success ? undefined : body.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const provider = getIntegrationProvider(providerId.data);
    if (!provider) {
      response.status(404).json({
        error: { code: 'INTEGRATION_PROVIDER_NOT_FOUND', message: 'Unknown integration provider.' },
      });
      return;
    }
    if (!provider.supportsPerUserAuthentication) {
      response.status(400).json({
        error: {
          code: 'INTEGRATION_USER_CONNECTION_NOT_SUPPORTED',
          message: 'This provider is configured at server or installation level.',
        },
      });
      return;
    }
    if (!provider.authenticationModes.includes(body.data.authenticationMode)) {
      response.status(400).json({
        error: {
          code: 'UNSUPPORTED_INTEGRATION_AUTH_MODE',
          message: 'The selected authentication mode is not supported by this provider.',
        },
      });
      return;
    }

    if (!provider.supportsMultipleConnections) {
      const existingOtherConnection = await prisma.userIntegration.findFirst({
        where: {
          userId: request.authUserId!,
          providerId: provider.id,
          NOT: { connectionKey: body.data.connectionKey },
        },
        select: { id: true },
      });
      if (existingOtherConnection) {
        response.status(409).json({
          error: {
            code: 'INTEGRATION_MULTIPLE_CONNECTIONS_NOT_SUPPORTED',
            message: 'This provider supports only one connection per user.',
          },
        });
        return;
      }
    }

    const secretRequired =
      body.data.authenticationMode === 'user_api_key' ||
      body.data.authenticationMode === 'integration_token';
    if (secretRequired && !body.data.secret) {
      response.status(400).json({
        error: {
          code: 'INTEGRATION_SECRET_REQUIRED',
          message: body.data.authenticationMode === 'integration_token'
            ? 'An integration token is required.'
            : 'An API key is required.',
        },
      });
      return;
    }

    const encryptedSecret = body.data.secret
      ? JSON.stringify(encryptSecret(body.data.secret))
      : null;

    const config = body.data.config as Prisma.InputJsonValue | undefined;

    const connection = await prisma.userIntegration.upsert({
      where: {
        userId_providerId_connectionKey: {
          userId: request.authUserId!,
          providerId: provider.id,
          connectionKey: body.data.connectionKey,
        },
      },
      update: {
        displayName: body.data.displayName ?? null,
        authenticationMode: body.data.authenticationMode,
        enabled: body.data.enabled,
        ...(config !== undefined ? { config } : {}),
        ...(encryptedSecret ? { encryptedSecret } : {}),
        status: 'CONFIGURED',
        lastError: null,
      },
      create: {
        userId: request.authUserId!,
        providerId: provider.id,
        connectionKey: body.data.connectionKey,
        displayName: body.data.displayName ?? null,
        authenticationMode: body.data.authenticationMode,
        enabled: body.data.enabled,
        ...(config !== undefined ? { config } : {}),
        encryptedSecret,
        status: 'CONFIGURED',
      },
    });

    response.status(201).json({ connection: publicConnection(connection) });
  },
);

userIntegrationRouter.post(
  '/integrations/connections/:connectionId/test',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const connectionId = connectionIdSchema.safeParse(request.params.connectionId);
    if (!connectionId.success) {
      response.status(400).json({
        error: { code: 'INVALID_INTEGRATION_CONNECTION_ID', message: 'The connection ID is invalid.' },
      });
      return;
    }

    const connection = await prisma.userIntegration.findFirst({
      where: { id: connectionId.data, userId: request.authUserId! },
    });
    if (!connection) {
      response.status(404).json({
        error: { code: 'INTEGRATION_CONNECTION_NOT_FOUND', message: 'Integration connection not found.' },
      });
      return;
    }

    const platform = publishingPlatform(connection.providerId);
    if (!platform) {
      response.status(400).json({
        error: { code: 'CONNECTION_TEST_NOT_SUPPORTED', message: 'Per-connection testing is not supported for this provider.' },
      });
      return;
    }

    const installationId = readInstallationId(connection.config);
    const installation = installationId
      ? await prisma.externalInstallation.findUnique({ where: { installationId } })
      : null;
    const healthy = Boolean(
      installation &&
      installation.platform === platform &&
      installation.status === ExternalInstallationStatus.ACTIVE,
    );
    const message = healthy
      ? 'The publishing installation is registered and active in Studio.'
      : 'The publishing installation is not registered or is disabled in Studio.';
    const checked = await prisma.userIntegration.update({
      where: { id: connection.id },
      data: {
        status: healthy ? 'CONNECTED' : 'DISCONNECTED',
        lastCheckedAt: new Date(),
        lastError: healthy ? null : message,
      },
    });

    response.status(healthy ? 200 : 409).json({
      connection: publicConnection(checked),
      status: { configured: Boolean(installationId), healthy, message },
    });
  },
);

userIntegrationRouter.post(
  '/integrations/:providerId/test',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const providerId = providerIdSchema.safeParse(request.params.providerId);
    if (!providerId.success || !getIntegrationProvider(providerId.data)) {
      response.status(404).json({
        error: { code: 'INTEGRATION_PROVIDER_NOT_FOUND', message: 'Unknown integration provider.' },
      });
      return;
    }

    const result = await testIntegrationProvider(providerId.data, request.authUserId!);
    await prisma.userIntegration.updateMany({
      where: { userId: request.authUserId!, providerId: providerId.data },
      data: {
        status: result.healthy ? 'CONNECTED' : result.configured ? 'CONFIGURED' : 'DISCONNECTED',
        lastCheckedAt: new Date(),
        lastError: result.healthy ? null : result.message,
      },
    });

    response.status(result.healthy ? 200 : 409).json({ status: result });
  },
);

userIntegrationRouter.delete(
  '/integrations/connections/:connectionId',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const connectionId = connectionIdSchema.safeParse(request.params.connectionId);
    if (!connectionId.success) {
      response.status(400).json({
        error: { code: 'INVALID_INTEGRATION_CONNECTION_ID', message: 'The connection ID is invalid.' },
      });
      return;
    }

    const connection = await prisma.userIntegration.findFirst({
      where: { id: connectionId.data, userId: request.authUserId! },
      select: { id: true, providerId: true, config: true },
    });
    if (!connection) {
      response.status(404).json({
        error: { code: 'INTEGRATION_CONNECTION_NOT_FOUND', message: 'Integration connection not found.' },
      });
      return;
    }

    const installationId = publishingPlatform(connection.providerId)
      ? readInstallationId(connection.config)
      : null;

    await prisma.$transaction(async (transaction) => {
      await transaction.userIntegration.delete({ where: { id: connection.id } });
      if (installationId) {
        await transaction.externalInstallation.updateMany({
          where: { installationId },
          data: { status: ExternalInstallationStatus.DISABLED },
        });
      }
    });

    response.status(204).end();
  },
);
