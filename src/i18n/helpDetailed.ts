export interface DetailedHelpTopic {
  location: string;
  steps: string[];
  checks: string[];
}

export interface DetailedHelpLabels {
  location: string;
  steps: string;
  checks: string;
}

const labels: Record<string, DetailedHelpLabels> = {
  hu: { location: 'Hol található?', steps: 'Lépések', checks: 'Ellenőrzés és gyakori hibák' },
  en: { location: 'Where is it?', steps: 'Steps', checks: 'Checks and common issues' },
  de: { location: 'Wo befindet sich die Funktion?', steps: 'Schritte', checks: 'Prüfung und häufige Probleme' },
};

const hu: Record<number, DetailedHelpTopic> = {
  1: {
    location: 'A fő szerkesztőben, a kézirat szövegterületén és a Beszúrás menüben.',
    steps: ['Kattintson a szerkeszteni kívánt szakaszba, majd módosítsa a szöveget.', 'Szerkezeti elemhez használjon címsort, jegyzetet, ábrát, táblázatot vagy más szemantikus elemet.', 'Karakterformázást csak valódi tipográfiai jelentéshez használjon, például dőlt vagy felső indexelt szöveghez.'],
    checks: ['Ha egy cím csak nagyobb vagy félkövér betű, de nem címsor, az export nem tudja megbízhatóan fejezetként kezelni.', 'A szerkezetet a Dokumentumszerkezet nézetben ellenőrizheti.'],
  },
  2: {
    location: 'Kézirat adatai → Dokumentumszerkezet és szakaszszámozás.',
    steps: ['Hozza létre vagy válassza ki a szakaszt.', 'Állítsa be a megfelelő hierarchiaszintet, illetve szükség esetén mozgassa a szülőszakasz alá.', 'A számozást a strukturális számozási beállítással kezelje, ne kézzel a címbe írva.'],
    checks: ['Ne ugorjon indokolatlanul címszinteket, például 1-es szintről közvetlenül 3-asra.', 'Átrendezés után ellenőrizze, hogy a kereszthivatkozások továbbra is a megfelelő célra mutatnak.'],
  },
  3: {
    location: 'Kézirat adatai, valamint a szerkesztő elején található front matter mezők.',
    steps: ['Adja meg a kézirat fő nyelvét a listából.', 'Töltse ki a címet, alcímet, absztraktot és kulcsszavakat.', 'Többnyelvű kiadványnál külön adja meg az egyes nyelvi változatokat.'],
    checks: ['A dokumentum nyelve nem azonos a felület nyelvével.', 'Export előtt ellenőrizze, hogy a kiadói profil által kötelezőnek jelölt metaadatok ki vannak-e töltve.'],
  },
  4: {
    location: 'Közreműködők menü, illetve a Részletek/Fiók kapcsolódó adatmezői.',
    steps: ['Vegye fel a szerzőt vagy más közreműködőt és válassza ki a szerepét.', 'Adja meg az intézményi kapcsolatot; ahol elérhető, használja a ROR-keresést.', 'ORCID esetén lehetőség szerint hitelesített ORCID-kapcsolatot használjon.'],
    checks: ['A kézzel beírt ORCID metaadat nem azonos a hitelesített ORCID-identitással.', 'Többszerzős kéziratnál ellenőrizze a szerzői sorrendet és a hozzájárulási szerepeket.'],
  },
  5: {
    location: 'Jegyzetek menü és a szerkesztő jegyzetbeszúrási funkciója.',
    steps: ['A kurzor helyén szúrjon be lábjegyzetet vagy végjegyzetet.', 'A jegyzet szövegét a jegyzet szerkesztőjében módosítsa.', 'Forráshivatkozáshoz meglévő bibliográfiai rekordot kapcsoljon a jegyzethez.'],
    checks: ['Ne kézzel begépelt felső indexszel utánozza a jegyzetet.', 'Törlés és átrendezés után ellenőrizze a jegyzetszámozást és az exportot.'],
  },
  6: {
    location: 'Hivatkozások menü, bibliográfiai rekordok és idézésbeszúrás.',
    steps: ['Keresse meg vagy hozza létre az idézett mű bibliográfiai rekordját.', 'Ugyanazt a rekordot használja fel minden kapcsolódó idézésnél.', 'Válassza ki az alkalmazandó CSL/idézési megjelenítést, majd ellenőrizze az előnézetet.'],
    checks: ['Kerülje ugyanazon mű többszörös felvételét eltérő rekordként.', 'DOI, ISBN és más azonosítók esetén ellenőrizze az érték pontosságát.'],
  },
  7: {
    location: 'Hivatkozások → Kereszthivatkozások, illetve a Beszúrás menüből.',
    steps: ['Válassza ki a hivatkozás célját: szakaszt, ábrát, táblázatot vagy más támogatott objektumot.', 'Szúrja be a kereszthivatkozást a kívánt szöveghelyre.', 'A dokumentum átrendezése után hagyja, hogy a Studio a strukturális cél alapján tartsa fenn a kapcsolatot.'],
    checks: ['Ne gépeljen be kézzel olyan sorszámot, amely automatikusan változhat.', 'Hiányzó cél esetén a publikációs ellenőrzés hibát vagy figyelmeztetést adhat.'],
  },
  8: {
    location: 'Beszúrás menü, valamint az ábra-, táblázat- és képletszerkesztők.',
    steps: ['Szúrja be a megfelelő objektumtípust.', 'Adjon hozzá képaláírást/címet és szükség esetén alternatív szöveget.', 'Táblázatnál valódi sor- és cellaszerkezetet, képletnél képletelemet használjon.'],
    checks: ['A táblázatot ne tabulátorokkal vagy szóközökkel építse fel.', 'A Képek jegyzéke és más jegyzékek csak felismerhető strukturált objektumokat tudnak felsorolni.'],
  },
  9: {
    location: 'Export és eszközök → OMI-csomag, valamint a kézirat vizuális elemei.',
    steps: ['A képeket és egyéb médiafájlokat a kézirat objektumaihoz kapcsolja.', 'Hordozható mentéshez készítsen OMI-csomagot.', 'Csomag importálásakor először futtassa az integritásvizsgálatot, majd csak érvényes csomagot nyisson meg.'],
    checks: ['Az OMI JSON önmagában nem feltétlenül tartalmaz minden külső médiafájlt; teljes hordozhatósághoz az OMI-csomag ajánlott.', 'Integritási eltérésnél ne importálja automatikusan a csomagot.'],
  },
  10: {
    location: 'Dokumentum → Word-kézirat importálása.',
    steps: ['Válassza ki a DOCX-fájlt.', 'Várja meg az import végét; nagy dokumentumnál a folyamat hosszabb lehet.', 'Import után ellenőrizze a címsorokat, jegyzeteket, táblázatokat, képeket és bekezdésformázást.'],
    checks: ['A Word Címsor 1/2/3 stílusok megbízhatóbban importálhatók, mint a pusztán kézzel formázott címek.', 'Ha egy elem hibásan érkezik át, először a forrás DOCX szerkezetét ellenőrizze.'],
  },
  11: {
    location: 'Integrációk, illetve OJS-ből indított Studio-munkamenet.',
    steps: ['Az OJS-ben a megfelelő beküldésből/assignmentből indítsa a Studiot.', 'Ellenőrizze az átadott szerepkört és hozzáférési hatókört.', 'Szerkesztés után az engedélyezett integrációs művelettel adja vissza vagy szinkronizálja az adatokat.'],
    checks: ['A Studio csak azt az adatot tudja átvenni, amely az OJS-ben valóban rendelkezésre áll.', 'Hibás szerepkör vagy assignment esetén ne folytassa a munkát, hanem nyissa meg újra a helyes kontextusból.'],
  },
  12: {
    location: 'OJS-integrációból érkező lektori assignment és a kapcsolódó lektori nézet.',
    steps: ['A lektori feladatból nyissa meg a kéziratot.', 'Végezze el a megjegyzéseket és a lektori műveleteket az engedélyezett nézetben.', 'A feladat végén a rendszer által biztosított visszaküldési folyamatot használja.'],
    checks: ['Double-blind folyamatban ügyeljen arra, hogy ne kerüljön be szükségtelen azonosító adat.', 'A lektor csak az assignmenthez engedélyezett tartalmat és funkciókat láthatja.'],
  },
  13: {
    location: 'Előzmények, valamint Export és eszközök → OMI integritási ellenőrzés.',
    steps: ['Nagyobb módosítások előtt vagy után hozzon létre ellenőrizhető állapotot/checkpointot.', 'Az Előzményekben tekintse át a revíziókat.', 'Hordozható csomagnál ellenőrizze a revíziók integritási lenyomatát.'],
    checks: ['A kézirat módosítása új állapotot eredményez; korábbi aláírás vagy digest nem jelenti automatikusan az új állapot hitelességét.', 'Export előtt győződjön meg arról, hogy a kívánt aktuális állapot van megnyitva.'],
  },
  14: {
    location: 'Publikáció menü → kiadói profil és Kiadványstílus szerkesztő.',
    steps: ['Válassza ki a megfelelő kiadói profilt.', 'A profilhoz tartozó stílusok közül válassza ki az aktívat.', 'A tipográfiát, margókat és más megjelenési szabályokat a Kiadványstílus szerkesztőben módosítsa.'],
    checks: ['A kézirat tartalma és a kiadvány megjelenése külön réteg; ne a szöveg közvetlen formázásával utánozza a végleges tördelést.', 'PDF/HTML export előtt használja az előnézetet és a publikációs ellenőrzést.'],
  },
  15: {
    location: 'Publikáció → Saját kiadói profil.',
    steps: ['Adja meg a kiadói identitás adatait, például nevet, webcímet, logót és alapértelmezett emailt.', 'Hozzon létre a profilhoz egy vagy több saját nevű kiadványstílust.', 'Ha profilvédelmet használ, csak hitelesített tulajdonosi identitással zárolja.'],
    checks: ['A kiadói identitás és a tipográfiai stílus két külön réteg.', 'Zárolás előtt ellenőrizze az alapértelmezett email címet, mert a szerkesztési jogosultság ehhez kapcsolódik.'],
  },
  16: {
    location: 'Publikáció → Kiadványstílus szerkesztő → CSS letöltése, illetve CSS-alapú exportbeállítások.',
    steps: ['Állítsa be a kívánt kiadványstílust.', 'Töltse le a generált CSS-t, ha külső rendszerben is használni szeretné.', 'Nyomtatási/PDF szabályoknál külön ellenőrizze a @page, margó és oldaltörési viselkedést.'],
    checks: ['A CSS a publikációs kimenetet módosítja, nem a Studio szerkesztőfelületét.', 'A böngészők és PDF-motorok paged-media támogatása eltérhet.'],
  },
  17: {
    location: 'Export és eszközök.',
    steps: ['Válassza ki a célnak megfelelő formátumot.', 'Várja meg az export előkészítését és a folyamatjelző végét.', 'Nyissa meg vagy ellenőrizze a létrejött fájlt a célalkalmazásban.'],
    checks: ['Archiváláshoz az OMI/OMI-csomag, folyóirati XML-hez JATS, webhez HTML, tördelési munkafolyamathoz IDML vagy más célformátum lehet megfelelő.', 'A különböző exportok ugyanabból a szemantikus kéziratból készülnek, ezért tartalmi eltérés esetén a forráskéziratot ellenőrizze.'],
  },
  18: {
    location: 'Export és eszközök → HTML, illetve a publikációs profil ellenőrzése.',
    steps: ['Válassza ki az aktív kiadói profilt és stílust.', 'Futtassa vagy figyelje a publikációs ellenőrzést.', 'A blokkoló hibák javítása után készítse el a HTML/PDF kimenetet.'],
    checks: ['A piros hibák általában javítandó publikációs problémát jeleznek.', 'A figyelmeztetéseket is nézze át, még ha az exportot nem is blokkolják.'],
  },
  19: {
    location: 'Beállítások → felhő- és tárolási beállítások, továbbá natív alkalmazásban a Dokumentum/Export menü.',
    steps: ['Válassza ki a tárolási módot.', 'Külső szolgáltatásnál adja meg és tesztelje a kapcsolatot.', 'Rendszeres biztonsági mentéshez készítsen hordozható OMI-csomagot is.'],
    checks: ['A külső szolgáltatás elérhetősége a telepítés és a felhasználói konfiguráció függvénye.', 'Megosztott eszközön ne hagyjon szükségtelen helyi munkafájl-kapcsolatot.'],
  },
  20: {
    location: 'A problémától függően Dokumentum, Kézirat adatai, Hivatkozások, Publikáció, Integrációk vagy Export és eszközök.',
    steps: ['Először döntse el, hogy tartalmi, szerkezeti, metaadat-, integrációs vagy megjelenítési hibáról van-e szó.', 'Ellenőrizze az adott terület forrásadatait és aktív beállításait.', 'Import/export hibánál próbálja meg ugyanazt egy egyszerűbb vagy kisebb tesztdokumentummal elkülöníteni.'],
    checks: ['DOCX-hibánál a Word-stílusokat, OJS-hibánál az assignmentet és metaadatokat, PDF/HTML-hibánál az aktív kiadói profilt és stílust ellenőrizze.', 'Ha a felület hosszabb folyamatot végez, várja meg a folyamatjelző végét, mielőtt új műveletet indít.'],
  },
};

const en: Record<number, DetailedHelpTopic> = {
  1: { location: 'Main editor and Insert menu.', steps: ['Open the section you want to edit and change the manuscript text.', 'Use semantic elements such as headings, notes, figures, tables and formulas for structural meaning.', 'Use inline formatting only when the formatting itself carries meaning.'], checks: ['A visually enlarged bold line is not automatically a heading.', 'Check the resulting hierarchy in the document structure view.'] },
  2: { location: 'Manuscript data → document structure and section numbering.', steps: ['Create or select a section.', 'Place it at the correct hierarchy level and under the correct parent.', 'Use structural numbering instead of typing chapter numbers into titles.'], checks: ['Avoid unjustified heading-level jumps.', 'After restructuring, verify internal cross-references.'] },
  3: { location: 'Manuscript data and front-matter fields.', steps: ['Choose the manuscript language from the list.', 'Fill title, subtitle, abstract and keywords.', 'Store translated metadata in separate language variants.'], checks: ['Interface language and manuscript language are different settings.', 'Before export, complete metadata required by the active publication profile.'] },
  4: { location: 'Contributors and related Details/Account fields.', steps: ['Add each contributor and assign a role.', 'Add affiliations and use ROR lookup where available.', 'Prefer an authenticated ORCID connection when identity verification matters.'], checks: ['A manually typed ORCID is metadata, not authenticated identity.', 'Check contributor order and roles in multi-author manuscripts.'] },
  5: { location: 'Notes menu and note insertion in the editor.', steps: ['Insert a footnote or endnote at the cursor.', 'Edit note content in the note editor.', 'Link citations in notes to existing bibliography records.'], checks: ['Do not simulate notes with manually typed superscript numbers.', 'Recheck numbering after deleting or moving notes.'] },
  6: { location: 'References menu and citation insertion.', steps: ['Find or create the bibliographic record.', 'Reuse the same record for every citation of the same work.', 'Select the citation/CSL presentation and inspect the result.'], checks: ['Avoid duplicate records for the same work.', 'Verify DOI, ISBN and other identifiers.'] },
  7: { location: 'References → cross-references and Insert menu.', steps: ['Choose the target section, figure, table or supported object.', 'Insert the cross-reference where needed.', 'Let Studio retain the link by structural target when numbering changes.'], checks: ['Do not hard-code numbers that may change.', 'Publication validation can report missing targets.'] },
  8: { location: 'Insert menu and figure/table/formula editors.', steps: ['Insert the correct object type.', 'Add caption/title and alternative text where relevant.', 'Use real table cells and formula objects instead of visual approximations.'], checks: ['Do not build tables with tabs or spaces.', 'Lists of figures/tables can only include recognized structured objects.'] },
  9: { location: 'Export & tools → OMI package and manuscript visual assets.', steps: ['Attach media assets to manuscript objects.', 'Create a portable OMI package for complete transfer.', 'When importing, inspect integrity before opening the package.'], checks: ['OMI JSON alone may not carry every external asset.', 'Do not automatically import a package with integrity mismatches.'] },
  10: { location: 'Document → Import Word manuscript.', steps: ['Choose the DOCX file.', 'Wait for import to finish, especially for large manuscripts.', 'Review headings, notes, tables, images and inline formatting after import.'], checks: ['Word Heading styles are more reliable than manually formatted headings.', 'If import is wrong, inspect the source DOCX structure first.'] },
  11: { location: 'Integrations or a Studio session launched from OJS.', steps: ['Launch Studio from the correct OJS submission/assignment.', 'Verify role and granted scope.', 'Use the permitted integration action to return or synchronize data.'], checks: ['Studio can import only data actually available in OJS.', 'If the role or assignment is wrong, reopen from the correct context.'] },
  12: { location: 'Reviewer assignment launched from OJS and reviewer workspace.', steps: ['Open the manuscript from the assigned review task.', 'Perform comments and review actions in the permitted workspace.', 'Use the provided return workflow when the review is complete.'], checks: ['In double-blind review, avoid unnecessary identity-revealing information.', 'Reviewer access is limited to the assignment scope.'] },
  13: { location: 'History and Export & tools → OMI integrity.', steps: ['Create clear checkpoints around major changes.', 'Review revisions in History.', 'Verify revision digests when moving portable packages.'], checks: ['A changed manuscript is a new state and may require a new signature/digest.', 'Before export, confirm that the intended current revision is open.'] },
  14: { location: 'Publication → publisher profile and Publication Style Editor.', steps: ['Select the required publisher profile.', 'Choose the active named publication style.', 'Edit typography, margins and presentation rules in the style editor.'], checks: ['Keep manuscript semantics separate from publisher presentation.', 'Use preview and publication validation before PDF/HTML export.'] },
  15: { location: 'Publication → Custom publisher profile.', steps: ['Enter publisher identity, website, logo and default email.', 'Create one or more named publication styles for that identity.', 'If protection is enabled, lock only with a verified owner identity.'], checks: ['Publisher identity and typography are separate layers.', 'Verify the default email before locking the profile.'] },
  16: { location: 'Publication → Publication Style Editor → Download CSS.', steps: ['Configure the active publication style.', 'Download generated CSS for external reuse.', 'For print/PDF rules, verify @page, margins and page breaks separately.'], checks: ['Export CSS changes publication output, not the Studio editor.', 'Paged-media support varies between browser/PDF engines.'] },
  17: { location: 'Export & tools.', steps: ['Choose the output format for the target workflow.', 'Wait until the processing indicator finishes.', 'Open and validate the produced file in the target application.'], checks: ['Use OMI for portability, JATS for journal XML, HTML for web and IDML/other interchange formats for layout workflows as appropriate.', 'All outputs derive from the same semantic manuscript.'] },
  18: { location: 'Export & tools → HTML and publication validation.', steps: ['Select the intended publisher profile and style.', 'Review publication validation.', 'Resolve blocking issues before producing HTML/PDF.'], checks: ['Red errors normally require correction.', 'Review warnings even when they do not block export.'] },
  19: { location: 'Settings → cloud/storage settings and native Document/Export actions.', steps: ['Choose the storage mode.', 'Configure and test external storage where applicable.', 'Keep a portable OMI package as an independent backup.'], checks: ['External service availability depends on installation and configuration.', 'On shared devices, avoid retaining unnecessary local working-file associations.'] },
  20: { location: 'The relevant Document, Manuscript data, References, Publication, Integrations or Export & tools view.', steps: ['Classify the problem as content, structure, metadata, integration or presentation.', 'Check the source data and active settings for that area.', 'For import/export issues, reproduce with a smaller test manuscript if possible.'], checks: ['For DOCX inspect Word styles; for OJS inspect assignment/metadata; for PDF/HTML inspect the active publisher profile and style.', 'For long-running operations, wait for the progress state to finish before starting another action.'] },
};

const de: Record<number, DetailedHelpTopic> = {
  1: { location: 'Haupteditor und Menü Einfügen.', steps: ['Öffnen Sie den gewünschten Abschnitt und bearbeiten Sie den Text.', 'Verwenden Sie semantische Elemente wie Überschriften, Anmerkungen, Abbildungen, Tabellen und Formeln.', 'Direkte Zeichenformatierung sollte nur echte typografische Bedeutung ausdrücken.'], checks: ['Eine nur größer oder fett formatierte Zeile ist nicht automatisch eine Überschrift.', 'Prüfen Sie die Hierarchie in der Dokumentstruktur.'] },
  2: { location: 'Manuskriptdaten → Dokumentstruktur und Abschnittsnummerierung.', steps: ['Abschnitt erstellen oder auswählen.', 'Die richtige Hierarchieebene und den richtigen übergeordneten Abschnitt festlegen.', 'Strukturelle Nummerierung verwenden statt Nummern in Überschriften einzutippen.'], checks: ['Unbegründete Sprünge zwischen Überschriftenebenen vermeiden.', 'Nach Umstrukturierungen Querverweise prüfen.'] },
  3: { location: 'Manuskriptdaten und Front-Matter-Felder.', steps: ['Manuskriptsprache aus der Liste wählen.', 'Titel, Untertitel, Abstract und Schlüsselwörter ausfüllen.', 'Übersetzte Metadaten als getrennte Sprachvarianten pflegen.'], checks: ['Oberflächensprache und Manuskriptsprache sind getrennte Einstellungen.', 'Vor dem Export Pflichtmetadaten des aktiven Publikationsprofils prüfen.'] },
  4: { location: 'Mitwirkende sowie zugehörige Detail-/Kontofelder.', steps: ['Mitwirkende hinzufügen und Rolle festlegen.', 'Affiliation angeben und, wo verfügbar, ROR-Suche verwenden.', 'Für Identitätsnachweis möglichst authentifizierte ORCID-Verknüpfung verwenden.'], checks: ['Eine manuell eingetragene ORCID ist nur Metadatum, keine authentifizierte Identität.', 'Bei mehreren Autoren Reihenfolge und Rollen prüfen.'] },
  5: { location: 'Menü Anmerkungen und Anmerkungseinfügung im Editor.', steps: ['Fuß- oder Endnote an der Cursorposition einfügen.', 'Notentext im Anmerkungseditor bearbeiten.', 'Zitate in Noten mit vorhandenen Literaturdatensätzen verbinden.'], checks: ['Anmerkungen nicht mit manuell gesetzten Hochzahlen simulieren.', 'Nach Löschen oder Verschieben Nummerierung prüfen.'] },
  6: { location: 'Menü Referenzen und Zitierfunktion.', steps: ['Literaturdatensatz suchen oder anlegen.', 'Denselben Datensatz für alle Zitate desselben Werks wiederverwenden.', 'Zitier-/CSL-Darstellung auswählen und Ergebnis prüfen.'], checks: ['Doppelte Datensätze vermeiden.', 'DOI, ISBN und andere Identifikatoren kontrollieren.'] },
  7: { location: 'Referenzen → Querverweise und Menü Einfügen.', steps: ['Zielabschnitt, Abbildung, Tabelle oder anderes unterstütztes Objekt wählen.', 'Querverweis an der gewünschten Stelle einfügen.', 'Bei neuer Nummerierung die strukturelle Zielbindung beibehalten.'], checks: ['Keine veränderlichen Nummern manuell eintippen.', 'Die Publikationsprüfung kann fehlende Ziele melden.'] },
  8: { location: 'Menü Einfügen sowie Abbildungs-, Tabellen- und Formeleditor.', steps: ['Passenden Objekttyp einfügen.', 'Beschriftung/Titel und gegebenenfalls Alternativtext ergänzen.', 'Echte Tabellenzellen und Formelelemente verwenden.'], checks: ['Tabellen nicht mit Tabs oder Leerzeichen bauen.', 'Abbildungs-/Tabellenverzeichnisse erfassen nur strukturierte Objekte.'] },
  9: { location: 'Export & Werkzeuge → OMI-Paket und Medienobjekte.', steps: ['Medien mit Manuskriptobjekten verbinden.', 'Für vollständigen Transport ein portables OMI-Paket erstellen.', 'Beim Import zuerst Integrität prüfen, dann öffnen.'], checks: ['OMI JSON allein enthält nicht zwingend alle externen Medien.', 'Pakete mit Integritätsabweichungen nicht automatisch importieren.'] },
  10: { location: 'Dokument → Word-Manuskript importieren.', steps: ['DOCX-Datei auswählen.', 'Import vollständig abwarten; große Dokumente benötigen mehr Zeit.', 'Danach Überschriften, Noten, Tabellen, Bilder und Formatierung kontrollieren.'], checks: ['Word-Überschriftenstile sind zuverlässiger als rein manuelle Formatierung.', 'Bei Fehlern zuerst die DOCX-Quellstruktur prüfen.'] },
  11: { location: 'Integrationen oder aus OJS gestartete Studio-Sitzung.', steps: ['Studio aus der richtigen OJS-Einreichung/dem richtigen Assignment starten.', 'Rolle und Scope prüfen.', 'Daten über die erlaubte Integrationsaktion zurückgeben oder synchronisieren.'], checks: ['Studio kann nur tatsächlich in OJS vorhandene Daten übernehmen.', 'Bei falschem Kontext Sitzung aus dem korrekten Assignment neu öffnen.'] },
  12: { location: 'OJS-Review-Assignment und Gutachteransicht.', steps: ['Manuskript aus dem zugewiesenen Review öffnen.', 'Kommentare und Review-Aktionen im erlaubten Arbeitsbereich durchführen.', 'Nach Abschluss den vorgesehenen Rückgabeprozess verwenden.'], checks: ['Im Double-Blind-Verfahren keine unnötigen identifizierenden Angaben hinzufügen.', 'Der Zugriff ist auf den Assignment-Scope begrenzt.'] },
  13: { location: 'Verlauf und Export & Werkzeuge → OMI-Integrität.', steps: ['Vor/nach größeren Änderungen klare Checkpoints erzeugen.', 'Revisionen im Verlauf prüfen.', 'Bei portablen Paketen Revisions-Digests kontrollieren.'], checks: ['Nach Manuskriptänderungen ist ein neuer Zustand entstanden; Signatur/Digest kann neu erforderlich sein.', 'Vor Export die gewünschte aktuelle Revision prüfen.'] },
  14: { location: 'Publikation → Verlagsprofil und Publikationsstil-Editor.', steps: ['Passendes Verlagsprofil auswählen.', 'Aktiven benannten Publikationsstil wählen.', 'Typografie, Ränder und Darstellungsregeln im Stil-Editor ändern.'], checks: ['Semantischen Inhalt und Verlagsdarstellung getrennt halten.', 'Vor PDF/HTML Vorschau und Publikationsprüfung nutzen.'] },
  15: { location: 'Publikation → Eigenes Verlagsprofil.', steps: ['Verlagsidentität, Website, Logo und Standard-E-Mail eintragen.', 'Einen oder mehrere benannte Publikationsstile anlegen.', 'Bei Schutz nur mit verifizierter Eigentümeridentität sperren.'], checks: ['Verlagsidentität und Typografie sind getrennte Ebenen.', 'Vor Sperrung Standard-E-Mail sorgfältig prüfen.'] },
  16: { location: 'Publikation → Publikationsstil-Editor → CSS herunterladen.', steps: ['Aktiven Stil konfigurieren.', 'Generiertes CSS für externe Wiederverwendung herunterladen.', 'Für Druck/PDF @page, Ränder und Seitenumbrüche separat prüfen.'], checks: ['Export-CSS verändert die Publikationsausgabe, nicht den Studio-Editor.', 'Paged-Media-Unterstützung hängt von Browser/PDF-Engine ab.'] },
  17: { location: 'Export & Werkzeuge.', steps: ['Zielformat auswählen.', 'Verarbeitung bis zum Ende der Fortschrittsanzeige abwarten.', 'Erzeugte Datei in der Zielanwendung öffnen und prüfen.'], checks: ['OMI für Portabilität, JATS für Zeitschriften-XML, HTML fürs Web und IDML/weitere Austauschformate für Layout-Workflows verwenden.', 'Alle Ausgaben stammen aus demselben semantischen Manuskript.'] },
  18: { location: 'Export & Werkzeuge → HTML und Publikationsprüfung.', steps: ['Gewünschtes Verlagsprofil und Stil auswählen.', 'Publikationsprüfung kontrollieren.', 'Blockierende Probleme vor HTML/PDF beheben.'], checks: ['Rote Fehler sollten behoben werden.', 'Warnungen auch dann prüfen, wenn sie Export nicht blockieren.'] },
  19: { location: 'Einstellungen → Cloud/Speicher sowie native Dokument-/Exportaktionen.', steps: ['Speichermodus auswählen.', 'Externen Speicher konfigurieren und testen.', 'Zusätzlich ein portables OMI-Paket als unabhängige Sicherung erstellen.'], checks: ['Externe Dienste hängen von Installation und Konfiguration ab.', 'Auf gemeinsam genutzten Geräten keine unnötige lokale Dateizuordnung behalten.'] },
  20: { location: 'Je nach Problem: Dokument, Manuskriptdaten, Referenzen, Publikation, Integrationen oder Export & Werkzeuge.', steps: ['Problem als Inhalt, Struktur, Metadaten, Integration oder Darstellung einordnen.', 'Quelldaten und aktive Einstellungen dieses Bereichs prüfen.', 'Import-/Exportfehler möglichst mit kleinerem Testmanuskript reproduzieren.'], checks: ['Bei DOCX Word-Stile, bei OJS Assignment/Metadaten, bei PDF/HTML aktives Verlagsprofil und Stil prüfen.', 'Bei längeren Vorgängen das Ende der Fortschrittsanzeige abwarten.'] },
};

const detailedByLocale: Record<string, Record<number, DetailedHelpTopic>> = { hu, en, de };

export function getDetailedHelpLabels(locale: string): DetailedHelpLabels {
  return labels[locale] ?? labels.en;
}

export function getDetailedHelpTopic(locale: string, title: string): DetailedHelpTopic | null {
  const match = title.match(/^\s*(\d+)/);
  if (!match) return null;
  const index = Number(match[1]);
  if (!Number.isFinite(index)) return null;
  return detailedByLocale[locale]?.[index] ?? null;
}
