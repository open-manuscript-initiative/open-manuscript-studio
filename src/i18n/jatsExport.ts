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
  jats4rValidation: string;
  jats4rValid: string;
  jats4rValidWithWarnings: string;
  jats4rInvalid: string;
  jats4rDiagnostics: string;
  jats4rNote: string;
  schemaValidation: string;
  validateSchema: string;
  validatingSchema: string;
  schemaValid: string;
  schemaInvalid: string;
  schemaNotChecked: string;
  schemaUnavailable: string;
  schemaDiagnostics: string;
  line: string;
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
    download: 'Download validated JATS XML',
    exportReady: 'The JATS rendering has no blocking diagnostics.',
    exportHasErrors: 'The XML can be inspected, but blocking diagnostics must be resolved before publication.',
    errors: 'errors',
    warnings: 'warnings',
    diagnostics: 'JATS diagnostics',
    noDiagnostics: 'No JATS-specific diagnostics.',
    workingPreview:
      'The preview reflects the current working state. Download creates a checkpoint and validates the committed XML before saving it.',
    unsupportedProfile: 'The active profile does not declare JATS as a supported output.',
    jats4rValidation: 'JATS4R profile',
    jats4rValid: 'Pass',
    jats4rValidWithWarnings: 'Pass with warnings',
    jats4rInvalid: 'Blocking errors',
    jats4rDiagnostics: 'JATS4R profile diagnostics',
    jats4rNote:
      'Studio evaluates the JATS4R best-practice subset relevant to its Article Authoring output offline. The rules are traced to JATS4R/jats-schematrons v0.0.17; this does not claim to replace the complete official JATS4R validator.',
    schemaValidation: 'JATS 1.4 DTD',
    validateSchema: 'Validate JATS 1.4 DTD',
    validatingSchema: 'Validating…',
    schemaValid: 'Valid · Article Authoring MathML 3',
    schemaInvalid: 'Invalid · resolve DTD errors before export',
    schemaNotChecked: 'Not checked for this working state',
    schemaUnavailable: 'Full JATS schema validation is unavailable.',
    schemaDiagnostics: 'JATS 1.4 DTD diagnostics',
    line: 'line',
    schemaNote:
      'Full validation uses the pinned NISO JATS 1.4 Article Authoring MathML 3 DTD locally on the Studio server with network access disabled.',
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
    download: 'Validált JATS XML letöltése',
    exportReady: 'A JATS-renderelésben nincs blokkoló diagnosztika.',
    exportHasErrors:
      'Az XML ellenőrizhető, de a blokkoló hibákat publikálás előtt meg kell oldani.',
    errors: 'hiba',
    warnings: 'figyelmeztetés',
    diagnostics: 'JATS diagnosztika',
    noDiagnostics: 'Nincs JATS-specifikus diagnosztika.',
    workingPreview:
      'Az előnézet az aktuális munkapéldányt mutatja. Letöltéskor a Stúdió checkpointot készít, majd mentés előtt a committed XML teljes DTD-validációját is lefuttatja.',
    unsupportedProfile: 'Az aktív profil nem jelöli támogatott kimenetként a JATS formátumot.',
    jats4rValidation: 'JATS4R profil',
    jats4rValid: 'Megfelel',
    jats4rValidWithWarnings: 'Megfelel figyelmeztetésekkel',
    jats4rInvalid: 'Blokkoló hibák',
    jats4rDiagnostics: 'JATS4R profil diagnosztika',
    jats4rNote:
      'A Studio helyben, hálózati továbbítás nélkül ellenőrzi a JATS4R ajánlásoknak az Article Authoring kimenetére releváns részhalmazát. A szabályok a JATS4R/jats-schematrons v0.0.17 verziójához vannak kötve; ez nem állítja, hogy kiváltja a teljes hivatalos JATS4R validátort.',
    schemaValidation: 'JATS 1.4 DTD',
    validateSchema: 'JATS 1.4 DTD ellenőrzése',
    validatingSchema: 'Validálás…',
    schemaValid: 'Érvényes · Article Authoring MathML 3',
    schemaInvalid: 'Érvénytelen · export előtt javítani kell',
    schemaNotChecked: 'Ehhez a munkapéldányhoz még nincs ellenőrizve',
    schemaUnavailable: 'A teljes JATS séma-validáció nem érhető el.',
    schemaDiagnostics: 'JATS 1.4 DTD diagnosztika',
    line: 'sor',
    schemaNote:
      'A teljes ellenőrzés a pinnelt NISO JATS 1.4 Article Authoring MathML 3 DTD-t használja helyben a Studio szerverén, letiltott hálózati hozzáféréssel.',
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
    download: 'Validiertes JATS XML herunterladen',
    exportReady: 'Das JATS-Rendering enthält keine blockierenden Diagnosen.',
    exportHasErrors:
      'Das XML kann geprüft werden, blockierende Fehler müssen jedoch vor der Publikation behoben werden.',
    errors: 'Fehler',
    warnings: 'Warnungen',
    diagnostics: 'JATS-Diagnostik',
    noDiagnostics: 'Keine JATS-spezifischen Diagnosen.',
    workingPreview:
      'Die Vorschau zeigt den aktuellen Arbeitsstand. Beim Download erzeugt Studio einen Checkpoint und validiert das festgeschriebene XML vor dem Speichern vollständig gegen die DTD.',
    unsupportedProfile: 'Das aktive Profil deklariert JATS nicht als unterstütztes Ausgabeformat.',
    jats4rValidation: 'JATS4R-Profil',
    jats4rValid: 'Bestanden',
    jats4rValidWithWarnings: 'Bestanden mit Warnungen',
    jats4rInvalid: 'Blockierende Fehler',
    jats4rDiagnostics: 'JATS4R-Profil-Diagnostik',
    jats4rNote:
      'Studio prüft offline den für die Article-Authoring-Ausgabe relevanten Teil der JATS4R-Empfehlungen. Die Regeln sind auf JATS4R/jats-schematrons v0.0.17 zurückgeführt; dies ersetzt nicht den vollständigen offiziellen JATS4R-Validator.',
    schemaValidation: 'JATS 1.4 DTD',
    validateSchema: 'JATS-1.4-DTD validieren',
    validatingSchema: 'Validierung…',
    schemaValid: 'Gültig · Article Authoring MathML 3',
    schemaInvalid: 'Ungültig · DTD-Fehler vor Export beheben',
    schemaNotChecked: 'Für diesen Arbeitsstand noch nicht geprüft',
    schemaUnavailable: 'Die vollständige JATS-Schemavalidierung ist nicht verfügbar.',
    schemaDiagnostics: 'JATS-1.4-DTD-Diagnostik',
    line: 'Zeile',
    schemaNote:
      'Die vollständige Prüfung verwendet die gepinnte NISO JATS 1.4 Article Authoring MathML 3 DTD lokal auf dem Studio-Server bei deaktiviertem Netzwerkzugriff.',
  },
};

export function getJatsExportCopy(locale: string): JatsExportCopy {
  const language = locale.trim().toLowerCase().split('-')[0];
  return language === 'hu' || language === 'de' ? COPY[language] : COPY.en;
}
