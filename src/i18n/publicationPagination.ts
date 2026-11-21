const en = {
  autoContinue: 'Continue this text flow on following pages', continuationStyle: 'Continuation page style', inherit: 'Follow the current page style',
  frameBreak: 'Frame break at cursor', pageBreak: 'Page break at cursor', breaks: 'Text flow breakpoints', removeBreak: 'Remove breakpoint',
  breakHelp: 'A frame break continues in the next linked frame; a page break skips frames on the same page. Enable automatic continuation to create more pages.',
  deleteHelp: 'Deleting a frame page preserves its text flow. Text reflows into remaining frames and automatic continuation pages.',
  studies: 'Study order', up: 'Move study up', down: 'Move study down', keepSection: 'Keep this section together when it fits on one page',
  inserted: 'Inserted pages', anchor: 'Insert before paragraph', insertStyle: 'Style for inserted page', insert: 'Insert page', deletePage: 'Delete inserted page',
  insertHelp: 'An empty print page is anchored before the selected paragraph and follows it when studies move. Deleting it closes the gap and reflows the text.',
  missingAnchor: 'The target paragraph has been removed. This insertion is inactive.',
  fit: 'Section fit', continued: 'Continues on the next page', moved: 'Moved to the next page', oversized: 'The section is longer than one page; it continues despite the keep-together setting',
  page: 'Page', untitled: 'Untitled section',
  checker: 'Layout checker', enableChecker: 'Check layout', noIssues: 'No layout issues detected.', blockOverflow: 'This block exceeds the page text area',
};
type Copy = typeof en;
const hu: Copy = {
  autoContinue: 'Szövegfolyam automatikus folytatása a következő oldalakon', continuationStyle: 'Folytató oldalak stílusa', inherit: 'Aktuális oldalstílus követése',
  frameBreak: 'Kerettörés a kurzornál', pageBreak: 'Oldaltörés a kurzornál', breaks: 'Szövegfolyam töréspontjai', removeBreak: 'Töréspont eltávolítása',
  breakHelp: 'A kerettörés a következő összekapcsolt keretben, az oldaltörés a következő oldalon folytatja a szöveget. Az automatikus folytatás új oldalakat is létrehoz.',
  deleteHelp: 'A keretoldal törlése megőrzi a szövegfolyamot. A szöveg a megmaradt keretekbe és az automatikus folytató oldalakra tördelődik újra.',
  studies: 'Tanulmányok sorrendje', up: 'Tanulmány előrébb', down: 'Tanulmány hátrébb', keepSection: 'Szakasz együtt tartása, ha elfér egy teljes oldalon',
  inserted: 'Beszúrt oldalak', anchor: 'Beszúrás a bekezdés elé', insertStyle: 'Beszúrt oldal stílusa', insert: 'Oldal beszúrása', deletePage: 'Beszúrt oldal törlése',
  insertHelp: 'Az üres nyomtatási oldal a kiválasztott bekezdéshez kapcsolódik, és átrendezéskor is követi. Törlése megszünteti a helyét, és újratördeli a szöveget.',
  missingAnchor: 'A célbekezdést eltávolították. Ez az oldalbeszúrás jelenleg inaktív.',
  fit: 'Szakaszok elférése', continued: 'A szakasz a következő oldalon folytatódik', moved: 'A szakasz a következő oldalra került', oversized: 'A szakasz hosszabb egy teljes oldalnál; az együtt tartás beállítása mellett is folytatódik',
  page: 'Oldal', untitled: 'Névtelen szakasz',
  checker: 'Tördelési ellenőrző', enableChecker: 'Tördelés ellenőrzése', noIssues: 'Nem található tördelési probléma.', blockOverflow: 'Ez a blokk túlnyúlik az oldal szövegtükrén',
};
const de: Copy = {
  autoContinue: 'Textfluss auf folgenden Seiten automatisch fortsetzen', continuationStyle: 'Seitenstil der Fortsetzung', inherit: 'Aktuellen Seitenstil übernehmen',
  frameBreak: 'Rahmenumbruch am Cursor', pageBreak: 'Seitenumbruch am Cursor', breaks: 'Umbruchstellen im Textfluss', removeBreak: 'Umbruch entfernen',
  breakHelp: 'Ein Rahmenumbruch setzt im nächsten verknüpften Rahmen fort, ein Seitenumbruch auf der nächsten Seite. Der automatische Textfluss erstellt weitere Seiten.',
  deleteHelp: 'Beim Löschen einer Rahmenseite bleibt der Textfluss erhalten und wird in verbleibende Rahmen und automatische Folgeseiten umbrochen.',
  studies: 'Reihenfolge der Beiträge', up: 'Beitrag nach oben', down: 'Beitrag nach unten', keepSection: 'Abschnitt zusammenhalten, wenn er auf eine Seite passt',
  inserted: 'Eingefügte Seiten', anchor: 'Vor Absatz einfügen', insertStyle: 'Stil der eingefügten Seite', insert: 'Seite einfügen', deletePage: 'Eingefügte Seite löschen',
  insertHelp: 'Die leere Druckseite bleibt mit dem ausgewählten Absatz verbunden. Beim Löschen wird der Text neu umbrochen.',
  missingAnchor: 'Der Zielabsatz wurde entfernt. Diese Einfügung ist inaktiv.',
  fit: 'Abschnittsumbruch', continued: 'Abschnitt wird auf der nächsten Seite fortgesetzt', moved: 'Abschnitt auf die nächste Seite verschoben', oversized: 'Abschnitt ist länger als eine Seite und wird trotz Zusammenhalten fortgesetzt',
  page: 'Seite', untitled: 'Unbenannter Abschnitt',
  checker: 'Layoutprüfung', enableChecker: 'Layout prüfen', noIssues: 'Keine Layoutprobleme erkannt.', blockOverflow: 'Dieser Block überschreitet den Satzspiegel',
};
export function publicationPaginationCopy(locale: string): Copy { return locale.startsWith('hu') ? hu : locale.startsWith('de') ? de : en; }
