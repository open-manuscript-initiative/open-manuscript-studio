export interface DocxImportCopy {
  title: string;
  description: string;
  chooseFile: string;
  parsing: string;
  replaceFile: string;
  previewTitle: string;
  previewDescription: string;
  detectedMetadata: string;
  manuscriptTitle: string;
  language: string;
  titleSource: string;
  sourceCore: string;
  sourceStyle: string;
  sourceFilename: string;
  authors: string;
  importAuthors: string;
  importAuthorsHint: string;
  coreAuthorSource: string;
  styleAuthorSource: string;
  outline: string;
  warnings: string;
  noWarnings: string;
  importButton: string;
  imported: string;
  confirmReplace: string;
  currentWorkspaceWarning: string;
  stats: {
    sections: string;
    paragraphs: string;
    lists: string;
    notes: string;
    images: string;
    tables: string;
    equations: string;
    citations: string;
    references: string;
  };
  warningText: Record<string, string>;
}

const en: DocxImportCopy = {
  title: 'Import Word manuscript',
  description: 'Convert a DOCX manuscript into semantic OMI structure locally in your browser.',
  chooseFile: 'Choose DOCX file',
  parsing: 'Reading and analysing DOCX…',
  replaceFile: 'Choose another file',
  previewTitle: 'Import preview',
  previewDescription: 'Review the reconstructed structure before opening it as a new OMI manuscript.',
  detectedMetadata: 'Detected metadata',
  manuscriptTitle: 'Title',
  language: 'Language',
  titleSource: 'Title source',
  sourceCore: 'DOCX core properties',
  sourceStyle: 'Word Title style',
  sourceFilename: 'File name fallback',
  authors: 'Detected authors',
  importAuthors: 'Import detected authors',
  importAuthorsHint: 'DOCX creator/Author-style metadata can be ambiguous. Imported names remain editable and are not identity-verified.',
  coreAuthorSource: 'core metadata',
  styleAuthorSource: 'Author style',
  outline: 'Reconstructed outline',
  warnings: 'Review items',
  noWarnings: 'No structural warnings were detected.',
  importButton: 'Open as new OMI manuscript',
  imported: 'The DOCX manuscript has been opened.',
  confirmReplace: 'Open this DOCX as a new OMI manuscript? The current active manuscript will leave the single-document workspace.',
  currentWorkspaceWarning: 'Import creates a new manuscript identity and a new root revision. It does not rewrite the current manuscript history.',
  stats: {
    sections: 'Sections', paragraphs: 'Paragraphs', lists: 'Lists', notes: 'Notes', images: 'Images', tables: 'Tables', equations: 'Equations', citations: 'Citations', references: 'Reference records',
  },
  warningText: {
    'tracked-deletions': 'Tracked deletions are not imported; accepted/visible text is preferred.',
    'comments-not-imported': 'Word comments are not yet converted into OMI review annotations.',
    'text-boxes-flattened': 'Text-box content may be flattened into the main text flow.',
    'conflicting-title-metadata': 'DOCX core title and the styled document title differ; the core title is retained.',
    'merged-table-cells': 'Merged Word table cells are flattened into the editable rectangular OMI table model.',
    'missing-note-body': 'A note reference was found without a readable note body.',
    'unresolved-word-citation': 'A Word citation field references a source that could not be matched to embedded bibliography metadata.',
    'word-cross-reference-flattened': 'A Word REF/PAGEREF field is preserved as visible text; semantic OMI target mapping needs review.',
    'inline-equation-promoted': 'An inline Word equation was promoted to a separate editable equation block.',
    'title-from-filename': 'No explicit document title was found; the file name is used as the manuscript title.',
    'authors-from-docx-metadata': 'Author names were inferred from DOCX metadata and should be reviewed.',
    'headers-footers-not-imported': 'Headers and footers are not imported into scholarly manuscript content.',
  },
};

const hu: DocxImportCopy = {
  ...en,
  title: 'Word-kézirat importálása',
  description: 'DOCX-kézirat szemantikus OMI-struktúrává alakítása helyben, a böngészőben.',
  chooseFile: 'DOCX-fájl kiválasztása', parsing: 'DOCX beolvasása és elemzése…', replaceFile: 'Másik fájl kiválasztása',
  previewTitle: 'Import-előnézet', previewDescription: 'A létrehozott szerkezet ellenőrizhető, mielőtt új OMI-kéziratként megnyílik.',
  detectedMetadata: 'Felismert metaadatok', manuscriptTitle: 'Cím', language: 'Nyelv', titleSource: 'A cím forrása',
  sourceCore: 'DOCX alapmetaadat', sourceStyle: 'Word Cím stílus', sourceFilename: 'Fájlnévből képzett cím',
  authors: 'Felismert szerzők', importAuthors: 'Felismert szerzők átvétele',
  importAuthorsHint: 'A DOCX creator/Author metaadata nem mindig azonos a közlemény szerzőségével. Az átvett nevek szerkeszthetők és nem minősülnek hitelesített identitásnak.',
  coreAuthorSource: 'alapmetaadat', styleAuthorSource: 'Szerző stílus', outline: 'Felismert dokumentumszerkezet',
  warnings: 'Ellenőrizendő elemek', noWarnings: 'Nem találtam szerkezeti figyelmeztetést.', importButton: 'Megnyitás új OMI-kéziratként',
  imported: 'A DOCX-kézirat megnyílt.',
  confirmReplace: 'Megnyitja ezt a DOCX-fájlt új OMI-kéziratként? A jelenlegi aktív kézirat kikerül az egykéziratos munkatérből.',
  currentWorkspaceWarning: 'Az import új kéziratazonosítót és új gyökérrevíziót hoz létre; a jelenlegi kézirat történetét nem írja át.',
  stats: { sections: 'Szakaszok', paragraphs: 'Bekezdések', lists: 'Listák', notes: 'Jegyzetek', images: 'Képek', tables: 'Táblázatok', equations: 'Egyenletek', citations: 'Hivatkozások', references: 'Bibliográfiai rekordok' },
  warningText: {
    'tracked-deletions': 'A követett törlések nem kerülnek be; a látható/elfogadott szöveg kap elsőbbséget.',
    'comments-not-imported': 'A Word-megjegyzések még nem alakulnak OMI lektori annotációvá.',
    'text-boxes-flattened': 'A szövegdobozok tartalma a fő szövegfolyamba lapulhat.',
    'conflicting-title-metadata': 'A DOCX alapmetaadatában és a dokumentumban szereplő cím eltér; az alapmetaadat címe marad meg.',
    'merged-table-cells': 'A Word egyesített cellái az OMI szerkeszthető, téglalap alakú táblázatmodelljében kilapításra kerülnek.',
    'missing-note-body': 'Jegyzethivatkozás található, de a jegyzet törzse nem olvasható.',
    'unresolved-word-citation': 'Egy Word-hivatkozás nem párosítható a DOCX-be ágyazott bibliográfiai forrással.',
    'word-cross-reference-flattened': 'A Word REF/PAGEREF mező látható szövegként megmarad; a szemantikus OMI-célpontot ellenőrizni kell.',
    'inline-equation-promoted': 'Egy szövegközi Word-egyenlet külön szerkeszthető egyenletblokkká alakult.',
    'title-from-filename': 'Nem találtam kifejezett dokumentumcímet; a fájlnév lett a kézirat címe.',
    'authors-from-docx-metadata': 'A szerzőnevek DOCX-metaadatból származnak, ezért ellenőrzendők.',
    'headers-footers-not-imported': 'A Word élőfeje és élőlába nem kerül a tudományos kézirattartalomba.',
  },
};

const de: DocxImportCopy = {
  ...en,
  title: 'Word-Manuskript importieren',
  description: 'Ein DOCX-Manuskript lokal im Browser in eine semantische OMI-Struktur umwandeln.',
  chooseFile: 'DOCX-Datei auswählen', parsing: 'DOCX wird gelesen und analysiert…', replaceFile: 'Andere Datei auswählen',
  previewTitle: 'Importvorschau', previewDescription: 'Prüfen Sie die rekonstruierte Struktur, bevor sie als neues OMI-Manuskript geöffnet wird.',
  detectedMetadata: 'Erkannte Metadaten', manuscriptTitle: 'Titel', language: 'Sprache', titleSource: 'Titelquelle',
  sourceCore: 'DOCX-Kerneigenschaften', sourceStyle: 'Word-Titelstil', sourceFilename: 'Dateiname als Ersatz',
  authors: 'Erkannte Autoren', importAuthors: 'Erkannte Autoren importieren',
  importAuthorsHint: 'Creator-/Author-Metadaten in DOCX können mehrdeutig sein. Importierte Namen bleiben editierbar und sind nicht identitätsverifiziert.',
  coreAuthorSource: 'Kernmetadaten', styleAuthorSource: 'Autor-Stil', outline: 'Rekonstruierte Gliederung',
  warnings: 'Zu prüfende Punkte', noWarnings: 'Keine strukturellen Warnungen erkannt.', importButton: 'Als neues OMI-Manuskript öffnen',
  imported: 'Das DOCX-Manuskript wurde geöffnet.',
  confirmReplace: 'Dieses DOCX als neues OMI-Manuskript öffnen? Das derzeit aktive Manuskript verlässt den Ein-Dokument-Arbeitsbereich.',
  currentWorkspaceWarning: 'Der Import erzeugt eine neue Manuskriptidentität und eine neue Wurzelrevision; die Historie des aktuellen Manuskripts wird nicht umgeschrieben.',
  stats: { sections: 'Abschnitte', paragraphs: 'Absätze', lists: 'Listen', notes: 'Anmerkungen', images: 'Bilder', tables: 'Tabellen', equations: 'Gleichungen', citations: 'Zitate', references: 'Literaturdatensätze' },
  warningText: {
    'tracked-deletions': 'Nachverfolgte Löschungen werden nicht importiert; sichtbarer/akzeptierter Text wird bevorzugt.',
    'comments-not-imported': 'Word-Kommentare werden noch nicht in OMI-Review-Annotationen umgewandelt.',
    'text-boxes-flattened': 'Textfeldinhalte können in den Haupttextfluss abgeflacht werden.',
    'conflicting-title-metadata': 'Kernmetadaten und formatierter Dokumenttitel unterscheiden sich; der Kerntitel bleibt erhalten.',
    'merged-table-cells': 'Zusammengeführte Word-Zellen werden in das rechteckige editierbare OMI-Tabellenmodell abgeflacht.',
    'missing-note-body': 'Eine Notenreferenz wurde gefunden, aber ihr Inhalt ist nicht lesbar.',
    'unresolved-word-citation': 'Ein Word-Zitationsfeld konnte keiner eingebetteten Literaturquelle zugeordnet werden.',
    'word-cross-reference-flattened': 'Ein Word-REF/PAGEREF-Feld bleibt als sichtbarer Text erhalten; das semantische OMI-Ziel muss geprüft werden.',
    'inline-equation-promoted': 'Eine Inline-Word-Gleichung wurde in einen separaten editierbaren Gleichungsblock überführt.',
    'title-from-filename': 'Kein expliziter Dokumenttitel gefunden; der Dateiname wird als Manuskripttitel verwendet.',
    'authors-from-docx-metadata': 'Autorennamen wurden aus DOCX-Metadaten abgeleitet und sollten geprüft werden.',
    'headers-footers-not-imported': 'Kopf- und Fußzeilen werden nicht als wissenschaftlicher Manuskriptinhalt importiert.',
  },
};

export function getDocxImportCopy(locale: string): DocxImportCopy {
  const language = locale.toLowerCase().split('-')[0];
  if (language === 'hu') return hu;
  if (language === 'de') return de;
  return en;
}
