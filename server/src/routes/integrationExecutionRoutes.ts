import { randomUUID } from 'node:crypto';

import { Router } from 'express';
import { z } from 'zod';

import {
  listIntegrationAuditEvents,
  runBuiltInAgent,
  translateWithDeepL,
} from '../integrations/integrationExecution.js';
import { prisma } from '../lib/prisma.js';
import {
  requireSession,
  type AuthenticatedRequest,
} from '../middleware/requireSession.js';

export const integrationExecutionRouter = Router();

const scopeSchema = z.object({
  kind: z.enum(['selection', 'block', 'section', 'manuscript', 'metadata', 'references']),
  id: z.string().trim().min(1).max(256).optional(),
  reviewConfidential: z.boolean().optional(),
});

const translationSchema = z.object({
  sourceLanguage: z.string().trim().min(2).max(32).optional(),
  targetLanguage: z.string().trim().min(2).max(32),
  formality: z.enum(['default', 'more', 'less', 'prefer_more', 'prefer_less']).optional(),
  scope: scopeSchema,
  segments: z.array(z.object({
    id: z.string().trim().min(1).max(256),
    text: z.string().min(1).max(100_000),
    kind: z.string().trim().max(64).optional(),
  })).min(1).max(200),
  allowReviewConfidential: z.boolean().optional(),
});

const agentSchema = z.object({
  agentId: z.enum(['language-editor', 'metadata-assistant', 'summarizer', 'citation-checker']),
  scope: scopeSchema,
  content: z.string().min(1).max(80_000),
  context: z.record(z.string(), z.unknown()).optional(),
  requestedPermissions: z.array(z.string().trim().min(1).max(128)).max(16).optional(),
  allowReviewConfidential: z.boolean().optional(),
  allowDirectWrite: z.boolean().optional(),
});

const extensionManifestSchema = z.object({
  model: z.literal('omi-integration-extension'),
  apiVersion: z.literal('1'),
  id: z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{1,126}[a-z0-9]$/),
  name: z.string().trim().min(1).max(200),
  version: z.string().trim().min(1).max(64),
  kind: z.enum(['translation', 'ai', 'agent', 'storage', 'publishing', 'identity', 'scholarly-service']),
  description: z.string().trim().max(2000).optional(),
  authenticationModes: z.array(z.enum(['none', 'server_secret', 'user_api_key', 'oauth2', 'oidc', 'integration_token'])).min(1).max(6),
  permissions: z.array(z.string().trim().min(1).max(128)).max(32),
  capabilities: z.array(z.string().trim().min(1).max(128)).max(32),
  endpoints: z.record(z.string(), z.string().url().max(2048)).optional(),
}).superRefine((manifest, context) => {
  for (const [name, endpoint] of Object.entries(manifest.endpoints ?? {})) {
    try {
      const url = new URL(endpoint);
      if (url.protocol !== 'https:' || url.username || url.password) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endpoints', name],
          message: 'Extension endpoints must be credential-free HTTPS URLs.',
        });
      }
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endpoints', name],
        message: 'Invalid extension endpoint URL.',
      });
    }
  }
});

integrationExecutionRouter.post(
  '/integrations/deepl/translate',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const input = translationSchema.safeParse(request.body);
    if (!input.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_TRANSLATION_REQUEST',
          message: 'The translation request is invalid.',
          fields: input.error.flatten().fieldErrors,
        },
      });
      return;
    }
    try {
      const result = await translateWithDeepL(request.authUserId!, input.data);
      response.status(200).json(result);
    } catch (error) {
      response.status(400).json({
        error: {
          code: 'DEEPL_TRANSLATION_FAILED',
          message: error instanceof Error ? error.message : 'DeepL translation failed.',
        },
      });
    }
  },
);

integrationExecutionRouter.post(
  '/integrations/agents/run',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const input = agentSchema.safeParse(request.body);
    if (!input.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_AGENT_REQUEST',
          message: 'The agent request is invalid.',
          fields: input.error.flatten().fieldErrors,
        },
      });
      return;
    }
    try {
      const result = await runBuiltInAgent(request.authUserId!, input.data);
      response.status(200).json(result);
    } catch (error) {
      response.status(400).json({
        error: {
          code: 'AGENT_EXECUTION_FAILED',
          message: error instanceof Error ? error.message : 'Agent execution failed.',
        },
      });
    }
  },
);

integrationExecutionRouter.get(
  '/integrations/audit',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const parsedLimit = z.coerce.number().int().min(1).max(200).catch(50).parse(request.query.limit);
    const events = await listIntegrationAuditEvents(request.authUserId!, parsedLimit);
    response.status(200).json({
      events: events.map((event) => ({
        id: event.id,
        providerId: event.provider_id,
        operation: event.operation,
        scope: { kind: event.scope_kind, id: event.scope_id },
        inputDigest: event.input_digest,
        inputLength: event.input_length,
        outputDigest: event.output_digest,
        outputLength: event.output_length,
        permissions: event.permissions,
        reviewConfidential: event.review_confidential,
        directWrite: event.direct_write,
        status: event.status.toLowerCase(),
        detail: event.detail,
        createdAt: event.created_at.toISOString(),
      })),
    });
  },
);

integrationExecutionRouter.get(
  '/integrations/extensions',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
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
      WHERE user_id = ${request.authUserId!}::uuid
      ORDER BY extension_id ASC
    `;
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

integrationExecutionRouter.post(
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

    const manifest = JSON.stringify(input.data);
    const rows = await prisma.$queryRaw<Array<{ id: string; created: boolean }>>`
      INSERT INTO integration_extension_manifests
        (id, user_id, extension_id, manifest, enabled)
      VALUES
        (${randomUUID()}::uuid, ${request.authUserId!}::uuid, ${input.data.id}, ${manifest}::jsonb, TRUE)
      ON CONFLICT (user_id, extension_id)
      DO UPDATE SET manifest = EXCLUDED.manifest, enabled = TRUE, updated_at = CURRENT_TIMESTAMP
      RETURNING id, (created_at = updated_at) AS created
    `;
    response.status(rows[0]?.created ? 201 : 200).json({
      id: rows[0]?.id,
      manifest: input.data,
      enabled: true,
    });
  },
);

integrationExecutionRouter.delete(
  '/integrations/extensions/:extensionId',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const extensionId = z.string().trim().min(1).max(128).safeParse(request.params.extensionId);
    if (!extensionId.success) {
      response.status(400).json({ error: { code: 'INVALID_EXTENSION_ID', message: 'Invalid extension id.' } });
      return;
    }
    await prisma.$executeRaw`
      DELETE FROM integration_extension_manifests
      WHERE user_id = ${request.authUserId!}::uuid
        AND extension_id = ${extensionId.data}
    `;
    response.status(204).end();
  },
);
