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
  languages: {
    en: 'Angol',
    hu: 'Magyar',
    de: 'Német'
  }
};
