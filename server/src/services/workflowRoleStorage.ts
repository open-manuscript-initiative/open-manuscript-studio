import { identityPrisma } from '../lib/identityPrisma.js';
import { workflowRolePreferences, type WorkflowRolePreference } from './workflowRolePreference.js';

/** Only the missing optional preference column is compatible with an old DB.
 * Authentication, connection and other schema errors must remain errors. */
export function isMissingWorkflowRoleColumn(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown; meta?: { modelName?: unknown; column?: unknown } };
  return candidate.code === 'P2022'
    && (candidate.meta?.modelName === undefined || candidate.meta.modelName === 'User')
    && [candidate.meta?.column, candidate.message].some((value) => typeof value === 'string'
      && /(?:^|\W)(?:users\.)?workflow_role(?:$|\W)/u.test(value));
}

export async function readWorkflowRolePreference(userId: string): Promise<WorkflowRolePreference> {
  try {
    // Explicit select opts this read into the globally omitted optional field.
    const user = await identityPrisma.user.findUnique({ where: { id: userId }, select: { workflowRole: true } });
    const role = user?.workflowRole as WorkflowRolePreference | undefined;
    return role && workflowRolePreferences.includes(role) ? role : 'general';
  } catch (error) {
    if (isMissingWorkflowRoleColumn(error)) return 'general';
    throw error;
  }
}
