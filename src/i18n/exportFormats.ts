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
  pdfContent: string;
  pdfPublication: string;
  pdfPublicationDescription: string;
  pdfEditorial: string;
  pdfEditorialDescription: string;
  pdfMode: string;
  pdfPrint: string;
  pdfPrintDescription: string;
  pdfInteractive: string;
  pdfInteractiveDescription: string;
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
    pdfDescription: 'PDF-kimenet tördelt kiadványból vagy semleges szerkesztői nézetből, nyomtatott vagy interaktív változatban.',
    pdfContent: 'Nyomtatási nézet',
    pdfPublication: 'Tördelt kiadvány',
    pdfPublicationDescription: 'A publikációs profil teljes tipográfiájával, oldalméretével, margóival és kiadói tördelési szabályaival készül.',
    pdfEditorial: 'Nyers / szerkesztői',
    pdfEditorialDescription: 'A kézirat szerkezetét, jegyzeteit és hivatkozásait megtartó semleges nyomat, kiadói tipográfia és végleges oldaltördelés nélkül.',
    pdfMode: 'PDF változat',
    pdfPrint: 'Nyomtatott PDF',
    pdfPrintDescription: 'Nyomtatásra és archiválásra optimalizált változat aktív hiperhivatkozások nélkül.',
    pdfInteractive: 'Interaktív PDF',
    pdfInteractiveDescription: 'Megőrzi a belső és külső hiperhivatkozásokat, így a hivatkozások, jegyzetek, ORCID/ROR és webes linkek a PDF-ben kattinthatók maradnak.',
    export: 'Exportálás',
    preparing: 'Előkészítés…',
    saved: 'Az export elkészült.',
    cancelled: 'A fájl mentése megszakítva.',
    failed: 'Az export nem sikerült.',
    pdfHint: 'A megnyíló nyomtatási ablakban közvetlenül nyomtathat, vagy választhatja a Mentés PDF-ként lehetőséget.',
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
    pdfDescription: 'PDF output from either the typeset publication or a neutral editorial view, as a print or interactive variant.',
    pdfContent: 'Print view',
    pdfPublication: 'Typeset publication',
    pdfPublicationDescription: 'Uses the publication profile typography, page size, margins and publisher layout rules.',
    pdfEditorial: 'Editorial / manuscript',
    pdfEditorialDescription: 'A neutral manuscript print that keeps structure, notes and references without publisher typography or final pagination.',
    pdfMode: 'PDF variant',
    pdfPrint: 'Print PDF',
    pdfPrintDescription: 'Print- and archive-oriented output without active hyperlinks.',
    pdfInteractive: 'Interactive PDF',
    pdfInteractiveDescription: 'Keeps internal and external hyperlinks so citations, notes, ORCID/ROR identifiers and web links remain clickable in the PDF.',
    export: 'Export',
    preparing: 'Preparing…',
    saved: 'Export completed.',
    cancelled: 'File save cancelled.',
    failed: 'Export failed.',
    pdfHint: 'Print directly in the dialog that opens, or choose Save as PDF.',
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
    pdfDescription: 'PDF-Ausgabe entweder aus der gesetzten Publikation oder einer neutralen redaktionellen Ansicht, als Druck- oder interaktive Variante.',
    pdfContent: 'Druckansicht',
    pdfPublication: 'Gesetzte Publikation',
    pdfPublicationDescription: 'Verwendet Typografie, Seitengröße, Ränder und Satzregeln des Publikationsprofils.',
    pdfEditorial: 'Redaktionell / Manuskript',
    pdfEditorialDescription: 'Neutraler Manuskriptausdruck mit Struktur, Anmerkungen und Literaturangaben, jedoch ohne Verlagstypografie oder endgültigen Satz.',
    pdfMode: 'PDF-Variante',
    pdfPrint: 'Druck-PDF',
    pdfPrintDescription: 'Für Druck und Archivierung optimierte Ausgabe ohne aktive Hyperlinks.',
    pdfInteractive: 'Interaktives PDF',
    pdfInteractiveDescription: 'Behält interne und externe Hyperlinks bei, sodass Zitate, Anmerkungen, ORCID/ROR-Kennungen und Weblinks im PDF anklickbar bleiben.',
    export: 'Exportieren',
    preparing: 'Wird vorbereitet…',
    saved: 'Export abgeschlossen.',
    cancelled: 'Dateispeichern abgebrochen.',
    failed: 'Export fehlgeschlagen.',
    pdfHint: 'Drucken Sie direkt im geöffneten Dialog oder wählen Sie Als PDF speichern.',
  },
};

export function getExportFormatCopy(locale: SupportedLocale): ExportFormatCopy {
  return copy[locale] ?? copy.en;
}
