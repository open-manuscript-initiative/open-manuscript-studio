import type { SupportedLocale } from './types';

export interface ExportFormatCopy {
  title: string;
  description: string;
  format: string;
  chooseFormat: string;
  portable: string;
  publication: string;
  omi: string;
  omiDescription: string;
  omiJson: string;
  omiJsonDescription: string;
  jats: string;
  jatsDescription: string;
  html: string;
  htmlDescription: string;
  docx: string;
  docxDescription: string;
  idml: string;
  idmlDescription: string;
  xtg: string;
  xtgDescription: string;
  mif: string;
  mifDescription: string;
  sla: string;
  slaDescription: string;
  latex: string;
  latexDescription: string;
  epub: string;
  epubDescription: string;
  pdf: string;
  pdfDescription: string;
  export: string;
  preparing: string;
  saved: string;
  cancelled: string;
  failed: string;
  pdfHint: string;
}

const copy: Record<SupportedLocale, ExportFormatCopy> = {
  hu: {
    title: 'Exportálás',
    description: 'Válassza ki a kívánt hordozható vagy publikációs formátumot, majd indítsa el az exportálást. A telepített alkalmazás natív fájlmentést használ.',
    format: 'Exportálási formátum',
    chooseFormat: 'Válasszon formátumot…',
    portable: 'Hordozható OMI formátumok',
    publication: 'Publikációs formátumok',
    omi: 'OMI konténer',
    omiDescription: 'Teljes hordozható csomag: kézirat, revíziótörténet, metaadatok, publikációs profil, JATS/HTML és eszközök.',
    omiJson: 'OMI JSON',
    omiJsonDescription: 'A kanonikus, ember és gép által olvasható OMI kéziratmodell JSON reprezentációja.',
    jats: 'JATS XML 1.4',
    jatsDescription: 'NISO JATS Article Authoring XML folyóirati és kiadói munkafolyamatokhoz.',
    html: 'Szemantikus HTML5 csomag',
    htmlDescription: 'Offline használható ZIP-csomag index.html fájllal, manifeszttel és az ellenőrzött kézirateszközökkel.',
    docx: 'Microsoft Word (DOCX)',
    docxDescription: 'Szerkeszthető Word-dokumentum valódi címsorstílusokkal és a kézirat fő szerkezetével.',
    idml: 'Adobe InDesign (IDML)',
    idmlDescription: 'Szerkeszthető InDesign Markup Language csomag OMI bekezdésstílusokkal, fejezet-hierarchiával és kiadói tördeléshez alkalmas szövegstruktúrával.',
    xtg: 'QuarkXPress (XPress Tags)',
    xtgDescription: 'UTF-8 XPress Tags fájl QuarkXPress-importhoz, OMI cím- és bekezdésstílusokkal.',
    mif: 'Adobe FrameMaker (MIF)',
    mifDescription: 'Szerkeszthető Maker Interchange Format dokumentum FrameMaker munkafolyamatokhoz.',
    sla: 'Scribus (SLA)',
    slaDescription: 'Szerkeszthető Scribus dokumentum OMI bekezdésstílusokkal és folyamatos szövegkerettel.',
    latex: 'LaTeX',
    latexDescription: 'UTF-8 LaTeX forrás tudományos és automatizált TeX-alapú kiadói munkafolyamatokhoz.',
    epub: 'EPUB 3',
    epubDescription: 'Hordozható e-könyv kiadvány EPUB 3 csomagként.',
    pdf: 'PDF',
    pdfDescription: 'A publikációs profil alapján formázott nyomtatási nézet; PDF-ként a rendszer nyomtatási párbeszédablakából menthető.',
    export: 'Exportálás',
    preparing: 'Előkészítés…',
    saved: 'Az export elkészült.',
    cancelled: 'A fájl mentése megszakítva.',
    failed: 'Az export nem sikerült.',
    pdfHint: 'A megnyíló nyomtatási ablakban válassza a Mentés PDF-ként lehetőséget.',
  },
  en: {
    title: 'Export',
    description: 'Choose a portable or publication format, then start the export. Installed apps use the native file save dialog.',
    format: 'Export format',
    chooseFormat: 'Choose a format…',
    portable: 'Portable OMI formats',
    publication: 'Publication formats',
    omi: 'OMI container',
    omiDescription: 'Complete portable package containing manuscript state, history, metadata, publication profile, JATS/HTML and assets.',
    omiJson: 'OMI JSON',
    omiJsonDescription: 'Canonical human- and machine-readable JSON representation of the OMI manuscript model.',
    jats: 'JATS XML 1.4',
    jatsDescription: 'NISO JATS Article Authoring XML for journal and publisher workflows.',
    html: 'Semantic HTML5 package',
    htmlDescription: 'Offline ZIP package containing index.html, a manifest and verified manuscript assets.',
    docx: 'Microsoft Word (DOCX)',
    docxDescription: 'Editable Word document with real heading styles and the core manuscript structure.',
    idml: 'Adobe InDesign (IDML)',
    idmlDescription: 'Editable InDesign Markup Language package with OMI paragraph styles, section hierarchy and publisher-oriented text structure.',
    xtg: 'QuarkXPress (XPress Tags)',
    xtgDescription: 'UTF-8 XPress Tags file for QuarkXPress import with OMI paragraph and heading styles.',
    mif: 'Adobe FrameMaker (MIF)',
    mifDescription: 'Editable Maker Interchange Format document for FrameMaker workflows.',
    sla: 'Scribus (SLA)',
    slaDescription: 'Editable Scribus document with OMI paragraph styles and a continuous text frame.',
    latex: 'LaTeX',
    latexDescription: 'UTF-8 LaTeX source for scientific and automated TeX-based publishing workflows.',
    epub: 'EPUB 3',
    epubDescription: 'Portable EPUB 3 ebook publication package.',
    pdf: 'PDF',
    pdfDescription: 'Publication-profile print view that can be saved as PDF from the system print dialog.',
    export: 'Export',
    preparing: 'Preparing…',
    saved: 'Export completed.',
    cancelled: 'File save cancelled.',
    failed: 'Export failed.',
    pdfHint: 'Choose Save as PDF in the print dialog that opens.',
  },
  de: {
    title: 'Export',
    description: 'Wählen Sie ein portables oder Publikationsformat und starten Sie anschließend den Export. Installierte Apps verwenden den nativen Dateidialog.',
    format: 'Exportformat',
    chooseFormat: 'Format auswählen…',
    portable: 'Portable OMI-Formate',
    publication: 'Publikationsformate',
    omi: 'OMI-Container',
    omiDescription: 'Vollständiges portables Paket mit Manuskript, Verlauf, Metadaten, Publikationsprofil, JATS/HTML und Assets.',
    omiJson: 'OMI JSON',
    omiJsonDescription: 'Kanonische, menschen- und maschinenlesbare JSON-Repräsentation des OMI-Manuskriptmodells.',
    jats: 'JATS XML 1.4',
    jatsDescription: 'NISO JATS Article Authoring XML für Zeitschriften- und Verlagsworkflows.',
    html: 'Semantisches HTML5-Paket',
    htmlDescription: 'Offline nutzbares ZIP-Paket mit index.html, Manifest und geprüften Manuskript-Assets.',
    docx: 'Microsoft Word (DOCX)',
    docxDescription: 'Bearbeitbares Word-Dokument mit echten Überschriftenformatvorlagen und Manuskriptstruktur.',
    idml: 'Adobe InDesign (IDML)',
    idmlDescription: 'Bearbeitbares InDesign-Markup-Language-Paket mit OMI-Absatzformaten, Abschnittshierarchie und verlagsorientierter Textstruktur.',
    xtg: 'QuarkXPress (XPress Tags)',
    xtgDescription: 'UTF-8-XPress-Tags-Datei für den QuarkXPress-Import mit OMI-Absatz- und Überschriftenstilen.',
    mif: 'Adobe FrameMaker (MIF)',
    mifDescription: 'Bearbeitbares Maker-Interchange-Format-Dokument für FrameMaker-Workflows.',
    sla: 'Scribus (SLA)',
    slaDescription: 'Bearbeitbares Scribus-Dokument mit OMI-Absatzstilen und fortlaufendem Textrahmen.',
    latex: 'LaTeX',
    latexDescription: 'UTF-8-LaTeX-Quelle für wissenschaftliche und automatisierte TeX-Publikationsworkflows.',
    epub: 'EPUB 3',
    epubDescription: 'Portables E-Book als EPUB-3-Paket.',
    pdf: 'PDF',
    pdfDescription: 'Druckansicht nach Publikationsprofil, die über den Systemdruckdialog als PDF gespeichert werden kann.',
    export: 'Exportieren',
    preparing: 'Wird vorbereitet…',
    saved: 'Export abgeschlossen.',
    cancelled: 'Dateispeichern abgebrochen.',
    failed: 'Export fehlgeschlagen.',
    pdfHint: 'Wählen Sie im geöffneten Druckdialog Als PDF speichern.',
  },
};

export function getExportFormatCopy(locale: SupportedLocale): ExportFormatCopy {
  return copy[locale] ?? copy.en;
}
