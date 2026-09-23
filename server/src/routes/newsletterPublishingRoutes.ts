import { Router, type Response } from 'express';
import { z } from 'zod';

import {
  WEB_PUBLICATION_APPROVAL,
  WebPublicationServiceError,
  executeWebPublicationDelivery,
  issueWebPublicationApproval,
} from '../integrations/publishing/webPublication.js';
import {
  requireSession,
  type AuthenticatedRequest,
} from '../middleware/requireSession.js';
import { listEditorialPublicationEvidence } from '../services/editorialDecisionService.js';

export const webPublicationV1Router = Router();
export const newsletterPublishingRouter = Router();

const assuranceBaseSchema = z.object({
  model: z.literal('omi-publication-assurance'),
  version: z.literal('1'),
  intent: z.enum([
    'public-interest',
    'popular-science',
    'newsletter',
    'scholarly-article',
    'book-chapter',
  ]),
  disclosure: z.literal('visible-and-machine-readable'),
});

const assuranceSchema = z.discriminatedUnion('reviewStatus', [
  assuranceBaseSchema.extend({
    reviewStatus: z.literal('not-peer-reviewed'),
    approvalAuthority: z.literal('authenticated-account-holder'),
  }).strict(),
  assuranceBaseSchema.extend({
    reviewStatus: z.literal('peer-reviewed'),
    approvalAuthority: z.literal('studio-editorial-decision'),
    evidence: z.object({
      type: z.literal('studio-editorial-decision'),
      decisionId: z.string().uuid(),
      evidenceDigest: z.string().regex(/^[a-f0-9]{64}$/i),
      reviewRound: z.number().int().min(1).max(99),
      decidedAt: z.iso.datetime({ offset: true }),
    }).strict(),
  }).strict(),
]);

const approvalSchema = z.object({
  connectionId: z.string().uuid(),
  connectionVersion: z.iso.datetime({ offset: true }),
  manuscriptId: z.string().trim().min(1).max(128),
  title: z.string().trim().min(1).max(500),
  status: z.enum(['draft', 'publish']),
  assurance: assuranceSchema,
  artifact: z.object({
    html: z.string().min(1).max(10 * 1024 * 1024),
    build: z.unknown(),
  }).strict(),
  idempotencyKey: z.string().trim().min(32).max(256),
  confirmation: z.literal(WEB_PUBLICATION_APPROVAL),
}).strict();

const executionSchema = z.object({
  executionToken: z.string().min(32).max(256),
}).strict();

const assuranceEvidenceQuerySchema = z.object({
  manuscriptId: z.string().trim().min(1).max(128),
  revisionId: z.string().trim().min(1).max(128),
  stateDigest: z.string().regex(/^[a-f0-9]{64}$/i),
}).strict();

webPublicationV1Router.get(
  '/web/assurance-evidence',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    response.setHeader('Cache-Control', 'no-store');
    const input = assuranceEvidenceQuerySchema.safeParse(request.query);
    if (!input.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_PUBLICATION_ASSURANCE_QUERY',
          message: 'A manuscript, committed revision, and state digest are required.',
        },
      });
      return;
    }
    try {
      const evidence = await listEditorialPublicationEvidence(
        request.authUserId!,
        input.data.manuscriptId,
        input.data.revisionId,
        input.data.stateDigest,
      );
      response.status(200).json(evidence);
    } catch (error) {
      sendServiceError(response, error, 'Publication-assurance lookup failed.');
    }
  },
);

webPublicationV1Router.post(
  '/web/approval-grants',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    response.setHeader('Cache-Control', 'no-store');
    const input = approvalSchema.safeParse(request.body);
    if (!input.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_WEB_PUBLICATION_APPROVAL',
          message: 'The web-publication artifact, assurance, or approval is invalid.',
          fields: input.error.flatten().fieldErrors,
        },
      });
      return;
    }

    try {
      const result = await issueWebPublicationApproval(
        request.authUserId!,
        input.data,
      );
      response.status(result.receipt ? 200 : 201).json(result);
    } catch (error) {
      sendServiceError(response, error, 'Web-publication approval failed.');
    }
  },
);

webPublicationV1Router.post(
  '/web/deliveries/:deliveryId/execute',
  requireSession,
  async (request: AuthenticatedRequest, response) => {
    response.setHeader('Cache-Control', 'no-store');
    const deliveryId = z.string().uuid().safeParse(request.params.deliveryId);
    const input = executionSchema.safeParse(request.body);
    if (!deliveryId.success || !input.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_WEB_PUBLICATION_EXECUTION',
          message: 'The web-publication execution request is invalid.',
        },
      });
      return;
    }

    try {
      const receipt = await executeWebPublicationDelivery(
        request.authUserId!,
        deliveryId.data,
        input.data.executionToken,
      );
      response.status(200).json({ receipt });
    } catch (error) {
      sendServiceError(response, error, 'Web-publication delivery failed.');
    }
  },
);

/**
 * Pre-v1 beta endpoint. Keeping an explicit tombstone prevents an older client
 * from silently falling back to client-controlled `approved: true` authority.
 */
newsletterPublishingRouter.post(
  '/newsletter/publish',
  requireSession,
  (_request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.status(410).json({
      error: {
        code: 'WEB_PUBLICATION_V1_REQUIRED',
        message: 'Prepare a committed publication artifact and use the server-issued web-publication approval-grant flow.',
      },
    });
  },
);

function sendServiceError(
  response: Response,
  error: unknown,
  fallback: string,
): void {
  if (error instanceof WebPublicationServiceError) {
    response.status(error.httpStatus).json({
      error: { code: error.code, message: error.message },
    });
    return;
  }
  response.status(500).json({
    error: {
      code: 'WEB_PUBLICATION_INTERNAL_ERROR',
      message: fallback,
    },
  });
}
