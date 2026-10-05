import { Router, type Response } from 'express';
import { z } from 'zod';

import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';
import { writeStudioModuleAuditEvent } from '../services/studioModuleAuditService.js';

export const studioModuleRouter = Router();

const MODULE_IDS = [
  'org.omi.history-archives',
  'org.omi.religious-texts',
  'org.omi.critical-text-edition',
  'org.omi.corpus-linguistics',
  'org.omi.musicology',
  'org.omi.cultural-heritage',
  'org.omi.social-research-methods',
  'org.omi.legal-sources',
  'org.omi.research-reproducibility',
] as const;
const workspaceIdSchema = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/);
const updateSchema = z.object({
  workspaceId: workspaceIdSchema,
  revision: z.number().int().nonnegative(),
  activeModuleIds: z.array(z.enum(MODULE_IDS)).max(MODULE_IDS.length),
}).strict();

studioModuleRouter.get('/modules/policy', requireSession, async (request: AuthenticatedRequest, response) => {
  const userId = request.authUserId;
  if (!userId) return unauthenticated(response);
  const parsedWorkspaceId = workspaceIdSchema.safeParse(request.query.workspaceId ?? 'default');
  if (!parsedWorkspaceId.success) {
    response.status(400).json({ error: { code: 'INVALID_WORKSPACE', message: 'A valid workspace ID is required.' } });
    return;
  }
  const workspaceId = parsedWorkspaceId.data;
  const preference = await prisma.studioModulePreference.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  const enabledModuleIds = env.STUDIO_ENABLED_MODULES.filter((id): id is (typeof MODULE_IDS)[number] =>
    MODULE_IDS.includes(id as (typeof MODULE_IDS)[number]),
  );
  response.setHeader('Cache-Control', 'no-store');
  response.status(200).json({
    workspaceId,
    revision: preference?.revision ?? 0,
    enabledModuleIds,
    activeModuleIds: preference?.activeModuleIds.filter((id) => enabledModuleIds.includes(id as (typeof MODULE_IDS)[number])) ?? [],
  });
});

studioModuleRouter.put('/modules/preferences', requireSession, async (request: AuthenticatedRequest, response) => {
  const userId = request.authUserId;
  if (!userId) return unauthenticated(response);
  const parsed = updateSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: { code: 'INVALID_MODULE_PREFERENCES', message: 'The module preferences are invalid.' } });
    return;
  }
  const input = parsed.data;
  const enabled = new Set(env.STUDIO_ENABLED_MODULES);
  if (input.activeModuleIds.some((id) => !enabled.has(id))) {
    response.status(403).json({ error: { code: 'MODULE_DISABLED_BY_INSTALLATION', message: 'One or more modules are disabled by this Studio installation.' } });
    return;
  }
  const activeModuleIds = [...new Set(input.activeModuleIds)];
  const existing = await prisma.studioModulePreference.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: input.workspaceId } },
  });
  let preference: { revision: number; activeModuleIds: string[] };
  if (!existing) {
    if (input.revision !== 0) return stalePreference(response);
    try {
      preference = await prisma.studioModulePreference.create({
        data: { userId, workspaceId: input.workspaceId, activeModuleIds },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) return stalePreference(response);
      throw error;
    }
  } else {
    if (existing.revision !== input.revision) return stalePreference(response);
    const result = await prisma.studioModulePreference.updateMany({
      where: { id: existing.id, revision: input.revision },
      data: { activeModuleIds, revision: { increment: 1 } },
    });
    if (result.count !== 1) return stalePreference(response);
    preference = await prisma.studioModulePreference.findUnique({ where: { id: existing.id } });
    if (!preference) return stalePreference(response);
  }

  await writeStudioModuleAuditEvent({
    actorUserId: userId,
    workspaceId: input.workspaceId,
    moduleId: 'org.omi.studio-module-framework',
    action: 'preferences.update',
    details: { activeModuleIds: activeModuleIds.join(',') },
    ipAddress: request.ip,
  });
  response.setHeader('Cache-Control', 'no-store');
  response.status(200).json({
    workspaceId: input.workspaceId,
    revision: preference.revision,
    enabledModuleIds: env.STUDIO_ENABLED_MODULES.filter((id): id is (typeof MODULE_IDS)[number] => MODULE_IDS.includes(id as (typeof MODULE_IDS)[number])),
    activeModuleIds: preference.activeModuleIds,
  });
});

function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2002');
}

function stalePreference(response: Response): void {
  response.status(409).json({ error: { code: 'MODULE_PREFERENCES_STALE', message: 'Module preferences changed. Reload them and try again.' } });
}

function unauthenticated(response: Response): void {
  response.status(401).json({ error: { code: 'NOT_AUTHENTICATED', message: 'Authentication is required.' } });
}
