import type { TranslationDictionary } from '../types';

export const en: TranslationDictionary = {
  common: {
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    loading: 'Loading…'
  },

  navigation: {
    documents: 'Documents',
    editor: 'Editor',
    metadata: 'Metadata',
    preview: 'Preview',
    settings: 'Settings'
  },

  manuscript: {
    newDocument: 'New manuscript',
    documentTitle: 'Document title',
    abstract: 'Abstract',
    keywords: 'Keywords',
    contributors: 'Contributors',
    sections: 'Sections',
    annotations: 'Notes',
    citations: 'Citations',
    bibliography: 'Bibliography'
  },

  editor: {
    addSection: 'Add section',
    addParagraph: 'Add paragraph',
    addNote: 'Add note',
    untitledSection: 'Untitled section',
    emptyParagraph: 'Start writing…'
  },

  status: {
    draft: 'Draft',
    submitted: 'Submitted',
    accepted: 'Accepted',
    published: 'Published'
  },

  validation: {
    requiredField: 'This field is required.',
    invalidDocument: 'The document structure is invalid.',
    unsupportedSchema: 'The document schema version is not supported.'
  }
};
