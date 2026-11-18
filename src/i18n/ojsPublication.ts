const en = {
  title: 'Publish the typeset study to OJS',
  close: 'Close OJS transfer',
  help: 'Apply the publisher style in this editor, inspect the OJS Production destination, then choose HTML, PDF or both. OJS keeps the final publication decision.',
  style: 'Current publisher style',
  connection: 'OJS connection',
  choose: 'Choose…',
  submission: 'OJS submission ID',
  inspect: 'Inspect OJS Production',
  noConnection:
    'Set up an OJS connection and a personal editorial API key in your profile first.',
  language: 'Publication language',
  genre: 'File genre',
  html: 'HTML',
  pdf: 'PDF',
  pdfMode: 'PDF mode',
  print: 'Print PDF',
  interactive: 'Interactive PDF',
  prepare: 'Prepare selected outputs',
  preparing: 'Preparing outputs…',
  transfer: 'Transfer selected outputs to OJS',
  busy: 'Working…',
  confirmation:
    'I checked the destination and previews. Transfer these exact files to OJS without publishing the article.',
  changed:
    'The manuscript or publisher style changed. Prepare the selected outputs again.',
  preview: 'Typeset HTML preview',
  pdfPreview: 'Open PDF preview',
  success:
    'All selected files are in OJS for editorial checking. The article has not been published.',
  partial:
    'Some files could not be confirmed. Completed files remain in OJS. Inspect the destination before preparing and explicitly retrying the remaining outputs.',
  received: 'Confirmed in OJS',
  galley: 'Galley',
  size: 'Size',
  failed: 'Unconfirmed output',
  studyOnly: 'OJS article transfer requires a standalone study.',
};
const hu: typeof en = {
  title: 'Tördelt tanulmány átadása OJS-be',
  close: 'OJS-átadás bezárása',
  help: 'Alkalmazd a kiadói stílust ebben a szerkesztőben, ellenőrizd az OJS előállítási célját, majd válaszd a HTML-, PDF- vagy mindkét kimenetet. A közzétételről továbbra is az OJS-ben dönt a szerkesztő.',
  style: 'Aktuális kiadói stílus',
  connection: 'OJS-kapcsolat',
  choose: 'Válassz…',
  submission: 'OJS-beküldés azonosítója',
  inspect: 'OJS előállítási cél ellenőrzése',
  noConnection:
    'Előbb állíts be OJS-kapcsolatot és személyes szerkesztői API-kulcsot a profilodban.',
  language: 'Publikáció nyelve',
  genre: 'Fájltípus',
  html: 'HTML',
  pdf: 'PDF',
  pdfMode: 'PDF-változat',
  print: 'Nyomtatási PDF',
  interactive: 'Interaktív PDF',
  prepare: 'Kijelölt kimenetek elkészítése',
  preparing: 'Kimenetek készítése…',
  transfer: 'Kijelölt kimenetek átadása OJS-be',
  busy: 'Feldolgozás…',
  confirmation:
    'Ellenőriztem a célt és az előnézeteket. Ezeket a pontos fájlokat adom át az OJS-nek, a cikk közzététele nélkül.',
  changed:
    'A kézirat vagy a kiadói stílus megváltozott. Készítsd el újra a kijelölt kimeneteket.',
  preview: 'Tördelt HTML előnézete',
  pdfPreview: 'PDF-előnézet megnyitása',
  success:
    'Minden kijelölt fájl az OJS-ben van, szerkesztői ellenőrzésre vár. A cikk közzététele nem történt meg.',
  partial:
    'Nem minden fájl átvétele igazolható. A sikeresen átadott fájlok az OJS-ben maradnak. Ellenőrizd a célt, majd a kimaradt kimeneteket újra elkészítve, külön megerősítéssel próbáld átadni.',
  received: 'OJS-átvétel visszaigazolva',
  galley: 'Olvasói fájl',
  size: 'Méret',
  failed: 'Nem visszaigazolt kimenet',
  studyOnly: 'OJS-cikk átadásához önálló tanulmány szükséges.',
};
const de: typeof en = {
  title: 'Gesetzten Beitrag an OJS übergeben',
  close: 'OJS-Übertragung schließen',
  help: 'Verlagsstil in diesem Editor anwenden, OJS-Produktionsziel prüfen und HTML, PDF oder beide wählen. Die Veröffentlichung entscheidet weiterhin die Redaktion in OJS.',
  style: 'Aktueller Verlagsstil',
  connection: 'OJS-Verbindung',
  choose: 'Auswählen…',
  submission: 'OJS-Einreichungs-ID',
  inspect: 'OJS-Produktionsziel prüfen',
  noConnection:
    'Zuerst OJS-Verbindung und persönlichen redaktionellen API-Schlüssel im Profil einrichten.',
  language: 'Publikationssprache',
  genre: 'Dateityp',
  html: 'HTML',
  pdf: 'PDF',
  pdfMode: 'PDF-Modus',
  print: 'Druck-PDF',
  interactive: 'Interaktives PDF',
  prepare: 'Ausgewählte Ausgaben erstellen',
  preparing: 'Ausgaben werden erstellt…',
  transfer: 'Ausgewählte Ausgaben an OJS übertragen',
  busy: 'Verarbeitung…',
  confirmation:
    'Ziel und Vorschauen sind geprüft. Diese exakten Dateien an OJS übertragen, ohne den Beitrag zu veröffentlichen.',
  changed:
    'Manuskript oder Verlagsstil geändert. Ausgewählte Ausgaben erneut erstellen.',
  preview: 'Vorschau des gesetzten HTML',
  pdfPreview: 'PDF-Vorschau öffnen',
  success:
    'Alle ausgewählten Dateien liegen in OJS zur redaktionellen Prüfung. Der Beitrag wurde nicht veröffentlicht.',
  partial:
    'Nicht alle Dateien wurden bestätigt. Erfolgreiche Dateien bleiben in OJS. Ziel prüfen und die fehlenden Ausgaben neu erstellen und ausdrücklich erneut übertragen.',
  received: 'In OJS bestätigt',
  galley: 'Fahne',
  size: 'Größe',
  failed: 'Unbestätigte Ausgabe',
  studyOnly:
    'Für einen OJS-Artikel ist ein eigenständiger Beitrag erforderlich.',
};
export function ojsPublicationCopy(locale: string) {
  return locale === 'hu' ? hu : locale === 'de' ? de : en;
}
