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
    addNote: 'Anmerkung hinzufügen',
    untitledSection: 'Unbenannter Abschnitt',
    emptyParagraph: 'Beginnen Sie zu schreiben…'
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
      invalidCredentials:
        'Falsche E-Mail-Adresse oder falsches Passwort.',
      userNotFound: 'Das Benutzerkonto wurde nicht gefunden.',
      accountNotActive: 'Das Benutzerkonto ist nicht aktiv.',
      authenticationRequired: 'Eine Anmeldung ist erforderlich.'
    },

    alphaNotice:
      'Alpha-Version – die Anmeldung dient derzeit Testzwecken.'
  }
};
