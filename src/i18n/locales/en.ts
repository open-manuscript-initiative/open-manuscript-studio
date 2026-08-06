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

  history: {
    title: 'Revision history',
    description:
      'Immutable OMI-SPEC-160 revisions recorded for this manuscript.',
    empty: 'No revisions have been recorded.',
    current: 'Current',
    revision: 'Revision',
    events: 'events',
    groupedChanges: 'grouped changes',
    unknownActor: 'Unknown actor',
    completeHistory: 'Complete history',
    shallowHistory: 'Shallow history',
    pendingTitle: 'Uncommitted working state',
    pendingDescription:
      'Recent edits are being batched and will become one immutable checkpoint revision.',
    pendingBadge: 'Pending',
    checkpoint: 'Save checkpoint',
    discard: 'Discard changes',
    confirmDiscard:
      'Discard all uncommitted changes and restore the latest committed revision?',
    revert: 'Revert',
    confirmRevert:
      'Create a new revision that restores this earlier manuscript state?',
    revertBlocked:
      'Save or discard the pending working state before reverting a committed revision.',
    operations: {
      snapshotCreated: 'Manuscript snapshot created',
      titleChanged: 'Manuscript title changed',
      abstractChanged: 'Manuscript abstract changed',
      sectionCreated: 'Section added',
      blockChanged: 'Block content changed',
      contributorAdded: 'Contributor added',
      contributorChanged: 'Contributor identity changed',
      contributorRemoved: 'Contributor removed',
      contributionChanged: 'Contribution role changed',
      contributorsReordered: 'Contributors reordered',
      reverted: 'Earlier revision restored'
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
