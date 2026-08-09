export interface VisualElementsCopy {
  insertMenu: string;
  insertElement: string;
  image: string;
  table: string;
  chart: string;
  equation: string;
  import: string;
  paste: string;
  pasteHint: string;
  importing: string;
  importFailed: string;
  noImportableElements: string;
  chooseFile: string;
  caption: string;
  altText: string;
  chartType: string;
  chartBar: string;
  chartLine: string;
  chartPie: string;
  chartScatter: string;
  chartTitle: string;
  equationLatex: string;
  equationLabel: string;
  addRow: string;
  addColumn: string;
  removeRow: string;
  removeColumn: string;
  createChart: string;
  deleteElement: string;
  confirmDelete: string;
  source: string;
  emptyChart: string;
  importedFrom: string;
  fileFormats: string;
}

const COPY: Record<'en' | 'hu' | 'de', VisualElementsCopy> = {
  en: {
    insertMenu: 'Insert', insertElement: 'Insert element', image: 'Image', table: 'Table', chart: 'Chart', equation: 'Equation', import: 'Import',
    paste: 'Paste from Word / Excel', pasteHint: 'Paste a table, image or equation here from Word, Excel or another application.',
    importing: 'Importing…', importFailed: 'The file could not be imported.', noImportableElements: 'No supported visual elements were found.',
    chooseFile: 'Choose file', caption: 'Caption', altText: 'Alternative text', chartType: 'Chart type', chartBar: 'Bar', chartLine: 'Line',
    chartPie: 'Pie', chartScatter: 'Scatter', chartTitle: 'Chart title', equationLatex: 'LaTeX source', equationLabel: 'Equation label',
    addRow: 'Add row', addColumn: 'Add column', removeRow: 'Remove last row', removeColumn: 'Remove last column', createChart: 'Create chart from table',
    deleteElement: 'Delete element', confirmDelete: 'Delete this element from the manuscript?', source: 'Source data', emptyChart: 'Add numeric source data to render the chart.',
    importedFrom: 'Imported from', fileFormats: 'Images, DOCX, XLSX, CSV/TSV, HTML and TeX are supported.',
  },
  hu: {
    insertMenu: 'Beszúrás', insertElement: 'Elem beszúrása', image: 'Kép', table: 'Táblázat', chart: 'Grafikon', equation: 'Egyenlet', import: 'Importálás',
    paste: 'Beillesztés Wordből / Excelből', pasteHint: 'Illesszen be ide táblázatot, képet vagy egyenletet Wordből, Excelből vagy más alkalmazásból.',
    importing: 'Importálás…', importFailed: 'A fájlt nem sikerült importálni.', noImportableElements: 'Nem található támogatott vizuális elem.',
    chooseFile: 'Fájl kiválasztása', caption: 'Képaláírás / felirat', altText: 'Alternatív szöveg', chartType: 'Grafikon típusa', chartBar: 'Oszlop', chartLine: 'Vonal',
    chartPie: 'Kör', chartScatter: 'Pont', chartTitle: 'Grafikon címe', equationLatex: 'LaTeX-forrás', equationLabel: 'Egyenlet jelölése',
    addRow: 'Sor hozzáadása', addColumn: 'Oszlop hozzáadása', removeRow: 'Utolsó sor törlése', removeColumn: 'Utolsó oszlop törlése', createChart: 'Grafikon készítése a táblázatból',
    deleteElement: 'Elem törlése', confirmDelete: 'Törli ezt az elemet a kéziratból?', source: 'Forrásadatok', emptyChart: 'Adjon meg numerikus forrásadatokat a grafikon megjelenítéséhez.',
    importedFrom: 'Importálva innen', fileFormats: 'Támogatott: képek, DOCX, XLSX, CSV/TSV, HTML és TeX.',
  },
  de: {
    insertMenu: 'Einfügen', insertElement: 'Element einfügen', image: 'Bild', table: 'Tabelle', chart: 'Diagramm', equation: 'Gleichung', import: 'Importieren',
    paste: 'Aus Word / Excel einfügen', pasteHint: 'Fügen Sie hier eine Tabelle, ein Bild oder eine Gleichung aus Word, Excel oder einer anderen Anwendung ein.',
    importing: 'Importieren…', importFailed: 'Die Datei konnte nicht importiert werden.', noImportableElements: 'Keine unterstützten visuellen Elemente gefunden.',
    chooseFile: 'Datei auswählen', caption: 'Beschriftung', altText: 'Alternativtext', chartType: 'Diagrammtyp', chartBar: 'Balken', chartLine: 'Linie',
    chartPie: 'Kreis', chartScatter: 'Streuung', chartTitle: 'Diagrammtitel', equationLatex: 'LaTeX-Quelle', equationLabel: 'Gleichungsbezeichnung',
    addRow: 'Zeile hinzufügen', addColumn: 'Spalte hinzufügen', removeRow: 'Letzte Zeile entfernen', removeColumn: 'Letzte Spalte entfernen', createChart: 'Diagramm aus Tabelle erstellen',
    deleteElement: 'Element löschen', confirmDelete: 'Dieses Element aus dem Manuskript löschen?', source: 'Quelldaten', emptyChart: 'Fügen Sie numerische Quelldaten hinzu, um das Diagramm darzustellen.',
    importedFrom: 'Importiert aus', fileFormats: 'Unterstützt werden Bilder, DOCX, XLSX, CSV/TSV, HTML und TeX.',
  },
};

export function getVisualElementsCopy(locale: string): VisualElementsCopy {
  const language = locale.toLowerCase().split('-')[0];
  return COPY[language === 'hu' || language === 'de' ? language : 'en'];
}
