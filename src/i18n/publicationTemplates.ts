export function publicationTemplatesCopy(locale: string) {
  if (locale === 'hu') return {
    title: 'Kiadványsablonok', select: 'Kiadványsablon', none: 'Sablon nélkül', name: 'Sablon neve', seriesTitle: 'Sorozat címe', association: 'Sorozat vagy folyóirat neve',
    apply: 'Sablon alkalmazása', save: 'Mentés új sablonként', update: 'Kijelölt sablon frissítése', remove: 'Sablon törlése', export: 'Sablon exportálása', import: 'Sablon importálása',
    help: 'A sablon megőrzi a beírt szövegeket, címadatokat, ISSN-eket és kiadványbeállításokat. A könyvek ISBN-je és eISBN-je nem kerül át az új kötetbe. Az alkalmazás a jelenlegi formátumot és borítót lecseréli; a kézirat tartalma és saját adatai megmaradnak.',
    placeholders: 'A borító és címnegyed szövegében használható például: {{title}}, {{subtitle}}, {{publicationYear}}, {{isbn}}, {{doi}}. Mentéskor a jelenlegi cím és egyedi adatok helyére automatikusan helyőrzők kerülnek.',
    storage: 'A saját sablonok ezen az eszközön maradnak meg. Másik eszközhöz exportálja, majd importálja a sablont.',
    saved: 'A sablon elmentve.', applied: 'A sablon alkalmazva.', deleted: 'A sablon törölve.', imported: 'A sablon importálva.', error: 'A sablonművelet nem sikerült. Ellenőrizze a fájlt, a képeket és a rendelkezésre álló tárhelyet.',
    loadError: 'A mentett sablonok nem tölthetők be. A beépített sablonok használhatók.', busy: 'Feldolgozás…',
    series: 'Könyvsorozat – A5', journal: 'Folyóirat – 150 × 240 mm',
  };
  if (locale === 'de') return {
    title: 'Publikationsvorlagen', select: 'Publikationsvorlage', none: 'Ohne Vorlage', name: 'Vorlagenname', seriesTitle: 'Reihentitel', association: 'Name der Reihe oder Zeitschrift',
    apply: 'Vorlage anwenden', save: 'Als neue Vorlage speichern', update: 'Ausgewählte Vorlage aktualisieren', remove: 'Vorlage löschen', export: 'Vorlage exportieren', import: 'Vorlage importieren',
    help: 'Vorlagen speichern eingegebene Texte, Titelangaben, ISSN und Publikationseinstellungen. ISBN und eISBN von Büchern werden nicht übernommen. Die Anwendung ersetzt das aktuelle Format und den Umschlag; Manuskriptinhalt und individuelle Angaben bleiben erhalten.',
    placeholders: 'Umschlag und Titelei unterstützen beispielsweise {{title}}, {{subtitle}}, {{publicationYear}}, {{isbn}}, {{doi}}. Beim Speichern werden der aktuelle Titel und individuelle Angaben automatisch durch Platzhalter ersetzt.',
    storage: 'Eigene Vorlagen werden auf diesem Gerät gespeichert. Für andere Geräte die Vorlage exportieren und importieren.',
    saved: 'Vorlage gespeichert.', applied: 'Vorlage angewendet.', deleted: 'Vorlage gelöscht.', imported: 'Vorlage importiert.', error: 'Vorlagenaktion fehlgeschlagen. Datei, Bilder und verfügbaren Speicher prüfen.',
    loadError: 'Gespeicherte Vorlagen konnten nicht geladen werden. Integrierte Vorlagen sind verfügbar.', busy: 'Verarbeitung…',
    series: 'Buchreihe – A5', journal: 'Zeitschrift – 150 × 240 mm',
  };
  return {
    title: 'Publication templates', select: 'Publication template', none: 'Without a template', name: 'Template name', seriesTitle: 'Series title', association: 'Series or journal name',
    apply: 'Apply template', save: 'Save as new template', update: 'Update selected template', remove: 'Delete template', export: 'Export template', import: 'Import template',
    help: 'Templates retain entered text, title data, ISSNs and publication settings. Book ISBNs and eISBNs are not carried over to the next volume. Applying replaces the current format and covers; manuscript content and individual metadata are preserved.',
    placeholders: 'Cover and title-page text supports placeholders such as {{title}}, {{subtitle}}, {{publicationYear}}, {{isbn}}, {{doi}}. Saving automatically replaces the current title and individual metadata with placeholders.',
    storage: 'Custom templates are saved on this device. Export and import a template to use it on another device.',
    saved: 'Template saved.', applied: 'Template applied.', deleted: 'Template deleted.', imported: 'Template imported.', error: 'The template operation failed. Check the file, images and available storage.',
    loadError: 'Saved templates could not be loaded. Built-in templates remain available.', busy: 'Processing…',
    series: 'Book series — A5', journal: 'Journal — 150 × 240 mm',
  };
}
