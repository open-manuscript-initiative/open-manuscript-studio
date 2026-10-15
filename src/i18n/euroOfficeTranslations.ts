export interface EuroOfficeCopy {
  title: string;
  description: string;
  notConfigured: string;
  notConfiguredHelp: string;
  newTitle: string;
  create: string;
  titleLabel: string;
  author: string;
  email: string;
  upload: string;
  documents: string;
  open: string;
  close: string;
  refresh: string;
  loading: string;
  saving: string;
  empty: string;
  unavailable: string;
  attribution: string;
  uploadInvalid: string;
  genericError: string;
  delete: string;
  deleteConfirmation: (title: string) => string;
}

const translations: Record<'en' | 'hu' | 'de', EuroOfficeCopy> = {
  en: {
    title: 'Simple documents', description: 'Create and edit everyday DOCX documents without scholarly review tools.',
    notConfigured: 'Euro-Office is not configured', notConfiguredHelp: 'The Studio server administrator must configure the Euro-Office Document Server URL and shared JWT secret.',
    newTitle: 'New document', create: 'Create blank document', titleLabel: 'Document title', author: 'Author', email: 'Author email',
    upload: 'Open a DOCX file', documents: 'Your documents', open: 'Open', close: 'Close editor', refresh: 'Refresh', loading: 'Loading…', saving: 'Preparing document…',
    empty: 'No simple documents yet.', unavailable: 'Could not connect to the Studio server.',
    attribution: 'Your author name and email are saved as document attribution and passed to the editor.',
    uploadInvalid: 'Choose a DOCX document.', genericError: 'The document could not be opened.', delete: 'Delete', deleteConfirmation: (title) => `Delete “${title}”?`,
  },
  hu: {
    title: 'Egyszerű dokumentumok', description: 'Mindennapi DOCX-dokumentumok írása és szerkesztése lektorálási eszközök nélkül.',
    notConfigured: 'A Euro-Office nincs beállítva', notConfiguredHelp: 'A Studio szerver üzemeltetőjének kell beállítania a Euro-Office dokumentumszerver címét és a közös JWT-titkot.',
    newTitle: 'Új dokumentum', create: 'Üres dokumentum létrehozása', titleLabel: 'Dokumentum címe', author: 'Szerző', email: 'Szerző e-mail-címe',
    upload: 'DOCX-fájl megnyitása', documents: 'Dokumentumaim', open: 'Megnyitás', close: 'Szerkesztő bezárása', refresh: 'Frissítés', loading: 'Betöltés…', saving: 'Dokumentum előkészítése…',
    empty: 'Még nincs egyszerű dokumentum.', unavailable: 'Nem sikerült kapcsolódni a Studio szerverhez.',
    attribution: 'A szerző neve és e-mail-címe dokumentumszerzői adatként mentődik, és átkerül a szerkesztőbe.',
    uploadInvalid: 'DOCX-dokumentumot válassz.', genericError: 'Nem sikerült megnyitni a dokumentumot.', delete: 'Törlés', deleteConfirmation: (title) => `Törlöd ezt a dokumentumot: „${title}”?`,
  },
  de: {
    title: 'Einfache Dokumente', description: 'Alltagsdokumente im DOCX-Format ohne wissenschaftliche Begutachtungsfunktionen schreiben und bearbeiten.',
    notConfigured: 'Euro-Office ist nicht konfiguriert', notConfiguredHelp: 'Die Studio-Serververwaltung muss die URL des Euro-Office Document Servers und das gemeinsame JWT-Geheimnis konfigurieren.',
    newTitle: 'Neues Dokument', create: 'Leeres Dokument erstellen', titleLabel: 'Dokumenttitel', author: 'Autor', email: 'E-Mail des Autors',
    upload: 'DOCX-Datei öffnen', documents: 'Ihre Dokumente', open: 'Öffnen', close: 'Editor schließen', refresh: 'Aktualisieren', loading: 'Wird geladen…', saving: 'Dokument wird vorbereitet…',
    empty: 'Noch keine einfachen Dokumente.', unavailable: 'Verbindung zum Studio-Server fehlgeschlagen.',
    attribution: 'Name und E-Mail des Autors werden als Dokumentzuordnung gespeichert und an den Editor übergeben.',
    uploadInvalid: 'Wählen Sie ein DOCX-Dokument aus.', genericError: 'Das Dokument konnte nicht geöffnet werden.', delete: 'Löschen', deleteConfirmation: (title) => `Dokument „${title}” löschen?`,
  },
};

export function getEuroOfficeCopy(locale: string): EuroOfficeCopy {
  if (locale === 'hu' || locale.startsWith('hu-')) return translations.hu;
  if (locale === 'de' || locale.startsWith('de-')) return translations.de;
  return translations.en;
}
