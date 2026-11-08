/** UI preferences are intentionally separate from authorization roles. */
export const workflowRolePreferences = ['general', 'author', 'editor', 'reviewer', 'translator', 'copyeditor', 'layout-editor'] as const;
export type WorkflowRolePreference = typeof workflowRolePreferences[number];
