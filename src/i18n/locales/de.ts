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
