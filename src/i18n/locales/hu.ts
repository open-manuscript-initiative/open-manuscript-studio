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
      notes: 'Jegyzetek',
      references: 'Hivatkozások',
      contributors: 'Közreműködők',
      history: 'Előzmények',
      tools: 'Export és eszközök',
      settings: 'Beállítások'
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
    },
    settings: {
      title: 'Felület beállításai',
      description:
        'Válassza ki, mely felületi nyelveket szeretné használni munka közben. A beállítások ezen az eszközön maradnak meg.',
      interfaceLanguages: 'Használható felületi nyelvek',
      interfaceLanguagesDescription:
        'Az engedélyezett nyelvek jelennek meg a szerkesztő fejlécének gyors nyelvváltójában.',
      currentLanguage: 'Jelenlegi felületi nyelv',
      currentLanguageHint:
        'Az éppen használt nyelvnek engedélyezve kell maradnia. A kikapcsolásához előbb váltson másik nyelvre.',
      enabledLanguage: 'Megjelenik a gyors nyelvváltóban',
      disabledLanguage: 'Elrejtve a gyors nyelvváltóból',
      futureLanguages:
        'A nyelvi regiszter bővíthető. Később új fordítási szótárak vehetők fel anélkül, hogy ezt a beállítási felületet újra kellene tervezni.'
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

  notes: {
    title: 'Jegyzetek',
    description:
      'A kézirat szemantikus jegyzeteinek kezelése. A jegyzet szövege önálló annotation objektum, a szövegben csak a stabil horgony marad.',
    empty: 'A kéziratban még nincs jegyzet.',
    emptyHint:
      'Helyezze a kurzort a szövegbe, majd használja a Jegyzet gombot vagy a Ctrl/Cmd+Alt+N billentyűkombinációt.',
    note: 'Jegyzet',
    type: 'Jegyzet típusa',
    body: 'Jegyzet szövege',
    bodyPlaceholder: 'Írja be a jegyzetet…',
    footnote: 'Lábjegyzet',
    endnote: 'Végjegyzet',
    authorNote: 'Szerzői jegyzet',
    delete: 'Jegyzet törlése',
    confirmDelete:
      'Törli ezt a jegyzetet és a hozzá tartozó szövegközi horgonyt a kéziratból?',
    closeEditor: 'Jegyzetszerkesztő bezárása',
    goToNote: 'Ugrás a jegyzethez',
    autoSave: 'A kézirat revízióival együtt mentve'
  },

  citations: {
    referencesTitle: 'Hivatkozások',
    referencesDescription:
      'Egy művet csak egyszer kell felvenni a kézirat hivatkozásjegyzékébe, majd tetszőleges számú idézési előfordulásban újra felhasználható.',
    addReference: 'Forrás hozzáadása',
    editReference: 'Forrás szerkesztése',
    referenceEditorDescription:
      'A bibliográfiai adatokat strukturáltan, az egyes idézési helyektől és a megjelenítési stílustól függetlenül tárolja.',
    emptyLibrary: 'A kézirat hivatkozásjegyzéke még üres.',
    emptyLibraryHint:
      'Vegyen fel könyvet, tanulmányt, levéltári forrást, webes forrást vagy más idézhető művet, majd illessze be a szövegbe.',
    searchReferences: 'Keresés a hivatkozások között',
    searchPlaceholder: 'Cím, szerző, év, DOI…',
    untitledReference: 'Cím nélküli forrás',
    occurrences: 'hivatkozás',
    bibliographyPreviewDescription:
      'A kéziratban ténylegesen idézett rekordok semleges előnézete. A végleges formázást a publikációs profil határozza meg.',
    resourceType: 'Forrás típusa',
    title: 'Cím',
    titlePlaceholder: 'Az idézett mű címe',
    subtitle: 'Alcím',
    creators: 'Szerzők és közreműködők',
    creatorsDescription:
      'A neveket strukturáltan tároljuk, hogy a hivatkozási stílusok és exportok helyesen jeleníthessék meg őket.',
    addCreator: 'Szerző hozzáadása',
    removeCreator: 'Szerző eltávolítása',
    noCreators: 'Még nincs megadott szerző vagy közreműködő.',
    creatorRole: 'Szerep',
    givenName: 'Utónév',
    familyName: 'Családnév',
    containerTitle: 'Folyóirat, kötet vagy befoglaló mű címe',
    issued: 'Megjelenés dátuma / éve',
    volume: 'Évfolyam / kötet',
    issue: 'Szám',
    pages: 'Oldalak / terjedelem',
    publisher: 'Kiadó',
    place: 'Kiadás helye',
    duplicateReference:
      'Valószínűleg már szerepel ugyanez a mű a hivatkozásjegyzékben:',
    insertTitle: 'Hivatkozás beszúrása',
    insertDescription:
      'Válasszon művet a kézirat hivatkozásjegyzékéből, és szükség esetén adja meg a pontos helyet.',
    noReferences: 'Még nincs használható forrás.',
    noReferencesHint:
      'A Kézirat menü → Hivatkozások pontban vegye fel a művet, majd térjen vissza ide a beszúráshoz.',
    insert: 'Hivatkozás beszúrása',
    citation: 'Hivatkozás',
    reference: 'Idézett mű',
    locatorType: 'Helymegjelölés típusa',
    locator: 'Helymegjelölés',
    locatorPlaceholder: 'pl. 45–47, 12r–13v, 4. fejezet',
    prefix: 'Előtag',
    prefixPlaceholder: 'pl. lásd még',
    suffix: 'Utótag',
    suffixPlaceholder: 'pl. kiemelés tőlem',
    openSource: 'Forrás megnyitása',
    closeEditor: 'Hivatkozásszerkesztő bezárása',
    deleteCitation: 'Hivatkozás törlése',
    confirmDeleteCitation:
      'Törli ezt a hivatkozási előfordulást a kéziratból? A bibliográfiai rekord megmarad a hivatkozásjegyzékben.',
    unresolvedReference: 'Az idézett bibliográfiai rekord hiányzik vagy nincs feloldva.',
    roles: {
      author: 'Szerző',
      editor: 'Szerkesztő',
      translator: 'Fordító',
      compiler: 'Összeállító',
      contributor: 'Közreműködő'
    },
    resourceTypes: {
      'journal-article': 'Folyóiratcikk',
      book: 'Könyv',
      'book-chapter': 'Könyvfejezet',
      'conference-paper': 'Konferencia-előadás',
      thesis: 'Szakdolgozat',
      dissertation: 'Disszertáció',
      report: 'Jelentés',
      preprint: 'Preprint',
      dataset: 'Adatkészlet',
      software: 'Szoftver',
      standard: 'Szabvány',
      'archival-source': 'Levéltári forrás',
      manuscript: 'Kézirat',
      'web-page': 'Weboldal'
    },
    locators: {
      page: 'Oldal',
      'page-range': 'Oldaltartomány',
      chapter: 'Fejezet',
      section: 'Szakasz',
      paragraph: 'Bekezdés',
      figure: 'Ábra',
      table: 'Táblázat',
      folio: 'Fólió',
      line: 'Sor',
      timestamp: 'Időpont'
    }
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
    addNote: 'Jegyzet',
    addCitation: 'Hivatkozás',
    untitledSection: 'Névtelen fejezet',
    emptyParagraph: 'Kezdjen el írni…',
    paragraph: 'Bekezdés',
    heading: 'Címsor',
    quote: 'Idézet',
    insertNote: 'Szemantikus jegyzet beszúrása',
    insertCitation: 'Szemantikus hivatkozás beszúrása',
    loading: 'A szerkesztő betöltése…'
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
      invalidCredentials: 'Helytelen e-mail-cím vagy jelszó.',
      userNotFound: 'A felhasználói fiók nem található.',
      accountNotActive: 'A felhasználói fiók nem aktív.',
      authenticationRequired: 'A művelethez bejelentkezés szükséges.'
    },
    alphaNotice:
      'Alfa verzió – a bejelentkezés jelenleg tesztelési célokat szolgál.'
  }
};
