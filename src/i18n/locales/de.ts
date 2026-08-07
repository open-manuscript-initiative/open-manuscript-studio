import type { TranslationDictionary } from '../types';

export const de: TranslationDictionary = {
  common: {
    save: 'Speichern',
    cancel: 'Abbrechen',
    close: 'Schließen',
    delete: 'Löschen',
    edit: 'Bearbeiten',
    add: 'Hinzufügen',
    loading: 'Wird geladen…',
    language: 'Sprache'
  },

  navigation: {
    documents: 'Dokumente',
    editor: 'Editor',
    metadata: 'Metadaten',
    preview: 'Vorschau',
    settings: 'Einstellungen'
  },

  studio: {
    menu: 'Manuskriptmenü',
    closeMenu: 'Manuskriptmenü schließen',
    languageSwitcher: 'Oberflächensprache',
    saved: 'Gespeichert',
    pending: 'Speichern…',
    editorAria: 'Manuskripteditor',
    titlePlaceholder: 'Manuskripttitel eingeben',
    noSection: 'Kein Abschnitt ausgewählt.',
    navigation: {
      document: 'Dokument',
      manuscript: 'Manuskriptdaten',
      notes: 'Anmerkungen',
      references: 'Literatur und Quellen',
      contributors: 'Mitwirkende',
      history: 'Verlauf',
      tools: 'Export und Werkzeuge',
      settings: 'Einstellungen'
    },
    document: {
      title: 'Dokumentstruktur',
      description:
        'Wählen Sie den Abschnitt aus, an dem Sie arbeiten möchten. Struktur- und Objektdaten bleiben außerhalb der Schreiboberfläche, bis sie benötigt werden.',
      addSection: 'Abschnitt hinzufügen',
      sections: 'Abschnitte',
      objects: 'Objekte',
      annotations: 'Anmerkungen',
      citations: 'Zitate'
    },
    manuscript: {
      title: 'Manuskriptdaten',
      description:
        'Bearbeiten Sie manuskriptweite Angaben getrennt von der Schreiboberfläche.'
    },
    tools: {
      title: 'Export und Werkzeuge',
      description:
        'Sekundäre, technische und potenziell destruktive Aktionen bleiben außerhalb der Schreiboberfläche.',
      export: 'Export .omi.json',
      exportDescription:
        'Erstellt nach dem Speichern ausstehender Änderungen eine kanonische, portable OMI-Manuskriptdatei.',
      reset: 'Beispiel zurücksetzen',
      resetDescription:
        'Ersetzt das aktuelle Alpha-Beispiel durch ein neues, sauberes Beispielmanuskript.',
      confirmReset:
        'Aktuelles Beispielmanuskript zurücksetzen? Die derzeitigen Beispieldaten werden ersetzt.',
      technicalData: 'Technische Daten',
      technicalDescription:
        'Die semantische Repräsentation wird nur angezeigt, wenn technische Details benötigt werden.',
      liveJson: 'JSON des aktuellen Abschnitts',
      synced: 'Synchronisiert'
    },
    settings: {
      title: 'Oberflächeneinstellungen',
      description:
        'Wählen Sie aus, welche Oberflächensprachen Sie beim Arbeiten verwenden möchten. Diese Einstellungen werden auf diesem Gerät gespeichert.',
      interfaceLanguages: 'Verfügbare Oberflächensprachen',
      interfaceLanguagesDescription:
        'Aktivierte Sprachen erscheinen im schnellen Sprachumschalter in der Kopfzeile des Editors.',
      currentLanguage: 'Aktuelle Oberflächensprache',
      currentLanguageHint:
        'Die aktuell verwendete Sprache muss aktiviert bleiben. Wechseln Sie zuerst zu einer anderen Sprache, bevor Sie sie deaktivieren.',
      enabledLanguage: 'Im schnellen Sprachumschalter verfügbar',
      disabledLanguage: 'Im schnellen Sprachumschalter ausgeblendet',
      futureLanguages:
        'Das Sprachregister ist erweiterbar. Zukünftige Übersetzungswörterbücher können hinzugefügt werden, ohne diese Einstellungsansicht neu zu entwerfen.'
    }
  },

  manuscript: {
    newDocument: 'Neues Manuskript',
    documentTitle: 'Dokumenttitel',
    abstract: 'Zusammenfassung',
    keywords: 'Schlüsselwörter',
    contributors: 'Mitwirkende',
    sections: 'Abschnitte',
    annotations: 'Anmerkungen',
    citations: 'Zitate',
    bibliography: 'Literaturverzeichnis',
    documentLanguage: 'Dokumentsprache',
    originalLanguage: 'Originalsprache'
  },

  notes: {
    title: 'Anmerkungen',
    description:
      'Verwalten Sie semantische Manuskriptanmerkungen. Der Anmerkungstext bleibt ein eigenständiges Annotation-Objekt, während im Text nur der stabile Anker steht.',
    empty: 'Dieses Manuskript enthält noch keine Anmerkungen.',
    emptyHint:
      'Setzen Sie den Cursor in den Text und verwenden Sie die Schaltfläche Anmerkung oder Strg/Cmd+Alt+N.',
    note: 'Anmerkung',
    type: 'Anmerkungstyp',
    body: 'Anmerkungstext',
    bodyPlaceholder: 'Anmerkung schreiben…',
    footnote: 'Fußnote',
    endnote: 'Endnote',
    authorNote: 'Autorenanmerkung',
    delete: 'Anmerkung löschen',
    confirmDelete:
      'Diese Anmerkung und ihren Inline-Anker aus dem Manuskript löschen?',
    closeEditor: 'Anmerkungseditor schließen',
    goToNote: 'Zur Anmerkung',
    autoSave: 'Mit den Manuskriptrevisionen gespeichert'
  },

  citations: {
    referencesTitle: 'Literatur und Quellen',
    referencesDescription:
      'Fügen Sie ein Werk einmal zur Referenzbibliothek des Manuskripts hinzu und verwenden Sie es anschließend in beliebig vielen Zitierstellen.',
    addReference: 'Quelle hinzufügen',
    editReference: 'Quelle bearbeiten',
    referenceEditorDescription:
      'Bibliografische Metadaten werden strukturiert und unabhängig von einzelnen Zitierstellen oder Ausgabestilen gespeichert.',
    emptyLibrary: 'Die Referenzbibliothek des Manuskripts ist leer.',
    emptyLibraryHint:
      'Fügen Sie ein Buch, einen Artikel, eine Archivquelle, eine Webseite oder eine andere zitierbare Ressource hinzu.',
    searchReferences: 'Referenzen durchsuchen',
    searchPlaceholder: 'Titel, Autor, Jahr, DOI…',
    untitledReference: 'Referenz ohne Titel',
    occurrences: 'Zitierungen',
    bibliographyPreviewDescription:
      'Neutrale Vorschau der im Manuskript tatsächlich zitierten Datensätze. Die endgültige Formatierung bestimmt das Publikationsprofil.',
    resourceType: 'Ressourcentyp',
    title: 'Titel',
    titlePlaceholder: 'Titel des zitierten Werks',
    subtitle: 'Untertitel',
    creators: 'Urheber und Mitwirkende',
    creatorsDescription:
      'Namen werden strukturiert gespeichert, damit Zitierstile und Exporte sie korrekt darstellen können.',
    addCreator: 'Urheber hinzufügen',
    removeCreator: 'Urheber entfernen',
    noCreators: 'Noch kein Urheber oder Mitwirkender angegeben.',
    creatorRole: 'Rolle',
    givenName: 'Vorname',
    familyName: 'Familienname',
    containerTitle: 'Titel der Zeitschrift, des Sammelwerks oder Containers',
    issued: 'Erscheinungsdatum / Jahr',
    volume: 'Band',
    issue: 'Heft',
    pages: 'Seiten / Umfang',
    publisher: 'Verlag',
    place: 'Erscheinungsort',
    duplicateReference:
      'Wahrscheinlich befindet sich dieses Werk bereits in der Referenzbibliothek:',
    insertTitle: 'Zitat einfügen',
    insertDescription:
      'Wählen Sie ein Werk aus der Referenzbibliothek und geben Sie bei Bedarf die genaue Fundstelle an.',
    noReferences: 'Noch keine Referenz verfügbar.',
    noReferencesHint:
      'Fügen Sie das Werk unter Manuskriptmenü → Literatur und Quellen hinzu und kehren Sie anschließend hierher zurück.',
    insert: 'Zitat einfügen',
    citation: 'Zitat',
    reference: 'Zitiertes Werk',
    locatorType: 'Fundstellentyp',
    locator: 'Fundstelle',
    locatorPlaceholder: 'z. B. 45–47, 12r–13v, Kapitel 4',
    prefix: 'Präfix',
    prefixPlaceholder: 'z. B. siehe auch',
    suffix: 'Suffix',
    suffixPlaceholder: 'z. B. Hervorhebung hinzugefügt',
    openSource: 'Quelle öffnen',
    closeEditor: 'Zitiereditor schließen',
    deleteCitation: 'Zitat löschen',
    confirmDeleteCitation:
      'Diese Zitierstelle aus dem Manuskript löschen? Der bibliografische Datensatz bleibt in der Referenzbibliothek erhalten.',
    unresolvedReference: 'Der zitierte bibliografische Datensatz fehlt oder ist nicht aufgelöst.',
    roles: {
      author: 'Autor/in',
      editor: 'Herausgeber/in',
      translator: 'Übersetzer/in',
      compiler: 'Zusammensteller/in',
      contributor: 'Mitwirkende/r'
    },
    resourceTypes: {
      'journal-article': 'Zeitschriftenartikel',
      book: 'Buch',
      'book-chapter': 'Buchkapitel',
      'conference-paper': 'Konferenzbeitrag',
      thesis: 'Abschlussarbeit',
      dissertation: 'Dissertation',
      report: 'Bericht',
      preprint: 'Preprint',
      dataset: 'Datensatz',
      software: 'Software',
      standard: 'Norm',
      'archival-source': 'Archivquelle',
      manuscript: 'Manuskript',
      'web-page': 'Webseite'
    },
    locators: {
      page: 'Seite',
      'page-range': 'Seitenbereich',
      chapter: 'Kapitel',
      section: 'Abschnitt',
      paragraph: 'Absatz',
      figure: 'Abbildung',
      table: 'Tabelle',
      folio: 'Folio',
      line: 'Zeile',
      timestamp: 'Zeitmarke'
    }
  },

  contributors: {
    description:
      'Verwalten Sie übertragbare wissenschaftliche Identitäten und manuskriptspezifische Mitwirkungsrollen.',
    add: 'Mitwirkenden hinzufügen',
    empty: 'Diesem Manuskript wurden noch keine Mitwirkenden hinzugefügt.',
    remove: 'Mitwirkenden entfernen',
    moveUp: 'Mitwirkenden nach oben verschieben',
    moveDown: 'Mitwirkenden nach unten verschieben',
    givenName: 'Vorname',
    familyName: 'Familienname',
    affiliation: 'Affiliation',
    orcid: 'ORCID',
    invalidOrcid: 'Format oder Prüfsumme der ORCID ist ungültig.',
    role: 'Mitwirkungsrolle',
    corresponding: 'Korrespondierender Mitwirkender',
    roles: {
      author: 'Autor/in',
      editor: 'Herausgeber/in',
      translator: 'Übersetzer/in',
      reviewer: 'Gutachter/in',
      dataCurator: 'Datenkurator/in',
      software: 'Software',
      methodology: 'Methodik',
      visualization: 'Visualisierung',
      other: 'Sonstige'
    }
  },

  history: {
    title: 'Revisionsverlauf',
    description:
      'Unveränderliche OMI-SPEC-160-Revisionen dieses Manuskripts.',
    empty: 'Es wurden noch keine Revisionen aufgezeichnet.',
    current: 'Aktuell',
    revision: 'Revision',
    events: 'Ereignisse',
    groupedChanges: 'gebündelte Änderungen',
    unknownActor: 'Unbekannter Mitwirkender',
    completeHistory: 'Vollständiger Verlauf',
    shallowHistory: 'Unvollständiger Verlauf',
    pendingTitle: 'Nicht gespeicherter Arbeitsstand',
    pendingDescription:
      'Die letzten Bearbeitungen werden gebündelt und als eine unveränderliche Checkpoint-Revision gespeichert.',
    pendingBadge: 'Ausstehend',
    checkpoint: 'Checkpoint speichern',
    discard: 'Änderungen verwerfen',
    confirmDiscard:
      'Alle nicht gespeicherten Änderungen verwerfen und die letzte gespeicherte Revision wiederherstellen?',
    revert: 'Wiederherstellen',
    confirmRevert:
      'Soll eine neue Revision erstellt werden, die diesen früheren Manuskriptstand wiederherstellt?',
    revertBlocked:
      'Speichern oder verwerfen Sie den ausstehenden Arbeitsstand, bevor Sie eine frühere Revision wiederherstellen.',
    tombstonesTitle: 'Nachweise gelöschter Objekte',
    tombstonesDescription:
      'Persistente OMI-SPEC-160-Tombstones bewahren Kennungen gelöschter Objekte und Nachweise ihrer Wiederherstellung.',
    tombstoneActive: 'Gelöscht',
    tombstoneRestored: 'Wiederhergestellt',
    operations: {
      snapshotCreated: 'Manuskript-Snapshot erstellt',
      titleChanged: 'Manuskripttitel geändert',
      abstractChanged: 'Zusammenfassung geändert',
      sectionCreated: 'Abschnitt hinzugefügt',
      blockChanged: 'Blockinhalt geändert',
      contributorAdded: 'Mitwirkender hinzugefügt',
      contributorChanged: 'Identität des Mitwirkenden geändert',
      contributorRemoved: 'Mitwirkender entfernt',
      contributionChanged: 'Mitwirkungsrolle geändert',
      contributorsReordered: 'Mitwirkende neu geordnet',
      reverted: 'Frühere Revision wiederhergestellt'
    }
  },

  editor: {
    addSection: 'Abschnitt hinzufügen',
    addParagraph: 'Absatz hinzufügen',
    addNote: 'Anmerkung',
    addCitation: 'Zitat',
    untitledSection: 'Unbenannter Abschnitt',
    emptyParagraph: 'Beginnen Sie zu schreiben…',
    paragraph: 'Absatz',
    heading: 'Überschrift',
    quote: 'Zitat',
    insertNote: 'Semantische Anmerkung einfügen',
    insertCitation: 'Semantisches Zitat einfügen',
    loading: 'Editor wird geladen…'
  },

  status: {
    draft: 'Entwurf',
    submitted: 'Eingereicht',
    accepted: 'Angenommen',
    published: 'Veröffentlicht'
  },

  validation: {
    requiredField: 'Dieses Feld ist erforderlich.',
    invalidDocument: 'Die Dokumentstruktur ist ungültig.',
    unsupportedSchema:
      'Die Schemaversion des Dokuments wird nicht unterstützt.'
  },

  languages: {
    en: 'Englisch',
    hu: 'Ungarisch',
    de: 'Deutsch'
  },

  auth: {
    brand: {
      name: 'Open Manuscript Studio',
      description: 'Gemeinsame Manuskriptbearbeitung'
    },
    login: {
      title: 'Anmelden',
      description: 'Bitte melden Sie sich an.',
      submit: 'Anmelden',
      submitting: 'Anmeldung läuft…',
      noAccount: 'Noch kein Konto?',
      registerLink: 'Registrieren'
    },
    register: {
      title: 'Konto erstellen',
      description: 'Erstellen Sie ein neues Konto.',
      submit: 'Registrieren',
      hasAccount: 'Bereits registriert?',
      loginLink: 'Anmelden'
    },
    fields: {
      name: {
        label: 'Vollständiger Name',
        placeholder: 'Ihr vollständiger Name'
      },
      email: {
        label: 'E-Mail',
        placeholder: 'name@example.com'
      },
      password: {
        label: 'Passwort',
        placeholder: 'Passwort eingeben'
      }
    },
    errors: {
      invalidEmail: 'Ungültige E-Mail-Adresse.',
      invalidCredentials: 'Falsche E-Mail-Adresse oder falsches Passwort.',
      userNotFound: 'Das Benutzerkonto wurde nicht gefunden.',
      accountNotActive: 'Das Benutzerkonto ist nicht aktiv.',
      authenticationRequired: 'Eine Anmeldung ist erforderlich.'
    },
    alphaNotice:
      'Alpha-Version – die Anmeldung dient derzeit Testzwecken.'
  }
};
