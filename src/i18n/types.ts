export interface TranslationDictionary {
  common: {
    save: string;
    cancel: string;
    close: string;
    delete: string;
    edit: string;
    add: string;
    loading: string;
    language: string;
  };

  navigation: {
    documents: string;
    editor: string;
    metadata: string;
    preview: string;
    settings: string;
  };

  studio: {
    menu: string;
    closeMenu: string;
    languageSwitcher: string;
    saved: string;
    pending: string;
    editorAria: string;
    titlePlaceholder: string;
    noSection: string;
    navigation: {
      document: string;
      manuscript: string;
      notes: string;
      contributors: string;
      history: string;
      tools: string;
      settings: string;
    };
    document: {
      title: string;
      description: string;
      addSection: string;
      sections: string;
      objects: string;
      annotations: string;
      citations: string;
    };
    manuscript: {
      title: string;
      description: string;
    };
    tools: {
      title: string;
      description: string;
      export: string;
      exportDescription: string;
      reset: string;
      resetDescription: string;
      confirmReset: string;
      technicalData: string;
      technicalDescription: string;
      liveJson: string;
      synced: string;
    };
    settings: {
      title: string;
      description: string;
      interfaceLanguages: string;
      interfaceLanguagesDescription: string;
      currentLanguage: string;
      currentLanguageHint: string;
      enabledLanguage: string;
      disabledLanguage: string;
      futureLanguages: string;
    };
  };

  manuscript: {
    newDocument: string;
    documentTitle: string;
    abstract: string;
    keywords: string;
    contributors: string;
    sections: string;
    annotations: string;
    citations: string;
    bibliography: string;
    documentLanguage: string;
    originalLanguage: string;
  };

  notes: {
    title: string;
    description: string;
    empty: string;
    emptyHint: string;
    note: string;
    type: string;
    body: string;
    bodyPlaceholder: string;
    footnote: string;
    endnote: string;
    authorNote: string;
    delete: string;
    confirmDelete: string;
    closeEditor: string;
    goToNote: string;
    autoSave: string;
  };

  contributors: {
    description: string;
    add: string;
    empty: string;
    remove: string;
    moveUp: string;
    moveDown: string;
    givenName: string;
    familyName: string;
    affiliation: string;
    orcid: string;
    invalidOrcid: string;
    role: string;
    corresponding: string;
    roles: {
      author: string;
      editor: string;
      translator: string;
      reviewer: string;
      dataCurator: string;
      software: string;
      methodology: string;
      visualization: string;
      other: string;
    };
  };

  history: {
    title: string;
    description: string;
    empty: string;
    current: string;
    revision: string;
    events: string;
    groupedChanges: string;
    unknownActor: string;
    completeHistory: string;
    shallowHistory: string;
    pendingTitle: string;
    pendingDescription: string;
    pendingBadge: string;
    checkpoint: string;
    discard: string;
    confirmDiscard: string;
    revert: string;
    confirmRevert: string;
    revertBlocked: string;
    tombstonesTitle: string;
    tombstonesDescription: string;
    tombstoneActive: string;
    tombstoneRestored: string;
    operations: {
      snapshotCreated: string;
      titleChanged: string;
      abstractChanged: string;
      sectionCreated: string;
      blockChanged: string;
      contributorAdded: string;
      contributorChanged: string;
      contributorRemoved: string;
      contributionChanged: string;
      contributorsReordered: string;
      reverted: string;
    };
  };

  editor: {
    addSection: string;
    addParagraph: string;
    addNote: string;
    untitledSection: string;
    emptyParagraph: string;
    paragraph: string;
    heading: string;
    quote: string;
    insertNote: string;
    loading: string;
  };

  status: {
    draft: string;
    submitted: string;
    accepted: string;
    published: string;
  };

  validation: {
    requiredField: string;
    invalidDocument: string;
    unsupportedSchema: string;
  };

  languages: {
    en: string;
    hu: string;
    de: string;
  };

  auth: {
    brand: {
      name: string;
      description: string;
    };

    login: {
      title: string;
      description: string;
      submit: string;
      submitting: string;
      noAccount: string;
      registerLink: string;
    };

    register: {
      title: string;
      description: string;
      submit: string;
      hasAccount: string;
      loginLink: string;
    };

    fields: {
      name: {
        label: string;
        placeholder: string;
      };

      email: {
        label: string;
        placeholder: string;
      };

      password: {
        label: string;
        placeholder: string;
      };
    };

    errors: {
      invalidEmail: string;
      invalidCredentials: string;
      userNotFound: string;
      accountNotActive: string;
      authenticationRequired: string;
    };

    alphaNotice: string;
  };
}

export type SupportedLocale = 'en' | 'hu' | 'de';

type NestedKeyOf<T> = {
  [K in keyof T & string]:
    T[K] extends string
      ? K
      : T[K] extends Record<string, unknown>
        ? `${K}.${NestedKeyOf<T[K]>}`
        : never;
}[keyof T & string];

export type TranslationKey =
  NestedKeyOf<TranslationDictionary>;
