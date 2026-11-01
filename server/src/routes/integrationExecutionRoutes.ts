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

const translationVariantSchema = z.object({
  manuscriptId: z.string().trim().min(1).max(128),
  sourceLocale: z.string().trim().min(2).max(32).optional(),
  targetLocale: z.string().trim().min(2).max(32),
  scope: z.object({
    kind: z.enum(['section', 'manuscript']),
    id: z.string().trim().min(1).max(256).optional(),
  }),
  providerId: z.literal('deepl').default('deepl'),
  translatedState: z.unknown(),
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
  '/integrations/translation-variants',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const manuscriptId = z.string().trim().min(1).max(128).safeParse(request.query.manuscriptId);
    if (!manuscriptId.success) {
      response.status(400).json({ error: { code: 'INVALID_MANUSCRIPT_ID', message: 'A manuscript id is required.' } });
      return;
    }
    const rows = await prisma.$queryRaw<Array<{
      id: string;
      manuscript_id: string;
      source_locale: string | null;
      target_locale: string;
      scope_kind: string;
      scope_id: string | null;
      provider_id: string;
      translated_state: unknown;
      created_at: Date;
      updated_at: Date;
    }>>`
      SELECT id, manuscript_id, source_locale, target_locale, scope_kind, scope_id,
             provider_id, translated_state, created_at, updated_at
      FROM integration_translation_variants
      WHERE user_id = ${request.authUserId!}::uuid
        AND manuscript_id = ${manuscriptId.data}
      ORDER BY updated_at DESC
    `;
    response.status(200).json({
      variants: rows.map((row) => ({
        id: row.id,
        manuscriptId: row.manuscript_id,
        sourceLocale: row.source_locale,
        targetLocale: row.target_locale,
        scope: { kind: row.scope_kind, id: row.scope_id },
        providerId: row.provider_id,
        translatedState: row.translated_state,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      })),
    });
  },
);

integrationExecutionRouter.post(
  '/integrations/translation-variants',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const input = translationVariantSchema.safeParse(request.body);
    if (!input.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_TRANSLATION_VARIANT',
          message: 'The translated language variant is invalid.',
          fields: input.error.flatten().fieldErrors,
        },
      });
      return;
    }
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO integration_translation_variants
        (id, user_id, manuscript_id, source_locale, target_locale, scope_kind,
         scope_id, provider_id, translated_state)
      VALUES
        (${id}::uuid, ${request.authUserId!}::uuid, ${input.data.manuscriptId},
         ${input.data.sourceLocale ?? null}, ${input.data.targetLocale}, ${input.data.scope.kind},
         ${input.data.scope.id ?? null}, ${input.data.providerId},
         ${JSON.stringify(input.data.translatedState)}::jsonb)
    `;
    response.status(201).json({ id });
  },
);

integrationExecutionRouter.delete(
  '/integrations/translation-variants/:variantId',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    const variantId = z.string().uuid().safeParse(request.params.variantId);
    if (!variantId.success) {
      response.status(400).json({ error: { code: 'INVALID_VARIANT_ID', message: 'Invalid translation variant id.' } });
      return;
    }
    await prisma.$executeRaw`
      DELETE FROM integration_translation_variants
      WHERE id = ${variantId.data}::uuid
        AND user_id = ${request.authUserId!}::uuid
    `;
    response.status(204).end();
  },
);
