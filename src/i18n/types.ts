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
      references: string;
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

  citations: {
    referencesTitle: string;
    referencesDescription: string;
    addReference: string;
    editReference: string;
    referenceEditorDescription: string;
    emptyLibrary: string;
    emptyLibraryHint: string;
    searchReferences: string;
    searchPlaceholder: string;
    untitledReference: string;
    occurrences: string;
    bibliographyPreviewDescription: string;
    resourceType: string;
    title: string;
    titlePlaceholder: string;
    subtitle: string;
    creators: string;
    creatorsDescription: string;
    addCreator: string;
    removeCreator: string;
    noCreators: string;
    creatorRole: string;
    givenName: string;
    familyName: string;
    containerTitle: string;
    issued: string;
    volume: string;
    issue: string;
    pages: string;
    publisher: string;
    place: string;
    duplicateReference: string;
    insertTitle: string;
    insertDescription: string;
    noReferences: string;
    noReferencesHint: string;
    insert: string;
    citation: string;
    reference: string;
    locatorType: string;
    locator: string;
    locatorPlaceholder: string;
    prefix: string;
    prefixPlaceholder: string;
    suffix: string;
    suffixPlaceholder: string;
    openSource: string;
    closeEditor: string;
    deleteCitation: string;
    confirmDeleteCitation: string;
    unresolvedReference: string;
    roles: {
      author: string;
      editor: string;
      translator: string;
      compiler: string;
      contributor: string;
    };
    resourceTypes: {
      'journal-article': string;
      book: string;
      'book-chapter': string;
      'conference-paper': string;
      thesis: string;
      dissertation: string;
      report: string;
      preprint: string;
      dataset: string;
      software: string;
      standard: string;
      'archival-source': string;
      manuscript: string;
      'web-page': string;
    };
    locators: {
      page: string;
      'page-range': string;
      chapter: string;
      section: string;
      paragraph: string;
      figure: string;
      table: string;
      folio: string;
      line: string;
      timestamp: string;
    };
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
    addCitation: string;
    untitledSection: string;
    emptyParagraph: string;
    paragraph: string;
    heading: string;
    quote: string;
    insertNote: string;
    insertCitation: string;
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

/** Every UI locale currently shipped by Studio. */
export type SupportedLocale =
  | 'bg'
  | 'cs'
  | 'da'
  | 'de'
  | 'el'
  | 'en'
  | 'es'
  | 'et'
  | 'fi'
  | 'fr'
  | 'ga'
  | 'hr'
  | 'hu'
  | 'it'
  | 'lt'
  | 'lv'
  | 'mt'
  | 'nl'
  | 'pl'
  | 'pt'
  | 'ro'
  | 'sk'
  | 'sl'
  | 'sv';

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
