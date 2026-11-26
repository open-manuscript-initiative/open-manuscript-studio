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
  },
  "bg": {
    "title": "Динамични полета в заглавните страници",
    "body": "Отворете редактора на публикации, изберете страница или текстова рамка и вмъкнете поле за метаданни. Запазете еднакво форматиране на кода.",
    "insert": "Вмъкване на поле",
    "tips": [
      "Кодовете остават в шаблона. За обновяване на издателските данни отворете броя от OJS отново. Проверете HTML/PDF."
    ],
    "fields": [
      "Издателски данни",
      "Редакционна колегия",
      "Автори",
      "Съдържание",
      "Списание",
      "Издател",
      "Адрес",
      "Контакт",
      "Заглавие",
      "Том",
      "Брой",
      "Година",
      "Печатен ISSN",
      "Електронен ISSN",
      "ISBN",
      "DOI"
    ]
  },
  "cs": {
    "title": "Dynamická pole titulních stran",
    "body": "Otevřete editor publikace, vyberte titulní stranu nebo textový rámeček a vložte pole metadat. Celý kód musí mít stejné formátování.",
    "insert": "Vložit pole metadat",
    "tips": [
      "Kódy zůstávají v šabloně. Pro aktualizaci tiráže otevřete číslo znovu z OJS. Zkontrolujte HTML/PDF."
    ],
    "fields": [
      "Tiráž",
      "Redakční rada",
      "Autoři",
      "Obsah",
      "Časopis",
      "Vydavatel",
      "Adresa",
      "Kontakt",
      "Název",
      "Ročník",
      "Číslo",
      "Rok",
      "Tištěné ISSN",
      "Elektronické ISSN",
      "ISBN",
      "DOI"
    ]
  },
  "da": {
    "title": "Dynamiske felter i forværket",
    "body": "Åbn publikationseditoren, vælg en titelside eller tekstramme, og indsæt et metadatafelt. Hele koden skal have samme formatering.",
    "insert": "Indsæt metadatafelt",
    "tips": [
      "Koderne bevares i skabelonen. Åbn nummeret igen fra OJS for at opdatere kolofonen. Kontrollér HTML/PDF."
    ],
    "fields": [
      "Kolofon",
      "Redaktionsråd",
      "Forfattere",
      "Indhold",
      "Tidsskrift",
      "Forlag",
      "Adresse",
      "Kontakt",
      "Titel",
      "Bind",
      "Nummer",
      "År",
      "Trykt ISSN",
      "Elektronisk ISSN",
      "ISBN",
      "DOI"
    ]
  },
  "el": {
    "title": "Δυναμικά πεδία προκαταρκτικών σελίδων",
    "body": "Ανοίξτε τον επεξεργαστή έκδοσης, επιλέξτε σελίδα τίτλου ή πλαίσιο κειμένου και εισαγάγετε πεδίο μεταδεδομένων με ενιαία μορφοποίηση.",
    "insert": "Εισαγωγή πεδίου",
    "tips": [
      "Οι κωδικοί παραμένουν στο πρότυπο. Ανοίξτε ξανά το τεύχος από το OJS για ενημέρωση των στοιχείων έκδοσης. Ελέγξτε το HTML/PDF."
    ],
    "fields": [
      "Στοιχεία έκδοσης",
      "Συντακτική επιτροπή",
      "Συγγραφείς",
      "Περιεχόμενα",
      "Περιοδικό",
      "Εκδότης",
      "Διεύθυνση",
      "Επικοινωνία",
      "Τίτλος",
      "Τόμος",
      "Τεύχος",
      "Έτος",
      "Έντυπο ISSN",
      "Ηλεκτρονικό ISSN",
      "ISBN",
      "DOI"
    ]
  },
  "et": {
    "title": "Tiitellehtede dünaamilised väljad",
    "body": "Avage väljaande redaktor, valige tiitelleht või tekstiraam ja lisage metaandmeväli. Kogu kood peab olema ühesuguse vorminguga.",
    "insert": "Lisa metaandmeväli",
    "tips": [
      "Koodid jäävad malli. Impressumi uuendamiseks avage number uuesti OJS-ist. Kontrollige HTML/PDF-i."
    ],
    "fields": [
      "Impressum",
      "Toimetuskolleegium",
      "Autorid",
      "Sisukord",
      "Ajakiri",
      "Kirjastaja",
      "Aadress",
      "Kontakt",
      "Pealkiri",
      "Köide",
      "Number",
      "Aasta",
      "Trükitud ISSN",
      "Elektrooniline ISSN",
      "ISBN",
      "DOI"
    ]
  },
  "fi": {
    "title": "Alkulehtien dynaamiset kentät",
    "body": "Avaa julkaisueditori, valitse nimiösivu tai tekstikehys ja lisää metatietokenttä. Käytä koko koodissa samaa muotoilua.",
    "insert": "Lisää metatietokenttä",
    "tips": [
      "Koodit säilyvät mallissa. Päivitä julkaisutiedot avaamalla numero uudelleen OJS:stä. Tarkista HTML/PDF."
    ],
    "fields": [
      "Julkaisutiedot",
      "Toimituskunta",
      "Tekijät",
      "Sisällys",
      "Lehti",
      "Kustantaja",
      "Osoite",
      "Yhteyshenkilö",
      "Otsikko",
      "Vuosikerta",
      "Numero",
      "Vuosi",
      "Painettu ISSN",
      "Sähköinen ISSN",
      "ISBN",
      "DOI"
    ]
  },
  "ga": {
    "title": "Réimsí dinimiciúla sna réamhleathanaigh",
    "body": "Oscail eagarthóir an fhoilseacháin, roghnaigh leathanach teidil nó fráma téacs agus ionsáigh réimse meiteashonraí le formáidiú aonfhoirmeach.",
    "insert": "Ionsáigh réimse",
    "tips": [
      "Fanann na cóid sa teimpléad. Athoscail an t-eagrán ó OJS chun sonraí foilsitheoireachta a nuashonrú. Seiceáil HTML/PDF."
    ],
    "fields": [
      "Sonraí foilsitheoireachta",
      "Bord eagarthóireachta",
      "Údair",
      "Clár ábhair",
      "Iris",
      "Foilsitheoir",
      "Seoladh",
      "Teagmhálaí",
      "Teideal",
      "Imleabhar",
      "Eagrán",
      "Bliain",
      "ISSN clóite",
      "ISSN leictreonach",
      "ISBN",
      "DOI"
    ]
  },
  "hr": {
    "title": "Dinamička polja naslovnih stranica",
    "body": "Otvorite uređivač publikacije, odaberite naslovnu stranicu ili tekstni okvir i umetnite polje metapodataka. Cijeli kod treba imati jednako oblikovanje.",
    "insert": "Umetni polje metapodataka",
    "tips": [
      "Kodovi ostaju u predlošku. Ponovno otvorite broj iz OJS-a za osvježavanje impresuma. Provjerite HTML/PDF."
    ],
    "fields": [
      "Impresum",
      "Uredništvo",
      "Autori",
      "Sadržaj",
      "Časopis",
      "Nakladnik",
      "Adresa",
      "Kontakt",
      "Naslov",
      "Svezak",
      "Broj",
      "Godina",
      "Tiskani ISSN",
      "Elektronički ISSN",
      "ISBN",
      "DOI"
    ]
  },
  "lt": {
    "title": "Dinaminiai antraštinių puslapių laukai",
    "body": "Atverkite leidinio redaktorių, pasirinkite antraštinį puslapį arba teksto rėmelį ir įterpkite metaduomenų lauką. Visam kodui taikykite vienodą formatavimą.",
    "insert": "Įterpti lauką",
    "tips": [
      "Kodai išlieka šablone. Leidybos informacijai atnaujinti iš naujo atverkite numerį iš OJS. Patikrinkite HTML/PDF."
    ],
    "fields": [
      "Leidybos informacija",
      "Redakcinė kolegija",
      "Autoriai",
      "Turinys",
      "Žurnalas",
      "Leidėjas",
      "Adresas",
      "Kontaktas",
      "Antraštė",
      "Tomas",
      "Numeris",
      "Metai",
      "Spausdintas ISSN",
      "Elektroninis ISSN",
      "ISBN",
      "DOI"
    ]
  },
  "lv": {
    "title": "Titullapu dinamiskie lauki",
    "body": "Atveriet publikācijas redaktoru, izvēlieties titullapu vai teksta rāmi un ievietojiet metadatu lauku. Visam kodam jābūt vienādi formatētam.",
    "insert": "Ievietot metadatu lauku",
    "tips": [
      "Kodi saglabājas veidnē. Lai atjaunotu izdevuma ziņas, atveriet numuru no OJS vēlreiz. Pārbaudiet HTML/PDF."
    ],
    "fields": [
      "Izdevuma ziņas",
      "Redkolēģija",
      "Autori",
      "Saturs",
      "Žurnāls",
      "Izdevējs",
      "Adrese",
      "Kontaktpersona",
      "Nosaukums",
      "Sējums",
      "Numurs",
      "Gads",
      "Drukātais ISSN",
      "Elektroniskais ISSN",
      "ISBN",
      "DOI"
    ]
  },
  "mt": {
    "title": "Oqsma dinamiċi fil-paġni preliminari",
    "body": "Iftaħ l-editur tal-pubblikazzjoni, agħżel paġna tat-titlu jew qafas tat-test u daħħal qasam tal-metadata. Żomm l-istess ifformattjar fil-kodiċi kollu.",
    "insert": "Daħħal qasam",
    "tips": [
      "Il-kodiċijiet jibqgħu fil-mudell. Erġa’ iftaħ il-ħarġa minn OJS biex taġġorna d-dettalji tal-pubblikazzjoni. Iċċekkja HTML/PDF."
    ],
    "fields": [
      "Dettalji tal-pubblikazzjoni",
      "Bord editorjali",
      "Awturi",
      "Werrej",
      "Ġurnal",
      "Pubblikatur",
      "Indirizz",
      "Kuntatt",
      "Titlu",
      "Volum",
      "Ħarġa",
      "Sena",
      "ISSN stampat",
      "ISSN elettroniku",
      "ISBN",
      "DOI"
    ]
  },
  "pt": {
    "title": "Campos dinâmicos nas páginas preliminares",
    "body": "Abra o editor de publicação, selecione uma página de rosto ou caixa de texto e insira um campo de metadados. Mantenha a formatação uniforme no código.",
    "insert": "Inserir campo de metadados",
    "tips": [
      "Os códigos permanecem no modelo. Reabra o número no OJS para atualizar a ficha editorial. Verifique HTML/PDF."
    ],
    "fields": [
      "Ficha editorial",
      "Conselho editorial",
      "Autores",
      "Índice",
      "Revista",
      "Editora",
      "Endereço",
      "Contacto",
      "Título",
      "Volume",
      "Número",
      "Ano",
      "ISSN impresso",
      "ISSN eletrónico",
      "ISBN",
      "DOI"
    ]
  },
  "ro": {
    "title": "Câmpuri dinamice în paginile preliminare",
    "body": "Deschideți editorul publicației, selectați o pagină de titlu sau un cadru de text și introduceți un câmp de metadate. Păstrați formatarea uniformă a codului.",
    "insert": "Inserează câmp",
    "tips": [
      "Codurile rămân în șablon. Redeschideți numărul din OJS pentru a actualiza caseta editorială. Verificați HTML/PDF."
    ],
    "fields": [
      "Casetă editorială",
      "Colegiu editorial",
      "Autori",
      "Cuprins",
      "Revistă",
      "Editură",
      "Adresă",
      "Contact",
      "Titlu",
      "Volum",
      "Număr",
      "An",
      "ISSN tipărit",
      "ISSN electronic",
      "ISBN",
      "DOI"
    ]
  },
  "sk": {
    "title": "Dynamické polia titulných strán",
    "body": "Otvorte editor publikácie, vyberte titulnú stranu alebo textový rám a vložte pole metadát. Celý kód musí mať rovnaké formátovanie.",
    "insert": "Vložiť pole metadát",
    "tips": [
      "Kódy zostávajú v šablóne. Pre aktualizáciu tiráže otvorte číslo znova z OJS. Skontrolujte HTML/PDF."
    ],
    "fields": [
      "Tiráž",
      "Redakčná rada",
      "Autori",
      "Obsah",
      "Časopis",
      "Vydavateľ",
      "Adresa",
      "Kontakt",
      "Názov",
      "Ročník",
      "Číslo",
      "Rok",
      "Tlačené ISSN",
      "Elektronické ISSN",
      "ISBN",
      "DOI"
    ]
  },
  "sl": {
    "title": "Dinamična polja naslovnih strani",
    "body": "Odprite urejevalnik publikacije, izberite naslovno stran ali besedilni okvir in vstavite polje metapodatkov. Celotna koda naj bo enotno oblikovana.",
    "insert": "Vstavi polje metapodatkov",
    "tips": [
      "Kode ostanejo v predlogi. Za osvežitev impresuma znova odprite številko iz OJS. Preverite HTML/PDF."
    ],
    "fields": [
      "Impresum",
      "Uredniški odbor",
      "Avtorji",
      "Kazalo",
      "Revija",
      "Založnik",
      "Naslov sedeža",
      "Kontakt",
      "Naslov",
      "Letnik",
      "Številka",
      "Leto",
      "Tiskani ISSN",
      "Elektronski ISSN",
      "ISBN",
      "DOI"
    ]
  },
  "sv": {
    "title": "Dynamiska fält på försättssidor",
    "body": "Öppna publikationsredigeraren, välj en titelsida eller textram och infoga ett metadatafält. Behåll enhetlig formatering i hela koden.",
    "insert": "Infoga metadatafält",
    "tips": [
      "Koderna sparas i mallen. Öppna numret igen från OJS för att uppdatera kolofonen. Kontrollera HTML/PDF."
    ],
    "fields": [
      "Kolofon",
      "Redaktionsråd",
      "Författare",
      "Innehåll",
      "Tidskrift",
      "Förlag",
      "Adress",
      "Kontakt",
      "Titel",
      "Volym",
      "Nummer",
      "År",
      "Tryckt ISSN",
      "Elektroniskt ISSN",
      "ISBN",
      "DOI"
    ]
  }
} as const;

const languageTips = {
  "hu": "A kiadvány vagy keret nyelvét felülírhatja a kód nyelvi utótagja: [omi:journal:hu], [omi:editorial-board:en]. A hiányzó OJS-fordítást nem helyettesíti más nyelvű mezővel és nem fordítja le automatikusan. Az azonosítók és a szerzők rögzített nevei közösek; a szerkesztőségi nyilvános névváltozatokat használja, ha elérhetők.",
  "en": "Override the publication or frame language with a suffix: [omi:journal:hu], [omi:editorial-board:en]. Missing OJS translations are not replaced by another language or generated automatically. Identifiers and recorded author names are shared; public editorial name variants are used when available.",
  "de": "Die Publikations- oder Rahmensprache lässt sich per Suffix überschreiben: [omi:journal:hu], [omi:editorial-board:en]. Fehlende OJS-Übersetzungen werden nicht durch andere Sprachen ersetzt oder automatisch erzeugt. Kennungen und erfasste Autorennamen bleiben gemeinsam; öffentliche Namensvarianten der Redaktion werden verwendet, sofern verfügbar.",
  "fr": "Le suffixe choisit la langue : [omi:journal:hu], [omi:editorial-board:en]. Les traductions OJS manquantes ne sont ni remplacées ni générées automatiquement.",
  "it": "Il suffisso seleziona la lingua: [omi:journal:hu], [omi:editorial-board:en]. Le traduzioni OJS mancanti non sono sostituite né generate automaticamente.",
  "es": "El sufijo selecciona el idioma: [omi:journal:hu], [omi:editorial-board:en]. No se sustituyen ni generan automáticamente traducciones OJS ausentes.",
  "nl": "Het achtervoegsel kiest de taal: [omi:journal:hu], [omi:editorial-board:en]. Ontbrekende OJS-vertalingen worden niet vervangen of automatisch gegenereerd.",
  "pl": "Przyrostek wybiera język: [omi:journal:hu], [omi:editorial-board:en]. Brakujące tłumaczenia OJS nie są zastępowane ani generowane automatycznie.",
  "bg": "Суфиксът избира езика. Липсващите преводи не се създават автоматично. [omi:journal:hu], [omi:editorial-board:en].",
  "cs": "Přípona vybírá jazyk. Chybějící překlady se automaticky nevytvářejí. [omi:journal:hu], [omi:editorial-board:en].",
  "da": "Suffikset vælger sprog. Manglende oversættelser genereres ikke automatisk. [omi:journal:hu], [omi:editorial-board:en].",
  "el": "Το επίθημα επιλέγει γλώσσα. Οι μεταφράσεις που λείπουν δεν δημιουργούνται αυτόματα. [omi:journal:hu], [omi:editorial-board:en].",
  "et": "Järelliide valib keele. Puuduvaid tõlkeid automaatselt ei looda. [omi:journal:hu], [omi:editorial-board:en].",
  "fi": "Kieliliite valitsee kielen. Puuttuvia käännöksiä ei luoda automaattisesti. [omi:journal:hu], [omi:editorial-board:en].",
  "ga": "Roghnaíonn an iarmhír an teanga. Ní chruthaítear aistriúcháin go huathoibríoch. [omi:journal:hu], [omi:editorial-board:en].",
  "hr": "Sufiks određuje jezik. Prijevodi koji nedostaju ne stvaraju se automatski. [omi:journal:hu], [omi:editorial-board:en].",
  "lt": "Priesaga parenka kalbą. Trūkstami vertimai automatiškai nekuriami. [omi:journal:hu], [omi:editorial-board:en].",
  "lv": "Piedēklis nosaka valodu. Trūkstoši tulkojumi netiek automātiski veidoti. [omi:journal:hu], [omi:editorial-board:en].",
  "mt": "Is-suffiss jagħżel il-lingwa. Traduzzjonijiet neqsin ma jinħolqux awtomatikament. [omi:journal:hu], [omi:editorial-board:en].",
  "pt": "O sufixo escolhe o idioma. As traduções em falta não são geradas automaticamente. [omi:journal:hu], [omi:editorial-board:en].",
  "ro": "Sufixul selectează limba. Traducerile lipsă nu sunt generate automat. [omi:journal:hu], [omi:editorial-board:en].",
  "sk": "Prípona určuje jazyk. Chýbajúce preklady sa nevytvárajú automaticky. [omi:journal:hu], [omi:editorial-board:en].",
  "sl": "Pripona določa jezik. Manjkajoči prevodi se ne ustvarjajo samodejno. [omi:journal:hu], [omi:editorial-board:en].",
  "sv": "Suffixet väljer språk. Saknade översättningar skapas inte automatiskt. [omi:journal:hu], [omi:editorial-board:en]."
} as const;

const runningTips = {
  "en": "Running headers use the study and printed page context, not cover metadata.",
  "hu": "A futó fejlécek a tanulmány és a nyomtatott oldal adatait használják, nem a borítóét.",
  "de": "Kolumnentitel verwenden Beitragsdaten und gedruckte Seitenzahlen, keine Umschlagdaten.",
  "fr": "Les titres courants utilisent les données de l’article et de la page imprimée.",
  "it": "Le testatine usano i dati del contributo e della pagina stampata.",
  "es": "Los encabezados corrientes usan los datos del artículo y de la página impresa.",
  "nl": "Lopende koppen gebruiken de gegevens van het artikel en de gedrukte pagina.",
  "pl": "Żywe paginy korzystają z danych artykułu i strony drukowanej.",
  "bg": "Колонтитули на статията и номера на страницата",
  "cs": "Živá záhlaví článku a číslo stránky",
  "da": "Løbende sidehoveder og sidetal",
  "el": "Κεφαλίδες άρθρου και αριθμός σελίδας",
  "et": "Jooksvad päised ja leheküljenumber",
  "fi": "Juoksevat ylätunnisteet ja sivunumero",
  "ga": "Ceanntásca reatha agus uimhir leathanaigh",
  "hr": "Tekuća zaglavlja i broj stranice",
  "lt": "Puslapių antraštės ir puslapio numeris",
  "lv": "Lappušu galvenes un numuri",
  "mt": "Intestaturi u numri tal-paġni",
  "pt": "Cabeçalhos correntes e número de página",
  "ro": "Anteturi curente și numărul paginii",
  "sk": "Živé hlavičky a číslo strany",
  "sl": "Tekoče glave in številka strani",
  "sv": "Löpande sidhuvuden och sidnummer"
} as const;

export function getPublicationShortcodeHelp(locale: string) {
  const language = locale.toLowerCase().split(/[-_]/)[0] as keyof typeof copy;
  const text = copy[language] ?? copy.en;
  const fields = PUBLICATION_SHORTCODES.map((key, index) => ({ key, label: text.fields[index] }));
  const runningTip = (runningTips[language] ?? runningTips.en) + ' [omi:article-doi], [omi:article-title], [omi:short-article-title], [omi:article-authors], [omi:page-number].';
  const topic: HelpTopic = { title: text.title, body: text.body, tips: [...text.tips, runningTip, languageTips[language] ?? languageTips.en, ...fields.map(field => '[omi:' + field.key + '] — ' + field.label)] };
  return { topic, fields, insert: text.insert };
}

export function appendPublicationShortcodeHelp(locale: string, help: HelpCopy): HelpCopy {
  const { topic } = getPublicationShortcodeHelp(locale);
  return help.topics.some(existing => existing.title === topic.title) ? help : { ...help, topics: [...help.topics, topic] };
}
