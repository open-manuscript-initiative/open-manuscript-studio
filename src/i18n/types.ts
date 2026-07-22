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

    login: {
      title: string;
      description: string;
      submit: string;
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
