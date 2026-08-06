import type { TranslationDictionary } from '../types';

export const en: TranslationDictionary = {
  common: {
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    loading: 'Loading…',
    language: 'Language'
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
    bibliography: 'Bibliography',
    documentLanguage: 'Document language',
    originalLanguage: 'Original language'
  },

  contributors: {
    description:
      'Manage portable scholarly identities and their manuscript-specific contribution roles.',
    add: 'Add contributor',
    empty: 'No contributors have been added to this manuscript.',
    remove: 'Remove contributor',
    moveUp: 'Move contributor up',
    moveDown: 'Move contributor down',
    givenName: 'Given name',
    familyName: 'Family name',
    affiliation: 'Affiliation',
    orcid: 'ORCID',
    invalidOrcid: 'The ORCID checksum or format is invalid.',
    role: 'Contribution role',
    corresponding: 'Corresponding contributor',
    roles: {
      author: 'Author',
      editor: 'Editor',
      translator: 'Translator',
      reviewer: 'Reviewer',
      dataCurator: 'Data curator',
      software: 'Software',
      methodology: 'Methodology',
      visualization: 'Visualization',
      other: 'Other'
    }
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
  },

  languages: {
    en: 'English',
    hu: 'Hungarian',
    de: 'German'
  },

  auth: {
    brand: {
      name: 'Open Manuscript Studio',
      description: 'Collaborative scholarly writing'
    },

    login: {
      title: 'Sign in',
      description: 'Please sign in to continue.',
      submit: 'Sign in',
      submitting: 'Signing in…',
      noAccount: 'Do not have an account yet?',
      registerLink: 'Register'
    },

    register: {
      title: 'Create account',
      description: 'Create your account.',
      submit: 'Register',
      hasAccount: 'Already have an account?',
      loginLink: 'Sign in'
    },

    fields: {
      name: {
        label: 'Full name',
        placeholder: 'Your full name'
      },

      email: {
        label: 'Email',
        placeholder: 'name@example.com'
      },

      password: {
        label: 'Password',
        placeholder: 'Enter your password'
      }
    },

    errors: {
      invalidEmail: 'Invalid e-mail address.',
      invalidCredentials:
        'Incorrect e-mail address or password.',
      userNotFound:
        'The user account could not be found.',
      accountNotActive:
        'The user account is not active.',
      authenticationRequired:
        'Authentication is required.'
    },

    alphaNotice:
      'Alpha version – authentication is currently for testing purposes.'
  }
};
