import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import { z } from 'zod';

import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { writeStudioModuleAuditEvent } from '../services/studioModuleAuditService.js';
import type { AuthenticatedRequest } from './requireSession.js';

export type StudioModuleId =
  | 'org.omi.history-archives'
  | 'org.omi.religious-texts';
export type StudioModuleCapability = 'archives.search' | 'religious-texts.search';

const workspaceIdSchema = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/);
const moduleCapabilities: Record<StudioModuleId, readonly StudioModuleCapability[]> = {
  'org.omi.history-archives': ['archives.search'],
  'org.omi.religious-texts': ['religious-texts.search'],
};

export interface ModuleExecutionGrant {
  id: string;
  userId: string;
  workspaceId: string;
  moduleId: StudioModuleId;
  capability: StudioModuleCapability;
}

export interface ModuleAuthorizedRequest extends AuthenticatedRequest {
  moduleExecutionGrant?: ModuleExecutionGrant;
}

export function requireModuleCapability(
  moduleId: StudioModuleId,
  capability: StudioModuleCapability,
) {
  if (!moduleCapabilities[moduleId]?.includes(capability)) {
    throw new Error('The requested capability is not declared by this module.');
  }

  return async (
    request: ModuleAuthorizedRequest,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    const userId = request.authUserId;
    if (!userId) {
      response.status(401).json({ error: { code: 'NOT_AUTHENTICATED', message: 'Authentication is required.' } });
      return;
    }
    const workspaceResult = workspaceIdSchema.safeParse(request.query.workspaceId ?? 'default');
    if (!workspaceResult.success) {
      response.status(400).json({ error: { code: 'INVALID_WORKSPACE', message: 'A valid workspace ID is required.' } });
      return;
    }
    if (!env.STUDIO_ENABLED_MODULES.includes(moduleId)) {
      response.status(403).json({ error: { code: 'MODULE_DISABLED_BY_INSTALLATION', message: 'This module is disabled by the Studio installation.' } });
      return;
    }

    const workspaceId = workspaceResult.data;
    const preference = await prisma.studioModulePreference.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });
    if (!preference?.activeModuleIds.includes(moduleId)) {
      response.status(403).json({ error: { code: 'MODULE_NOT_ACTIVE', message: 'Activate this module in the current workspace before using it.' } });
      return;
    }

    const grant: ModuleExecutionGrant = {
      id: randomUUID(),
      userId,
      workspaceId,
      moduleId,
      capability,
    };
    await writeStudioModuleAuditEvent({
      actorUserId: userId,
      workspaceId,
      moduleId,
      action: 'execution.grant',
      capability,
      executionGrantId: grant.id,
      ipAddress: request.ip,
    });
    request.moduleExecutionGrant = grant;
    next();
  };
}
