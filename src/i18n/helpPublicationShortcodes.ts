import type { HelpCopy, HelpTopic } from './help';
import { PUBLICATION_SHORTCODES } from '../model/publicationShortcodes';

const copy = {
  "en": {
    "title": "Title matter — dynamic metadata fields (shortcodes)",
    "body": "Open Publishing → Publication editor → Covers and title pages. Select a page or text frame, place the cursor, and choose Insert metadata field. You may also type a shortcode. Keep each token together with the same formatting. Enable Preview metadata fields to see resolved text; turn it off to edit the tokens.",
    "insert": "Insert metadata field",
    "tips": [
      "Save the layout as a publication template; the tokens are retained and resolve against the current publication in preview and HTML/PDF output, not against the previous issue.",
      "For an existing OJS issue, reopen it from OJS and choose Refresh imprint and editorial board. This updates the imported snapshot without replacing the article text or layout. Native OJS masthead data requires the compatible connector; custom masthead plugins may need an adapter.",
      "Missing or unknown fields remain visible as tokens and produce export diagnostics. Check the final PDF, especially frame overflow. Contents lists authors and titles, not page numbers. IDML, DOCX and ODT shortcode expansion is not established."
    ],
    "fields": [
      "Imprint (colophon or publisher/address/contact, copyright and available identifiers)",
      "Editorial board / native public masthead, grouped by role",
      "Publication authors",
      "Contents: study authors and titles",
      "Journal / series name",
      "Publisher",
      "Mailing address / publication place",
      "Contact name",
      "Publication title",
      "Volume",
      "Issue number",
      "Year",
      "Print ISSN",
      "Electronic ISSN",
      "ISBN",
      "DOI"
    ]
  },
  "hu": {
    "title": "Címnegyed – dinamikus adatmezők (shortcode-ok)",
    "body": "Nyissa meg: Publikálás → Kiadványszerkesztő → Borítók és címnegyed. Válasszon oldalt vagy szövegkeretet, helyezze el a kurzort, majd válassza az Adatmező beszúrása menüt. A shortcode kézzel is beírható. Egy kódon belül ne váltson formázást. Az Adatmezők előnézete a behelyettesített szöveget mutatja; kikapcsolásával a kódok szerkeszthetők.",
    "insert": "Adatmező beszúrása",
    "tips": [
      "Mentse a formátumot kiadványsablonként: a kódok megmaradnak, és az aktuális kiadvány adataira oldódnak fel az előnézetben, valamint a HTML/PDF-kimenetben.",
      "Már importált lapszámot nyisson meg ismét az OJS-ből, majd válassza az Impresszum és szerkesztőbizottság frissítése műveletet. A szöveg és a tördelés megmarad. A natív OJS-névsorhoz kompatibilis plugin szükséges; egyedi szerkesztőbizottsági bővítményhez további illesztés kellhet.",
      "A hiányzó vagy ismeretlen mező kódja látható marad, és exportálási hibajelzést eredményez. Ellenőrizze a PDF-et és a keretek túlcsordulását. A tartalomjegyzék szerzőket és címeket tartalmaz, oldalszámokat nem. Az IDML, DOCX és ODT shortcode-feloldása még nem igazolt."
    ],
    "fields": [
      "Impresszum (kolofon vagy kiadó/cím/kapcsolattartó, copyright és elérhető azonosítók)",
      "Szerkesztőbizottság – natív nyilvános névsor szerepkörönként",
      "A kiadvány szerzői",
      "Tartalomjegyzék: tanulmányok szerzői és címei",
      "Folyóirat vagy sorozat neve",
      "Kiadó",
      "Postacím vagy kiadási hely",
      "Kapcsolattartó neve",
      "Kiadvány címe",
      "Évfolyam vagy kötet",
      "Lapszám",
      "Kiadás éve",
      "Nyomtatott ISSN",
      "Elektronikus ISSN",
      "ISBN",
      "DOI"
    ]
  },
  "de": {
    "title": "Titelei – dynamische Datenfelder (Shortcodes)",
    "body": "Öffnen Sie Publizieren → Publikationseditor → Umschlag und Titelei. Wählen Sie eine Seite oder einen Textrahmen, setzen Sie den Cursor und wählen Sie Datenfeld einfügen. Shortcodes können auch eingetippt werden; ein Code muss einheitlich formatiert bleiben. Aktivieren Sie die Datenfeldvorschau; deaktivieren Sie sie zum Bearbeiten der Codes.",
    "insert": "Datenfeld einfügen",
    "tips": [
      "Speichern Sie das Layout als Publikationsvorlage. Die Codes bleiben erhalten und werden in Vorschau und HTML/PDF mit den aktuellen Publikationsdaten ersetzt.",
      "Öffnen Sie eine bereits importierte Ausgabe erneut aus OJS und wählen Sie Impressum und Redaktion aktualisieren. Text und Layout bleiben erhalten. Die native öffentliche OJS-Redaktion erfordert ein kompatibles Plugin; eigene Masthead-Plugins können einen Adapter benötigen.",
      "Fehlende oder unbekannte Felder bleiben als Codes sichtbar und erzeugen Exportdiagnosen. Prüfen Sie PDF und Rahmenüberlauf. Das Inhaltsverzeichnis enthält Autoren und Titel, keine Seitenzahlen. Die Auflösung in IDML, DOCX und ODT ist nicht bestätigt."
    ],
    "fields": [
      "Impressum (Kolophon oder Verlag/Adresse/Kontakt, Copyright und verfügbare Kennungen)",
      "Redaktion – öffentliche native Liste nach Rollen",
      "Autoren der Publikation",
      "Inhaltsverzeichnis: Autoren und Beitragstitel",
      "Zeitschrift oder Reihe",
      "Verlag",
      "Postanschrift oder Verlagsort",
      "Kontaktname",
      "Publikationstitel",
      "Jahrgang oder Band",
      "Heftnummer",
      "Erscheinungsjahr",
      "Druck-ISSN",
      "Elektronische ISSN",
      "ISBN",
      "DOI"
    ]
  },
  "fr": {
    "title": "Pages liminaires – champs dynamiques (shortcodes)",
    "body": "Ouvrez l’éditeur de publication, puis la couverture et les pages liminaires. Choisissez une page ou un cadre de texte, placez le curseur et insérez un champ de métadonnées. Vous pouvez aussi saisir le code sans changer sa mise en forme. Activez l’aperçu des champs pour voir les valeurs.",
    "insert": "Insérer un champ de métadonnées",
    "tips": [
      "Les codes restent dans les modèles et utilisent les données de la publication actuelle en aperçu et en HTML/PDF.",
      "Pour actualiser l’ours et le comité, ouvrez à nouveau le numéro depuis OJS et choisissez l’actualisation dédiée. Le texte et la mise en page restent intacts. Le connecteur compatible est requis; les extensions de comité personnalisées peuvent nécessiter un adaptateur.",
      "Les champs manquants restent visibles et produisent des diagnostics d’export. Vérifiez le PDF et les débordements. Le sommaire contient les auteurs et titres, sans pages. La résolution IDML/DOCX/ODT n’est pas confirmée."
    ],
    "fields": [
      "Ours",
      "Comité éditorial public par rôle",
      "Auteurs",
      "Sommaire : auteurs et titres",
      "Revue ou collection",
      "Éditeur",
      "Adresse postale ou lieu de publication",
      "Nom du contact",
      "Titre",
      "Volume",
      "Numéro",
      "Année",
      "ISSN imprimé",
      "ISSN électronique",
      "ISBN",
      "DOI"
    ]
  },
  "it": {
    "title": "Pagine preliminari – campi dinamici (shortcode)",
    "body": "Aprire l’editor di pubblicazione, copertina e pagine preliminari. Selezionare una pagina o una cornice di testo, posizionare il cursore e inserire un campo di metadati. Si può digitare il codice mantenendo la stessa formattazione. Attivare l’anteprima dei campi.",
    "insert": "Inserisci campo di metadati",
    "tips": [
      "I codici restano nei modelli e utilizzano i dati della pubblicazione corrente in anteprima e HTML/PDF.",
      "Riaprire il fascicolo da OJS e aggiornare colophon e comitato editoriale. Testo e impaginazione restano invariati. Serve il connettore compatibile; plugin personalizzati possono richiedere un adattatore.",
      "I campi mancanti rimangono visibili e generano diagnostica. Controllare PDF e testo eccedente. L’indice contiene autori e titoli, non numeri di pagina. La risoluzione IDML/DOCX/ODT non è confermata."
    ],
    "fields": [
      "Colophon",
      "Comitato editoriale pubblico per ruolo",
      "Autori",
      "Indice: autori e titoli",
      "Rivista o collana",
      "Editore",
      "Indirizzo o luogo di pubblicazione",
      "Nome del contatto",
      "Titolo",
      "Volume",
      "Fascicolo",
      "Anno",
      "ISSN cartaceo",
      "ISSN elettronico",
      "ISBN",
      "DOI"
    ]
  },
  "es": {
    "title": "Páginas preliminares – campos dinámicos (shortcodes)",
    "body": "Abra el editor de publicaciones, cubiertas y páginas preliminares. Seleccione una página o marco de texto, sitúe el cursor e inserte un campo de metadatos. También puede escribir el código sin cambiar su formato. Active la vista previa de campos.",
    "insert": "Insertar campo de metadatos",
    "tips": [
      "Los códigos permanecen en las plantillas y usan los datos actuales en la vista previa y HTML/PDF.",
      "Abra de nuevo el número desde OJS y actualice el colofón y comité editorial. Se conservan texto y diseño. Se requiere el conector compatible; extensiones personalizadas pueden necesitar un adaptador.",
      "Los campos ausentes quedan visibles y generan diagnósticos. Revise el PDF y el desbordamiento. El índice contiene autores y títulos, no páginas. La resolución IDML/DOCX/ODT no está confirmada."
    ],
    "fields": [
      "Colofón",
      "Comité editorial público por función",
      "Autores",
      "Índice: autores y títulos",
      "Revista o colección",
      "Editorial",
      "Dirección o lugar de publicación",
      "Nombre de contacto",
      "Título",
      "Volumen",
      "Número",
      "Año",
      "ISSN impreso",
      "ISSN electrónico",
      "ISBN",
      "DOI"
    ]
  },
  "nl": {
    "title": "Voorwerk – dynamische gegevensvelden (shortcodes)",
    "body": "Open de publicatie-editor, omslag en voorwerk. Selecteer een pagina of tekstkader, plaats de cursor en voeg een metadataveld in. Typ desgewenst de code met dezelfde opmaak. Schakel het veldvoorbeeld in.",
    "insert": "Metadataveld invoegen",
    "tips": [
      "Codes blijven in sjablonen staan en gebruiken de actuele publicatiegegevens in het voorbeeld en HTML/PDF.",
      "Open het nummer opnieuw vanuit OJS en werk colofon en redactie bij. Tekst en lay-out blijven behouden. Een compatibele connector is vereist; aangepaste plugins kunnen een adapter nodig hebben.",
      "Ontbrekende velden blijven zichtbaar en geven exportmeldingen. Controleer PDF en overlopende kaders. De inhoudsopgave bevat auteurs en titels, geen paginanummers. IDML/DOCX/ODT-omzetting is niet bevestigd."
    ],
    "fields": [
      "Colofon",
      "Openbare redactie per rol",
      "Auteurs",
      "Inhoudsopgave: auteurs en titels",
      "Tijdschrift of reeks",
      "Uitgever",
      "Postadres of plaats van uitgave",
      "Contactnaam",
      "Titel",
      "Jaargang",
      "Nummer",
      "Jaar",
      "ISSN gedrukt",
      "ISSN elektronisch",
      "ISBN",
      "DOI"
    ]
  },
  "pl": {
    "title": "Strony tytułowe – pola dynamiczne (shortcode)",
    "body": "Otwórz edytor publikacji, okładkę i strony tytułowe. Wybierz stronę lub ramkę tekstową, ustaw kursor i wstaw pole metadanych. Kod można wpisać ręcznie bez zmiany formatowania. Włącz podgląd pól.",
    "insert": "Wstaw pole metadanych",
    "tips": [
      "Kody pozostają w szablonach i korzystają z danych bieżącej publikacji w podglądzie oraz HTML/PDF.",
      "Otwórz ponownie numer z OJS i odśwież stopkę wydawniczą oraz redakcję. Tekst i układ pozostają bez zmian. Wymagany jest zgodny konektor; niestandardowe wtyczki mogą potrzebować adaptera.",
      "Brakujące pola pozostają widoczne i generują diagnostykę. Sprawdź PDF i przepełnienie ramek. Spis treści zawiera autorów i tytuły, bez numerów stron. Obsługa IDML/DOCX/ODT nie jest potwierdzona."
    ],
    "fields": [
      "Stopka wydawnicza",
      "Publiczna redakcja według ról",
      "Autorzy",
      "Spis treści: autorzy i tytuły",
      "Czasopismo lub seria",
      "Wydawca",
      "Adres lub miejsce wydania",
      "Osoba kontaktowa",
      "Tytuł",
      "Tom",
      "Numer",
      "Rok",
      "ISSN drukowany",
      "ISSN elektroniczny",
      "ISBN",
      "DOI"
    ]
  }
} as const;

export function getPublicationShortcodeHelp(locale: string) {
  const language = locale.toLowerCase().split(/[-_]/)[0] as keyof typeof copy;
  const text = copy[language] ?? copy.en;
  const fields = PUBLICATION_SHORTCODES.map((key, index) => ({ key, label: text.fields[index] }));
  const topic: HelpTopic = { title: text.title, body: text.body, tips: [...text.tips, ...fields.map(field => '[omi:' + field.key + '] — ' + field.label)] };
  return { topic, fields, insert: text.insert };
}

export function appendPublicationShortcodeHelp(locale: string, help: HelpCopy): HelpCopy {
  const { topic } = getPublicationShortcodeHelp(locale);
  return help.topics.some(existing => existing.title === topic.title) ? help : { ...help, topics: [...help.topics, topic] };
}
