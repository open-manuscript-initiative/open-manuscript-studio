import { normalizePublicationLanguages, translationLanguage } from '../services/translationAssignmentPolicy.js';
import { getActiveInstallationWithSecret } from '../integrations/externalInstallations.js';
import { ojsWorkflowRequest } from '../integrations/ojs/workflowRequest.js';
import { rememberOjsReviewWritebackEndpoint } from '../integrations/ojs/reviewWriteback.js';
import { rememberOjsReviewForm, type OjsReviewFormDefinition } from '../integrations/ojs/reviewForm.js';
import { parseOjsReviewRecommendations } from '../integrations/ojs/reviewRecommendationModel.js';
import { randomUUID, createHash } from 'node:crypto';

import type { Prisma } from '../generated/prisma/client.js';
import { Router, type Response } from 'express';
import { z } from 'zod';

import { verifyOjsAssignmentGrant } from '../integrations/ojs/ojsAssignmentGrant.js';
import { prisma } from '../lib/prisma.js';
import {
  requireSession,
  type AuthenticatedRequest,
} from '../middleware/requireSession.js';
import {
  issueAssignmentInvitation,
  pendingPasswordPlaceholder,
} from '../services/assignmentInvitationService.js';
import { sanitizeReviewManuscript } from '../services/reviewManuscriptService.js';

export const ojsAssignmentRouter = Router();

ojsAssignmentRouter.use(requireSession);

const createSchema = z.object({
  grant: z.string().min(20),
  reviewerEmail: z.string().email(),
  reviewerFullName: z.string().trim().min(1).max(200).optional(),
  assignmentType: z.enum(['SCIENTIFIC_REVIEW', 'LANGUAGE_REVIEW', 'TRANSLATION']),
  publicationLanguages: z.array(z.string().min(2).max(32)).max(32).optional(),
  sourceLanguage: z.string().trim().min(2).max(32).transform(translationLanguage).optional(),
  targetLanguage: z.string().trim().min(2).max(32).transform(translationLanguage).optional(),
  manuscript: z.unknown(),
});

ojsAssignmentRouter.get('/ojs/assignments', async (request: AuthenticatedRequest, response) => {
  try {
    const grant = typeof request.query.grant === 'string' ? request.query.grant : '';
    const context = await authorizeGrant(request, grant);
    const workspaceId = workspaceIdFor(context.installationId, context.contextId);

    const assignments = await prisma.peerReviewAssignment.findMany({
      where: {
        workspaceId,
        manuscriptId: context.manuscriptId,
        ...(context.actorMode === 'author'
          ? { assignmentType: { in: ['LANGUAGE_REVIEW', 'TRANSLATION'] as const } }
          : {}),
      },
      include: {
        reviewer: {
          select: { id: true, email: true, fullName: true, affiliation: true, orcid: true, status: true },
        },
      },
      orderBy: [{ assignmentType: 'asc' }, { invitedAt: 'asc' }],
    });

    response.status(200).json({
      actorMode: context.actorMode,
      assignments: assignments.map((assignment) => ({
        id: assignment.id,
        assignmentType: assignment.assignmentType.toLowerCase(),
        status: assignment.status.toLowerCase(),
        reviewerAlias: assignment.reviewerAlias,
        sourceLanguage: assignment.sourceLanguage,
        targetLanguage: assignment.targetLanguage,
        invitedAt: assignment.invitedAt.toISOString(),
        accountStatus: assignment.reviewer.status.toLowerCase(),
        reviewer: context.actorMode === 'editor' || assignment.assignmentType !== 'SCIENTIFIC_REVIEW'
          ? {
              userId: assignment.reviewer.id,
              email: assignment.reviewer.email,
              fullName: assignment.reviewer.fullName,
              affiliation: assignment.reviewer.affiliation,
              orcid: assignment.reviewer.orcid,
            }
          : null,
      })),
    });
  } catch (error) {
    sendError(response, error, 'OJS_ASSIGNMENT_LIST_FAILED');
  }
});

ojsAssignmentRouter.post('/ojs/assignments', async (request: AuthenticatedRequest, response) => {
  try {
    const parsed = createSchema.parse(request.body);
    const context = await authorizeGrant(request, parsed.grant);
    if (context.actorMode !== 'editor') throw forbidden('Only an editor can create assignments.');

    if (parsed.assignmentType === 'TRANSLATION') {
      if (!parsed.sourceLanguage || !parsed.targetLanguage) {
        throw new Error('Translation assignments require source and target languages.');
      }
      if (parsed.sourceLanguage.toLowerCase() === parsed.targetLanguage.toLowerCase()) {
        throw new Error('Translation source and target languages must be different.');
      }
    }

    if (!context.apiBaseUrl || !context.actorExternalId) throw new Error('Reopen the manuscript from OJS before assigning this task.');
    const localAssignmentId = randomUUID();
    const binding = await ojsWorkflowRequest(context.installationId, context.apiBaseUrl, 'workflow-assignment', {
      assignmentId: localAssignmentId, submissionExternalId: context.manuscriptId,
      editorExternalId: context.actorExternalId, reviewerEmail: parsed.reviewerEmail.trim().toLowerCase(),
      assignmentType: parsed.assignmentType,
      sourceLanguage: parsed.sourceLanguage, targetLanguage: parsed.targetLanguage,
      ...(parsed.publicationLanguages ? { publicationLanguages: parsed.publicationLanguages } : {}),
    });
    if (typeof binding.externalAssignmentId !== 'string' || typeof binding.assignmentToken !== 'string' ||
      typeof binding.reviewRound !== 'number') throw new Error('OJS did not return a valid assignment binding.');
    const recommendations = parsed.assignmentType === 'SCIENTIFIC_REVIEW' ? parseOjsReviewRecommendations({ recommendationStorage: (binding.recommendations as Record<string, unknown> | undefined)?.storage,
      options: (binding.recommendations as Record<string, unknown> | undefined)?.options,
      selectedExternalId: (binding.recommendations as Record<string, unknown> | undefined)?.selectedExternalId }) : null;
    const reviewerEmail = parsed.reviewerEmail.trim().toLowerCase();
    let reviewer = await prisma.user.findUnique({
      where: { email: reviewerEmail },
      select: {
        id: true,
        email: true,
        fullName: true,
        affiliation: true,
        orcid: true,
        status: true,
      },
    });

    if (reviewer && reviewer.status !== 'ACTIVE' && reviewer.status !== 'PENDING') {
      throw new Error('The selected Studio account is suspended or disabled.');
    }

    if (!reviewer) {
      reviewer = await prisma.user.create({
        data: {
          email: reviewerEmail,
          passwordHash: pendingPasswordPlaceholder(),
          fullName: parsed.reviewerFullName?.trim() || reviewerEmail,
          status: 'PENDING',
          interfaceLanguage: 'en',
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          affiliation: true,
          orcid: true,
          status: true,
        },
      });
    }

    const workspaceId = workspaceIdFor(context.installationId, context.contextId);
    const aliasBase = parsed.assignmentType === 'SCIENTIFIC_REVIEW'
      ? 'Reviewer'
      : parsed.assignmentType === 'LANGUAGE_REVIEW'
        ? 'Language reviewer'
        : 'Translator';
    const sequence = await prisma.peerReviewAssignment.count({
      where: { workspaceId, manuscriptId: context.manuscriptId, assignmentType: parsed.assignmentType },
    });
    const manuscript = sanitizeReviewManuscript(parsed.manuscript, parsed.assignmentType !== 'SCIENTIFIC_REVIEW');
    const manuscriptSnapshot = JSON.parse(JSON.stringify(manuscript)) as Prisma.InputJsonValue;

    const existing = await prisma.peerReviewAssignment.findUnique({ where: { externalInstallationId_externalAssignmentId: {
      externalInstallationId: context.installationId, externalAssignmentId: binding.externalAssignmentId,
    } } });
    if (existing && (existing.reviewerUserId !== reviewer.id || existing.assignmentType !== parsed.assignmentType)) throw forbidden('This OJS task belongs to another Studio account or role.');
    if (existing && !['SUBMITTED', 'COMPLETED'].includes(existing.status)) await prisma.peerReviewAssignment.update({ where: { id: existing.id }, data: {
      assignedByUserId: request.authUserId ?? null, manuscriptSnapshot: existing.manuscriptSnapshot ?? manuscriptSnapshot,
      ...(recommendations ? { externalRecommendationStorage: recommendations.storage, externalRecommendationOptions: recommendations.options as unknown as Prisma.InputJsonValue, externalRecommendationId: recommendations.selectedExternalId } : {}),
    } });
    const assignment = existing ?? await prisma.peerReviewAssignment.create({
      data: {
        id: localAssignmentId,
        workspaceId,
        externalInstallationId: context.installationId,
        externalSubmissionId: context.manuscriptId,
        externalAssignmentId: binding.externalAssignmentId,
        manuscriptId: context.manuscriptId,
        reviewerUserId: reviewer.id,
        assignedByUserId: request.authUserId ?? null,
        reviewerAlias: `${aliasBase} ${sequence + 1}`,
        assignmentType: parsed.assignmentType,
        publicationLanguages: normalizePublicationLanguages(binding.publicationLanguages ?? []),
        sourceLanguage: parsed.sourceLanguage?.trim() || null,
        targetLanguage: parsed.targetLanguage?.trim() || null,
        reviewRound: binding.reviewRound,
        anonymityMode: parsed.assignmentType === 'SCIENTIFIC_REVIEW' ? 'DOUBLE_BLIND' : 'OPEN',
        status: 'INVITED',
        manuscriptSnapshot,
        ...(recommendations ? { externalRecommendationStorage: recommendations.storage, externalRecommendationOptions: recommendations.options as unknown as Prisma.InputJsonValue,
          externalRecommendationId: recommendations.selectedExternalId } : {}),
      },
    });

    const installation = await getActiveInstallationWithSecret(context.installationId);
    if (!installation) throw new Error('The OJS installation is no longer active.');
    await rememberOjsReviewWritebackEndpoint(assignment.id, context.apiBaseUrl, installation.baseUrl);
    await prisma.$executeRaw`UPDATE ojs_review_writeback_contexts SET assignment_token = ${binding.assignmentToken} WHERE assignment_id = ${assignment.id}::uuid`;
    if (parsed.assignmentType === 'SCIENTIFIC_REVIEW') await rememberOjsReviewForm(assignment.id, binding.reviewForm as OjsReviewFormDefinition | null ?? null);
    let invitationSent: boolean | undefined;
    if (reviewer.status === 'PENDING') {
      const invitation = await issueAssignmentInvitation({
        userId: reviewer.id,
        email: reviewer.email,
        fullName: reviewer.fullName,
        assignmentType: parsed.assignmentType,
      });
      invitationSent = invitation.sent;
    }

    response.status(201).json({
      assignment: {
        id: assignment.id,
        assignmentType: assignment.assignmentType.toLowerCase(),
        status: assignment.status.toLowerCase(),
        reviewerAlias: assignment.reviewerAlias,
        sourceLanguage: assignment.sourceLanguage,
        targetLanguage: assignment.targetLanguage,
        accountStatus: reviewer.status.toLowerCase(),
        ...(invitationSent !== undefined ? { invitationSent } : {}),
        reviewer: {
          userId: reviewer.id,
          email: reviewer.email,
          fullName: reviewer.fullName,
          affiliation: reviewer.affiliation,
          orcid: reviewer.orcid,
        },
      },
    });
  } catch (error) {
    sendError(response, error, 'OJS_ASSIGNMENT_CREATE_FAILED');
  }
});

ojsAssignmentRouter.post('/ojs/assignments/:assignmentId/reconnect', async (request: AuthenticatedRequest, response) => {
  try {
    const { grant } = z.object({ grant: z.string().min(20) }).parse(request.body);
    const context = await authorizeGrant(request, grant);
    if (context.actorMode !== 'editor' || !context.apiBaseUrl || !context.actorExternalId) throw forbidden('Reopen the OJS manuscript as its editor.');
    const assignmentId = z.string().uuid().parse(request.params.assignmentId);
    const existing = await prisma.peerReviewAssignment.findFirst({ where: { id: assignmentId,
      workspaceId: workspaceIdFor(context.installationId, context.contextId), manuscriptId: context.manuscriptId }, include: { reviewer: true } });
    if (!existing) throw forbidden('The task does not belong to this OJS manuscript.');
    const binding = await ojsWorkflowRequest(context.installationId, context.apiBaseUrl, 'workflow-assignment', {
      assignmentId, submissionExternalId: context.manuscriptId, editorExternalId: context.actorExternalId,
      reviewerEmail: existing.reviewer.email, assignmentType: existing.assignmentType,
      sourceLanguage: existing.sourceLanguage, targetLanguage: existing.targetLanguage, expectedReviewRound: existing.reviewRound,
    });
    if (typeof binding.externalAssignmentId !== 'string' || typeof binding.assignmentToken !== 'string' || typeof binding.reviewRound !== 'number' || binding.reviewRound !== existing.reviewRound) throw new Error('The OJS round changed. Create a new task for the current round.');
    const installation = await getActiveInstallationWithSecret(context.installationId);
    if (!installation) throw new Error('The OJS installation is no longer active.');
    const recommendations = existing.assignmentType === 'SCIENTIFIC_REVIEW' ? parseOjsReviewRecommendations({
      recommendationStorage: (binding.recommendations as Record<string, unknown> | undefined)?.storage,
      options: (binding.recommendations as Record<string, unknown> | undefined)?.options,
      selectedExternalId: (binding.recommendations as Record<string, unknown> | undefined)?.selectedExternalId,
    }) : null;
    // Reconnecting the same task must not clear an existing success receipt.
    await prisma.peerReviewAssignment.update({ where: { id: assignmentId }, data: {
      externalInstallationId: context.installationId, externalSubmissionId: context.manuscriptId,
      externalAssignmentId: binding.externalAssignmentId, reviewRound: binding.reviewRound, publicationLanguages: normalizePublicationLanguages(binding.publicationLanguages ?? []),
      anonymityMode: existing.assignmentType === 'SCIENTIFIC_REVIEW' ? 'DOUBLE_BLIND' : 'OPEN',
      ...(recommendations ? { externalRecommendationStorage: recommendations.storage, externalRecommendationOptions: recommendations.options as unknown as Prisma.InputJsonValue } : {}),
    } });
    await rememberOjsReviewWritebackEndpoint(assignmentId, context.apiBaseUrl, installation.baseUrl);
    await prisma.$executeRaw`UPDATE ojs_review_writeback_contexts SET assignment_token = ${binding.assignmentToken} WHERE assignment_id = ${assignmentId}::uuid`;
    if (existing.assignmentType === 'SCIENTIFIC_REVIEW') await rememberOjsReviewForm(assignmentId, binding.reviewForm as OjsReviewFormDefinition | null ?? null);
    response.json({ reconnected: true });
  } catch (error) { sendError(response, error, 'OJS_ASSIGNMENT_RECONNECT_FAILED'); }
});

async function authorizeGrant(request: AuthenticatedRequest, token: string) {
  if (!request.authUserId) throw forbidden('Authentication is required.');
  const grant = verifyOjsAssignmentGrant(token);
  const user = await prisma.user.findUnique({
    where: { id: request.authUserId },
    select: { email: true, status: true },
  });
  if (!user || user.status !== 'ACTIVE' || user.email.toLowerCase() !== grant.actorEmail) {
    throw forbidden('The OJS assignment grant belongs to a different Studio account.');
  }
  return grant;
}

function workspaceIdFor(installationId: string, contextId: string): string {
  return `ojs:${createHash('sha256')
    .update(`${installationId}:${contextId}`)
    .digest('hex')
    .slice(0, 40)}`;
}

function forbidden(message: string): Error {
  const error = new Error(message);
  error.name = 'ForbiddenError';
  return error;
}

function sendError(response: Response, error: unknown, fallbackCode: string): void {
  const message = error instanceof Error ? error.message : 'OJS assignment request failed.';
  const name = error instanceof Error ? error.name : '';
  if (error instanceof z.ZodError) {
    response.status(400).json({ error: { code: 'INVALID_REQUEST', message } });
    return;
  }
  if (name === 'ForbiddenError') {
    response.status(403).json({ error: { code: 'FORBIDDEN', message } });
    return;
  }
  if (name === 'PrismaClientKnownRequestError') {
    response.status(409).json({ error: { code: 'ASSIGNMENT_CONFLICT', message } });
    return;
  }
  response.status(400).json({ error: { code: fallbackCode, message } });
}
