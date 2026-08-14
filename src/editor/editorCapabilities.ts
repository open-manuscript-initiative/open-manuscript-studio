export interface EditorCapabilities {
  editText: boolean;
  editStructure: boolean;
  editVisualBlocks: boolean;
  editMetadata: boolean;
  insertNotes: boolean;
  editCitations: boolean;
  editCrossReferences: boolean;
  reconcileWorkspaceReferences: boolean;
}

export type EditorRole =
  | 'author'
  | 'editor'
  | 'scientific-review'
  | 'language-review'
  | 'translation'
  | 'editorial-revision'
  | 'read-only';

const FULL_EDITOR_CAPABILITIES: EditorCapabilities = {
  editText: true,
  editStructure: true,
  editVisualBlocks: true,
  editMetadata: true,
  insertNotes: true,
  editCitations: true,
  editCrossReferences: true,
  reconcileWorkspaceReferences: true,
};

const REVIEW_TEXT_CAPABILITIES: EditorCapabilities = {
  editText: true,
  editStructure: false,
  editVisualBlocks: false,
  editMetadata: false,
  insertNotes: false,
  editCitations: false,
  editCrossReferences: false,
  reconcileWorkspaceReferences: false,
};

export const EDITOR_CAPABILITIES_BY_ROLE: Record<EditorRole, EditorCapabilities> = {
  author: FULL_EDITOR_CAPABILITIES,
  editor: FULL_EDITOR_CAPABILITIES,
  'scientific-review': REVIEW_TEXT_CAPABILITIES,
  'language-review': REVIEW_TEXT_CAPABILITIES,
  translation: {
    ...REVIEW_TEXT_CAPABILITIES,
    editStructure: true,
  },
  'editorial-revision': {
    ...REVIEW_TEXT_CAPABILITIES,
    editStructure: true,
  },
  'read-only': {
    editText: false,
    editStructure: false,
    editVisualBlocks: false,
    editMetadata: false,
    insertNotes: false,
    editCitations: false,
    editCrossReferences: false,
    reconcileWorkspaceReferences: false,
  },
};

export function getEditorCapabilities(role: EditorRole): EditorCapabilities {
  return EDITOR_CAPABILITIES_BY_ROLE[role];
}
