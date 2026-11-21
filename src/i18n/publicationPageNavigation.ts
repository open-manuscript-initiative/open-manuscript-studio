const en = {
  title: 'Page thumbnails', page: 'Page', styles: 'Page style letters', insertStyle: 'New page style in thumbnails',
  before: 'Add page before', after: 'Add page after', remove: 'Delete page', up: 'Move page earlier', down: 'Move page later',
  frameHelp: 'Drag a thumbnail onto another page to move it there. The arrow buttons also change page order. Text flows survive page deletion.',
  bodyHelp: 'Continuous text pages move with their complete study. Inserted empty pages can be moved and deleted individually. Additions follow the nearest paragraph boundary.',
  defaultStyle: 'Default',
};
type Copy = typeof en;
const hu: Copy = {
  title: 'Oldalminiatűrök', page: 'Oldal', styles: 'Oldalstílusok betűjelei', insertStyle: 'Új oldal stílusa a miniatűrnézetben',
  before: 'Oldal hozzáadása elé', after: 'Oldal hozzáadása utána', remove: 'Oldal törlése', up: 'Oldal előrébb', down: 'Oldal hátrébb',
  frameHelp: 'Az oldal áthelyezéséhez húzd a miniatűrjét a céloldalra, vagy használd a nyílgombokat. Az oldal törlése megőrzi a szövegfolyamot.',
  bodyHelp: 'A folyószöveg oldalai a teljes tanulmánnyal együtt mozgathatók. A beszúrt üres oldalak egyenként mozgathatók és törölhetők. Az új oldalak a legközelebbi bekezdéshatárhoz kapcsolódnak.',
  defaultStyle: 'Alapértelmezett',
};
const de: Copy = {
  title: 'Seitenminiaturen', page: 'Seite', styles: 'Buchstaben der Seitenstile', insertStyle: 'Neuer Seitenstil in der Miniaturansicht',
  before: 'Seite davor einfügen', after: 'Seite danach einfügen', remove: 'Seite löschen', up: 'Seite nach vorne', down: 'Seite nach hinten',
  frameHelp: 'Ziehen Sie eine Miniatur auf die Zielseite oder verwenden Sie die Pfeiltasten. Beim Löschen einer Seite bleibt der Textfluss erhalten.',
  bodyHelp: 'Seiten im fortlaufenden Text werden mit dem gesamten Beitrag verschoben. Eingefügte leere Seiten können einzeln verschoben und gelöscht werden. Neue Seiten folgen der nächsten Absatzgrenze.',
  defaultStyle: 'Standard',
};
export function publicationPageNavigationCopy(locale: string): Copy { return locale.startsWith('hu') ? hu : locale.startsWith('de') ? de : en; }
