import type { WorkflowRole } from './workflowRole';

export type DocumentImportMode = 'editorial' | 'own-work' | 'citation';

export interface DocumentImportSourceOptions {
  importMode?: DocumentImportMode;
  selfAuthoredExternal?: boolean;
  includeSource?: boolean;
}

export function defaultDocumentImportMode(role: WorkflowRole = 'general'): DocumentImportMode {
  return ['editor', 'copyeditor', 'layout-editor'].includes(role) ? 'editorial'
    : role === 'author' ? 'own-work' : 'citation';
}

export function documentImportSourcePolicy(options: DocumentImportSourceOptions) {
  const mode = options.importMode ?? (options.selfAuthoredExternal ? 'own-work' : 'citation');
  return {
    selfAuthored: mode === 'own-work',
    includeSource: mode === 'citation' || (mode === 'own-work' && options.includeSource === true),
  };
}
