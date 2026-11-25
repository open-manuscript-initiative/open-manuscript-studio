import { applyReturnedSupplementalOverlay } from './returnedTranslationOverlay';
export interface VisualElementsCopy {
  insertMenu: string;
  insertElement: string;
  image: string;
  textBox: string;
  table: string;
  chart: string;
  equation: string;
  musicScore: string;
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
  chartHorizontal: string;
  chartStacked: string;
  chartStacked100: string;
  chartArea: string;
  chartDonut: string;
  chartRadar: string;
  chartStyle: string;
  chartStyleColor: string;
  chartStyleEditorial: string;
  chartStyleMonochrome: string;
  chartStyleContrast: string;
  chartShowGrid: string;
  chartShowLegend: string;
  chartShowValues: string;
  chartTitle: string;
  equationLatex: string;
  equationLabel: string;
  cellFormatting: string;
  cellRow: string;
  cellColumn: string;
  textRotation: string;
  rotationNone: string;
  rotationClockwise: string;
  rotationCounterclockwise: string;
  rotationUpsideDown: string;
  textDirection: string;
  directionAuto: string;
  directionLtr: string;
  directionRtl: string;
  editCellText: string;
  mobilePreviewNote: string;
  tableFontSize: string;
  tableHeaderRows: string;
  mergeRight: string;
  mergeDown: string;
  splitCell: string;
  mergeHint: string;
  bodyFontSize: string;
  smallerFontSize: string;
  resizeColumn: string;
  cell: string;
  addRow: string;
  addColumn: string;
  removeRow: string;
  removeColumn: string;
  createChart: string;
  tableToText: string;
  confirmTableToText: string;
  deleteElement: string;
  confirmDelete: string;
  source: string;
  emptyChart: string;
  importedFrom: string;
  fileFormats: string;
}

const COPY: Record<'en' | 'hu' | 'de', VisualElementsCopy> = {
  en: {
    cellFormatting: 'Cell formatting', cellRow: 'Cell row', cellColumn: 'Cell column', textRotation: 'Text rotation', rotationNone: 'No rotation', rotationClockwise: '90° clockwise', rotationCounterclockwise: '90° counterclockwise', rotationUpsideDown: '180° upside down', textDirection: 'Writing direction', directionAuto: 'Automatic', directionLtr: 'Left to right', directionRtl: 'Right to left', editCellText: 'Selected cell text', mobilePreviewNote: 'Mobile shows the current publication layout. Full editing is available on a desktop.',
    mergeRight: "Merge right", mergeDown: "Merge down", splitCell: "Split cell", mergeHint: "Only empty adjacent cells can be merged; split first to change a conflicting header boundary.",
    tableHeaderRows: 'Repeating header rows', tableFontSize: 'Table font size', bodyFontSize: 'Same as body text', smallerFontSize: 'Body text − 1 pt', resizeColumn: 'Resize column', cell: 'Cell',
    insertMenu: 'Insert', insertElement: 'Insert element', image: 'Image', textBox: 'Text box', table: 'Table', chart: 'Chart', equation: 'Equation', musicScore: 'Music score', import: 'Import',
    paste: 'Paste from Word / Excel', pasteHint: 'Paste a table, image or equation here from Word, Excel or another application.',
    importing: 'Importing…', importFailed: 'The file could not be imported.', noImportableElements: 'No supported visual elements were found.',
    chooseFile: 'Choose file', caption: 'Caption', altText: 'Alternative text', chartType: 'Chart type', chartBar: 'Bar', chartLine: 'Line',
    chartPie: 'Pie', chartScatter: 'Scatter', chartHorizontal: 'Horizontal bar', chartStacked: 'Stacked bar', chartStacked100: '100% stacked', chartArea: 'Area', chartDonut: 'Doughnut', chartRadar: 'Radar', chartStyle: 'Chart style', chartStyleColor: 'Color', chartStyleEditorial: 'Editorial', chartStyleMonochrome: 'Grayscale', chartStyleContrast: 'High contrast', chartShowGrid: 'Gridlines', chartShowLegend: 'Legend', chartShowValues: 'Data labels', chartTitle: 'Chart title', equationLatex: 'LaTeX source', equationLabel: 'Equation label',
    addRow: 'Add row', addColumn: 'Add column', removeRow: 'Remove last row', removeColumn: 'Remove last column', createChart: 'Create chart from table',
    tableToText: 'Convert table to text', confirmTableToText: 'Convert this table to tab-separated text paragraphs?', deleteElement: 'Delete element', confirmDelete: 'Delete this element from the manuscript?', source: 'Source data', emptyChart: 'Add numeric source data to render the chart.',
    importedFrom: 'Imported from', fileFormats: 'Images, DOCX, XLSX, CSV/TSV, HTML and TeX are supported.',
  },
  hu: {
    cellFormatting: 'Cellaformázás', cellRow: 'Cella sora', cellColumn: 'Cella oszlopa', textRotation: 'Szöveg elforgatása', rotationNone: 'Nincs elforgatás', rotationClockwise: '90° jobbra', rotationCounterclockwise: '90° balra', rotationUpsideDown: '180° fejjel lefelé', textDirection: 'Írásirány', directionAuto: 'Automatikus', directionLtr: 'Balról jobbra', directionRtl: 'Jobbról balra', editCellText: 'Kijelölt cella szövege', mobilePreviewNote: 'Mobilon a kiadvány aktuális elrendezése tekinthető meg. A teljes szerkesztés asztali gépen érhető el.',
    mergeRight: "Egyesítés jobbra", mergeDown: "Egyesítés lefelé", splitCell: "Cella szétválasztása", mergeHint: "Csak üres szomszédos cellák egyesíthetők; a fejléc határának módosítása előtt válassza szét az érintett cellát.",
    tableHeaderRows: 'Ismétlődő fejlécsorok', tableFontSize: 'Táblázat betűmérete', bodyFontSize: 'Törzsszöveggel azonos', smallerFontSize: 'Törzsszöveg − 1 pt', resizeColumn: 'Oszlop átméretezése', cell: 'Cella',
    insertMenu: 'Beszúrás', insertElement: 'Elem beszúrása', image: 'Kép', textBox: 'Szövegdoboz', table: 'Táblázat', chart: 'Grafikon', equation: 'Egyenlet', musicScore: 'Kotta', import: 'Importálás',
    paste: 'Beillesztés Wordből / Excelből', pasteHint: 'Illesszen be ide táblázatot, képet vagy egyenletet Wordből, Excelből vagy más alkalmazásból.',
    importing: 'Importálás…', importFailed: 'A fájlt nem sikerült importálni.', noImportableElements: 'Nem található támogatott vizuális elem.',
    chooseFile: 'Fájl kiválasztása', caption: 'Képaláírás / felirat', altText: 'Alternatív szöveg', chartType: 'Grafikon típusa', chartBar: 'Oszlop', chartLine: 'Vonal',
    chartPie: 'Kör', chartScatter: 'Pont', chartHorizontal: 'Vízszintes sáv', chartStacked: 'Halmozott oszlop', chartStacked100: '100%-os halmozott', chartArea: 'Terület', chartDonut: 'Gyűrű', chartRadar: 'Radar', chartStyle: 'Grafikonstílus', chartStyleColor: 'Színes', chartStyleEditorial: 'Kiadvány', chartStyleMonochrome: 'Szürkeárnyalatos', chartStyleContrast: 'Nagy kontraszt', chartShowGrid: 'Rácsvonalak', chartShowLegend: 'Jelmagyarázat', chartShowValues: 'Értékfeliratok', chartTitle: 'Grafikon címe', equationLatex: 'LaTeX-forrás', equationLabel: 'Egyenlet jelölése',
    addRow: 'Sor hozzáadása', addColumn: 'Oszlop hozzáadása', removeRow: 'Utolsó sor törlése', removeColumn: 'Utolsó oszlop törlése', createChart: 'Grafikon készítése a táblázatból',
    tableToText: 'Táblázatból szöveg', confirmTableToText: 'A táblázat sorait tabulátorokkal tagolt szövegbekezdésekké alakítja?', deleteElement: 'Elem törlése', confirmDelete: 'Törli ezt az elemet a kéziratból?', source: 'Forrásadatok', emptyChart: 'Adjon meg numerikus forrásadatokat a grafikon megjelenítéséhez.',
    importedFrom: 'Importálva innen', fileFormats: 'Támogatott: képek, DOCX, XLSX, CSV/TSV, HTML és TeX.',
  },
  de: {
    cellFormatting: 'Zellformatierung', cellRow: 'Zellzeile', cellColumn: 'Zellspalte', textRotation: 'Textdrehung', rotationNone: 'Keine Drehung', rotationClockwise: '90° im Uhrzeigersinn', rotationCounterclockwise: '90° gegen den Uhrzeigersinn', rotationUpsideDown: '180° auf dem Kopf', textDirection: 'Schreibrichtung', directionAuto: 'Automatisch', directionLtr: 'Links nach rechts', directionRtl: 'Rechts nach links', editCellText: 'Text der ausgewählten Zelle', mobilePreviewNote: 'Mobil wird das aktuelle Publikationslayout angezeigt. Die vollständige Bearbeitung ist am Desktop verfügbar.',
    mergeRight: "Nach rechts verbinden", mergeDown: "Nach unten verbinden", splitCell: "Zelle teilen", mergeHint: "Nur leere Nachbarzellen können verbunden werden; vor einer Änderung der Kopfzeilengrenze die betroffene Zelle teilen.",
    tableHeaderRows: 'Wiederholte Kopfzeilen', tableFontSize: 'Tabellenschriftgröße', bodyFontSize: 'Wie Fließtext', smallerFontSize: 'Fließtext − 1 pt', resizeColumn: 'Spaltenbreite ändern', cell: 'Zelle',
    insertMenu: 'Einfügen', insertElement: 'Element einfügen', image: 'Bild', textBox: 'Textfeld', table: 'Tabelle', chart: 'Diagramm', equation: 'Gleichung', musicScore: 'Notensatz', import: 'Importieren',
    paste: 'Aus Word / Excel einfügen', pasteHint: 'Fügen Sie hier eine Tabelle, ein Bild oder eine Gleichung aus Word, Excel oder einer anderen Anwendung ein.',
    importing: 'Importieren…', importFailed: 'Die Datei konnte nicht importiert werden.', noImportableElements: 'Keine unterstützten visuellen Elemente gefunden.',
    chooseFile: 'Datei auswählen', caption: 'Beschriftung', altText: 'Alternativtext', chartType: 'Diagrammtyp', chartBar: 'Balken', chartLine: 'Linie',
    chartPie: 'Kreis', chartScatter: 'Streuung', chartHorizontal: 'Horizontaler Balken', chartStacked: 'Gestapelte Säulen', chartStacked100: '100 % gestapelt', chartArea: 'Fläche', chartDonut: 'Ring', chartRadar: 'Radar', chartStyle: 'Diagrammstil', chartStyleColor: 'Farbig', chartStyleEditorial: 'Publikation', chartStyleMonochrome: 'Graustufen', chartStyleContrast: 'Hoher Kontrast', chartShowGrid: 'Gitternetz', chartShowLegend: 'Legende', chartShowValues: 'Datenbeschriftungen', chartTitle: 'Diagrammtitel', equationLatex: 'LaTeX-Quelle', equationLabel: 'Gleichungsbezeichnung',
    addRow: 'Zeile hinzufügen', addColumn: 'Spalte hinzufügen', removeRow: 'Letzte Zeile entfernen', removeColumn: 'Letzte Spalte entfernen', createChart: 'Diagramm aus Tabelle erstellen',
    tableToText: 'Tabelle in Text umwandeln', confirmTableToText: 'Diese Tabelle in tabulatorgetrennte Textabsätze umwandeln?', deleteElement: 'Element löschen', confirmDelete: 'Dieses Element aus dem Manuskript löschen?', source: 'Quelldaten', emptyChart: 'Fügen Sie numerische Quelldaten hinzu, um das Diagramm darzustellen.',
    importedFrom: 'Importiert aus', fileFormats: 'Unterstützt werden Bilder, DOCX, XLSX, CSV/TSV, HTML und TeX.',
  },
};

export function getVisualElementsCopy(locale: string): VisualElementsCopy {
  const language = locale.toLowerCase().split('-')[0];
  const current =
    COPY[language === 'hu' || language === 'de' ? language : 'en'];
  const translated = applyReturnedSupplementalOverlay(locale, 'visualElements', current, COPY.en);
  const additionalHeaders: Record<string,string> = {fr:'Lignes d’en-tête répétées',it:'Righe di intestazione ripetute',es:'Filas de encabezado repetidas',nl:'Herhaalde koprijen',pl:'Powtarzane wiersze nagłówka'};
  const mergeCopies: Record<string,[string,string,string,string]> = {
    fr:['Fusionner à droite','Fusionner vers le bas','Scinder la cellule','Seules les cellules adjacentes vides peuvent être fusionnées ; scinder avant de modifier une limite d’en-tête.'],
    it:['Unisci a destra','Unisci in basso','Dividi cella','Si possono unire solo celle adiacenti vuote; dividere prima di modificare il limite dell’intestazione.'],
    es:['Combinar a la derecha','Combinar hacia abajo','Dividir celda','Solo se pueden combinar celdas adyacentes vacías; dividir antes de cambiar el límite del encabezado.'],
    nl:['Rechts samenvoegen','Omlaag samenvoegen','Cel splitsen','Alleen lege aangrenzende cellen kunnen worden samengevoegd; splits vóór het wijzigen van een koprijgrens.'],
    pl:['Scal w prawo','Scal w dół','Podziel komórkę','Można scalać tylko puste sąsiednie komórki; przed zmianą granicy nagłówka należy podzielić komórkę.'],
  };
  const merge=mergeCopies[language];
  return {...translated,tableHeaderRows:additionalHeaders[language] ?? translated.tableHeaderRows,...(merge?{mergeRight:merge[0],mergeDown:merge[1],splitCell:merge[2],mergeHint:merge[3]}:{})};
}
