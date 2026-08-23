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
    };
    manuscript: {
      title: string;
      description: string;
    };
    tools: {
      title: string;
      description: string;
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
    };
    footer: {
      tagline: string;
      linksLabel: string;
      documentation: string;
      license: string;
      orcidSandbox: string;
      orcidSandboxTitle: string;
      copyright: string;
    };
  };

  manuscript: {
    title: string;
    subtitle: string;
    abstract: string;
    keywords: string;
    keywordsHint: string;
    language: string;
    languageHint: string;
    metadataLanguage: string;
    metadataLanguageHint: string;
  };

  editor: {
    formatting: {
      bold: string;
      italic: string;
      strike: string;
      superscript: string;
      subscript: string;
      bulletList: string;
      orderedList: string;
      blockquote: string;
      inlineCode: string;
      codeBlock: string;
      hardBreak: string;
      clearFormatting: string;
      language: string;
      automaticToolbar: string;
    };
    insert: {
      title: string;
      image: string;
      table: string;
      chart: string;
      equation: string;
      spreadsheet: string;
    };
    search: {
      openSearch: string;
      openReplace: string;
      searchTitle: string;
      replaceTitle: string;
      searchPlaceholder: string;
      replacePlaceholder: string;
      previous: string;
      next: string;
      close: string;
      matchCase: string;
      wholeWord: string;
      scope: string;
      all: string;
      currentSection: string;
      titleAbstract: string;
      replace: string;
      replaceAll: string;
      noResults: string;
      resultCount: string;
    };
  };

  notes: {
    title: string;
    description: string;
    addFootnote: string;
    addEndnote: string;
    footnote: string;
    endnote: string;
    label: string;
    content: string;
    delete: string;
    empty: string;
  };

  references: {
    title: string;
    description: string;
    search: string;
    add: string;
    edit: string;
    delete: string;
    style: string;
    styleSearch: string;
    customStyle: string;
    noRecords: string;
  };

  contributors: {
    title: string;
    description: string;
    add: string;
    fullName: string;
    affiliation: string;
    orcid: string;
    role: string;
    corresponding: string;
    moveUp: string;
    moveDown: string;
    remove: string;
  };

  history: {
    title: string;
    description: string;
    checkpoint: string;
    noHistory: string;
    restore: string;
  };

  status: {
    ready: string;
    loading: string;
    error: string;
    saved: string;
    saving: string;
  };

  validation: {
    required: string;
    invalid: string;
  };

  languages: Record<string, string>;

  auth: {
    title: string;
    subtitle: string;
    login: string;
    register: string;
    logout: string;
    email: {
      label: string;
      placeholder: string;
    };
    password: {
      label: string;
      placeholder: string;
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

/**
 * Every UI locale shipped by Studio.
 *
 * Keep this union aligned with `localeLabels` in config.ts and with the
 * canonical PO/JSON locale directories. Historically this type listed only
 * en/hu/de even after the runtime expanded to 24 locales, which made newer
 * component-local translation maps silently regress to three-language
 * coverage.
 */
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
