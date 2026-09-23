import { Router, type Response } from 'express';
import { z } from 'zod';

import {
  requireSession,
  type AuthenticatedRequest,
} from '../middleware/requireSession.js';
import {
  acceptNativeSubmission,
  assignNativeReviewer,
  claimNativeSubmission,
  completeNativeReview,
  createNativeSubmission,
  getNativeSubmissionForParticipant,
  listAuthorNativeSubmissions,
  listNativeEditorialInbox,
  markNativeSubmissionPublished,
  rejectNativeSubmission,
  requestNativeRevision,
  submitNativeRevision,
} from '../services/nativeEditorialWorkflowService.js';

export const nativeEditorialWorkflowRouter = Router();
nativeEditorialWorkflowRouter.use(requireSession);

const digestSchema = z.string().regex(/^[a-f0-9]{64}$/i);
const snapshotSchema = z.record(z.string(), z.unknown());

const submissionSnapshotSchema = z.object({
  publicationVenueId: z.string().uuid(),
  manuscriptId: z.string().trim().min(1).max(128),
  title: z.string().trim().min(1).max(500),
  revisionId: z.string().trim().min(1).max(128),
  stateDigest: digestSchema,
  manuscriptSnapshot: snapshotSchema,
}).strict();

const revisionSchema = submissionSnapshotSchema.omit({
  publicationVenueId: true,
  manuscriptId: true,
});

const reviewerSchema = z.object({
  reviewerEmail: z.string().trim().email(),
  anonymityMode: z.enum(['DOUBLE_BLIND', 'SINGLE_BLIND', 'OPEN']).optional(),
}).strict();

const noteSchema = z.object({
  note: z.string().trim().max(100_000).default(''),
}).strict();

const acceptanceSchema = z.object({
  publicationContentDigest: digestSchema,
  basisAssignmentIds: z.array(z.string().uuid()).min(1).max(100),
}).strict();

nativeEditorialWorkflowRouter.post('/', async (request: AuthenticatedRequest, response) => {
  try {
    const input = submissionSnapshotSchema.parse(request.body);
    const submission = await createNativeSubmission(requireUserId(request), input);
    response.status(201).json({ submission });
  } catch (error) {
    sendError(response, error, 'NATIVE_SUBMISSION_CREATE_FAILED');
  }
});

nativeEditorialWorkflowRouter.get('/mine', async (request: AuthenticatedRequest, response) => {
  try {
    const submissions = await listAuthorNativeSubmissions(requireUserId(request));
    response.status(200).json({ submissions });
  } catch (error) {
    sendError(response, error, 'NATIVE_SUBMISSION_LIST_FAILED');
  }
});

nativeEditorialWorkflowRouter.get('/editor-inbox', async (request: AuthenticatedRequest, response) => {
  try {
    const submissions = await listNativeEditorialInbox(requireUserId(request));
    response.status(200).json({ submissions });
  } catch (error) {
    sendError(response, error, 'NATIVE_EDITORIAL_INBOX_FAILED');
  }
});

nativeEditorialWorkflowRouter.get('/:submissionId', async (request: AuthenticatedRequest, response) => {
  try {
    const submission = await getNativeSubmissionForParticipant(
      requireUserId(request),
      parseId(request.params.submissionId),
    );
    response.status(200).json({ submission });
  } catch (error) {
    sendError(response, error, 'NATIVE_SUBMISSION_READ_FAILED');
  }
});

nativeEditorialWorkflowRouter.post('/:submissionId/claim', async (request: AuthenticatedRequest, response) => {
  try {
    const submission = await claimNativeSubmission(
      requireUserId(request),
      parseId(request.params.submissionId),
    );
    response.status(200).json({ submission });
  } catch (error) {
    sendError(response, error, 'NATIVE_SUBMISSION_CLAIM_FAILED');
  }
});

nativeEditorialWorkflowRouter.post('/:submissionId/reviewers', async (request: AuthenticatedRequest, response) => {
  try {
    const input = reviewerSchema.parse(request.body);
    const review = await assignNativeReviewer(
      requireUserId(request),
      parseId(request.params.submissionId),
      input,
    );
    response.status(201).json({ review });
  } catch (error) {
    sendError(response, error, 'NATIVE_REVIEWER_ASSIGNMENT_FAILED');
  }
});

nativeEditorialWorkflowRouter.post(
  '/:submissionId/reviews/:assignmentId/complete',
  async (request: AuthenticatedRequest, response) => {
    try {
      const review = await completeNativeReview(
        requireUserId(request),
        parseId(request.params.submissionId),
        parseId(request.params.assignmentId),
      );
      response.status(200).json({ review });
    } catch (error) {
      sendError(response, error, 'NATIVE_REVIEW_COMPLETE_FAILED');
    }
  },
);

nativeEditorialWorkflowRouter.post(
  '/:submissionId/request-revision',
  async (request: AuthenticatedRequest, response) => {
    try {
      const { note } = noteSchema.parse(request.body);
      const submission = await requestNativeRevision(
        requireUserId(request),
        parseId(request.params.submissionId),
        note,
      );
      response.status(200).json({ submission });
    } catch (error) {
      sendError(response, error, 'NATIVE_REVISION_REQUEST_FAILED');
    }
  },
);

nativeEditorialWorkflowRouter.post(
  '/:submissionId/revision',
  async (request: AuthenticatedRequest, response) => {
    try {
      const input = revisionSchema.parse(request.body);
      const submission = await submitNativeRevision(
        requireUserId(request),
        parseId(request.params.submissionId),
        input,
      );
      response.status(200).json({ submission });
    } catch (error) {
      sendError(response, error, 'NATIVE_REVISION_SUBMIT_FAILED');
    }
  },
);

nativeEditorialWorkflowRouter.post(
  '/:submissionId/reject',
  async (request: AuthenticatedRequest, response) => {
    try {
      const { note } = noteSchema.parse(request.body);
      const submission = await rejectNativeSubmission(
        requireUserId(request),
        parseId(request.params.submissionId),
        note,
      );
      response.status(200).json({ submission });
    } catch (error) {
      sendError(response, error, 'NATIVE_SUBMISSION_REJECT_FAILED');
    }
  },
);

nativeEditorialWorkflowRouter.post(
  '/:submissionId/accept',
  async (request: AuthenticatedRequest, response) => {
    try {
      const input = acceptanceSchema.parse(request.body);
      const result = await acceptNativeSubmission(
        requireUserId(request),
        parseId(request.params.submissionId),
        input,
      );
      response.status(201).json(result);
    } catch (error) {
      sendError(response, error, 'NATIVE_SUBMISSION_ACCEPT_FAILED');
    }
  },
);

nativeEditorialWorkflowRouter.post(
  '/:submissionId/published',
  async (request: AuthenticatedRequest, response) => {
    try {
      const submission = await markNativeSubmissionPublished(
        requireUserId(request),
        parseId(request.params.submissionId),
      );
      response.status(200).json({ submission });
    } catch (error) {
      sendError(response, error, 'NATIVE_SUBMISSION_PUBLISH_FAILED');
    }
  },
);

function requireUserId(request: AuthenticatedRequest): string {
  if (!request.authUserId) {
    const error = new Error('Authentication is required.');
    error.name = 'UnauthorizedError';
    throw error;
  }
  return request.authUserId;
}

function parseId(value: string | undefined): string {
  return z.string().uuid().parse(value);
}

function sendError(response: Response, error: unknown, code: string): void {
  const message = error instanceof Error ? error.message : 'Studio-native editorial workflow failed.';
  const name = error instanceof Error ? error.name : '';
  const status =
    name === 'UnauthorizedError' ? 401 :
    name === 'ForbiddenError' ? 403 :
    name === 'NotFoundError' ? 404 :
    name === 'ConflictError' ? 409 :
    error instanceof z.ZodError ? 400 : 400;
  response.status(status).json({ error: { code, message } });
}
