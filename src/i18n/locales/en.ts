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

  studio: {
    menu: 'Manuscript menu',
    closeMenu: 'Close manuscript menu',
    languageSwitcher: 'Interface language',
    saved: 'Saved',
    pending: 'Saving…',
    editorAria: 'Manuscript editor',
    titlePlaceholder: 'Enter the manuscript title',
    noSection: 'No section is selected.',
    navigation: {
      document: 'Document',
      manuscript: 'Manuscript data',
      notes: 'Notes',
      contributors: 'Contributors',
      history: 'History',
      tools: 'Export and tools',
      settings: 'Settings'
    },
    document: {
      title: 'Document structure',
      description:
        'Choose the section you want to work on. Structural and object information stays out of the writing surface until you need it.',
      addSection: 'Add section',
      sections: 'Sections',
      objects: 'Objects',
      annotations: 'Annotations',
      citations: 'Citations'
    },
    manuscript: {
      title: 'Manuscript data',
      description:
        'Edit manuscript-level information separately from the writing surface.'
    },
    tools: {
      title: 'Export and tools',
      description:
        'Secondary, technical and potentially destructive actions are kept outside the writing surface.',
      export: 'Export .omi.json',
      exportDescription:
        'Create a canonical portable OMI manuscript file after checkpointing pending edits.',
      reset: 'Reset sample',
      resetDescription:
        'Replace the current alpha sample with a new clean sample manuscript.',
      confirmReset:
        'Reset the current sample manuscript? Unsaved and current sample data will be replaced.',
      technicalData: 'Technical data',
      technicalDescription:
        'Inspect the semantic representation only when technical details are needed.',
      liveJson: 'Current section JSON',
      synced: 'Synced'
    },
    settings: {
      title: 'Interface settings',
      description:
        'Choose which interface languages you want available while working. These preferences are stored on this device.',
      interfaceLanguages: 'Available interface languages',
      interfaceLanguagesDescription:
        'Enabled languages appear in the quick language switcher in the editor header.',
      currentLanguage: 'Current interface language',
      currentLanguageHint:
        'The language currently in use must remain enabled. Switch to another language before disabling it.',
      enabledLanguage: 'Available in quick switcher',
      disabledLanguage: 'Hidden from quick switcher',
      futureLanguages:
        'The language registry is extensible. Future translation dictionaries can be added without redesigning this settings screen.'
    }
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

  notes: {
    title: 'Notes',
    description:
      'Manage semantic manuscript notes. Note bodies remain independent annotation objects while their inline anchors stay in the text.',
    empty: 'This manuscript has no notes yet.',
    emptyHint:
      'Place the cursor in the text and use the Note button or Ctrl/Cmd+Alt+N.',
    note: 'Note',
    type: 'Note type',
    body: 'Note text',
    bodyPlaceholder: 'Write the note…',
    footnote: 'Footnote',
    endnote: 'Endnote',
    authorNote: 'Author note',
    delete: 'Delete note',
    confirmDelete:
      'Delete this note and its inline anchor from the manuscript?',
    closeEditor: 'Close note editor',
    goToNote: 'Go to note',
    autoSave: 'Saved with manuscript revisions'
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
    tombstonesTitle: 'Deleted object records',
    tombstonesDescription:
      'Persistent OMI-SPEC-160 tombstones preserve deleted object identifiers and restoration evidence.',
    tombstoneActive: 'Deleted',
    tombstoneRestored: 'Restored',
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
    addNote: 'Note',
    untitledSection: 'Untitled section',
    emptyParagraph: 'Start writing…',
    paragraph: 'Paragraph',
    heading: 'Heading',
    quote: 'Quote',
    insertNote: 'Insert semantic manuscript note',
    loading: 'Loading editor…'
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
      invalidCredentials: 'Incorrect e-mail address or password.',
      userNotFound: 'The user account could not be found.',
      accountNotActive: 'The user account is not active.',
      authenticationRequired: 'Authentication is required.'
    },
    alphaNotice:
      'Alpha version – authentication is currently for testing purposes.'
  }
};
