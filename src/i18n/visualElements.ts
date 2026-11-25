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
  cellRange: string;
  selectTableRow: string;
  selectTableColumn: string;
  selectWholeTable: string;
  rangeEndRow: string;
  rangeEndColumn: string;
  selectedCellCount: string;
  cellRangeHint: string;
  mixedCellFormat: string;
  applyCellColor: string;
  insertNestedTable: string;
  editNestedTable: string;
  cellListIndent: string;
  cellListOutdent: string;
  cellParagraphFormatting: string;
  cellParagraphLeftIndent: string;
  cellParagraphRightIndent: string;
  cellParagraphFirstIndent: string;
  cellParagraphBefore: string;
  cellParagraphAfter: string;
  cellParagraphLineSpacing: string;
  cellParagraphLineRule: string;
  cellEdges: string;
  cellEdgeUnit: string;
  cellBorderStyle: string;
  cellBorderNone: string;
  cellBorderSolid: string;
  cellBorderDashed: string;
  cellBorderDotted: string;
  cellBorderDouble: string;
  cellBorderWidth: string;
  cellBorderColor: string;
  cellPadding: string;
  cellHorizontalAlign: string;
  cellVerticalAlign: string;
  cellAppearanceDefault: string;
  cellAlignLeft: string;
  cellAlignCenter: string;
  cellAlignRight: string;
  cellAlignJustify: string;
  cellAlignTop: string;
  cellAlignMiddle: string;
  cellAlignBottom: string;
  cellBackground: string;
  cellClearBackground: string;
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
  rowPagination: string;
  rowHeightMode: string;
  rowHeightAuto: string;
  rowHeightMinimum: string;
  rowHeightExact: string;
  rowHeightValue: string;
  rowHeightExactHint: string;
  rowSplitDefault: string;
  rowSplitSelected: string;
  rowSplitKeep: string;
  rowSplitAllow: string;
  rowSplitInherit: string;
  rowSplitHint: string;
  mergeRight: string;
  mergeDown: string;
  splitCell: string;
  mergeHint: string;
  bodyFontSize: string;
  smallerFontSize: string;
  resizeColumn: string;
  resizeRow: string;
  resizeRowHint: string;
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
    cellHorizontalAlign: "Horizontal alignment", cellVerticalAlign: "Vertical alignment", cellAppearanceDefault: "Default", cellAlignLeft: "Left", cellAlignCenter: "Center", cellAlignRight: "Right", cellAlignJustify: "Justified", cellAlignTop: "Top", cellAlignMiddle: "Middle", cellAlignBottom: "Bottom", cellBackground: "Cell background", cellClearBackground: "Clear background",
    cellEdges: "Cell borders and padding", cellEdgeUnit: "Unit", cellBorderStyle: "Border style", cellBorderNone: "No border", cellBorderSolid: "Solid", cellBorderDashed: "Dashed", cellBorderDotted: "Dotted", cellBorderDouble: "Double", cellBorderWidth: "Line width", cellBorderColor: "Border color", cellPadding: "Inner padding",
    cellParagraphFormatting: "Paragraph formatting", cellParagraphLeftIndent: "Left indent", cellParagraphRightIndent: "Right indent", cellParagraphFirstIndent: "First-line indent", cellParagraphBefore: "Space before", cellParagraphAfter: "Space after", cellParagraphLineSpacing: "Line spacing", cellParagraphLineRule: "Line spacing mode",
    cellListIndent: "Increase list level", cellListOutdent: "Decrease list level",
    insertNestedTable: "Insert nested table", editNestedTable: "Edit nested table",
    cellRange: "Cell range", selectTableRow: "Select row", selectTableColumn: "Select column", selectWholeTable: "Select whole table", rangeEndRow: "Last row", rangeEndColumn: "Last column", selectedCellCount: "Selected cells", cellRangeHint: "Click the ending cell or enter its coordinates. Cell properties apply to the selection; text and row properties remain individual.", mixedCellFormat: "Mixed", applyCellColor: "Apply current color",
    cellFormatting: 'Cell formatting', cellRow: 'Cell row', cellColumn: 'Cell column', textRotation: 'Text rotation', rotationNone: 'No rotation', rotationClockwise: '90° clockwise', rotationCounterclockwise: '90° counterclockwise', rotationUpsideDown: '180° upside down', textDirection: 'Writing direction', directionAuto: 'Automatic', directionLtr: 'Left to right', directionRtl: 'Right to left', editCellText: 'Selected cell text', mobilePreviewNote: 'Mobile shows the current publication layout. Full editing is available on a desktop.',
    mergeRight: "Merge right", mergeDown: "Merge down", splitCell: "Split cell", mergeHint: "Only empty adjacent cells can be merged; split first to change a conflicting header boundary.",
    rowHeightMode: "Row height mode", rowHeightAuto: "Automatic", rowHeightMinimum: "At least", rowHeightExact: "Exact", rowHeightValue: "Row height", rowHeightExactHint: "The Studio and HTML/PDF retain all text and expand the row if needed. Exact DOCX/ODT rows may clip text; review the exported document.",
    rowPagination: "Row pagination", rowSplitDefault: "Table default", rowSplitSelected: "Selected row", rowSplitKeep: "Keep row together", rowSplitAllow: "Allow row to split", rowSplitInherit: "Use table default", rowSplitHint: "The live editor breaks between rows; splitting within a row is an export setting.",
    tableHeaderRows: 'Repeating header rows', tableFontSize: 'Table font size', bodyFontSize: 'Same as body text', smallerFontSize: 'Body text − 1 pt', resizeColumn: 'Resize column', resizeRow: "Resize row", resizeRowHint: "Drag to resize; double-click or Home resets to automatic. Arrow keys change by 1 pt; Shift by 10 pt.", cell: 'Cell',
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
    cellHorizontalAlign: "Vízszintes igazítás", cellVerticalAlign: "Függőleges igazítás", cellAppearanceDefault: "Alapértelmezett", cellAlignLeft: "Balra", cellAlignCenter: "Középre", cellAlignRight: "Jobbra", cellAlignJustify: "Sorkizárt", cellAlignTop: "Felülre", cellAlignMiddle: "Középre", cellAlignBottom: "Alulra", cellBackground: "Cella háttérszíne", cellClearBackground: "Háttérszín törlése",
    cellEdges: "Cellaszegélyek és belső margók", cellEdgeUnit: "Mértékegység", cellBorderStyle: "Szegély típusa", cellBorderNone: "Nincs szegély", cellBorderSolid: "Folytonos", cellBorderDashed: "Szaggatott", cellBorderDotted: "Pontozott", cellBorderDouble: "Dupla", cellBorderWidth: "Vonalvastagság", cellBorderColor: "Szegélyszín", cellPadding: "Belső margó",
    cellParagraphFormatting: "Bekezdésformázás", cellParagraphLeftIndent: "Bal oldali behúzás", cellParagraphRightIndent: "Jobb oldali behúzás", cellParagraphFirstIndent: "Első sor behúzása", cellParagraphBefore: "Térköz előtte", cellParagraphAfter: "Térköz utána", cellParagraphLineSpacing: "Sorköz", cellParagraphLineRule: "Sorköz módja",
    cellListIndent: "Listaszint növelése", cellListOutdent: "Listaszint csökkentése",
    insertNestedTable: "Beágyazott táblázat beszúrása", editNestedTable: "Beágyazott táblázat szerkesztése",
    cellRange: "Cellatartomány", selectTableRow: "Sor kijelölése", selectTableColumn: "Oszlop kijelölése", selectWholeTable: "Teljes táblázat kijelölése", rangeEndRow: "Utolsó sor", rangeEndColumn: "Utolsó oszlop", selectedCellCount: "Kijelölt cellák", cellRangeHint: "Kattintson a tartomány végpontjára vagy adja meg a koordinátáit. A cellaformázás a kijelölésre vonatkozik, a szöveg és a sor beállításai egyediek.", mixedCellFormat: "Vegyes", applyCellColor: "Aktuális szín alkalmazása",
    cellFormatting: 'Cellaformázás', cellRow: 'Cella sora', cellColumn: 'Cella oszlopa', textRotation: 'Szöveg elforgatása', rotationNone: 'Nincs elforgatás', rotationClockwise: '90° jobbra', rotationCounterclockwise: '90° balra', rotationUpsideDown: '180° fejjel lefelé', textDirection: 'Írásirány', directionAuto: 'Automatikus', directionLtr: 'Balról jobbra', directionRtl: 'Jobbról balra', editCellText: 'Kijelölt cella szövege', mobilePreviewNote: 'Mobilon a kiadvány aktuális elrendezése tekinthető meg. A teljes szerkesztés asztali gépen érhető el.',
    mergeRight: "Egyesítés jobbra", mergeDown: "Egyesítés lefelé", splitCell: "Cella szétválasztása", mergeHint: "Csak üres szomszédos cellák egyesíthetők; a fejléc határának módosítása előtt válassza szét az érintett cellát.",
    rowHeightMode: "Sormagasság módja", rowHeightAuto: "Automatikus", rowHeightMinimum: "Minimális", rowHeightExact: "Rögzített", rowHeightValue: "Sormagasság", rowHeightExactHint: "A Stúdió és a HTML/PDF szükség esetén megnöveli a sort, hogy minden szöveg látható maradjon. A rögzített DOCX/ODT-sor levághatja a szöveget; ellenőrizze az exportot.",
    rowPagination: "Sorok tördelése", rowSplitDefault: "Táblázat alapbeállítása", rowSplitSelected: "Kijelölt sor", rowSplitKeep: "Sor egyben tartása", rowSplitAllow: "Sor törése engedélyezett", rowSplitInherit: "Táblázat alapbeállításának használata", rowSplitHint: "Az élő szerkesztő sorhatárokon tördel; a soron belüli törés az export beállítása.",
    tableHeaderRows: 'Ismétlődő fejlécsorok', tableFontSize: 'Táblázat betűmérete', bodyFontSize: 'Törzsszöveggel azonos', smallerFontSize: 'Törzsszöveg − 1 pt', resizeColumn: 'Oszlop átméretezése', resizeRow: "Sor átméretezése", resizeRowHint: "Húzással méretezhető; dupla kattintás vagy Home: automatikus. Nyilak: 1 pt, Shift: 10 pt.", cell: 'Cella',
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
    cellHorizontalAlign: "Horizontale Ausrichtung", cellVerticalAlign: "Vertikale Ausrichtung", cellAppearanceDefault: "Standard", cellAlignLeft: "Links", cellAlignCenter: "Zentriert", cellAlignRight: "Rechts", cellAlignJustify: "Blocksatz", cellAlignTop: "Oben", cellAlignMiddle: "Mittig", cellAlignBottom: "Unten", cellBackground: "Zellhintergrund", cellClearBackground: "Hintergrund entfernen",
    cellEdges: "Zellrahmen und Innenabstände", cellEdgeUnit: "Maßeinheit", cellBorderStyle: "Rahmenart", cellBorderNone: "Kein Rahmen", cellBorderSolid: "Durchgezogen", cellBorderDashed: "Gestrichelt", cellBorderDotted: "Gepunktet", cellBorderDouble: "Doppelt", cellBorderWidth: "Linienstärke", cellBorderColor: "Rahmenfarbe", cellPadding: "Innenabstand",
    cellParagraphFormatting: "Absatzformatierung", cellParagraphLeftIndent: "Linker Einzug", cellParagraphRightIndent: "Rechter Einzug", cellParagraphFirstIndent: "Erstzeileneinzug", cellParagraphBefore: "Abstand davor", cellParagraphAfter: "Abstand danach", cellParagraphLineSpacing: "Zeilenabstand", cellParagraphLineRule: "Zeilenabstandsmodus",
    cellListIndent: "Listenebene erhöhen", cellListOutdent: "Listenebene verringern",
    insertNestedTable: "Verschachtelte Tabelle einfügen", editNestedTable: "Verschachtelte Tabelle bearbeiten",
    cellRange: "Zellbereich", selectTableRow: "Zeile auswählen", selectTableColumn: "Spalte auswählen", selectWholeTable: "Ganze Tabelle auswählen", rangeEndRow: "Letzte Zeile", rangeEndColumn: "Letzte Spalte", selectedCellCount: "Ausgewählte Zellen", cellRangeHint: "Endzelle anklicken oder Koordinaten eingeben. Zellformatierung gilt für die Auswahl; Text und Zeilen bleiben individuell.", mixedCellFormat: "Gemischt", applyCellColor: "Aktuelle Farbe anwenden",
    cellFormatting: 'Zellformatierung', cellRow: 'Zellzeile', cellColumn: 'Zellspalte', textRotation: 'Textdrehung', rotationNone: 'Keine Drehung', rotationClockwise: '90° im Uhrzeigersinn', rotationCounterclockwise: '90° gegen den Uhrzeigersinn', rotationUpsideDown: '180° auf dem Kopf', textDirection: 'Schreibrichtung', directionAuto: 'Automatisch', directionLtr: 'Links nach rechts', directionRtl: 'Rechts nach links', editCellText: 'Text der ausgewählten Zelle', mobilePreviewNote: 'Mobil wird das aktuelle Publikationslayout angezeigt. Die vollständige Bearbeitung ist am Desktop verfügbar.',
    mergeRight: "Nach rechts verbinden", mergeDown: "Nach unten verbinden", splitCell: "Zelle teilen", mergeHint: "Nur leere Nachbarzellen können verbunden werden; vor einer Änderung der Kopfzeilengrenze die betroffene Zelle teilen.",
    rowHeightMode: "Zeilenhöhenmodus", rowHeightAuto: "Automatisch", rowHeightMinimum: "Mindestens", rowHeightExact: "Genau", rowHeightValue: "Zeilenhöhe", rowHeightExactHint: "Studio und HTML/PDF vergrößern die Zeile bei Bedarf. Exakte DOCX/ODT-Zeilen können Text abschneiden; Export prüfen.",
    rowPagination: "Zeilenumbrüche", rowSplitDefault: "Tabellenstandard", rowSplitSelected: "Ausgewählte Zeile", rowSplitKeep: "Zeile zusammenhalten", rowSplitAllow: "Zeilenumbruch zulassen", rowSplitInherit: "Tabellenstandard verwenden", rowSplitHint: "Der Live-Editor trennt zwischen Zeilen; das Teilen innerhalb einer Zeile ist eine Exporteinstellung.",
    tableHeaderRows: 'Wiederholte Kopfzeilen', tableFontSize: 'Tabellenschriftgröße', bodyFontSize: 'Wie Fließtext', smallerFontSize: 'Fließtext − 1 pt', resizeColumn: 'Spaltenbreite ändern', resizeRow: "Zeilenhöhe ändern", resizeRowHint: "Ziehen zum Ändern; Doppelklick oder Pos1 setzt auf automatisch. Pfeile: 1 pt, Umschalt: 10 pt.", cell: 'Zelle',
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
  const rowCopies: Record<string,Pick<VisualElementsCopy,'rowPagination'|'rowSplitDefault'|'rowSplitSelected'|'rowSplitKeep'|'rowSplitAllow'|'rowSplitInherit'|'rowSplitHint'>> = {
    fr: {"rowPagination":"Pagination des lignes","rowSplitDefault":"Valeur par défaut du tableau","rowSplitSelected":"Ligne sélectionnée","rowSplitKeep":"Garder la ligne entière","rowSplitAllow":"Autoriser la coupure de ligne","rowSplitInherit":"Utiliser la valeur du tableau","rowSplitHint":"L’éditeur coupe entre les lignes ; la coupure dans une ligne est un réglage d’exportation."},
    it: {"rowPagination":"Paginazione delle righe","rowSplitDefault":"Impostazione predefinita della tabella","rowSplitSelected":"Riga selezionata","rowSplitKeep":"Mantieni la riga intera","rowSplitAllow":"Consenti divisione della riga","rowSplitInherit":"Usa il valore della tabella","rowSplitHint":"L’editor divide tra le righe; la divisione interna è un’impostazione di esportazione."},
    es: {"rowPagination":"Paginación de filas","rowSplitDefault":"Valor predeterminado de la tabla","rowSplitSelected":"Fila seleccionada","rowSplitKeep":"Mantener la fila unida","rowSplitAllow":"Permitir dividir la fila","rowSplitInherit":"Usar el valor de la tabla","rowSplitHint":"El editor divide entre filas; la división dentro de una fila se configura al exportar."},
    nl: {"rowPagination":"Rijpaginering","rowSplitDefault":"Tabelstandaard","rowSplitSelected":"Geselecteerde rij","rowSplitKeep":"Rij bijeenhouden","rowSplitAllow":"Rij splitsen toestaan","rowSplitInherit":"Tabelstandaard gebruiken","rowSplitHint":"De editor breekt tussen rijen; splitsen binnen een rij is een exportinstelling."},
    pl: {"rowPagination":"Podział wierszy na strony","rowSplitDefault":"Domyślne ustawienie tabeli","rowSplitSelected":"Wybrany wiersz","rowSplitKeep":"Zachowaj wiersz w całości","rowSplitAllow":"Zezwól na podział wiersza","rowSplitInherit":"Użyj ustawienia tabeli","rowSplitHint":"Edytor dzieli między wierszami; podział wewnątrz wiersza jest ustawieniem eksportu."},
  };
  const appearanceCopies: Record<string,Pick<VisualElementsCopy,'cellHorizontalAlign'|'cellVerticalAlign'|'cellAppearanceDefault'|'cellAlignLeft'|'cellAlignCenter'|'cellAlignRight'|'cellAlignJustify'|'cellAlignTop'|'cellAlignMiddle'|'cellAlignBottom'|'cellBackground'|'cellClearBackground'>> = {
    fr: {"cellHorizontalAlign":"Alignement horizontal","cellVerticalAlign":"Alignement vertical","cellAppearanceDefault":"Par défaut","cellAlignLeft":"Gauche","cellAlignCenter":"Centré","cellAlignRight":"Droite","cellAlignJustify":"Justifié","cellAlignTop":"Haut","cellAlignMiddle":"Milieu","cellAlignBottom":"Bas","cellBackground":"Arrière-plan de cellule","cellClearBackground":"Effacer l’arrière-plan"},
    it: {"cellHorizontalAlign":"Allineamento orizzontale","cellVerticalAlign":"Allineamento verticale","cellAppearanceDefault":"Predefinito","cellAlignLeft":"Sinistra","cellAlignCenter":"Centro","cellAlignRight":"Destra","cellAlignJustify":"Giustificato","cellAlignTop":"In alto","cellAlignMiddle":"Al centro","cellAlignBottom":"In basso","cellBackground":"Sfondo cella","cellClearBackground":"Rimuovi sfondo"},
    es: {"cellHorizontalAlign":"Alineación horizontal","cellVerticalAlign":"Alineación vertical","cellAppearanceDefault":"Predeterminado","cellAlignLeft":"Izquierda","cellAlignCenter":"Centro","cellAlignRight":"Derecha","cellAlignJustify":"Justificado","cellAlignTop":"Superior","cellAlignMiddle":"Medio","cellAlignBottom":"Inferior","cellBackground":"Fondo de celda","cellClearBackground":"Quitar fondo"},
    nl: {"cellHorizontalAlign":"Horizontale uitlijning","cellVerticalAlign":"Verticale uitlijning","cellAppearanceDefault":"Standaard","cellAlignLeft":"Links","cellAlignCenter":"Centreren","cellAlignRight":"Rechts","cellAlignJustify":"Uitvullen","cellAlignTop":"Boven","cellAlignMiddle":"Midden","cellAlignBottom":"Onder","cellBackground":"Celachtergrond","cellClearBackground":"Achtergrond wissen"},
    pl: {"cellHorizontalAlign":"Wyrównanie poziome","cellVerticalAlign":"Wyrównanie pionowe","cellAppearanceDefault":"Domyślne","cellAlignLeft":"Do lewej","cellAlignCenter":"Do środka","cellAlignRight":"Do prawej","cellAlignJustify":"Wyjustowane","cellAlignTop":"Do góry","cellAlignMiddle":"Do środka","cellAlignBottom":"Do dołu","cellBackground":"Tło komórki","cellClearBackground":"Wyczyść tło"},
  };
  const edgeCopies: Record<string,Pick<VisualElementsCopy,'cellEdges'|'cellEdgeUnit'|'cellBorderStyle'|'cellBorderNone'|'cellBorderSolid'|'cellBorderDashed'|'cellBorderDotted'|'cellBorderDouble'|'cellBorderWidth'|'cellBorderColor'|'cellPadding'>> = {
    fr: {"cellEdges":"Bordures et marges internes","cellEdgeUnit":"Unité","cellBorderStyle":"Style de bordure","cellBorderNone":"Sans bordure","cellBorderSolid":"Continu","cellBorderDashed":"Tirets","cellBorderDotted":"Pointillé","cellBorderDouble":"Double","cellBorderWidth":"Épaisseur","cellBorderColor":"Couleur de bordure","cellPadding":"Marge interne"},
    it: {"cellEdges":"Bordi e margini interni","cellEdgeUnit":"Unità","cellBorderStyle":"Stile del bordo","cellBorderNone":"Nessun bordo","cellBorderSolid":"Continuo","cellBorderDashed":"Tratteggiato","cellBorderDotted":"Punteggiato","cellBorderDouble":"Doppio","cellBorderWidth":"Spessore","cellBorderColor":"Colore del bordo","cellPadding":"Margine interno"},
    es: {"cellEdges":"Bordes y márgenes internos","cellEdgeUnit":"Unidad","cellBorderStyle":"Estilo de borde","cellBorderNone":"Sin borde","cellBorderSolid":"Continuo","cellBorderDashed":"Discontinuo","cellBorderDotted":"Punteado","cellBorderDouble":"Doble","cellBorderWidth":"Grosor","cellBorderColor":"Color del borde","cellPadding":"Margen interno"},
    nl: {"cellEdges":"Celranden en binnenmarges","cellEdgeUnit":"Eenheid","cellBorderStyle":"Randstijl","cellBorderNone":"Geen rand","cellBorderSolid":"Doorgetrokken","cellBorderDashed":"Gestreept","cellBorderDotted":"Gestippeld","cellBorderDouble":"Dubbel","cellBorderWidth":"Lijndikte","cellBorderColor":"Randkleur","cellPadding":"Binnenmarge"},
    pl: {"cellEdges":"Obramowanie i marginesy komórki","cellEdgeUnit":"Jednostka","cellBorderStyle":"Styl obramowania","cellBorderNone":"Bez obramowania","cellBorderSolid":"Ciągła","cellBorderDashed":"Kreskowana","cellBorderDotted":"Kropkowana","cellBorderDouble":"Podwójna","cellBorderWidth":"Grubość","cellBorderColor":"Kolor obramowania","cellPadding":"Margines wewnętrzny"},
  };
  const heightCopies: Record<string,Pick<VisualElementsCopy,'rowHeightMode'|'rowHeightAuto'|'rowHeightMinimum'|'rowHeightExact'|'rowHeightValue'|'rowHeightExactHint'>> = {
    fr: {"rowHeightMode":"Mode de hauteur de ligne","rowHeightAuto":"Automatique","rowHeightMinimum":"Minimum","rowHeightExact":"Exacte","rowHeightValue":"Hauteur de ligne","rowHeightExactHint":"Studio et HTML/PDF agrandissent la ligne si nécessaire. Les hauteurs exactes DOCX/ODT peuvent tronquer le texte ; vérifier l’export."},
    it: {"rowHeightMode":"Modalità altezza riga","rowHeightAuto":"Automatica","rowHeightMinimum":"Minima","rowHeightExact":"Esatta","rowHeightValue":"Altezza riga","rowHeightExactHint":"Studio e HTML/PDF ampliano la riga se necessario. Le altezze esatte DOCX/ODT possono tagliare il testo; verificare l’esportazione."},
    es: {"rowHeightMode":"Modo de altura de fila","rowHeightAuto":"Automática","rowHeightMinimum":"Mínima","rowHeightExact":"Exacta","rowHeightValue":"Altura de fila","rowHeightExactHint":"Studio y HTML/PDF amplían la fila si es necesario. Las alturas exactas DOCX/ODT pueden recortar texto; revisar la exportación."},
    nl: {"rowHeightMode":"Modus rijhoogte","rowHeightAuto":"Automatisch","rowHeightMinimum":"Minimaal","rowHeightExact":"Exact","rowHeightValue":"Rijhoogte","rowHeightExactHint":"Studio en HTML/PDF vergroten de rij zo nodig. Exacte DOCX/ODT-rijen kunnen tekst afkappen; controleer de export."},
    pl: {"rowHeightMode":"Tryb wysokości wiersza","rowHeightAuto":"Automatyczna","rowHeightMinimum":"Minimalna","rowHeightExact":"Dokładna","rowHeightValue":"Wysokość wiersza","rowHeightExactHint":"Studio i HTML/PDF powiększają wiersz w razie potrzeby. Dokładne wysokości DOCX/ODT mogą obcinać tekst; sprawdź eksport."},
  };
  const paragraphCopies: Record<string,Pick<VisualElementsCopy,'cellParagraphFormatting'|'cellParagraphLeftIndent'|'cellParagraphRightIndent'|'cellParagraphFirstIndent'|'cellParagraphBefore'|'cellParagraphAfter'|'cellParagraphLineSpacing'|'cellParagraphLineRule'>> = {
    fr: {"cellParagraphFormatting":"Mise en forme du paragraphe","cellParagraphLeftIndent":"Retrait gauche","cellParagraphRightIndent":"Retrait droit","cellParagraphFirstIndent":"Retrait de première ligne","cellParagraphBefore":"Espacement avant","cellParagraphAfter":"Espacement après","cellParagraphLineSpacing":"Interligne","cellParagraphLineRule":"Mode d’interligne"},
    it: {"cellParagraphFormatting":"Formattazione del paragrafo","cellParagraphLeftIndent":"Rientro sinistro","cellParagraphRightIndent":"Rientro destro","cellParagraphFirstIndent":"Rientro prima riga","cellParagraphBefore":"Spazio prima","cellParagraphAfter":"Spazio dopo","cellParagraphLineSpacing":"Interlinea","cellParagraphLineRule":"Modalità interlinea"},
    es: {"cellParagraphFormatting":"Formato de párrafo","cellParagraphLeftIndent":"Sangría izquierda","cellParagraphRightIndent":"Sangría derecha","cellParagraphFirstIndent":"Sangría de primera línea","cellParagraphBefore":"Espacio anterior","cellParagraphAfter":"Espacio posterior","cellParagraphLineSpacing":"Interlineado","cellParagraphLineRule":"Modo de interlineado"},
    nl: {"cellParagraphFormatting":"Alineaopmaak","cellParagraphLeftIndent":"Inspringing links","cellParagraphRightIndent":"Inspringing rechts","cellParagraphFirstIndent":"Inspringing eerste regel","cellParagraphBefore":"Ruimte ervoor","cellParagraphAfter":"Ruimte erna","cellParagraphLineSpacing":"Regelafstand","cellParagraphLineRule":"Modus regelafstand"},
    pl: {"cellParagraphFormatting":"Formatowanie akapitu","cellParagraphLeftIndent":"Wcięcie lewe","cellParagraphRightIndent":"Wcięcie prawe","cellParagraphFirstIndent":"Wcięcie pierwszego wiersza","cellParagraphBefore":"Odstęp przed","cellParagraphAfter":"Odstęp po","cellParagraphLineSpacing":"Interlinia","cellParagraphLineRule":"Tryb interlinii"},
  };
  const cellListCopies: Record<string,Pick<VisualElementsCopy,'cellListIndent'|'cellListOutdent'>> = {
    fr: {"cellListIndent":"Augmenter le niveau de liste","cellListOutdent":"Réduire le niveau de liste"},
    it: {"cellListIndent":"Aumenta livello elenco","cellListOutdent":"Riduci livello elenco"},
    es: {"cellListIndent":"Aumentar nivel de lista","cellListOutdent":"Reducir nivel de lista"},
    nl: {"cellListIndent":"Lijstniveau verhogen","cellListOutdent":"Lijstniveau verlagen"},
    pl: {"cellListIndent":"Zwiększ poziom listy","cellListOutdent":"Zmniejsz poziom listy"},
  };
  const nestedTableCopies:Record<string,Pick<VisualElementsCopy,'insertNestedTable'|'editNestedTable'>>={
    fr: {"insertNestedTable":"Insérer un tableau imbriqué","editNestedTable":"Modifier le tableau imbriqué"},
    it: {"insertNestedTable":"Inserisci tabella annidata","editNestedTable":"Modifica tabella annidata"},
    es: {"insertNestedTable":"Insertar tabla anidada","editNestedTable":"Editar tabla anidada"},
    nl: {"insertNestedTable":"Geneste tabel invoegen","editNestedTable":"Geneste tabel bewerken"},
    pl: {"insertNestedTable":"Wstaw tabelę zagnieżdżoną","editNestedTable":"Edytuj tabelę zagnieżdżoną"},
  };
  const rowResizeCopies:Record<string,Pick<VisualElementsCopy,'resizeRow'|'resizeRowHint'>>={
    fr: {"resizeRow":"Redimensionner la ligne","resizeRowHint":"Glisser pour redimensionner ; double-clic ou Origine pour réinitialiser. Flèches : 1 pt, Maj : 10 pt."},
    it: {"resizeRow":"Ridimensiona riga","resizeRowHint":"Trascina per ridimensionare; doppio clic o Home per ripristinare. Frecce: 1 pt, Maiusc: 10 pt."},
    es: {"resizeRow":"Cambiar altura de fila","resizeRowHint":"Arrastra para ajustar; doble clic o Inicio para restablecer. Flechas: 1 pt, Mayús: 10 pt."},
    nl: {"resizeRow":"Rijhoogte aanpassen","resizeRowHint":"Sleep om te wijzigen; dubbelklik of Home voor automatisch. Pijlen: 1 pt, Shift: 10 pt."},
    pl: {"resizeRow":"Zmień wysokość wiersza","resizeRowHint":"Przeciągnij, aby zmienić; dwuklik lub Home przywraca automatykę. Strzałki: 1 pt, Shift: 10 pt."},
  };
  const rangeCopies:Record<string,Pick<VisualElementsCopy,'cellRange'|'selectTableRow'|'selectTableColumn'|'selectWholeTable'|'rangeEndRow'|'rangeEndColumn'|'selectedCellCount'|'cellRangeHint'|'mixedCellFormat'|'applyCellColor'>>={
    fr: {"cellRange":"Plage de cellules","selectTableRow":"Sélectionner la ligne","selectTableColumn":"Sélectionner la colonne","selectWholeTable":"Sélectionner le tableau","rangeEndRow":"Dernière ligne","rangeEndColumn":"Dernière colonne","selectedCellCount":"Cellules sélectionnées","cellRangeHint":"Choisir la cellule finale ou ses coordonnées. La mise en forme des cellules s’applique à la sélection ; texte et lignes restent individuels.","mixedCellFormat":"Mixte","applyCellColor":"Appliquer la couleur actuelle"},
    it: {"cellRange":"Intervallo di celle","selectTableRow":"Seleziona riga","selectTableColumn":"Seleziona colonna","selectWholeTable":"Seleziona tabella","rangeEndRow":"Ultima riga","rangeEndColumn":"Ultima colonna","selectedCellCount":"Celle selezionate","cellRangeHint":"Scegli la cella finale o le coordinate. La formattazione si applica alla selezione; testo e righe restano individuali.","mixedCellFormat":"Misto","applyCellColor":"Applica colore corrente"},
    es: {"cellRange":"Rango de celdas","selectTableRow":"Seleccionar fila","selectTableColumn":"Seleccionar columna","selectWholeTable":"Seleccionar tabla","rangeEndRow":"Última fila","rangeEndColumn":"Última columna","selectedCellCount":"Celdas seleccionadas","cellRangeHint":"Elige la celda final o sus coordenadas. El formato se aplica a la selección; texto y filas siguen siendo individuales.","mixedCellFormat":"Mixto","applyCellColor":"Aplicar color actual"},
    nl: {"cellRange":"Celbereik","selectTableRow":"Rij selecteren","selectTableColumn":"Kolom selecteren","selectWholeTable":"Hele tabel selecteren","rangeEndRow":"Laatste rij","rangeEndColumn":"Laatste kolom","selectedCellCount":"Geselecteerde cellen","cellRangeHint":"Kies de eindcel of coördinaten. Celopmaak geldt voor de selectie; tekst en rijen blijven individueel.","mixedCellFormat":"Gemengd","applyCellColor":"Huidige kleur toepassen"},
    pl: {"cellRange":"Zakres komórek","selectTableRow":"Zaznacz wiersz","selectTableColumn":"Zaznacz kolumnę","selectWholeTable":"Zaznacz tabelę","rangeEndRow":"Ostatni wiersz","rangeEndColumn":"Ostatnia kolumna","selectedCellCount":"Zaznaczone komórki","cellRangeHint":"Wybierz komórkę końcową lub współrzędne. Formatowanie dotyczy zaznaczenia; tekst i wiersze pozostają indywidualne.","mixedCellFormat":"Mieszane","applyCellColor":"Zastosuj bieżący kolor"},
  };
  const merge=mergeCopies[language];
  return {...translated,...rowCopies[language],...appearanceCopies[language],...edgeCopies[language],...heightCopies[language],...paragraphCopies[language],...cellListCopies[language],...nestedTableCopies[language],...rowResizeCopies[language],...rangeCopies[language],tableHeaderRows:additionalHeaders[language] ?? translated.tableHeaderRows,...(merge?{mergeRight:merge[0],mergeDown:merge[1],splitCell:merge[2],mergeHint:merge[3]}:{})};
}
