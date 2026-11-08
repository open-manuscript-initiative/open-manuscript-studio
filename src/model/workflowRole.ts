/** A presentation preference, never a permission or institutional role. */
export const workflowRoles = ['general', 'author', 'editor', 'reviewer', 'translator', 'copyeditor', 'layout-editor'] as const;
export type WorkflowRole = typeof workflowRoles[number];
export type WorkflowTask = 'document' | 'manuscript' | 'contributors' | 'translations' | 'notes' | 'references' | 'history' | 'validation' | 'editorial-workflow' | 'assignments' | 'signatures' | 'publication-editor' | 'publication' | 'tools' | 'settings';

export interface ExternalWorkflowContext {
  manuscriptId: string;
  source: 'ojs' | 'omp';
  role: Exclude<WorkflowRole, 'general'>;
}

export function normalizeWorkflowRole(value: unknown): WorkflowRole {
  return workflowRoles.includes(value as WorkflowRole) ? value as WorkflowRole : 'general';
}

/** Call only after receiving a server-verified handoff, not URL/local-storage claims. */
export function workflowContextFromHandoff(
  manuscriptId: string,
  source: ExternalWorkflowContext['source'],
  actorMode: unknown,
): ExternalWorkflowContext | null {
  const role = actorMode === 'review' ? 'reviewer'
    : actorMode === 'author' || actorMode === 'editor' ? actorMode : null;
  return role ? { manuscriptId, source, role } : null;
}

export function resolveWorkflowRole(
  preferredRole: unknown,
  context: ExternalWorkflowContext | null | undefined,
  manuscriptId: string,
): { role: WorkflowRole; source: 'profile' | 'ojs' | 'omp' } {
  return context?.manuscriptId === manuscriptId
    ? { role: context.role, source: context.source }
    : { role: normalizeWorkflowRole(preferredRole), source: 'profile' };
}

const roleTasks: Record<Exclude<WorkflowRole, 'general'>, readonly WorkflowTask[]> = {
  author: ['document', 'manuscript', 'contributors', 'notes', 'references', 'history', 'signatures', 'editorial-workflow', 'assignments'],
  editor: ['document', 'manuscript', 'contributors', 'editorial-workflow', 'assignments', 'validation', 'publication', 'history'],
  reviewer: ['document', 'notes', 'references', 'editorial-workflow', 'history'],
  translator: ['document', 'translations', 'notes', 'references', 'history'],
  copyeditor: ['document', 'manuscript', 'notes', 'references', 'history', 'validation', 'editorial-workflow'],
  'layout-editor': ['document', 'publication-editor', 'publication', 'validation', 'history'],
};

export function isWorkflowTaskVisible(role: WorkflowRole, task: WorkflowTask, showAll = false): boolean {
  return showAll || role === 'general' || task === 'settings' || task === 'tools' || roleTasks[role].includes(task);
}
