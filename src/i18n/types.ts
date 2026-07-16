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

export type TranslationKey = NestedKeyOf<TranslationDictionary>;
