export interface AssetContainerCopy {
  title: string;
  description: string;
  assets: string;
  embedded: string;
  prepare: string;
  preparing: string;
  prepared: string;
  download: string;
  downloading: string;
  ready: string;
  blocked: string;
  diagnostics: string;
  noDiagnostics: string;
  integrity: string;
  format: string;
  privacyNote: string;
  importTitle: string;
  importDescription: string;
  choosePackage: string;
  inspecting: string;
  importPackage: string;
  importing: string;
  verified: string;
  invalid: string;
  imported: string;
  entries: string;
  revisions: string;
  checksums: string;
  packageAssets: string;
  manuscriptId: string;
  headRevision: string;
  replaceWarning: string;
  confirmImport: string;
}

const COPY: Record<'en' | 'hu' | 'de', AssetContainerCopy> = {
  en: {
    title: 'OMI package',
    description:
      'Externalize binary resources and package the manuscript, history, publication profile, checksums, assets and valid JATS output as a portable .omi container.',
    assets: 'registered assets',
    embedded: 'embedded images awaiting externalization',
    prepare: 'Prepare assets',
    preparing: 'Preparing assets…',
    prepared: 'Embedded image payloads are registered as stable assets.',
    download: 'Download .omi package',
    downloading: 'Building package…',
    ready: 'The container passed Studio integrity checks.',
    blocked: 'The package has blocking integrity errors.',
    diagnostics: 'Container diagnostics',
    noDiagnostics: 'No container-specific diagnostics.',
    integrity: 'SHA-256 integrity',
    format: 'OMI-SPEC-320 / OMI-SPEC-330 Draft package',
    privacyNote:
      'Asset-backed image previews are resolved from the local binary repository. Portable manuscript state no longer needs Base64 preview data after externalization.',
    importTitle: 'Open OMI package',
    importDescription:
      'Inspect an untrusted .omi container, verify its manifest, ZIP structure, revision identities, assets and SHA-256 checksums before loading it.',
    choosePackage: 'Choose .omi package',
    inspecting: 'Verifying package…',
    importPackage: 'Open verified manuscript',
    importing: 'Opening manuscript…',
    verified: 'The package passed integrity verification and can be opened.',
    invalid: 'The package cannot be opened until its blocking integrity errors are resolved.',
    imported: 'The verified OMI manuscript was opened with its original identity and revision history.',
    entries: 'entries',
    revisions: 'revisions',
    checksums: 'checksums verified',
    packageAssets: 'assets',
    manuscriptId: 'Manuscript ID',
    headRevision: 'Head revision',
    replaceWarning:
      'Opening the package replaces the active workspace manuscript. It does not create a new manuscript ID or revision root.',
    confirmImport:
      'Open this verified OMI manuscript and replace the currently active workspace document?',
  },
  hu: {
    title: 'OMI-csomag',
    description:
      'A bináris erőforrások külső assetté alakítása, majd a kézirat, revíziótörténet, publikációs profil, ellenőrzőösszegek, assetek és az érvényes JATS-kimenet hordozható .omi konténerbe csomagolása.',
    assets: 'regisztrált asset',
    embedded: 'külső assetté alakítandó beágyazott kép',
    prepare: 'Assetek előkészítése',
    preparing: 'Assetek előkészítése…',
    prepared: 'A beágyazott képek stabil assetként regisztrálva vannak.',
    download: '.omi csomag letöltése',
    downloading: 'Csomag készítése…',
    ready: 'A konténer átment a Studio integritás-ellenőrzésén.',
    blocked: 'A csomag blokkoló integritási hibákat tartalmaz.',
    diagnostics: 'Konténerdiagnosztika',
    noDiagnostics: 'Nincs konténer-specifikus diagnosztika.',
    integrity: 'SHA-256 integritás',
    format: 'OMI-SPEC-320 / OMI-SPEC-330 Draft csomag',
    privacyNote:
      'Az asset-alapú kép-előnézetet a Studio a helyi bináris tárból oldja fel. Külső assetté alakítás után a hordozható kéziratállapotnak már nincs szüksége Base64-előnézetre.',
    importTitle: 'OMI-csomag megnyitása',
    importDescription:
      'A nem megbízhatónak tekintett .omi konténer ZIP-szerkezetének, manifestjének, revízióazonosítóinak, assetjeinek és SHA-256 ellenőrzőösszegeinek vizsgálata betöltés előtt.',
    choosePackage: '.omi csomag kiválasztása',
    inspecting: 'Csomag ellenőrzése…',
    importPackage: 'Ellenőrzött kézirat megnyitása',
    importing: 'Kézirat megnyitása…',
    verified: 'A csomag átment az integritás-ellenőrzésen és megnyitható.',
    invalid: 'A csomag a blokkoló integritási hibák kijavításáig nem nyitható meg.',
    imported: 'Az ellenőrzött OMI-kézirat az eredeti azonosítóval és revíziótörténettel megnyílt.',
    entries: 'csomagelem',
    revisions: 'revízió',
    checksums: 'ellenőrzött checksum',
    packageAssets: 'asset',
    manuscriptId: 'Kézirat-ID',
    headRevision: 'Aktuális revízió',
    replaceWarning:
      'A csomag megnyitása lecseréli az aktív munkatér kéziratát. Nem hoz létre új kézirat-ID-t vagy új revíziós gyökeret.',
    confirmImport:
      'Megnyitod ezt az ellenőrzött OMI-kéziratot, és lecseréled vele a munkatér jelenlegi dokumentumát?',
  },
  de: {
    title: 'OMI-Paket',
    description:
      'Binäre Ressourcen werden als Assets externalisiert und Manuskript, Versionshistorie, Publikationsprofil, Prüfsummen, Assets sowie gültiges JATS in einen portablen .omi-Container gepackt.',
    assets: 'registrierte Assets',
    embedded: 'eingebettete Bilder zur Externalisierung',
    prepare: 'Assets vorbereiten',
    preparing: 'Assets werden vorbereitet…',
    prepared: 'Eingebettete Bilddaten sind als stabile Assets registriert.',
    download: '.omi-Paket herunterladen',
    downloading: 'Paket wird erstellt…',
    ready: 'Der Container hat die Integritätsprüfungen von Studio bestanden.',
    blocked: 'Das Paket enthält blockierende Integritätsfehler.',
    diagnostics: 'Container-Diagnostik',
    noDiagnostics: 'Keine containerspezifische Diagnostik.',
    integrity: 'SHA-256-Integrität',
    format: 'OMI-SPEC-320 / OMI-SPEC-330 Draft-Paket',
    privacyNote:
      'Asset-basierte Bildvorschauen werden aus dem lokalen Binärspeicher aufgelöst. Nach der Externalisierung benötigt der portable Manuskriptzustand keine Base64-Vorschau mehr.',
    importTitle: 'OMI-Paket öffnen',
    importDescription:
      'Ein nicht vertrauenswürdiger .omi-Container wird vor dem Laden auf ZIP-Struktur, Manifest, Revisionsidentitäten, Assets und SHA-256-Prüfsummen geprüft.',
    choosePackage: '.omi-Paket auswählen',
    inspecting: 'Paket wird geprüft…',
    importPackage: 'Geprüftes Manuskript öffnen',
    importing: 'Manuskript wird geöffnet…',
    verified: 'Das Paket hat die Integritätsprüfung bestanden und kann geöffnet werden.',
    invalid: 'Das Paket kann wegen blockierender Integritätsfehler nicht geöffnet werden.',
    imported: 'Das geprüfte OMI-Manuskript wurde mit seiner ursprünglichen Identität und Versionshistorie geöffnet.',
    entries: 'Einträge',
    revisions: 'Revisionen',
    checksums: 'Prüfsummen verifiziert',
    packageAssets: 'Assets',
    manuscriptId: 'Manuskript-ID',
    headRevision: 'Head-Revision',
    replaceWarning:
      'Das Öffnen ersetzt das aktive Workspace-Manuskript. Es erzeugt weder eine neue Manuskript-ID noch eine neue Revisionswurzel.',
    confirmImport:
      'Dieses geprüfte OMI-Manuskript öffnen und damit das derzeit aktive Workspace-Dokument ersetzen?',
  },
};

export function getAssetContainerCopy(locale: string): AssetContainerCopy {
  const language = locale.trim().toLowerCase().split('-')[0];
  return language === 'hu' || language === 'de' ? COPY[language] : COPY.en;
}
