import { Router } from 'express';
import { z } from 'zod';
import {
  productionId as id,
  productionCommandSchema as schema,
  productionResponseSchema,
  productionTasksSchema,
} from '../contracts/editorialProductionContract.js';
import {
  versionedEditorialBoundary,
  editorialError,
} from './editorialApiBoundary.js';
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
editorialProductionRouter.use(
  versionedEditorialBoundary('/native-editorial/production'),
);
editorialProductionRouter.use(requireSession);
editorialProductionRouter.use((_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store');
  next();
});
function productionWire(value: unknown) {
  const parsed = productionResponseSchema.safeParse(
    JSON.parse(JSON.stringify(value)),
  );
  if (!parsed.success) throw new Error('Incompatible production response.');
  return parsed.data;
}
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
  editorialError(
    response,
    status,
    status === 500
      ? 'Production request failed.'
      : error instanceof Error
        ? error.message
        : 'Production request failed.',
  );
}
editorialProductionRouter.get(
  '/tasks',
  async (request: AuthenticatedRequest, response) => {
    try {
      response.json(
        productionTasksSchema.parse({
          tasks: await listProductionTasks(request.authUserId!),
        }),
      );
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
        productionWire(
          await getEditorialProduction(
            request.authUserId!,
            id.parse(request.params.submissionId),
          ),
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
        productionWire(
          await changeEditorialProduction(
            request.authUserId!,
            id.parse(request.params.submissionId),
            input.version,
            input.command as ProductionCommand,
          ),
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
