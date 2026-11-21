import type { PublicationMatterPageKind } from '../model/publicationMatter';

const labels = {
  hu: {
    sheetHelp: 'A borító egyetlen ív. A szaggatott hajtásvonalakon a szöveg és a kép is átnyúlhat; a segédvonalak nem kerülnek az exportba.', sheetSize: 'Borítóív mérete', frameArea: 'Új keret helye', wholeSheet: 'Teljes borítóív',
    title: 'Borító és címnegyed', description: 'A kiadvány önálló oldalai, a tanulmányoktól elkülönítve. A bekapcsolt oldalak a HTML- és PDF-kiadás elejére vagy végére kerülnek.',
    spineWidth: 'Gerinc szélessége (mm)', spineHelp: 'A gerinc bekapcsolásakor a külső hátsó borító, a gerinc és a külső első borító egy közös borítóíven kerül a HTML/PDF-kiadásba. A gerinc szövegkeretei külön forgathatók.',
    units: 'Méretezés egysége', unitMm: 'Milliméter (mm)', unitPica: 'Pica (pc)', unitPoint: 'DTP pont (pt)', unitHelp: '1 pica = 12 pont; 72 pont = 25,4 mm. Egységváltáskor a tényleges méret megmarad.',
    kind: 'Kiadvány típusa', volume: 'Kötet', journal: 'Folyóiratszám', include: 'Szerepeljen a kiadásban',
    template: 'Kitöltés a kiadvány adataiból', image: 'Borítókép feltöltése', removeImage: 'Kép eltávolítása', alt: 'Kép szöveges leírása',
    fit: 'Kép illesztése', contain: 'Teljes kép', cover: 'Oldal kitöltése', font: 'Betűcsalád', size: 'Betűméret (pt)',
    color: 'Szövegszín', background: 'Háttérszín', padding: 'Belső térköz (mm)', alignment: 'Igazítás', left: 'Balra', center: 'Középre', right: 'Jobbra', justify: 'Sorkizárt',
    vertical: 'Függőleges elhelyezés', top: 'Fent', middle: 'Középen', bottom: 'Lent', content: 'Az oldal szövege',
    imageError: 'Legfeljebb 16 MiB méretű PNG-, JPEG- vagy WebP-képet válasszon.',
    pages: { 'front-cover': 'I. Első borító – külső', 'inside-front-cover': 'II. Első borító – belső', 'half-title': 'Félcímlap',
      'series-page': 'Sorozati oldal / címnegyed 2. oldala', 'title-page': 'Címlap', 'imprint-page': 'Impresszum / címnegyed 4. oldala',
      'inside-back-cover': 'III. Hátsó borító – belső', 'back-cover': 'IV. Hátsó borító – külső', spine: 'Gerinc', 'cover-outside': 'Borító – külső oldal', 'cover-inside': 'Borító – belső oldal' },
  },
  en: {
    sheetHelp: 'The cover is one sheet. Text and images may cross the dashed fold lines; guides are omitted from export.', sheetSize: 'Cover sheet size', frameArea: 'New frame placement', wholeSheet: 'Whole cover sheet',
    title: 'Covers and title pages', description: 'Independent publication pages, separate from individual studies. Enabled pages appear before or after the content in HTML and PDF publication output.',
    spineWidth: 'Spine width (mm)', spineHelp: 'Enabling the spine combines the outside back cover, spine and outside front cover into one cover spread in HTML/PDF output. Spine text frames can be rotated independently.',
    units: 'Measurement units', unitMm: 'Millimetres (mm)', unitPica: 'Picas (pc)', unitPoint: 'DTP points (pt)', unitHelp: '1 pica = 12 points; 72 points = 25.4 mm. Switching units preserves physical dimensions.',
    kind: 'Publication type', volume: 'Volume', journal: 'Journal issue', include: 'Include in publication',
    template: 'Fill from publication metadata', image: 'Upload cover image', removeImage: 'Remove image', alt: 'Image description',
    fit: 'Image fit', contain: 'Entire image', cover: 'Fill page', font: 'Font family', size: 'Font size (pt)',
    color: 'Text color', background: 'Background color', padding: 'Padding (mm)', alignment: 'Alignment', left: 'Left', center: 'Center', right: 'Right', justify: 'Justified',
    vertical: 'Vertical placement', top: 'Top', middle: 'Center', bottom: 'Bottom', content: 'Page text',
    imageError: 'Choose a PNG, JPEG or WebP image up to 16 MiB.',
    pages: { 'front-cover': 'I. Front cover – outside', 'inside-front-cover': 'II. Front cover – inside', 'half-title': 'Half-title',
      'series-page': 'Series page / title matter page 2', 'title-page': 'Title page', 'imprint-page': 'Imprint / title matter page 4',
      'inside-back-cover': 'III. Back cover – inside', 'back-cover': 'IV. Back cover – outside', spine: 'Spine', 'cover-outside': 'Cover – outside', 'cover-inside': 'Cover – inside' },
  },
  de: {
    sheetHelp: 'Der Umschlag ist ein Bogen. Text und Bilder dürfen die gestrichelten Falzlinien überqueren; Hilfslinien werden nicht exportiert.', sheetSize: 'Umschlagbogengröße', frameArea: 'Position neuer Rahmen', wholeSheet: 'Ganzer Umschlagbogen',
    title: 'Umschlag und Titelei', description: 'Eigenständige Publikationsseiten, getrennt von den einzelnen Beiträgen. Aktivierte Seiten erscheinen vor oder nach dem Inhalt in der HTML- und PDF-Ausgabe.',
    spineWidth: 'Rückenbreite (mm)', spineHelp: 'Bei aktiviertem Rücken bilden hinterer Umschlag, Rücken und vorderer Umschlag eine gemeinsame Außenseite in der HTML/PDF-Ausgabe. Textrahmen auf dem Rücken sind frei drehbar.',
    units: 'Maßeinheit', unitMm: 'Millimeter (mm)', unitPica: 'Pica (pc)', unitPoint: 'DTP-Punkt (pt)', unitHelp: '1 Pica = 12 Punkt; 72 Punkt = 25,4 mm. Einheitenwechsel erhalten die tatsächlichen Abmessungen.',
    kind: 'Publikationstyp', volume: 'Band', journal: 'Zeitschriftenheft', include: 'In die Ausgabe aufnehmen',
    template: 'Aus Publikationsmetadaten ausfüllen', image: 'Umschlagbild hochladen', removeImage: 'Bild entfernen', alt: 'Bildbeschreibung',
    fit: 'Bildanpassung', contain: 'Gesamtes Bild', cover: 'Seite ausfüllen', font: 'Schriftfamilie', size: 'Schriftgröße (pt)',
    color: 'Textfarbe', background: 'Hintergrundfarbe', padding: 'Innenabstand (mm)', alignment: 'Ausrichtung', left: 'Links', center: 'Zentriert', right: 'Rechts', justify: 'Blocksatz',
    vertical: 'Vertikale Position', top: 'Oben', middle: 'Mitte', bottom: 'Unten', content: 'Seitentext',
    imageError: 'Wählen Sie ein PNG-, JPEG- oder WebP-Bild bis 16 MiB.',
    pages: { 'front-cover': 'I. Vorderer Umschlag – außen', 'inside-front-cover': 'II. Vorderer Umschlag – innen', 'half-title': 'Schmutztitel',
      'series-page': 'Reihentitel / Titelei Seite 2', 'title-page': 'Haupttitel', 'imprint-page': 'Impressum / Titelei Seite 4',
      'inside-back-cover': 'III. Hinterer Umschlag – innen', 'back-cover': 'IV. Hinterer Umschlag – außen', spine: 'Buchrücken', 'cover-outside': 'Umschlag – außen', 'cover-inside': 'Umschlag – innen' },
  },
} satisfies Record<string, { pages: Record<PublicationMatterPageKind, string> } & Record<string, unknown>>;

export function getPublicationMatterCopy(locale: string) {
  return labels[locale as keyof typeof labels] ?? labels.en;
}
