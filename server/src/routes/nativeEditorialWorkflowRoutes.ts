import { Router, type Response } from 'express';
import { z } from 'zod';

import {
  requireSession,
  type AuthenticatedRequest,
} from '../middleware/requireSession.js';
import {
  acceptNativeEditorialSubmission,
  assignNativeEditorialReviewer,
  completeNativeEditorialReview,
  getNativeEditorialSubmission,
  listNativeEditorialInbox,
  listNativeEditorialSubmissionsForAuthor,
  markNativeEditorialSubmissionPublished,
  rejectNativeEditorialSubmission,
  requestNativeEditorialRevision,
  submitNativeEditorialManuscript,
  submitNativeEditorialRevision,
} from '../services/nativeEditorialWorkflowService.js';

export const nativeEditorialWorkflowRouter = Router();

nativeEditorialWorkflowRouter.use(requireSession);

const digestSchema = z.string().regex(/^[a-f0-9]{64}$/i);
const manuscriptIdSchema = z.string().trim().min(1).max(128);
const revisionIdSchema = z.string().trim().min(1).max(128);
const venueIdSchema = z.string().uuid();
const submissionIdSchema = z.string().uuid();
const assignmentIdSchema = z.string().uuid();

const assetSchema = z.object({
  assetId: z.string().trim().min(1).max(128),
  mediaType: z.string().trim().min(1).max(200),
  checksum: digestSchema,
  bytesBase64: z.string().min(1).max(70_000_000),
}).strict();

const revisionSchema = z.object({
  manuscriptId: manuscriptIdSchema,
  title: z.string().trim().max(500),
  revisionId: revisionIdSchema,
  stateDigest: digestSchema,
  publicationContentDigest: digestSchema,
  manuscriptStateSnapshot: z.record(z.string(), z.unknown()),
  reviewSnapshot: z.record(z.string(), z.unknown()),
  assets: z.array(assetSchema).max(2_000).optional(),
}).strict();

const submissionSchema = revisionSchema.extend({
  publicationVenueId: venueIdSchema,
}).strict();

const reviewerSchema = z.object({
  reviewerEmail: z.string().trim().email(),
}).strict();

const noteSchema = z.object({
  note: z.string().trim().min(1).max(100_000),
}).strict();

const optionalNoteSchema = z.object({
  note: z.string().trim().max(100_000).optional(),
}).strict();

const publishedSchema = z.object({
  revisionId: revisionIdSchema,
  note: z.string().trim().max(10_000).optional(),
}).strict();

nativeEditorialWorkflowRouter.post(
  '/submissions',
  async (request: AuthenticatedRequest, response) => {
    try {
      const input = submissionSchema.parse(request.body);
      const submission = await submitNativeEditorialManuscript(
        requireUserId(request),
        input,
      );
      response.status(201).json({ submission });
    } catch (error) {
      sendError(response, error, 'NATIVE_EDITORIAL_SUBMISSION_FAILED');
    }
  },
);

nativeEditorialWorkflowRouter.get(
  '/submissions/mine',
  async (request: AuthenticatedRequest, response) => {
    try {
      const manuscriptId = typeof request.query.manuscriptId === 'string'
        ? manuscriptIdSchema.parse(request.query.manuscriptId)
        : undefined;
      const submissions = await listNativeEditorialSubmissionsForAuthor(
        requireUserId(request),
        manuscriptId,
      );
      response.status(200).json({ submissions });
    } catch (error) {
      sendError(response, error, 'NATIVE_EDITORIAL_AUTHOR_LIST_FAILED');
    }
  },
);

nativeEditorialWorkflowRouter.get(
  '/inbox',
  async (request: AuthenticatedRequest, response) => {
    try {
      const submissions = await listNativeEditorialInbox(requireUserId(request));
      response.status(200).json({ submissions });
    } catch (error) {
      sendError(response, error, 'NATIVE_EDITORIAL_INBOX_FAILED');
    }
  },
);

nativeEditorialWorkflowRouter.get(
  '/submissions/:submissionId',
  async (request: AuthenticatedRequest, response) => {
    try {
      const submissionId = parseId(request.params.submissionId, submissionIdSchema);
      const result = await getNativeEditorialSubmission(
        requireUserId(request),
        submissionId,
      );
      response.status(200).json(result);
    } catch (error) {
      sendError(response, error, 'NATIVE_EDITORIAL_SUBMISSION_LOAD_FAILED');
    }
  },
);

nativeEditorialWorkflowRouter.post(
  '/submissions/:submissionId/reviewers',
  async (request: AuthenticatedRequest, response) => {
    try {
      const submissionId = parseId(request.params.submissionId, submissionIdSchema);
      const input = reviewerSchema.parse(request.body);
      const result = await assignNativeEditorialReviewer(
        requireUserId(request),
        submissionId,
        input.reviewerEmail,
      );
      response.status(201).json(result);
    } catch (error) {
      sendError(response, error, 'NATIVE_EDITORIAL_REVIEWER_ASSIGN_FAILED');
    }
  },
);

nativeEditorialWorkflowRouter.post(
  '/submissions/:submissionId/reviews/:assignmentId/complete',
  async (request: AuthenticatedRequest, response) => {
    try {
      const submissionId = parseId(request.params.submissionId, submissionIdSchema);
      const assignmentId = parseId(request.params.assignmentId, assignmentIdSchema);
      const review = await completeNativeEditorialReview(
        requireUserId(request),
        submissionId,
        assignmentId,
      );
      response.status(200).json({ review });
    } catch (error) {
      sendError(response, error, 'NATIVE_EDITORIAL_REVIEW_COMPLETE_FAILED');
    }
  },
);

nativeEditorialWorkflowRouter.post(
  '/submissions/:submissionId/request-revision',
  async (request: AuthenticatedRequest, response) => {
    try {
      const submissionId = parseId(request.params.submissionId, submissionIdSchema);
      const input = noteSchema.parse(request.body);
      const submission = await requestNativeEditorialRevision(
        requireUserId(request),
        submissionId,
        input.note,
      );
      response.status(200).json({ submission });
    } catch (error) {
      sendError(response, error, 'NATIVE_EDITORIAL_REVISION_REQUEST_FAILED');
    }
  },
);

nativeEditorialWorkflowRouter.post(
  '/submissions/:submissionId/revision',
  async (request: AuthenticatedRequest, response) => {
    try {
      const submissionId = parseId(request.params.submissionId, submissionIdSchema);
      const input = revisionSchema.parse(request.body);
      const submission = await submitNativeEditorialRevision(
        requireUserId(request),
        submissionId,
        input,
      );
      response.status(200).json({ submission });
    } catch (error) {
      sendError(response, error, 'NATIVE_EDITORIAL_REVISION_SUBMIT_FAILED');
    }
  },
);

nativeEditorialWorkflowRouter.post(
  '/submissions/:submissionId/reject',
  async (request: AuthenticatedRequest, response) => {
    try {
      const submissionId = parseId(request.params.submissionId, submissionIdSchema);
      const input = optionalNoteSchema.parse(request.body);
      const submission = await rejectNativeEditorialSubmission(
        requireUserId(request),
        submissionId,
        input.note ?? '',
      );
      response.status(200).json({ submission });
    } catch (error) {
      sendError(response, error, 'NATIVE_EDITORIAL_REJECT_FAILED');
    }
  },
);

nativeEditorialWorkflowRouter.post(
  '/submissions/:submissionId/accept',
  async (request: AuthenticatedRequest, response) => {
    try {
      const submissionId = parseId(request.params.submissionId, submissionIdSchema);
      const result = await acceptNativeEditorialSubmission(
        requireUserId(request),
        submissionId,
      );
      response.status(200).json(result);
    } catch (error) {
      sendError(response, error, 'NATIVE_EDITORIAL_ACCEPT_FAILED');
    }
  },
);

nativeEditorialWorkflowRouter.post(
  '/submissions/:submissionId/published',
  async (request: AuthenticatedRequest, response) => {
    try {
      const submissionId = parseId(request.params.submissionId, submissionIdSchema);
      const input = publishedSchema.parse(request.body);
      const submission = await markNativeEditorialSubmissionPublished(
        requireUserId(request),
        submissionId,
        input.revisionId,
        input.note,
      );
      response.status(200).json({ submission });
    } catch (error) {
      sendError(response, error, 'NATIVE_EDITORIAL_PUBLISHED_FAILED');
    }
  },
);

function parseId(
  value: string | undefined,
  schema: z.ZodString,
): string {
  return schema.parse(value);
}

function requireUserId(request: AuthenticatedRequest): string {
  if (!request.authUserId) {
    const error = new Error('An authenticated Studio account is required.');
    error.name = 'UnauthorizedError';
    throw error;
  }
  return request.authUserId;
}

function sendError(
  response: Response,
  error: unknown,
  code: string,
): void {
  const message = error instanceof Error ? error.message : 'Editorial workflow request failed.';
  const name = error instanceof Error ? error.name : '';
  const status =
    name === 'UnauthorizedError' ? 401 :
    name === 'ForbiddenError' ? 403 :
    name === 'NotFoundError' ? 404 :
    name === 'ConflictError' ? 409 :
    error instanceof z.ZodError ? 400 :
    400;
  response.status(status).json({
    error: { code, message },
  });
}
