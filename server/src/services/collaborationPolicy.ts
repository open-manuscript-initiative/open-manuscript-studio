/** OMI-SPEC-190 Draft 0.1.0, Studio single-manuscript policy profile. */
export const COLLABORATION_POLICY_VERSION = 'studio-collaboration-0.1.0';
export const COLLABORATION_RECHECK_MS = 15_000;
export const COLLABORATION_ROLE_ACTIONS = {
  OWNER: ['read', 'edit-content', 'edit-metadata', 'annotate', 'edit-translation', 'view-history', 'export', 'invite', 'manage-members'],
  EDITOR: ['read', 'edit-content', 'edit-metadata', 'annotate', 'edit-translation', 'view-history', 'export', 'invite'],
  AUTHOR: ['read', 'edit-content', 'edit-metadata', 'annotate', 'edit-translation', 'view-history', 'export', 'invite'],
  VIEWER: ['read', 'view-history', 'export'],
} as const;
export type CollaborationAction = 'read' | 'edit-content' | 'edit-metadata' | 'annotate' | 'edit-translation' | 'view-history' | 'export' | 'invite' | 'manage-members' | 'manage-policy' | 'approve-or-publish';
export interface CollaborationPolicyEvidence {
  principalId: string;
  documentId: string;
  role: string;
  revoked: boolean;
  expiresAt?: number;
  deniedActions?: readonly CollaborationAction[];
}
export function collaborationDecision(
  evidence: CollaborationPolicyEvidence | null,
  request: { principalId: string; documentId: string; action: CollaborationAction },
  now = Date.now(),
) {
  const actions: readonly string[] = evidence && Object.hasOwn(COLLABORATION_ROLE_ACTIONS, evidence.role)
    ? COLLABORATION_ROLE_ACTIONS[evidence.role as keyof typeof COLLABORATION_ROLE_ACTIONS] : [];
  const allowed = !!evidence && !!request.principalId && !!request.documentId
    && evidence.principalId === request.principalId && evidence.documentId === request.documentId
    && !evidence.revoked && (evidence.expiresAt === undefined || Number.isFinite(evidence.expiresAt) && evidence.expiresAt > now)
    && !evidence.deniedActions?.includes(request.action) && actions.includes(request.action);
  return { allowed, principalId: request.principalId, resourceId: request.documentId,
    action: request.action, authority: 'studio-local-membership', policyVersion: COLLABORATION_POLICY_VERSION };
}
