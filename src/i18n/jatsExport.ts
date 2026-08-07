export interface JatsExportCopy {
  title: string;
  description: string;
  standard: string;
  renderingContext: string;
  currentRevision: string;
  preview: string;
  hidePreview: string;
  download: string;
  exportReady: string;
  exportHasErrors: string;
  errors: string;
  warnings: string;
  diagnostics: string;
  noDiagnostics: string;
  workingPreview: string;
  unsupportedProfile: string;
  schemaNote: string;
}

const COPY: Record<'en' | 'hu' | 'de', JatsExportCopy> = {
  en: {
    title: 'JATS XML',
    description:
      'Render the semantic manuscript through the active Publication Profile as NISO JATS 1.4 Article Authoring XML.',
    standard: 'Target standard',
    renderingContext: 'Rendering context',
    currentRevision: 'Manuscript revision',
    preview: 'Preview XML',
    hidePreview: 'Hide XML',
    download: 'Download JATS XML',
    exportReady: 'The JATS rendering has no blocking diagnostics.',
    exportHasErrors: 'The XML can be inspected, but blocking diagnostics must be resolved before publication.',
    errors: 'errors',
    warnings: 'warnings',
    diagnostics: 'JATS diagnostics',
    noDiagnostics: 'No JATS-specific diagnostics.',
    workingPreview:
      'The preview reflects the current working state. Download creates a checkpoint first so the exported XML is traceable to a committed revision.',
    unsupportedProfile: 'The active profile does not declare JATS as a supported output.',
    schemaNote:
      'Studio checks required structure, XML identifiers and internal rid targets. Full external JATS DTD/XSD/RNG validation remains a separate conformance step.',
  },
  hu: {
    title: 'JATS XML',
    description:
      'A szemantikus kézirat renderelése az aktív publikációs profilon keresztül NISO JATS 1.4 Article Authoring XML formátumba.',
    standard: 'Célszabvány',
    renderingContext: 'Renderelési kontextus',
    currentRevision: 'Kéziratrevízió',
    preview: 'XML előnézet',
    hidePreview: 'XML elrejtése',
    download: 'JATS XML letöltése',
    exportReady: 'A JATS-renderelésben nincs blokkoló diagnosztika.',
    exportHasErrors:
      'Az XML ellenőrizhető, de a blokkoló hibákat publikálás előtt meg kell oldani.',
    errors: 'hiba',
    warnings: 'figyelmeztetés',
    diagnostics: 'JATS diagnosztika',
    noDiagnostics: 'Nincs JATS-specifikus diagnosztika.',
    workingPreview:
      'Az előnézet az aktuális munkapéldányt mutatja. Letöltéskor a Studio előbb checkpointot készít, így az XML egy konkrét committed revízióhoz visszavezethető.',
    unsupportedProfile: 'Az aktív profil nem jelöli támogatott kimenetként a JATS formátumot.',
    schemaNote:
      'A Studio ellenőrzi a kötelező szerkezetet, az XML-azonosítókat és a belső rid célokat. A teljes külső JATS DTD/XSD/RNG validáció külön megfelelőségi lépés marad.',
  },
  de: {
    title: 'JATS XML',
    description:
      'Das semantische Manuskript wird über das aktive Publikationsprofil als NISO JATS 1.4 Article Authoring XML gerendert.',
    standard: 'Zielstandard',
    renderingContext: 'Rendering-Kontext',
    currentRevision: 'Manuskriptrevision',
    preview: 'XML-Vorschau',
    hidePreview: 'XML ausblenden',
    download: 'JATS XML herunterladen',
    exportReady: 'Das JATS-Rendering enthält keine blockierenden Diagnosen.',
    exportHasErrors:
      'Das XML kann geprüft werden, blockierende Fehler müssen jedoch vor der Publikation behoben werden.',
    errors: 'Fehler',
    warnings: 'Warnungen',
    diagnostics: 'JATS-Diagnostik',
    noDiagnostics: 'Keine JATS-spezifischen Diagnosen.',
    workingPreview:
      'Die Vorschau zeigt den aktuellen Arbeitsstand. Vor dem Download erzeugt Studio einen Checkpoint, damit das XML auf eine festgeschriebene Revision zurückgeführt werden kann.',
    unsupportedProfile: 'Das aktive Profil deklariert JATS nicht als unterstütztes Ausgabeformat.',
    schemaNote:
      'Studio prüft Pflichtstruktur, XML-IDs und interne rid-Ziele. Eine vollständige externe JATS-DTD/XSD/RNG-Validierung bleibt ein separater Konformitätsschritt.',
  },
};

export function getJatsExportCopy(locale: string): JatsExportCopy {
  const language = locale.trim().toLowerCase().split('-')[0];
  return language === 'hu' || language === 'de' ? COPY[language] : COPY.en;
}
