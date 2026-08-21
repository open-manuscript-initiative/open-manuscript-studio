import { createHash } from 'node:crypto';

import express, { Router } from 'express';
import { z } from 'zod';

import { WebDavProvider } from '../cloud/providers/webdav/WebDavProvider.js';
import { createCloudProvider, providerTypeFromDatabase } from '../cloud/providerFactory.js';
import type { WebDavCredentials } from '../cloud/types.js';
import { CloudStorageError } from '../cloud/errors/CloudStorageError.js';
import { encryptSecret } from '../integrations/secretCrypto.js';
import { prisma } from '../lib/prisma.js';
import {
  requireSession,
  type AuthenticatedRequest,
} from '../middleware/requireSession.js';

export const cloudRouter = Router();

const createConnectionSchema = z.object({
  providerType: z.enum(['webdav', 'nextcloud']),
  displayName: z.string().trim().min(1).max(200),
  baseUrl: z.string().url().max(2048),
  username: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(4096),
  rootPath: z.string().trim().max(1024).default('OMI'),
});

const connectionIdSchema = z.string().uuid();
const manuscriptIdSchema = z.string().trim().min(1).max(128);
const checksumSchema = z.string().regex(/^[0-9a-fA-F]{64}$/);

function databaseProviderType(type: 'webdav' | 'nextcloud'): 'WEBDAV' | 'NEXTCLOUD' {
  return type === 'webdav' ? 'WEBDAV' : 'NEXTCLOUD';
}

function publicConnection(connection: {
  id: string;
  providerType: string;
  displayName: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  lastVerifiedAt: Date | null;
}) {
  return {
    id: connection.id,
    providerType: providerTypeFromDatabase(connection.providerType),
    displayName: connection.displayName,
    status: connection.status.toLowerCase(),
    createdAt: connection.createdAt.toISOString(),
    updatedAt: connection.updatedAt.toISOString(),
    lastVerifiedAt: connection.lastVerifiedAt?.toISOString() ?? null,
  };
}

function errorResponse(response: express.Response, error: unknown): void {
  if (error instanceof CloudStorageError) {
    const status =
      error.code === 'CLOUD_AUTH_FAILED' ? 401 :
      error.code === 'CLOUD_PERMISSION_DENIED' ? 403 :
      error.code === 'CLOUD_OBJECT_NOT_FOUND' ? 404 :
      error.code === 'CLOUD_UNSAFE_REMOTE_URL' ? 400 : 502;

    response.status(status).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  console.error('Cloud storage request failed:', error);
  response.status(500).json({
    error: {
      code: 'CLOUD_INTERNAL_ERROR',
      message: 'The cloud storage operation failed.',
    },
  });
}

cloudRouter.get(
  '/cloud/connections',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const connections = await prisma.cloudConnection.findMany({
      where: { userId: request.authUserId! },
      orderBy: { createdAt: 'asc' },
    });

    response.status(200).json({
      connections: connections.map(publicConnection),
    });
  },
);

cloudRouter.post(
  '/cloud/connections',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const parsed = createConnectionSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_CLOUD_CONNECTION',
          message: 'The cloud connection configuration is invalid.',
          fields: parsed.error.flatten().fieldErrors,
        },
      });
      return;
    }

    const credentials: WebDavCredentials = {
      baseUrl: parsed.data.baseUrl,
      username: parsed.data.username,
      password: parsed.data.password,
      rootPath: parsed.data.rootPath,
    };

    try {
      const provider = new WebDavProvider(credentials, parsed.data.providerType);
      const connectionStatus = await provider.getStatus();
      if (connectionStatus.state !== 'connected') {
        response.status(400).json({
          error: {
            code: 'CLOUD_CONNECTION_TEST_FAILED',
            message: connectionStatus.message ?? 'The cloud connection test failed.',
          },
        });
        return;
      }

      const encrypted = encryptSecret(JSON.stringify(credentials));
      const connection = await prisma.cloudConnection.create({
        data: {
          userId: request.authUserId!,
          providerType: databaseProviderType(parsed.data.providerType),
          displayName: parsed.data.displayName,
          status: 'CONNECTED',
          encryptedCredentials: JSON.stringify(encrypted),
          lastVerifiedAt: new Date(),
        },
      });

      response.status(201).json({ connection: publicConnection(connection) });
    } catch (error) {
      errorResponse(response, error);
    }
  },
);

cloudRouter.post(
  '/cloud/connections/:connectionId/test',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const parsedId = connectionIdSchema.safeParse(request.params.connectionId);
    if (!parsedId.success) {
      response.status(400).json({ error: { code: 'INVALID_CONNECTION_ID', message: 'The connection ID is invalid.' } });
      return;
    }

    const connection = await prisma.cloudConnection.findFirst({
      where: { id: parsedId.data, userId: request.authUserId! },
    });
    if (!connection) {
      response.status(404).json({ error: { code: 'CLOUD_CONNECTION_NOT_FOUND', message: 'Cloud connection not found.' } });
      return;
    }

    try {
      const provider = createCloudProvider(connection);
      const status = await provider.getStatus();
      const updated = await prisma.cloudConnection.update({
        where: { id: connection.id },
        data: {
          status: status.state === 'connected' ? 'CONNECTED' : 'ERROR',
          lastVerifiedAt: new Date(),
        },
      });

      response.status(status.state === 'connected' ? 200 : 502).json({
        connection: publicConnection(updated),
        status,
      });
    } catch (error) {
      errorResponse(response, error);
    }
  },
);

cloudRouter.delete(
  '/cloud/connections/:connectionId',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const parsedId = connectionIdSchema.safeParse(request.params.connectionId);
    if (!parsedId.success) {
      response.status(400).json({ error: { code: 'INVALID_CONNECTION_ID', message: 'The connection ID is invalid.' } });
      return;
    }

    const result = await prisma.cloudConnection.deleteMany({
      where: { id: parsedId.data, userId: request.authUserId! },
    });
    if (result.count === 0) {
      response.status(404).json({ error: { code: 'CLOUD_CONNECTION_NOT_FOUND', message: 'Cloud connection not found.' } });
      return;
    }

    response.status(204).end();
  },
);

cloudRouter.post(
  '/manuscripts/:manuscriptId/backups',
  requireSession,
  express.raw({
    type: 'application/vnd.openmanuscript.package+zip',
    limit: '100mb',
  }),
  async (request: AuthenticatedRequest, response) => {
    const manuscriptId = manuscriptIdSchema.safeParse(request.params.manuscriptId);
    const connectionId = connectionIdSchema.safeParse(request.query.connectionId);
    const packageVersion = typeof request.headers['x-omi-package-version'] === 'string'
      ? request.headers['x-omi-package-version'].trim()
      : '0.1.0';
    const expectedChecksumHeader = request.headers['x-omi-sha256'];
    const expectedChecksum = typeof expectedChecksumHeader === 'string'
      ? checksumSchema.safeParse(expectedChecksumHeader)
      : undefined;
    const requestBody: unknown = request.body;

    if (!manuscriptId.success || !connectionId.success || !Buffer.isBuffer(requestBody) || requestBody.byteLength === 0) {
      response.status(400).json({
        error: {
          code: 'INVALID_BACKUP_REQUEST',
          message: 'A manuscript ID, connectionId and non-empty OMI package are required.',
        },
      });
      return;
    }
    if (expectedChecksum && !expectedChecksum.success) {
      response.status(400).json({ error: { code: 'INVALID_BACKUP_CHECKSUM', message: 'X-OMI-SHA256 must contain a SHA-256 checksum.' } });
      return;
    }

    // Copy the validated raw body into a concrete Buffer before using any
    // length/hash properties. This prevents parameter tampering from changing
    // the runtime type after Express parsing and keeps downstream providers on
    // a single binary representation.
    const packageBytes = Buffer.from(requestBody);

    const connection = await prisma.cloudConnection.findFirst({
      where: { id: connectionId.data, userId: request.authUserId! },
    });
    if (!connection) {
      response.status(404).json({ error: { code: 'CLOUD_CONNECTION_NOT_FOUND', message: 'Cloud connection not found.' } });
      return;
    }

    const checksum = createHash('sha256').update(packageBytes).digest('hex');
    if (expectedChecksum?.success && expectedChecksum.data.toLowerCase() !== checksum) {
      response.status(400).json({
        error: {
          code: 'BACKUP_INTEGRITY_CHECK_FAILED',
          message: 'The supplied package checksum does not match the uploaded content.',
        },
      });
      return;
    }

    const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
    const remotePath = [
      'users',
      request.authUserId!,
      'manuscripts',
      manuscriptId.data,
      'backups',
      `${manuscriptId.data}_${timestamp}.omi.zip`,
    ].join('/');

    try {
      const provider = createCloudProvider(connection);
      const object = await provider.upload({
        path: remotePath,
        data: packageBytes,
        contentType: 'application/vnd.openmanuscript.package+zip',
        metadata: { manuscriptId: manuscriptId.data, packageVersion, checksum },
      });

      const backup = await prisma.cloudBackup.create({
        data: {
          manuscriptId: manuscriptId.data,
          userId: request.authUserId!,
          connectionId: connection.id,
          providerObjectId: object.id,
          providerPath: object.path,
          packageVersion,
          checksum,
          sizeBytes: BigInt(packageBytes.byteLength),
          status: 'COMPLETED',
        },
      });

      response.status(201).json({
        backup: {
          ...backup,
          sizeBytes: backup.sizeBytes.toString(),
        },
      });
    } catch (error) {
      errorResponse(response, error);
    }
  },
);

cloudRouter.get(
  '/manuscripts/:manuscriptId/backups',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const manuscriptId = manuscriptIdSchema.safeParse(request.params.manuscriptId);
    if (!manuscriptId.success) {
      response.status(400).json({ error: { code: 'INVALID_MANUSCRIPT_ID', message: 'The manuscript ID is invalid.' } });
      return;
    }

    const backups = await prisma.cloudBackup.findMany({
      where: { manuscriptId: manuscriptId.data, userId: request.authUserId! },
      orderBy: { createdAt: 'desc' },
    });

    response.status(200).json({
      backups: backups.map((backup) => ({
        ...backup,
        sizeBytes: backup.sizeBytes.toString(),
      })),
    });
  },
);

async function loadOwnedBackup(backupId: string, userId: string) {
  const parsedId = connectionIdSchema.safeParse(backupId);
  if (!parsedId.success) return null;

  return prisma.cloudBackup.findFirst({
    where: { id: parsedId.data, userId },
    include: { connection: true },
  });
}

async function sendBackupContent(
  request: AuthenticatedRequest,
  response: express.Response,
): Promise<void> {
  const backup = await loadOwnedBackup(request.params.backupId ?? '', request.authUserId!);
  if (!backup) {
    response.status(404).json({ error: { code: 'CLOUD_BACKUP_NOT_FOUND', message: 'Cloud backup not found.' } });
    return;
  }

  try {
    const provider = createCloudProvider(backup.connection);
    const data = await provider.download(backup.providerObjectId);
    const checksum = createHash('sha256').update(data).digest('hex');
    if (checksum !== backup.checksum) {
      throw new CloudStorageError(
        'BACKUP_INTEGRITY_CHECK_FAILED',
        'The downloaded backup checksum does not match the stored checksum.',
      );
    }

    response.setHeader('Content-Type', 'application/vnd.openmanuscript.package+zip');
    response.setHeader('Content-Length', String(data.length));
    response.setHeader('X-OMI-Package-Version', backup.packageVersion);
    response.setHeader('X-OMI-SHA256', backup.checksum);
    response.status(200).send(data);
  } catch (error) {
    errorResponse(response, error);
  }
}

cloudRouter.get(
  '/backups/:backupId/content',
  requireSession,
  sendBackupContent,
);

cloudRouter.post(
  '/backups/:backupId/restore',
  requireSession,
  sendBackupContent,
);

cloudRouter.delete(
  '/backups/:backupId',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const backup = await loadOwnedBackup(request.params.backupId ?? '', request.authUserId!);
    if (!backup) {
      response.status(404).json({ error: { code: 'CLOUD_BACKUP_NOT_FOUND', message: 'Cloud backup not found.' } });
      return;
    }

    try {
      const provider = createCloudProvider(backup.connection);
      await provider.delete(backup.providerObjectId);
      await prisma.cloudBackup.delete({ where: { id: backup.id } });
      response.status(204).end();
    } catch (error) {
      errorResponse(response, error);
    }
  },
);