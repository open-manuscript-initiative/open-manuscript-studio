import type { SupportedLocale } from './types';

export interface ExportFormatCopy {
  title: string;
  description: string;
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
  epub: string;
  epubDescription: string;
  pdf: string;
  pdfDescription: string;
  export: string;
  preparing: string;
  failed: string;
  pdfHint: string;
}

const copy: Record<SupportedLocale, ExportFormatCopy> = {
  hu: {
    title: 'Exportálható formátumok',
    description: 'A kézirat ugyanabból a szemantikus OMI modellből több hordozható és publikációs formátumba exportálható.',
    portable: 'Hordozható OMI formátumok',
    publication: 'Publikációs formátumok',
    omi: 'OMI konténer',
    omiDescription: 'Teljes hordozható csomag: kézirat, revíziótörténet, metaadatok, publikációs profil, JATS/HTML és eszközök.',
    omiJson: 'OMI JSON',
    omiJsonDescription: 'A kanonikus, ember és gép által olvasható OMI kéziratmodell JSON reprezentációja.',
    jats: 'JATS XML 1.4',
    jatsDescription: 'NISO JATS Article Authoring XML folyóirati és kiadói munkafolyamatokhoz.',
    html: 'Szemantikus HTML5',
    htmlDescription: 'Önálló, script nélküli akadálymentes HTML publikációs nézet.',
    docx: 'Microsoft Word (DOCX)',
    docxDescription: 'Szerkeszthető Word-dokumentum valódi címsorstílusokkal és a kézirat fő szerkezetével.',
    idml: 'Adobe InDesign (IDML)',
    idmlDescription: 'Szerkeszthető InDesign Markup Language csomag OMI bekezdésstílusokkal, fejezet-hierarchiával és kiadói tördeléshez alkalmas szövegstruktúrával.',
    epub: 'EPUB 3',
    epubDescription: 'Hordozható e-könyv kiadvány EPUB 3 csomagként.',
    pdf: 'PDF',
    pdfDescription: 'A publikációs profil alapján formázott nyomtatási nézet; a böngészőben PDF-ként menthető.',
    export: 'Exportálás',
    preparing: 'Előkészítés…',
    failed: 'Az export nem sikerült.',
    pdfHint: 'A megnyíló nyomtatási ablakban válassza a Mentés PDF-ként lehetőséget.'
  },
  en: {
    title: 'Export formats',
    description: 'Export the manuscript from the same semantic OMI model into portable and publication formats.',
    portable: 'Portable OMI formats',
    publication: 'Publication formats',
    omi: 'OMI container',
    omiDescription: 'Complete portable package containing manuscript state, history, metadata, publication profile, JATS/HTML and assets.',
    omiJson: 'OMI JSON',
    omiJsonDescription: 'Canonical human- and machine-readable JSON representation of the OMI manuscript model.',
    jats: 'JATS XML 1.4',
    jatsDescription: 'NISO JATS Article Authoring XML for journal and publisher workflows.',
    html: 'Semantic HTML5',
    htmlDescription: 'Standalone, script-free accessible HTML publication view.',
    docx: 'Microsoft Word (DOCX)',
    docxDescription: 'Editable Word document with real heading styles and the core manuscript structure.',
    idml: 'Adobe InDesign (IDML)',
    idmlDescription: 'Editable InDesign Markup Language package with OMI paragraph styles, section hierarchy and publisher-oriented text structure.',
    epub: 'EPUB 3',
    epubDescription: 'Portable EPUB 3 ebook publication package.',
    pdf: 'PDF',
    pdfDescription: 'Publication-profile print view that can be saved as PDF in the browser.',
    export: 'Export',
    preparing: 'Preparing…',
    failed: 'Export failed.',
    pdfHint: 'Choose Save as PDF in the print dialog that opens.'
  },
  de: {
    title: 'Exportformate',
    description: 'Exportieren Sie das Manuskript aus demselben semantischen OMI-Modell in portable und Publikationsformate.',
    portable: 'Portable OMI-Formate',
    publication: 'Publikationsformate',
    omi: 'OMI-Container',
    omiDescription: 'Vollständiges portables Paket mit Manuskript, Verlauf, Metadaten, Publikationsprofil, JATS/HTML und Assets.',
    omiJson: 'OMI JSON',
    omiJsonDescription: 'Kanonische, menschen- und maschinenlesbare JSON-Repräsentation des OMI-Manuskriptmodells.',
    jats: 'JATS XML 1.4',
    jatsDescription: 'NISO JATS Article Authoring XML für Zeitschriften- und Verlagsworkflows.',
    html: 'Semantisches HTML5',
    htmlDescription: 'Eigenständige, skriptfreie und barrierearme HTML-Publikationsansicht.',
    docx: 'Microsoft Word (DOCX)',
    docxDescription: 'Bearbeitbares Word-Dokument mit echten Überschriftenformatvorlagen und Manuskriptstruktur.',
    idml: 'Adobe InDesign (IDML)',
    idmlDescription: 'Bearbeitbares InDesign-Markup-Language-Paket mit OMI-Absatzformaten, Abschnittshierarchie und verlagsorientierter Textstruktur.',
    epub: 'EPUB 3',
    epubDescription: 'Portables E-Book als EPUB-3-Paket.',
    pdf: 'PDF',
    pdfDescription: 'Druckansicht nach Publikationsprofil, die im Browser als PDF gespeichert werden kann.',
    export: 'Exportieren',
    preparing: 'Wird vorbereitet…',
    failed: 'Export fehlgeschlagen.',
    pdfHint: 'Wählen Sie im geöffneten Druckdialog Als PDF speichern.'
  }
};

export function getExportFormatCopy(locale: SupportedLocale): ExportFormatCopy {
  return copy[locale];
}
