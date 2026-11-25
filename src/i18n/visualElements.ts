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
  insertCellCitation: string;
  cellCitationProtected: string;
  publicationTableStyles: string;
  saveStyleToPublication: string;
  removeStyleFromPublication: string;
  defaultPublicationTableStyle: string;
  noDefaultPublicationTableStyle: string;
  publicationTableStyleHint: string;
  linkedPublicationTableStyle: string;
  detachPublicationTableStyle: string;
  updatePublicationTableStyle: string;
  rangeTextFormatting: string;
  rangeTextFormattingHint: string;
  cellNoteProtected: string;
  tableAppearanceStyles: string;
  tableStyleGrid: string;
  tableStyleMinimal: string;
  tableStyleBanded: string;
  cellStyleLabel: string;
  tableStyleLabel: string;
  applyTableStyle: string;
  deleteTableStyle: string;
  tableStyleApplyHint: string;
  tableStyleName: string;
  tableStyleSaveAs: string;
  saveTableStyle: string;
  tableStyleSaveHint: string;
  tableStyleError: string;
  reorderTable: string;
  moveRowUp: string;
  moveRowDown: string;
  moveColumnLeft: string;
  moveColumnRight: string;
  reorderTableHint: string;
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
  idmlTableOnly: string;
  idmlTablePartial: string;
}

const COPY: Record<'en' | 'hu' | 'de', VisualElementsCopy> = {
  en: {
    cellHorizontalAlign: "Horizontal alignment", cellVerticalAlign: "Vertical alignment", cellAppearanceDefault: "Default", cellAlignLeft: "Left", cellAlignCenter: "Center", cellAlignRight: "Right", cellAlignJustify: "Justified", cellAlignTop: "Top", cellAlignMiddle: "Middle", cellAlignBottom: "Bottom", cellBackground: "Cell background", cellClearBackground: "Clear background",
    cellEdges: "Cell borders and padding", cellEdgeUnit: "Unit", cellBorderStyle: "Border style", cellBorderNone: "No border", cellBorderSolid: "Solid", cellBorderDashed: "Dashed", cellBorderDotted: "Dotted", cellBorderDouble: "Double", cellBorderWidth: "Line width", cellBorderColor: "Border color", cellPadding: "Inner padding",
    cellParagraphFormatting: "Paragraph formatting", cellParagraphLeftIndent: "Left indent", cellParagraphRightIndent: "Right indent", cellParagraphFirstIndent: "First-line indent", cellParagraphBefore: "Space before", cellParagraphAfter: "Space after", cellParagraphLineSpacing: "Line spacing", cellParagraphLineRule: "Line spacing mode",
    cellListIndent: "Increase list level", cellListOutdent: "Decrease list level",
    insertNestedTable: "Insert nested table", editNestedTable: "Edit nested table",
    cellRange: "Cell range", selectTableRow: "Select row", selectTableColumn: "Select column", selectWholeTable: "Select whole table", rangeEndRow: "Last row", rangeEndColumn: "Last column", selectedCellCount: "Selected cells", cellRangeHint: "Click the ending cell or enter its coordinates. Cell properties apply to the selection; text and row properties remain individual.", mixedCellFormat: "Mixed", applyCellColor: "Apply current color",
    reorderTable: "Reorder rows and columns", moveRowUp: "Move row up", moveRowDown: "Move row down", moveColumnLeft: "Move column left", moveColumnRight: "Move column right", reorderTableHint: "Select one cell first. Connected merged rows or columns move together; header rows stay in the header.",
    tableAppearanceStyles: "Table and cell styles", tableStyleGrid: "Grid", tableStyleMinimal: "Horizontal rules", tableStyleBanded: "Banded rows", cellStyleLabel: "Cell style", tableStyleLabel: "Table style", applyTableStyle: "Apply style", deleteTableStyle: "Delete saved style", tableStyleApplyHint: "Table styles replace cell appearance throughout the table; cell styles apply to the selection. Text and dimensions are retained.", tableStyleName: "Style name", tableStyleSaveAs: "Save as", saveTableStyle: "Save style", tableStyleSaveHint: "Saved on this device. Table styles sample the first header and body cells, optionally the second body row.", tableStyleError: "Choose a unique name (max. 80 characters); storage may be unavailable or the 50-style limit reached.",
    cellNoteProtected: "This edit would remove or duplicate a note anchor, or the table has changed. Use the note editor to delete notes.",
    rangeTextFormatting: "Selected cell text formatting", rangeTextFormattingHint: "Applies only to existing text and paragraphs in selected cells, including list items. Nested tables and note bodies have their own formatting. Empty cells receive paragraph settings only.",
    publicationTableStyles: "Publication styles", linkedPublicationTableStyle: "Linked publication style", detachPublicationTableStyle: "Detach style (keep appearance)", updatePublicationTableStyle: "Update style from table", saveStyleToPublication: "Copy style to publication", removeStyleFromPublication: "Remove style from publication", defaultPublicationTableStyle: "Default for new tables", noDefaultPublicationTableStyle: "No default", publicationTableStyleHint: "Publication table styles update linked tables automatically. Unlinked existing and imported tables stay unchanged.",
    insertCellCitation: "Insert inline citation", cellCitationProtected: "This edit would remove or duplicate a citation anchor, or the table has changed. Use the citation editor to remove references.",
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
    idmlTableOnly: "IDML: imports editable tables only, not the entire InDesign document.", idmlTablePartial: "Some IDML properties could not be preserved. Review the imported tables before publishing.",
    importedFrom: 'Imported from', fileFormats: 'Images, DOCX, IDML, XLSX, CSV/TSV, HTML and TeX are supported.',
  },
  hu: {
    cellHorizontalAlign: "Vízszintes igazítás", cellVerticalAlign: "Függőleges igazítás", cellAppearanceDefault: "Alapértelmezett", cellAlignLeft: "Balra", cellAlignCenter: "Középre", cellAlignRight: "Jobbra", cellAlignJustify: "Sorkizárt", cellAlignTop: "Felülre", cellAlignMiddle: "Középre", cellAlignBottom: "Alulra", cellBackground: "Cella háttérszíne", cellClearBackground: "Háttérszín törlése",
    cellEdges: "Cellaszegélyek és belső margók", cellEdgeUnit: "Mértékegység", cellBorderStyle: "Szegély típusa", cellBorderNone: "Nincs szegély", cellBorderSolid: "Folytonos", cellBorderDashed: "Szaggatott", cellBorderDotted: "Pontozott", cellBorderDouble: "Dupla", cellBorderWidth: "Vonalvastagság", cellBorderColor: "Szegélyszín", cellPadding: "Belső margó",
    cellParagraphFormatting: "Bekezdésformázás", cellParagraphLeftIndent: "Bal oldali behúzás", cellParagraphRightIndent: "Jobb oldali behúzás", cellParagraphFirstIndent: "Első sor behúzása", cellParagraphBefore: "Térköz előtte", cellParagraphAfter: "Térköz utána", cellParagraphLineSpacing: "Sorköz", cellParagraphLineRule: "Sorköz módja",
    cellListIndent: "Listaszint növelése", cellListOutdent: "Listaszint csökkentése",
    insertNestedTable: "Beágyazott táblázat beszúrása", editNestedTable: "Beágyazott táblázat szerkesztése",
    cellRange: "Cellatartomány", selectTableRow: "Sor kijelölése", selectTableColumn: "Oszlop kijelölése", selectWholeTable: "Teljes táblázat kijelölése", rangeEndRow: "Utolsó sor", rangeEndColumn: "Utolsó oszlop", selectedCellCount: "Kijelölt cellák", cellRangeHint: "Kattintson a tartomány végpontjára vagy adja meg a koordinátáit. A cellaformázás a kijelölésre vonatkozik, a szöveg és a sor beállításai egyediek.", mixedCellFormat: "Vegyes", applyCellColor: "Aktuális szín alkalmazása",
    reorderTable: "Sorok és oszlopok átrendezése", moveRowUp: "Sor feljebb", moveRowDown: "Sor lejjebb", moveColumnLeft: "Oszlop balra", moveColumnRight: "Oszlop jobbra", reorderTableHint: "Először jelöljön ki egy cellát. Az egyesített cellákkal összekapcsolt sorok vagy oszlopok együtt mozognak; a fejlécsorok a fejlécben maradnak.",
    tableAppearanceStyles: "Táblázat- és cellastílusok", tableStyleGrid: "Rácsos", tableStyleMinimal: "Vízszintes vonalak", tableStyleBanded: "Váltakozó sávok", cellStyleLabel: "Cellastílus", tableStyleLabel: "Táblázatstílus", applyTableStyle: "Stílus alkalmazása", deleteTableStyle: "Mentett stílus törlése", tableStyleApplyHint: "A táblázatstílus a teljes táblázat megjelenését felülírja; a cellastílus a kijelölésre vonatkozik. A szöveg és a méretek megmaradnak.", tableStyleName: "Stílus neve", tableStyleSaveAs: "Mentés típusa", saveTableStyle: "Stílus mentése", tableStyleSaveHint: "Mentés ezen az eszközön. A táblázatstílus az első fejléc- és törzscellából, opcionálisan a második törzssorból vesz mintát.", tableStyleError: "Adjon meg egyedi, legfeljebb 80 karakteres nevet. A tárhely nem érhető el, vagy elérte az 50 stílusos korlátot.",
    cellNoteProtected: "A módosítás törölne vagy megkettőzne egy jegyzethorgonyt, vagy a táblázat időközben megváltozott. A jegyzeteket a jegyzetszerkesztőben törölje.",
    rangeTextFormatting: "Kijelölt cellák szövegformázása", rangeTextFormattingHint: "A kijelölt cellák meglévő szövegére és bekezdéseire, a listák elemeire is vonatkozik. A beágyazott táblázatok és a jegyzetek külön formázhatók. Az üres cellák csak bekezdésbeállításokat kapnak.",
    publicationTableStyles: "Kiadványstílusok", linkedPublicationTableStyle: "Kapcsolt kiadványstílus", detachPublicationTableStyle: "Stíluskapcsolat megszüntetése (formázás megőrzése)", updatePublicationTableStyle: "Stílus frissítése a táblázatból", saveStyleToPublication: "Stílus másolása a kiadványba", removeStyleFromPublication: "Stílus eltávolítása a kiadványból", defaultPublicationTableStyle: "Új táblázatok alapértelmezett stílusa", noDefaultPublicationTableStyle: "Nincs alapértelmezett stílus", publicationTableStyleHint: "A kiadvány táblázatstílusai automatikusan frissítik a kapcsolt táblázatokat. A nem kapcsolt meglévő és importált táblázatok változatlanok.",
    insertCellCitation: "Szövegközi hivatkozás beszúrása", cellCitationProtected: "A módosítás törölne vagy megkettőzne egy hivatkozási horgonyt, vagy a táblázat időközben megváltozott. A hivatkozások törléséhez használja a hivatkozásszerkesztőt.",
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
    idmlTableOnly: "IDML: csak a szerkeszthető táblázatokat importálja, nem a teljes InDesign-dokumentumot.", idmlTablePartial: "Egyes IDML-tulajdonságok nem őrizhetők meg. Publikálás előtt ellenőrizze az importált táblázatokat.",
    importedFrom: 'Importálva innen', fileFormats: 'Támogatott: képek, DOCX, IDML, XLSX, CSV/TSV, HTML és TeX.',
  },
  de: {
    cellHorizontalAlign: "Horizontale Ausrichtung", cellVerticalAlign: "Vertikale Ausrichtung", cellAppearanceDefault: "Standard", cellAlignLeft: "Links", cellAlignCenter: "Zentriert", cellAlignRight: "Rechts", cellAlignJustify: "Blocksatz", cellAlignTop: "Oben", cellAlignMiddle: "Mittig", cellAlignBottom: "Unten", cellBackground: "Zellhintergrund", cellClearBackground: "Hintergrund entfernen",
    cellEdges: "Zellrahmen und Innenabstände", cellEdgeUnit: "Maßeinheit", cellBorderStyle: "Rahmenart", cellBorderNone: "Kein Rahmen", cellBorderSolid: "Durchgezogen", cellBorderDashed: "Gestrichelt", cellBorderDotted: "Gepunktet", cellBorderDouble: "Doppelt", cellBorderWidth: "Linienstärke", cellBorderColor: "Rahmenfarbe", cellPadding: "Innenabstand",
    cellParagraphFormatting: "Absatzformatierung", cellParagraphLeftIndent: "Linker Einzug", cellParagraphRightIndent: "Rechter Einzug", cellParagraphFirstIndent: "Erstzeileneinzug", cellParagraphBefore: "Abstand davor", cellParagraphAfter: "Abstand danach", cellParagraphLineSpacing: "Zeilenabstand", cellParagraphLineRule: "Zeilenabstandsmodus",
    cellListIndent: "Listenebene erhöhen", cellListOutdent: "Listenebene verringern",
    insertNestedTable: "Verschachtelte Tabelle einfügen", editNestedTable: "Verschachtelte Tabelle bearbeiten",
    cellRange: "Zellbereich", selectTableRow: "Zeile auswählen", selectTableColumn: "Spalte auswählen", selectWholeTable: "Ganze Tabelle auswählen", rangeEndRow: "Letzte Zeile", rangeEndColumn: "Letzte Spalte", selectedCellCount: "Ausgewählte Zellen", cellRangeHint: "Endzelle anklicken oder Koordinaten eingeben. Zellformatierung gilt für die Auswahl; Text und Zeilen bleiben individuell.", mixedCellFormat: "Gemischt", applyCellColor: "Aktuelle Farbe anwenden",
    reorderTable: "Zeilen und Spalten verschieben", moveRowUp: "Zeile nach oben", moveRowDown: "Zeile nach unten", moveColumnLeft: "Spalte nach links", moveColumnRight: "Spalte nach rechts", reorderTableHint: "Zuerst eine Zelle auswählen. Durch verbundene Zellen verknüpfte Zeilen oder Spalten werden gemeinsam verschoben; Kopfzeilen bleiben im Kopfbereich.",
    tableAppearanceStyles: "Tabellen- und Zellstile", tableStyleGrid: "Raster", tableStyleMinimal: "Horizontale Linien", tableStyleBanded: "Alternierende Zeilen", cellStyleLabel: "Zellstil", tableStyleLabel: "Tabellenstil", applyTableStyle: "Stil anwenden", deleteTableStyle: "Gespeicherten Stil löschen", tableStyleApplyHint: "Tabellenstile ersetzen die Zellgestaltung der ganzen Tabelle, Zellstile gelten für die Auswahl. Text und Maße bleiben erhalten.", tableStyleName: "Stilname", tableStyleSaveAs: "Speichern als", saveTableStyle: "Stil speichern", tableStyleSaveHint: "Lokal auf diesem Gerät gespeichert. Tabellenstile übernehmen die erste Kopf- und Datenzelle, optional die zweite Datenzeile.", tableStyleError: "Eindeutigen Namen (max. 80 Zeichen) wählen; Speicher eventuell nicht verfügbar oder 50 Stile erreicht.",
    cellNoteProtected: "Die Änderung würde einen Notenanker entfernen oder duplizieren, oder die Tabelle wurde geändert. Noten im Noteneditor löschen.",
    rangeTextFormatting: "Textformatierung der ausgewählten Zellen", rangeTextFormattingHint: "Gilt für vorhandenen Text und Absätze in ausgewählten Zellen, auch Listenelemente. Verschachtelte Tabellen und Notiztexte werden separat formatiert. Leere Zellen erhalten nur Absatzformatierung.",
    publicationTableStyles: "Publikationsstile", linkedPublicationTableStyle: "Verknüpfter Publikationsstil", detachPublicationTableStyle: "Stil lösen (Gestaltung behalten)", updatePublicationTableStyle: "Stil aus Tabelle aktualisieren", saveStyleToPublication: "Stil in die Publikation kopieren", removeStyleFromPublication: "Stil aus der Publikation entfernen", defaultPublicationTableStyle: "Standard für neue Tabellen", noDefaultPublicationTableStyle: "Kein Standard", publicationTableStyleHint: "Publikationstabellenstile aktualisieren verknüpfte Tabellen automatisch. Nicht verknüpfte Tabellen bleiben unverändert.",
    insertCellCitation: "Inline-Zitat einfügen", cellCitationProtected: "Die Änderung würde einen Zitatanker entfernen oder duplizieren, oder die Tabelle wurde geändert. Zitate im Zitiereditor löschen.",
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
    idmlTableOnly: "IDML: Importiert nur bearbeitbare Tabellen, nicht das gesamte InDesign-Dokument.", idmlTablePartial: "Einige IDML-Eigenschaften konnten nicht übernommen werden. Prüfen Sie die Tabellen vor der Veröffentlichung.",
    importedFrom: 'Importiert aus', fileFormats: 'Unterstützt werden Bilder, DOCX, IDML, XLSX, CSV/TSV, HTML und TeX.',
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
  const reorderCopies:Record<string,Pick<VisualElementsCopy,'reorderTable'|'moveRowUp'|'moveRowDown'|'moveColumnLeft'|'moveColumnRight'|'reorderTableHint'>>={
    fr: {"reorderTable":"Réorganiser les lignes et colonnes","moveRowUp":"Monter la ligne","moveRowDown":"Descendre la ligne","moveColumnLeft":"Déplacer la colonne à gauche","moveColumnRight":"Déplacer la colonne à droite","reorderTableHint":"Sélectionnez une cellule. Les lignes ou colonnes liées par des cellules fusionnées se déplacent ensemble ; les lignes d’en-tête restent dans l’en-tête."},
    it: {"reorderTable":"Riordina righe e colonne","moveRowUp":"Sposta riga su","moveRowDown":"Sposta riga giù","moveColumnLeft":"Sposta colonna a sinistra","moveColumnRight":"Sposta colonna a destra","reorderTableHint":"Seleziona una cella. Le righe o colonne collegate da celle unite si spostano insieme; le righe di intestazione restano nell’intestazione."},
    es: {"reorderTable":"Reordenar filas y columnas","moveRowUp":"Subir fila","moveRowDown":"Bajar fila","moveColumnLeft":"Mover columna a la izquierda","moveColumnRight":"Mover columna a la derecha","reorderTableHint":"Selecciona una celda. Las filas o columnas conectadas por celdas combinadas se mueven juntas; las filas de encabezado permanecen en el encabezado."},
    nl: {"reorderTable":"Rijen en kolommen herschikken","moveRowUp":"Rij omhoog","moveRowDown":"Rij omlaag","moveColumnLeft":"Kolom naar links","moveColumnRight":"Kolom naar rechts","reorderTableHint":"Selecteer eerst één cel. Door samengevoegde cellen verbonden rijen of kolommen bewegen samen; koprijen blijven in de kop."},
    pl: {"reorderTable":"Zmień kolejność wierszy i kolumn","moveRowUp":"Przesuń wiersz w górę","moveRowDown":"Przesuń wiersz w dół","moveColumnLeft":"Przesuń kolumnę w lewo","moveColumnRight":"Przesuń kolumnę w prawo","reorderTableHint":"Najpierw zaznacz jedną komórkę. Wiersze lub kolumny połączone scalonymi komórkami przesuwają się razem; wiersze nagłówka pozostają w nagłówku."},
  };
  const tableStyleCopies:Record<string,Pick<VisualElementsCopy,'tableAppearanceStyles'|'tableStyleGrid'|'tableStyleMinimal'|'tableStyleBanded'|'cellStyleLabel'|'tableStyleLabel'|'applyTableStyle'|'deleteTableStyle'|'tableStyleApplyHint'|'tableStyleName'|'tableStyleSaveAs'|'saveTableStyle'|'tableStyleSaveHint'|'tableStyleError'>>={
    fr: {"tableAppearanceStyles":"Styles de tableaux et de cellules","tableStyleGrid":"Grille","tableStyleMinimal":"Filets horizontaux","tableStyleBanded":"Lignes alternées","cellStyleLabel":"Style de cellule","tableStyleLabel":"Style de tableau","applyTableStyle":"Appliquer le style","deleteTableStyle":"Supprimer le style enregistré","tableStyleApplyHint":"Le style de tableau remplace l’apparence de toutes les cellules ; le style de cellule s’applique à la sélection. Texte et dimensions sont conservés.","tableStyleName":"Nom du style","tableStyleSaveAs":"Enregistrer comme","saveTableStyle":"Enregistrer le style","tableStyleSaveHint":"Stockage local. Le style reprend les premières cellules d’en-tête et du corps, éventuellement la deuxième ligne du corps.","tableStyleError":"Choisissez un nom unique (80 caractères max.) ; stockage indisponible ou limite de 50 styles atteinte."},
    it: {"tableAppearanceStyles":"Stili di tabella e cella","tableStyleGrid":"Griglia","tableStyleMinimal":"Linee orizzontali","tableStyleBanded":"Righe alternate","cellStyleLabel":"Stile cella","tableStyleLabel":"Stile tabella","applyTableStyle":"Applica stile","deleteTableStyle":"Elimina stile salvato","tableStyleApplyHint":"Lo stile tabella sostituisce l’aspetto delle celle; lo stile cella si applica alla selezione. Testo e dimensioni restano invariati.","tableStyleName":"Nome stile","tableStyleSaveAs":"Salva come","saveTableStyle":"Salva stile","tableStyleSaveHint":"Salvataggio locale. Lo stile campiona la prima cella di intestazione e del corpo, opzionalmente la seconda riga del corpo.","tableStyleError":"Scegli un nome univoco (max 80 caratteri); archivio non disponibile o limite di 50 stili raggiunto."},
    es: {"tableAppearanceStyles":"Estilos de tabla y celda","tableStyleGrid":"Cuadrícula","tableStyleMinimal":"Líneas horizontales","tableStyleBanded":"Filas alternas","cellStyleLabel":"Estilo de celda","tableStyleLabel":"Estilo de tabla","applyTableStyle":"Aplicar estilo","deleteTableStyle":"Eliminar estilo guardado","tableStyleApplyHint":"El estilo de tabla reemplaza la apariencia de todas las celdas; el de celda se aplica a la selección. Se conservan texto y dimensiones.","tableStyleName":"Nombre del estilo","tableStyleSaveAs":"Guardar como","saveTableStyle":"Guardar estilo","tableStyleSaveHint":"Guardado local. El estilo toma la primera celda del encabezado y del cuerpo, opcionalmente la segunda fila del cuerpo.","tableStyleError":"Elige un nombre único (máx. 80 caracteres); almacenamiento no disponible o límite de 50 estilos alcanzado."},
    nl: {"tableAppearanceStyles":"Tabel- en celstijlen","tableStyleGrid":"Raster","tableStyleMinimal":"Horizontale lijnen","tableStyleBanded":"Afwisselende rijen","cellStyleLabel":"Celstijl","tableStyleLabel":"Tabelstijl","applyTableStyle":"Stijl toepassen","deleteTableStyle":"Opgeslagen stijl verwijderen","tableStyleApplyHint":"Tabelstijlen vervangen het uiterlijk van alle cellen; celstijlen gelden voor de selectie. Tekst en afmetingen blijven behouden.","tableStyleName":"Stijlnaam","tableStyleSaveAs":"Opslaan als","saveTableStyle":"Stijl opslaan","tableStyleSaveHint":"Lokaal opgeslagen. De tabelstijl neemt de eerste kop- en gegevenscel over, eventueel de tweede gegevensrij.","tableStyleError":"Kies een unieke naam (max. 80 tekens); opslag niet beschikbaar of limiet van 50 stijlen bereikt."},
    pl: {"tableAppearanceStyles":"Style tabel i komórek","tableStyleGrid":"Siatka","tableStyleMinimal":"Linie poziome","tableStyleBanded":"Naprzemienne wiersze","cellStyleLabel":"Styl komórki","tableStyleLabel":"Styl tabeli","applyTableStyle":"Zastosuj styl","deleteTableStyle":"Usuń zapisany styl","tableStyleApplyHint":"Styl tabeli zastępuje wygląd wszystkich komórek; styl komórki dotyczy zaznaczenia. Tekst i wymiary pozostają bez zmian.","tableStyleName":"Nazwa stylu","tableStyleSaveAs":"Zapisz jako","saveTableStyle":"Zapisz styl","tableStyleSaveHint":"Zapis lokalny. Styl pobiera pierwszą komórkę nagłówka i danych, opcjonalnie drugi wiersz danych.","tableStyleError":"Wybierz unikatową nazwę (maks. 80 znaków); pamięć niedostępna lub osiągnięto limit 50 stylów."},
  };
  const cellNoteCopies:Record<string,string>={"fr":"Cette modification supprimerait ou dupliquerait une ancre de note, ou le tableau a changé. Supprimez les notes dans l’éditeur de notes.","it":"La modifica eliminerebbe o duplichererebbe un’ancora di nota, oppure la tabella è cambiata. Elimina le note nell’editor delle note.","es":"La modificación eliminaría o duplicaría un ancla de nota, o la tabla ha cambiado. Elimina las notas en el editor de notas.","nl":"Deze wijziging zou een nootanker verwijderen of dupliceren, of de tabel is gewijzigd. Verwijder noten in de noteneditor.","pl":"Zmiana usunęłaby lub powieliła kotwicę przypisu albo tabela uległa zmianie. Przypisy usuwaj w edytorze przypisów."};
  const rangeTextCopies:Record<string,Pick<VisualElementsCopy,'rangeTextFormatting'|'rangeTextFormattingHint'>>={"fr":{"rangeTextFormatting":"Formatage du texte des cellules sélectionnées","rangeTextFormattingHint":"S’applique au texte et aux paragraphes existants, y compris les listes. Les tableaux imbriqués et les notes sont formatés séparément. Les cellules vides ne reçoivent que les réglages de paragraphe."},"it":{"rangeTextFormatting":"Formattazione del testo delle celle selezionate","rangeTextFormattingHint":"Si applica al testo e ai paragrafi esistenti, incluse le liste. Tabelle annidate e note si formattano separatamente. Le celle vuote ricevono solo impostazioni di paragrafo."},"es":{"rangeTextFormatting":"Formato de texto de las celdas seleccionadas","rangeTextFormattingHint":"Se aplica al texto y los párrafos existentes, incluidas las listas. Las tablas anidadas y las notas se formatean por separado. Las celdas vacías solo reciben ajustes de párrafo."},"nl":{"rangeTextFormatting":"Tekstopmaak van geselecteerde cellen","rangeTextFormattingHint":"Geldt voor bestaande tekst en alinea’s, inclusief lijstitems. Geneste tabellen en noten worden apart opgemaakt. Lege cellen krijgen alleen alinea-instellingen."},"pl":{"rangeTextFormatting":"Formatowanie tekstu zaznaczonych komórek","rangeTextFormattingHint":"Dotyczy istniejącego tekstu i akapitów, także elementów list. Tabele zagnieżdżone i przypisy są formatowane osobno. Puste komórki otrzymują tylko ustawienia akapitu."}};
  const idmlTableCopies:Record<string,Pick<VisualElementsCopy,'idmlTableOnly'|'idmlTablePartial'>>={"fr":{"idmlTableOnly":"IDML : importe uniquement les tableaux modifiables, pas le document InDesign complet.","idmlTablePartial":"Certaines propriétés IDML n’ont pas été conservées. Vérifiez les tableaux avant publication."},"it":{"idmlTableOnly":"IDML: importa solo le tabelle modificabili, non l’intero documento InDesign.","idmlTablePartial":"Alcune proprietà IDML non sono state conservate. Controlla le tabelle prima della pubblicazione."},"es":{"idmlTableOnly":"IDML: importa solo tablas editables, no todo el documento InDesign.","idmlTablePartial":"No se conservaron algunas propiedades IDML. Revisa las tablas antes de publicar."},"nl":{"idmlTableOnly":"IDML: importeert alleen bewerkbare tabellen, niet het hele InDesign-document.","idmlTablePartial":"Sommige IDML-eigenschappen zijn niet behouden. Controleer de tabellen vóór publicatie."},"pl":{"idmlTableOnly":"IDML: importuje tylko edytowalne tabele, nie cały dokument InDesign.","idmlTablePartial":"Niektóre właściwości IDML nie zostały zachowane. Sprawdź tabele przed publikacją."}};
  const publicationTableCopies:Record<string,Pick<VisualElementsCopy,'publicationTableStyles'|'saveStyleToPublication'|'removeStyleFromPublication'|'defaultPublicationTableStyle'|'noDefaultPublicationTableStyle'|'publicationTableStyleHint'|'linkedPublicationTableStyle'|'detachPublicationTableStyle'|'updatePublicationTableStyle'>>={"fr":{"publicationTableStyles":"Styles de publication","linkedPublicationTableStyle":"Style de publication lié","detachPublicationTableStyle":"Dissocier le style (conserver la mise en forme)","updatePublicationTableStyle":"Actualiser le style depuis le tableau","saveStyleToPublication":"Copier le style dans la publication","removeStyleFromPublication":"Retirer le style de la publication","defaultPublicationTableStyle":"Style par défaut des nouveaux tableaux","noDefaultPublicationTableStyle":"Aucun style par défaut","publicationTableStyleHint":"Les styles actualisent automatiquement les tableaux liés. Les tableaux non liés restent inchangés."},"it":{"publicationTableStyles":"Stili di pubblicazione","linkedPublicationTableStyle":"Stile di pubblicazione collegato","detachPublicationTableStyle":"Scollega stile (mantieni aspetto)","updatePublicationTableStyle":"Aggiorna stile dalla tabella","saveStyleToPublication":"Copia stile nella pubblicazione","removeStyleFromPublication":"Rimuovi stile dalla pubblicazione","defaultPublicationTableStyle":"Stile predefinito per nuove tabelle","noDefaultPublicationTableStyle":"Nessuno stile predefinito","publicationTableStyleHint":"Gli stili aggiornano automaticamente le tabelle collegate. Le tabelle non collegate restano invariate."},"es":{"publicationTableStyles":"Estilos de publicación","linkedPublicationTableStyle":"Estilo de publicación vinculado","detachPublicationTableStyle":"Desvincular estilo (conservar formato)","updatePublicationTableStyle":"Actualizar estilo desde la tabla","saveStyleToPublication":"Copiar estilo a la publicación","removeStyleFromPublication":"Quitar estilo de la publicación","defaultPublicationTableStyle":"Estilo predeterminado de tablas nuevas","noDefaultPublicationTableStyle":"Sin estilo predeterminado","publicationTableStyleHint":"Los estilos actualizan automáticamente las tablas vinculadas. Las tablas no vinculadas no cambian."},"nl":{"publicationTableStyles":"Publicatiestijlen","linkedPublicationTableStyle":"Gekoppelde publicatiestijl","detachPublicationTableStyle":"Stijl ontkoppelen (opmaak behouden)","updatePublicationTableStyle":"Stijl bijwerken vanuit tabel","saveStyleToPublication":"Stijl naar publicatie kopiëren","removeStyleFromPublication":"Stijl uit publicatie verwijderen","defaultPublicationTableStyle":"Standaard voor nieuwe tabellen","noDefaultPublicationTableStyle":"Geen standaard","publicationTableStyleHint":"Stijlen werken gekoppelde tabellen automatisch bij. Niet-gekoppelde tabellen blijven ongewijzigd."},"pl":{"publicationTableStyles":"Style publikacji","linkedPublicationTableStyle":"Powiązany styl publikacji","detachPublicationTableStyle":"Odłącz styl (zachowaj wygląd)","updatePublicationTableStyle":"Aktualizuj styl z tabeli","saveStyleToPublication":"Kopiuj styl do publikacji","removeStyleFromPublication":"Usuń styl z publikacji","defaultPublicationTableStyle":"Domyślny styl nowych tabel","noDefaultPublicationTableStyle":"Bez stylu domyślnego","publicationTableStyleHint":"Style automatycznie aktualizują powiązane tabele. Niepowiązane tabele pozostają bez zmian."}};
  const cellCitationCopies:Record<string,Pick<VisualElementsCopy,'insertCellCitation'|'cellCitationProtected'>>={"fr":{"insertCellCitation":"Insérer une citation dans le texte","cellCitationProtected":"Cette modification supprimerait ou dupliquerait une ancre de citation, ou le tableau a changé. Utilisez l’éditeur de citations."},"it":{"insertCellCitation":"Inserisci citazione nel testo","cellCitationProtected":"La modifica eliminerebbe o duplicherebbe un’ancora di citazione, oppure la tabella è cambiata. Usa l’editor delle citazioni."},"es":{"insertCellCitation":"Insertar cita en el texto","cellCitationProtected":"La modificación eliminaría o duplicaría un ancla de cita, o la tabla ha cambiado. Usa el editor de citas."},"nl":{"insertCellCitation":"Citaat in tekst invoegen","cellCitationProtected":"Deze wijziging zou een citaatanker verwijderen of dupliceren, of de tabel is gewijzigd. Gebruik de citateneditor."},"pl":{"insertCellCitation":"Wstaw cytowanie w tekście","cellCitationProtected":"Zmiana usunęłaby lub powieliła kotwicę cytowania albo tabela uległa zmianie. Użyj edytora cytowań."}};
  const merge=mergeCopies[language];
  return {...translated,...rowCopies[language],...appearanceCopies[language],...edgeCopies[language],...heightCopies[language],...paragraphCopies[language],...cellListCopies[language],...nestedTableCopies[language],...rowResizeCopies[language],...rangeCopies[language],...reorderCopies[language],...tableStyleCopies[language],...rangeTextCopies[language],...idmlTableCopies[language],...publicationTableCopies[language],...cellCitationCopies[language],cellNoteProtected:cellNoteCopies[language]??translated.cellNoteProtected,tableHeaderRows:additionalHeaders[language] ?? translated.tableHeaderRows,...(merge?{mergeRight:merge[0],mergeDown:merge[1],splitCell:merge[2],mergeHint:merge[3]}:{})};
}
