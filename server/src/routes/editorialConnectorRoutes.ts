import { Router } from 'express';
import { z } from 'zod';
import {
  requireSession,
  type AuthenticatedRequest,
} from '../middleware/requireSession.js';
import { ojsMetadataRequest } from '../contracts/ojsMetadataContract.js';
import { workflowInspectionRequest } from '../contracts/editorialConnectorContract.js';
import {
  inspectEditorialCapabilities,
  inspectEditorialWorkflow,
  reconcileEditorialMetadata,
} from '../services/editorialConnectorService.js';
import { RemoteError } from '../integrations/publishing/nativePublishingClient.js';
import {
  versionedEditorialBoundary,
  editorialError,
} from './editorialApiBoundary.js';
export const editorialConnectorRouter = Router();
const prefix = '/integrations/connections/:connectionId';
function handler(
  operation: (
    userId: string,
    connectionId: string,
    body: unknown,
  ) => Promise<unknown>,
) {
  return async (
    request: AuthenticatedRequest,
    response: import('express').Response,
  ) => {
    try {
      response.json(
        await operation(
          request.authUserId!,
          z.string().uuid().parse(request.params.connectionId),
          request.body,
        ),
      );
    } catch (error) {
      const status =
        error instanceof z.ZodError
          ? 400
          : error instanceof RemoteError &&
              [400, 403, 404, 409, 422, 502].includes(error.status)
            ? error.status
            : 502;
      editorialError(
        response,
        status,
        error instanceof z.ZodError
          ? 'Invalid editorial connector request.'
          : error instanceof RemoteError
            ? error.message
            : 'Editorial connector request failed.',
      );
    }
  };
}
editorialConnectorRouter.get(
  `${prefix}/editorial-capabilities`,
  versionedEditorialBoundary(''),
  requireSession,
  handler(inspectEditorialCapabilities),
);
editorialConnectorRouter.post(
  `${prefix}/workflow-status`,
  versionedEditorialBoundary(''),
  requireSession,
  handler((user, id, body) =>
    inspectEditorialWorkflow(
      user,
      id,
      workflowInspectionRequest.parse(body).submissionId,
    ),
  ),
);
editorialConnectorRouter.post(
  `${prefix}/metadata`,
  versionedEditorialBoundary(''),
  requireSession,
  handler((user, id, body) =>
    reconcileEditorialMetadata(user, id, ojsMetadataRequest.parse(body)),
  ),
);
