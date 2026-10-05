import { prisma } from '../lib/prisma.js';

export async function writeStudioModuleAuditEvent(input: {
  actorUserId?: string;
  workspaceId: string;
  moduleId: string;
  action: string;
  capability?: string;
  executionGrantId?: string;
  details?: Record<string, string | number | boolean | null>;
  ipAddress?: string;
}): Promise<void> {
  await prisma.studioModuleAuditEvent.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      workspaceId: input.workspaceId,
      moduleId: input.moduleId,
      action: input.action,
      capability: input.capability ?? null,
      executionGrantId: input.executionGrantId ?? null,
      ...(input.details === undefined ? {} : { details: input.details }),
      ipAddress: input.ipAddress?.slice(0, 64) ?? null,
    },
  });
}
