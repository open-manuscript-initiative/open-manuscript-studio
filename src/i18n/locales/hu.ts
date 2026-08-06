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

  contributors: {
    description:
      'A hordozható tudományos identitások és a kézirathoz kötött közreműködői szerepek kezelése.',
    add: 'Közreműködő hozzáadása',
    empty: 'A kézirathoz még nincs közreműködő hozzáadva.',
    remove: 'Közreműködő eltávolítása',
    moveUp: 'Közreműködő feljebb mozgatása',
    moveDown: 'Közreműködő lejjebb mozgatása',
    givenName: 'Utónév',
    familyName: 'Családnév',
    affiliation: 'Intézményi kapcsolat',
    orcid: 'ORCID',
    invalidOrcid: 'Az ORCID formátuma vagy ellenőrző összege hibás.',
    role: 'Közreműködői szerep',
    corresponding: 'Kapcsolattartó közreműködő',
    roles: {
      author: 'Szerző',
      editor: 'Szerkesztő',
      translator: 'Fordító',
      reviewer: 'Lektor',
      dataCurator: 'Adatgondozó',
      software: 'Szoftver',
      methodology: 'Módszertan',
      visualization: 'Vizualizáció',
      other: 'Egyéb'
    }
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

  languages: {
    en: 'Angol',
    hu: 'Magyar',
    de: 'Német'
  },

  auth: {
    brand: {
      name: 'Open Manuscript Studio',
      description: 'Együttműködő kéziratszerkesztő'
    },

    login: {
      title: 'Bejelentkezés',
      description: 'A folytatáshoz jelentkezzen be.',
      submit: 'Bejelentkezés',
      submitting: 'Bejelentkezés…',
      noAccount: 'Még nincs fiókja?',
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
        placeholder: 'Adja meg a teljes nevét'
      },

      email: {
        label: 'E-mail',
        placeholder: 'pelda@email.hu'
      },

      password: {
        label: 'Jelszó',
        placeholder: 'Adja meg a jelszavát'
      }
    },

    errors: {
      invalidEmail: 'Érvénytelen e-mail-cím.',
      invalidCredentials:
        'Helytelen e-mail-cím vagy jelszó.',
      userNotFound:
        'A felhasználói fiók nem található.',
      accountNotActive:
        'A felhasználói fiók nem aktív.',
      authenticationRequired:
        'A művelethez bejelentkezés szükséges.'
    },

    alphaNotice:
      'Alfa verzió – a bejelentkezés jelenleg tesztelési célokat szolgál.'
  }
};
