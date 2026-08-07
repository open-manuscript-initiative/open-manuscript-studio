import type {
  OmiPublicationProfileIssueCode,
  OmiPublicationRequirement,
} from '../model/publicationProfile';

export interface PublicationProfileCopy {
  navigation: string;
  title: string;
  description: string;
  experimental: string;
  selectedProfile: string;
  chooseProfile: string;
  applyProfile: string;
  reapplied: string;
  active: string;
  profileVersion: string;
  profilePublisher: string;
  rules: string;
  layout: string;
  sections: string;
  citations: string;
  notes: string;
  objects: string;
  contributors: string;
  accessibility: string;
  outputs: string;
  page: string;
  columns: string;
  typography: string;
  margins: string;
  numbering: string;
  maxDepth: string;
  citationStyle: string;
  notePlacement: string;
  objectNumbering: string;
  figureCaption: string;
  tableCaption: string;
  showOrcid: string;
  showAffiliations: string;
  yes: string;
  no: string;
  above: string;
  below: string;
  document: string;
  section: string;
  footnotes: string;
  endnotes: string;
  interactive: string;
  readiness: string;
  ready: string;
  notReady: string;
  errors: string;
  warnings: string;
  noIssues: string;
  requirements: string;
  requirementLabels: Record<OmiPublicationRequirement, string>;
  issueText: Record<OmiPublicationProfileIssueCode, string>;
  exportProfile: string;
  exportDescription: string;
  profileSeparation: string;
  profileOverrides: string;
  resetDefaults: string;
  profileNames: Record<string, { name: string; description: string }>;
}

const en: PublicationProfileCopy = {
  navigation: 'Publication',
  title: 'Publication profile',
  description: 'Choose the rendering, metadata and accessibility rules for the intended publication target.',
  experimental: 'Studio implementation profile. OMI-SPEC-240 is still Reserved; this does not claim specification conformance.',
  selectedProfile: 'Selected profile',
  chooseProfile: 'Choose a profile',
  applyProfile: 'Apply profile',
  reapplied: 'Profile defaults applied.',
  active: 'Active',
  profileVersion: 'Version',
  profilePublisher: 'Publisher',
  rules: 'Rendering rules',
  layout: 'Layout',
  sections: 'Sections',
  citations: 'Citations',
  notes: 'Notes',
  objects: 'Figures, tables and equations',
  contributors: 'Contributors',
  accessibility: 'Accessibility',
  outputs: 'Output targets',
  page: 'Page',
  columns: 'Columns',
  typography: 'Typography',
  margins: 'Margins',
  numbering: 'Numbering',
  maxDepth: 'Numbered depth',
  citationStyle: 'Citation style',
  notePlacement: 'Note placement',
  objectNumbering: 'Object numbering',
  figureCaption: 'Figure caption',
  tableCaption: 'Table caption',
  showOrcid: 'Show ORCID',
  showAffiliations: 'Show affiliations',
  yes: 'Yes',
  no: 'No',
  above: 'Above',
  below: 'Below',
  document: 'Whole document',
  section: 'Per section',
  footnotes: 'Footnotes',
  endnotes: 'Endnotes',
  interactive: 'Interactive notes',
  readiness: 'Publication readiness',
  ready: 'Ready for profile-based rendering',
  notReady: 'Publication requirements still need attention',
  errors: 'errors',
  warnings: 'warnings',
  noIssues: 'No profile-specific readiness issues were found.',
  requirements: 'Metadata requirements',
  requirementLabels: {
    off: 'Not required',
    recommended: 'Recommended',
    required: 'Required',
  },
  issueText: {
    'missing-title': 'A manuscript title is required.',
    'missing-abstract': 'An abstract is required by this profile.',
    'too-few-keywords': 'The manuscript has fewer keywords than this profile requires.',
    'missing-contributor': 'At least one author contribution is required.',
    'missing-affiliation': 'A contributor has no affiliation.',
    'missing-orcid': 'A contributor has no ORCID identifier.',
    'missing-figure-alt': 'A figure is missing alternative text.',
    'missing-table-header': 'A table has no declared header row.',
    'unresolved-citation': 'A citation points to a missing bibliographic record.',
    'unresolved-cross-reference': 'An internal cross-reference points to a missing target.',
    'profile-override': 'A manuscript presentation preference overrides the selected profile default.',
  },
  exportProfile: 'Export profile JSON',
  exportDescription: 'Save the exact profile definition used for reproducible future rendering.',
  profileSeparation: 'The profile changes presentation and publication requirements, not scholarly content. Profile selection and explicit presentation overrides are revisioned separately from text edits.',
  profileOverrides: 'This manuscript currently contains presentation overrides that differ from the selected profile.',
  resetDefaults: 'Reapply profile defaults',
  profileNames: {
    'omi-generic-scholarly': {
      name: 'OMI Generic Scholarly',
      description: 'Neutral scholarly rendering for general-purpose publishing.',
    },
    'omi-journal-author-date': {
      name: 'OMI Journal — Author-Date',
      description: 'Journal profile with author-date citations and stricter metadata requirements.',
    },
    'omi-humanities-notes': {
      name: 'OMI Humanities — Notes & Bibliography',
      description: 'Humanities profile with Chicago notes, bibliography and footnotes.',
    },
  },
};

const hu: PublicationProfileCopy = {
  ...en,
  navigation: 'Publikáció',
  title: 'Publikációs profil',
  description: 'Válaszd ki a célkiadvány megjelenítési, metaadat- és akadálymentességi szabályait.',
  experimental: 'Studio implementációs profil. Az OMI-SPEC-240 még Reserved állapotú; ez nem jelent specifikációs megfelelőségi állítást.',
  selectedProfile: 'Kiválasztott profil',
  chooseProfile: 'Profil kiválasztása',
  applyProfile: 'Profil alkalmazása',
  reapplied: 'A profil alapértékei alkalmazva.',
  active: 'Aktív',
  profileVersion: 'Verzió',
  profilePublisher: 'Kiadó',
  rules: 'Megjelenítési szabályok',
  layout: 'Oldalkép',
  sections: 'Szakaszok',
  citations: 'Hivatkozások',
  notes: 'Jegyzetek',
  objects: 'Ábrák, táblázatok és egyenletek',
  contributors: 'Szerzők és közreműködők',
  accessibility: 'Akadálymentesség',
  outputs: 'Kimeneti formátumok',
  page: 'Oldal',
  columns: 'Hasábok',
  typography: 'Tipográfia',
  margins: 'Margók',
  numbering: 'Számozás',
  maxDepth: 'Számozott mélység',
  citationStyle: 'Hivatkozási stílus',
  notePlacement: 'Jegyzetek helye',
  objectNumbering: 'Objektumszámozás',
  figureCaption: 'Ábrafelirat',
  tableCaption: 'Táblázatfelirat',
  showOrcid: 'ORCID megjelenítése',
  showAffiliations: 'Affiliációk megjelenítése',
  yes: 'Igen',
  no: 'Nem',
  above: 'Fölötte',
  below: 'Alatta',
  document: 'Teljes dokumentumban',
  section: 'Szakaszonként',
  footnotes: 'Lábjegyzetek',
  endnotes: 'Végjegyzetek',
  interactive: 'Interaktív jegyzetek',
  readiness: 'Publikációs készültség',
  ready: 'Kész a profil szerinti renderelésre',
  notReady: 'Még vannak teljesítendő publikációs követelmények',
  errors: 'hiba',
  warnings: 'figyelmeztetés',
  noIssues: 'Nem találtam profilspecifikus publikációs problémát.',
  requirements: 'Metaadat-követelmények',
  requirementLabels: {
    off: 'Nem követelmény',
    recommended: 'Ajánlott',
    required: 'Kötelező',
  },
  issueText: {
    'missing-title': 'A kézirat címe kötelező.',
    'missing-abstract': 'Ehhez a profilhoz absztrakt szükséges.',
    'too-few-keywords': 'A kézirat kevesebb kulcsszót tartalmaz, mint amennyit a profil előír.',
    'missing-contributor': 'Legalább egy szerzői közreműködés szükséges.',
    'missing-affiliation': 'Egy szerzőnél hiányzik az affiliáció.',
    'missing-orcid': 'Egy szerzőnél hiányzik az ORCID-azonosító.',
    'missing-figure-alt': 'Egy ábránál hiányzik az alternatív szöveg.',
    'missing-table-header': 'Egy táblázatnál nincs fejlécsor megadva.',
    'unresolved-citation': 'Egy idézés hiányzó bibliográfiai rekordra mutat.',
    'unresolved-cross-reference': 'Egy belső kereszthivatkozás hiányzó célobjektumra mutat.',
    'profile-override': 'A kézirat egyik megjelenítési beállítása felülírja a profil alapértékét.',
  },
  exportProfile: 'Profil JSON exportálása',
  exportDescription: 'A reprodukálható későbbi rendereléshez mentsd el a használt profil pontos definícióját.',
  profileSeparation: 'A profil a megjelenítést és a publikációs követelményeket módosítja, nem a tudományos tartalmat. A profilválasztás és az explicit megjelenítési felülírások a szövegszerkesztéstől elkülönülten kerülnek a revíziótörténetbe.',
  profileOverrides: 'A kézirat jelenleg olyan megjelenítési felülírásokat tartalmaz, amelyek eltérnek a kiválasztott profil alapértékeitől.',
  resetDefaults: 'Profil alapértékeinek visszaállítása',
  profileNames: {
    'omi-generic-scholarly': {
      name: 'OMI általános tudományos profil',
      description: 'Semleges tudományos megjelenítés általános publikálási célokra.',
    },
    'omi-journal-author-date': {
      name: 'OMI folyóirat — szerző–év',
      description: 'Folyóiratprofil szerző–év hivatkozásokkal és szigorúbb metaadat-követelményekkel.',
    },
    'omi-humanities-notes': {
      name: 'OMI bölcsészettudomány — jegyzetek és bibliográfia',
      description: 'Bölcsészettudományi profil Chicago jegyzetes hivatkozással, bibliográfiával és lábjegyzetekkel.',
    },
  },
};

const de: PublicationProfileCopy = {
  ...en,
  navigation: 'Publikation',
  title: 'Publikationsprofil',
  description: 'Wählen Sie Darstellungs-, Metadaten- und Barrierefreiheitsregeln für das Publikationsziel.',
  experimental: 'Studio-Implementierungsprofil. OMI-SPEC-240 ist noch reserviert; dies ist keine Konformitätsaussage.',
  selectedProfile: 'Ausgewähltes Profil',
  chooseProfile: 'Profil auswählen',
  applyProfile: 'Profil anwenden',
  reapplied: 'Profilstandards angewendet.',
  active: 'Aktiv',
  profileVersion: 'Version',
  profilePublisher: 'Verlag',
  rules: 'Darstellungsregeln',
  layout: 'Layout',
  sections: 'Abschnitte',
  citations: 'Zitate',
  notes: 'Anmerkungen',
  objects: 'Abbildungen, Tabellen und Gleichungen',
  contributors: 'Mitwirkende',
  accessibility: 'Barrierefreiheit',
  outputs: 'Ausgabeformate',
  page: 'Seite',
  columns: 'Spalten',
  typography: 'Typografie',
  margins: 'Ränder',
  numbering: 'Nummerierung',
  maxDepth: 'Nummerierungstiefe',
  citationStyle: 'Zitierstil',
  notePlacement: 'Anmerkungsplatzierung',
  objectNumbering: 'Objektnummerierung',
  figureCaption: 'Abbildungsbeschriftung',
  tableCaption: 'Tabellenbeschriftung',
  showOrcid: 'ORCID anzeigen',
  showAffiliations: 'Affiliationen anzeigen',
  yes: 'Ja',
  no: 'Nein',
  above: 'Oben',
  below: 'Unten',
  document: 'Gesamtes Dokument',
  section: 'Pro Abschnitt',
  footnotes: 'Fußnoten',
  endnotes: 'Endnoten',
  interactive: 'Interaktive Anmerkungen',
  readiness: 'Publikationsbereitschaft',
  ready: 'Bereit für profilbasiertes Rendering',
  notReady: 'Publikationsanforderungen sind noch zu bearbeiten',
  errors: 'Fehler',
  warnings: 'Warnungen',
  noIssues: 'Keine profilspezifischen Probleme gefunden.',
  requirements: 'Metadatenanforderungen',
  requirementLabels: {
    off: 'Nicht erforderlich',
    recommended: 'Empfohlen',
    required: 'Erforderlich',
  },
  issueText: {
    'missing-title': 'Ein Manuskripttitel ist erforderlich.',
    'missing-abstract': 'Dieses Profil erfordert eine Zusammenfassung.',
    'too-few-keywords': 'Das Manuskript enthält weniger Schlüsselwörter als erforderlich.',
    'missing-contributor': 'Mindestens eine Autorenmitwirkung ist erforderlich.',
    'missing-affiliation': 'Bei einem Autor fehlt die Affiliation.',
    'missing-orcid': 'Bei einem Autor fehlt die ORCID-Kennung.',
    'missing-figure-alt': 'Bei einer Abbildung fehlt der Alternativtext.',
    'missing-table-header': 'Eine Tabelle besitzt keine deklarierte Kopfzeile.',
    'unresolved-citation': 'Ein Zitat verweist auf einen fehlenden bibliografischen Datensatz.',
    'unresolved-cross-reference': 'Ein interner Verweis zeigt auf ein fehlendes Ziel.',
    'profile-override': 'Eine Manuskripteinstellung überschreibt den Standard des ausgewählten Profils.',
  },
  exportProfile: 'Profil-JSON exportieren',
  exportDescription: 'Speichern Sie die genaue Profildefinition für reproduzierbares zukünftiges Rendering.',
  profileSeparation: 'Das Profil ändert Darstellung und Publikationsanforderungen, nicht den wissenschaftlichen Inhalt. Profilwahl und explizite Darstellungsüberschreibungen werden getrennt von Textänderungen versioniert.',
  profileOverrides: 'Dieses Manuskript enthält Darstellungsüberschreibungen, die vom ausgewählten Profil abweichen.',
  resetDefaults: 'Profilstandards erneut anwenden',
  profileNames: {
    'omi-generic-scholarly': {
      name: 'OMI Allgemeines Wissenschaftsprofil',
      description: 'Neutrale wissenschaftliche Darstellung für allgemeine Publikationszwecke.',
    },
    'omi-journal-author-date': {
      name: 'OMI Zeitschrift — Autor–Jahr',
      description: 'Zeitschriftenprofil mit Autor–Jahr-Zitaten und strengeren Metadatenanforderungen.',
    },
    'omi-humanities-notes': {
      name: 'OMI Geisteswissenschaften — Anmerkungen & Bibliografie',
      description: 'Geisteswissenschaftliches Profil mit Chicago-Anmerkungen, Bibliografie und Fußnoten.',
    },
  },
};

export function getPublicationProfileCopy(locale: string): PublicationProfileCopy {
  const language = locale.trim().toLowerCase().split('-')[0];
  if (language === 'hu') return hu;
  if (language === 'de') return de;
  return en;
}
