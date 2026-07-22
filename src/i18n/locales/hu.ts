import type { TranslationDictionary } from '../types';

export const hu: TranslationDictionary = {
  common: {
    save: 'Mentés',
    cancel: 'Mégse',
    close: 'Bezárás',
    delete: 'Törlés',
    edit: 'Szerkesztés',
    add: 'Hozzáadás',
    loading: 'Betöltés…',
    language: 'Nyelv'
  },
  navigation: {
    documents: 'Dokumentumok',
    editor: 'Szerkesztő',
    metadata: 'Metaadatok',
    preview: 'Előnézet',
    settings: 'Beállítások'
  },
  manuscript: {
    newDocument: 'Új kézirat',
    documentTitle: 'Dokumentum címe',
    abstract: 'Absztrakt',
    keywords: 'Kulcsszavak',
    contributors: 'Közreműködők',
    sections: 'Fejezetek',
    annotations: 'Jegyzetek',
    citations: 'Hivatkozások',
    bibliography: 'Irodalomjegyzék',
    documentLanguage: 'A dokumentum nyelve',
    originalLanguage: 'Eredeti nyelv'
  },
  editor: {
    addSection: 'Fejezet hozzáadása',
    addParagraph: 'Bekezdés hozzáadása',
    addNote: 'Jegyzet hozzáadása',
    untitledSection: 'Névtelen fejezet',
    emptyParagraph: 'Kezdj el írni…'
  },
  status: {
    draft: 'Piszkozat',
    submitted: 'Beküldve',
    accepted: 'Elfogadva',
    published: 'Megjelent'
  },
  validation: {
    requiredField: 'Ez a mező kötelező.',
    invalidDocument: 'A dokumentum szerkezete érvénytelen.',
    unsupportedSchema: 'A dokumentum sémaverziója nem támogatott.'
  },
  
  auth: {
  brand: {
    name: 'Open Manuscript Studio',
    description: 'Együttműködő kéziratszerkesztő'
  },

  login: {
    title: 'Bejelentkezés',
    description: 'Jelentkezzen be a folytatáshoz.',
    submit: 'Bejelentkezés',
    noAccount: 'Nincs még fiókja?',
    registerLink: 'Regisztráció'
  },

  register: {
    title: 'Fiók létrehozása',
    description: 'Hozzon létre új fiókot.',
    submit: 'Regisztráció',
    hasAccount: 'Már van fiókja?',
    loginLink: 'Bejelentkezés'
  },

  fields: {
    name: {
      label: 'Teljes név',
      placeholder: 'Teljes név'
    },

    email: {
      label: 'E-mail',
      placeholder: 'pelda@email.hu'
    },

    password: {
      label: 'Jelszó',
      placeholder: 'Jelszó'
    }
  },

  alphaNotice: 'Alfa verzió'
  }
  languages: {
    en: 'Angol',
    hu: 'Magyar',
    de: 'Német'
  }
};
