export interface HtmlExportCopy {
  title: string;
  description: string;
  standard: string;
  renderingContext: string;
  currentRevision: string;
  preview: string;
  hidePreview: string;
  openPreview: string;
  downloadPackage: string;
  preparingPackage: string;
  exportReady: string;
  exportHasErrors: string;
  errors: string;
  warnings: string;
  diagnostics: string;
  noDiagnostics: string;
  workingPreview: string;
  unsupportedProfile: string;
  accessibilityNote: string;
  packageNote: string;
}

const COPY: Record<'en' | 'hu' | 'de', HtmlExportCopy> = {
  en: {
    title: 'Semantic HTML5',
    description:
      'Render the semantic manuscript through the active Publication Profile as an accessible, script-free HTML5 scholarly article.',
    standard: 'Output profile',
    renderingContext: 'Rendering context',
    currentRevision: 'Manuscript revision',
    preview: 'Preview source',
    hidePreview: 'Hide source',
    openPreview: 'Open rendered preview',
    downloadPackage: 'Download HTML package',
    preparingPackage: 'Preparing package…',
    exportReady: 'The HTML rendering has no blocking diagnostics.',
    exportHasErrors:
      'The HTML can be inspected, but blocking diagnostics must be resolved before a publication package is created.',
    errors: 'errors',
    warnings: 'warnings',
    diagnostics: 'HTML diagnostics',
    noDiagnostics: 'No HTML-specific diagnostics.',
    workingPreview:
      'The preview reflects the current working state. Package download creates a checkpoint first so the output is traceable to a committed revision.',
    unsupportedProfile:
      'The active profile does not declare HTML as a supported output.',
    accessibilityNote:
      'The renderer uses semantic headings, figures, tables, document-note roles, bibliography links and explicit image alt attributes. External accessibility auditing remains a separate publication step.',
    packageNote:
      'The ZIP package contains index.html, a manifest and referenced media assets under relative media/ paths. No script or external stylesheet is required.',
  },
  hu: {
    title: 'Szemantikus HTML5',
    description:
      'A szemantikus kézirat renderelése az aktív publikációs profilon keresztül akadálymentes, szkriptmentes HTML5 tudományos cikké.',
    standard: 'Kimeneti profil',
    renderingContext: 'Renderelési kontextus',
    currentRevision: 'Kéziratrevízió',
    preview: 'Forrás előnézete',
    hidePreview: 'Forrás elrejtése',
    openPreview: 'Renderelt előnézet megnyitása',
    downloadPackage: 'HTML-csomag letöltése',
    preparingPackage: 'Csomag készítése…',
    exportReady: 'A HTML-renderelésben nincs blokkoló diagnosztika.',
    exportHasErrors:
      'A HTML ellenőrizhető, de publikációs csomag készítése előtt a blokkoló hibákat meg kell oldani.',
    errors: 'hiba',
    warnings: 'figyelmeztetés',
    diagnostics: 'HTML diagnosztika',
    noDiagnostics: 'Nincs HTML-specifikus diagnosztika.',
    workingPreview:
      'Az előnézet az aktuális munkapéldányt mutatja. Csomagletöltéskor a Studio előbb checkpointot készít, így a kimenet konkrét committed revízióhoz visszavezethető.',
    unsupportedProfile:
      'Az aktív profil nem jelöli támogatott kimenetként a HTML formátumot.',
    accessibilityNote:
      'A renderer szemantikus címsorokat, ábra- és táblázatszerkezetet, dokumentumjegyzet-szerepeket, bibliográfiai linkeket és explicit kép-alt attribútumokat használ. A külső akadálymentességi audit külön publikációs lépés marad.',
    packageNote:
      'A ZIP-csomag index.html fájlt, manifestet és a hivatkozott médiafájlokat tartalmazza relatív media/ útvonalakon. Nem igényel szkriptet vagy külső stíluslapot.',
  },
  de: {
    title: 'Semantisches HTML5',
    description:
      'Das semantische Manuskript wird über das aktive Publikationsprofil als barrierearmer, skriptfreier wissenschaftlicher HTML5-Artikel gerendert.',
    standard: 'Ausgabeprofil',
    renderingContext: 'Rendering-Kontext',
    currentRevision: 'Manuskriptrevision',
    preview: 'Quelltext anzeigen',
    hidePreview: 'Quelltext ausblenden',
    openPreview: 'Gerenderte Vorschau öffnen',
    downloadPackage: 'HTML-Paket herunterladen',
    preparingPackage: 'Paket wird erstellt…',
    exportReady: 'Das HTML-Rendering enthält keine blockierenden Diagnosen.',
    exportHasErrors:
      'Das HTML kann geprüft werden, blockierende Fehler müssen jedoch vor der Erstellung eines Publikationspakets behoben werden.',
    errors: 'Fehler',
    warnings: 'Warnungen',
    diagnostics: 'HTML-Diagnostik',
    noDiagnostics: 'Keine HTML-spezifischen Diagnosen.',
    workingPreview:
      'Die Vorschau zeigt den aktuellen Arbeitsstand. Vor dem Paketdownload erzeugt Studio einen Checkpoint, damit die Ausgabe auf eine festgeschriebene Revision zurückgeführt werden kann.',
    unsupportedProfile:
      'Das aktive Profil deklariert HTML nicht als unterstütztes Ausgabeformat.',
    accessibilityNote:
      'Der Renderer verwendet semantische Überschriften, Abbildungen, Tabellen, Dokumentnoten-Rollen, Bibliografielinks und explizite Alt-Attribute für Bilder. Eine externe Barrierefreiheitsprüfung bleibt ein separater Publikationsschritt.',
    packageNote:
      'Das ZIP-Paket enthält index.html, ein Manifest und referenzierte Mediendateien unter relativen media/-Pfaden. Skripte oder externe Stylesheets sind nicht erforderlich.',
  },
};

export function getHtmlExportCopy(locale: string): HtmlExportCopy {
  const language = locale.trim().toLowerCase().split('-')[0];
  return language === 'hu' || language === 'de' ? COPY[language] : COPY.en;
}
