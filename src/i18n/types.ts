export interface TranslationDictionary {
  common: {
    save: string;
    cancel: string;
    close: string;
    delete: string;
    edit: string;
    add: string;
    loading: string;
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
}

export type SupportedLocale = 'hu' | 'en' | 'de';
