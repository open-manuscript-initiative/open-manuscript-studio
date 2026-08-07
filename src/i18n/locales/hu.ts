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

  studio: {
    menu: 'Kézirat menü',
    closeMenu: 'Kézirat menü bezárása',
    languageSwitcher: 'Felület nyelve',
    saved: 'Mentve',
    pending: 'Mentés…',
    editorAria: 'Kéziratszerkesztő',
    titlePlaceholder: 'Adja meg a kézirat címét',
    noSection: 'Nincs kiválasztott szakasz.',
    navigation: {
      document: 'Dokumentum',
      manuscript: 'Kézirat adatai',
      contributors: 'Közreműködők',
      history: 'Előzmények',
      tools: 'Export és eszközök'
    },
    document: {
      title: 'Dokumentumszerkezet',
      description:
        'Válassza ki azt a szakaszt, amelyen dolgozni szeretne. A szerkezeti és objektumadatok csak akkor jelennek meg, amikor szükség van rájuk.',
      addSection: 'Szakasz hozzáadása',
      sections: 'Szakaszok',
      objects: 'Objektumok',
      annotations: 'Jegyzetek',
      citations: 'Hivatkozások'
    },
    manuscript: {
      title: 'Kézirat adatai',
      description:
        'A kéziratszintű adatokat a szerkesztési felülettől elkülönítve kezelheti.'
    },
    tools: {
      title: 'Export és eszközök',
      description:
        'A másodlagos, technikai és esetleg romboló műveletek nem jelennek meg a szerkesztési felületen.',
      export: 'Export .omi.json',
      exportDescription:
        'Kanonikus, hordozható OMI kéziratfájl készítése a függő módosítások checkpointba mentése után.',
      reset: 'Mintakézirat visszaállítása',
      resetDescription:
        'A jelenlegi alfa mintakézirat lecserélése egy új, tiszta mintakéziratra.',
      confirmReset:
        'Visszaállítja a mintakéziratot? A jelenlegi mintakézirat adatai lecserélődnek.',
      technicalData: 'Technikai adatok',
      technicalDescription:
        'A szemantikai reprezentáció csak akkor jelenik meg, amikor technikai részletekre van szükség.',
      liveJson: 'Aktuális szakasz JSON',
      synced: 'Szinkronban'
    }
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

  history: {
    title: 'Revíziótörténet',
    description:
      'A kézirathoz rögzített, nem módosítható OMI-SPEC-160 revíziók.',
    empty: 'Még nincs rögzített revízió.',
    current: 'Jelenlegi',
    revision: 'Revízió',
    events: 'esemény',
    groupedChanges: 'csoportosított változás',
    unknownActor: 'Ismeretlen közreműködő',
    completeHistory: 'Teljes előzmény',
    shallowHistory: 'Részleges előzmény',
    pendingTitle: 'Nem rögzített munkapéldány',
    pendingDescription:
      'A legutóbbi módosítások összevonva várakoznak, és egyetlen nem módosítható checkpoint-revízióvá válnak.',
    pendingBadge: 'Függőben',
    checkpoint: 'Checkpoint mentése',
    discard: 'Módosítások elvetése',
    confirmDiscard:
      'Elveti az összes nem rögzített módosítást, és visszaállítja a legutóbbi rögzített revíziót?',
    revert: 'Visszaállítás',
    confirmRevert:
      'Készüljön új revízió, amely visszaállítja ezt a korábbi kéziratállapotot?',
    revertBlocked:
      'Korábbi revízió visszaállítása előtt mentse checkpointként vagy vesse el a függő módosításokat.',
    tombstonesTitle: 'Törölt objektumok nyilvántartása',
    tombstonesDescription:
      'Az OMI-SPEC-160 tombstone-rekordok megőrzik a törölt objektumok azonosítóit és a későbbi helyreállítás bizonyítékát.',
    tombstoneActive: 'Törölve',
    tombstoneRestored: 'Helyreállítva',
    operations: {
      snapshotCreated: 'Kézirat-pillanatkép létrehozva',
      titleChanged: 'A kézirat címe megváltozott',
      abstractChanged: 'A kézirat absztraktja megváltozott',
      sectionCreated: 'Új fejezet hozzáadva',
      blockChanged: 'A blokk tartalma megváltozott',
      contributorAdded: 'Közreműködő hozzáadva',
      contributorChanged: 'A közreműködő identitása megváltozott',
      contributorRemoved: 'Közreműködő eltávolítva',
      contributionChanged: 'A közreműködői szerep megváltozott',
      contributorsReordered: 'A közreműködők sorrendje megváltozott',
      reverted: 'Korábbi revízió visszaállítva'
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
