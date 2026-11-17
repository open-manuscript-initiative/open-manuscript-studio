import { Router } from 'express';
import { z } from 'zod';
import {
  requireSession,
  type AuthenticatedRequest,
} from '../middleware/requireSession.js';
import {
  changeEditorialProduction,
  getEditorialProduction,
  getEditorialProductionFile,
  listProductionTasks,
  type ProductionCommand,
} from '../services/editorialProductionService.js';

export const editorialProductionRouter = Router();
editorialProductionRouter.use(requireSession);
editorialProductionRouter.use((_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store');
  next();
});
const id = z.string().uuid();
const role = z.enum(['COPYEDITOR', 'LAYOUT_EDITOR', 'PROOFREADER']);
const approvalRole = z.enum(['AUTHOR', 'EDITOR']);
const source = z
  .object({
    manuscriptId: z.string().trim().min(1).max(128),
    title: z.string().max(500),
    revisionId: z.string().trim().min(1).max(128),
    stateDigest: z.string().regex(/^[0-9a-f]{64}$/),
    publicationContentDigest: z.string().regex(/^[0-9a-f]{64}$/),
    manuscriptStateSnapshot: z.record(z.string(), z.unknown()),
    reviewSnapshot: z.record(z.string(), z.unknown()),
    assets: z
      .array(
        z
          .object({
            assetId: z.string().max(128),
            mediaType: z.string().max(200),
            checksum: z.string().regex(/^[0-9a-f]{64}$/),
            bytesBase64: z.string().max(70_000_000),
          })
          .strict(),
      )
      .max(2000),
  })
  .strict();
const schema = z
  .object({
    version: z.number().int().min(0),
    command: z.discriminatedUnion('type', [
      z.object({ type: z.literal('START') }).strict(),
      z
        .object({
          type: z.literal('ASSIGN'),
          email: z.string().email().max(320),
          role,
          dueAt: z.string().datetime().optional(),
        })
        .strict(),
      z.object({ type: z.literal('REVOKE'), userId: id, role }).strict(),
      z.object({ type: z.literal('SOURCE'), source }).strict(),
      z
        .object({
          type: z.literal('APPROVE_SOURCE'),
          role: approvalRole,
          fileId: id,
        })
        .strict(),
      z.object({ type: z.literal('LAYOUT') }).strict(),
      z
        .object({
          type: z.literal('PROOF'),
          artifactBase64: z.string().min(1).max(46_000_000),
          build: z.record(z.string(), z.unknown()),
        })
        .strict(),
      z
        .object({
          type: z.literal('CORRECTION'),
          fileId: id,
          locator: z.string().trim().min(1).max(500),
          note: z.string().trim().min(1).max(10_000),
        })
        .strict(),
      z
        .object({
          type: z.literal('RESOLVE'),
          id,
          note: z.string().trim().min(1).max(10_000),
        })
        .strict(),
      z
        .object({
          type: z.literal('APPROVE_PROOF'),
          role: approvalRole,
          fileId: id,
        })
        .strict(),
      z.object({ type: z.literal('READY') }).strict(),
    ]),
  })
  .strict();
function sendError(response: import('express').Response, error: unknown) {
  const status =
    error instanceof z.ZodError
      ? 400
      : ((error as { status?: number }).status ??
        (
          {
            ForbiddenError: 403,
            ConflictError: 409,
            NotFoundError: 404,
          } as Record<string, number>
        )[(error as Error).name] ??
        500);
  response
    .status(status)
    .json({
      error: {
        message:
          status === 500
            ? 'Production request failed.'
            : error instanceof Error
              ? error.message
              : 'Production request failed.',
      },
    });
}
editorialProductionRouter.get(
  '/tasks',
  async (request: AuthenticatedRequest, response) => {
    try {
      response.json({ tasks: await listProductionTasks(request.authUserId!) });
    } catch (error) {
      sendError(response, error);
    }
  },
);
editorialProductionRouter.get(
  '/:submissionId',
  async (request: AuthenticatedRequest, response) => {
    try {
      response.json(
        await getEditorialProduction(
          request.authUserId!,
          id.parse(request.params.submissionId),
        ),
      );
    } catch (error) {
      sendError(response, error);
    }
  },
);
editorialProductionRouter.post(
  '/:submissionId',
  async (request: AuthenticatedRequest, response) => {
    try {
      const input = schema.parse(request.body);
      response.json(
        await changeEditorialProduction(
          request.authUserId!,
          id.parse(request.params.submissionId),
          input.version,
          input.command as ProductionCommand,
        ),
      );
    } catch (error) {
      sendError(response, error);
    }
  },
);
editorialProductionRouter.get(
  '/:submissionId/files/:fileId',
  async (request: AuthenticatedRequest, response) => {
    try {
      const file = await getEditorialProductionFile(
        request.authUserId!,
        id.parse(request.params.submissionId),
        id.parse(request.params.fileId),
      );
      response.setHeader('Content-Type', file.mediaType);
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader(
        'Content-Security-Policy',
        "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:",
      );
      response.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      );
      response.send(Buffer.from(file.bytes));
    } catch (error) {
      sendError(response, error);
    }
  },
);
