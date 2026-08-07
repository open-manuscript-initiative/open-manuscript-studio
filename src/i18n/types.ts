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
