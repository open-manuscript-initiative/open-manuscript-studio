import type { SupportedLocale } from './types';

export interface HelpTopic {
  title: string;
  body: string;
  tips?: string[];
}

export interface HelpCopy {
  navigation: string;
  title: string;
  description: string;
  gettingStarted: string;
  topics: HelpTopic[];
}

const copy: Record<SupportedLocale, HelpCopy> = {
  hu: {
    navigation: 'Súgó',
    title: 'Open Manuscript Studio súgó',
    description: 'Útmutató a Studio 0.1.0-alpha.1 jelenlegi kézirat-, lektorálási, publikációs és exportfunkcióihoz.',
    gettingStarted: 'A Studio szemantikus kéziratot szerkeszt: a címek, szakaszok, jegyzetek, hivatkozások, ábrák, táblázatok, képletek és metaadatok nem pusztán formázásként, hanem strukturált elemekként maradnak meg. Az OJS-ből megnyitott kéziratnál a Studio az integráción keresztül átveszi az elérhető dokumentumot és publikációs adatokat.',
    topics: [
      {
        title: '1. Kézirat szerkesztése és szemantikus formázás',
        body: 'A fő szerkesztőben a kézirat szövegét és belső szerkezetét módosíthatja. A Studio megőrzi a bekezdések, címsorok és támogatott karakterformázások jelentését, ezért a szerkezet később más formátumokba is átvihető.',
        tips: ['A fejezetcímekhez valódi címsorszintet használjon.', 'A szerkezeti jelentést ne pusztán félkövér, dőlt vagy nagyobb betűvel fejezze ki.', 'A közvetlen formázás helyett lehetőség szerint szemantikus elemet válasszon.'],
      },
      {
        title: '2. Szakaszok, hierarchia és számozás',
        body: 'A dokumentum szakaszai hierarchikus szerkezetet alkotnak. A Studio kezeli a szakaszszinteket és a publikációs profil által meghatározott számozást, így a fejezetstruktúra exportkor is megőrizhető.',
        tips: ['A szinteket következetesen használja: egy alfejezet a megfelelő szülőszakasz alá kerüljön.', 'A kézzel begépelt fejezetszám helyett használja a strukturális számozást, amikor az aktív profil ezt biztosítja.'],
      },
      {
        title: '3. Kézirat adatai, front matter és nyelvek',
        body: 'A kézirat tudományos metaadatai között kezelhető többek között a cím, alcím, mottó, absztrakt, kulcsszavak és a dokumentum nyelve. A többnyelvű publikációs mezők külön nyelvi változatokban tárolhatók.',
        tips: ['A kézirat fő nyelve és az egyes metaadatok nyelve külön adat.', 'Egy magyar kézirathoz is megadható angol és német cím, absztrakt és kulcsszólista.', 'A publikációs profil előírhat kötelező vagy ajánlott metaadatokat.'],
      },
      {
        title: '4. Közreműködők, intézmények, ORCID és ROR',
        body: 'A közreműködőknél a szerzők és más résztvevők neve, szerepe, intézményi kapcsolata és ORCID-azonosítója kezelhető. Az intézményi kapcsolatok ROR-adatokkal is kiegészíthetők, ahol a keresési szolgáltatás elérhető.',
        tips: ['Az ORCID és az intézményi azonosító pontosabb gépi feldolgozást és exportot tesz lehetővé.', 'Ellenőrizze, hogy az aktív publikációs profil mely közreműködői adatokat követeli meg.'],
      },
      {
        title: '5. Jegyzetek és jegyzetbeli hivatkozások',
        body: 'A lábjegyzetek és végjegyzetek külön szemantikus jegyzetobjektumok. A jegyzetek formázott szöveget és hivatkozásokat is tartalmazhatnak, a megjelenési módot pedig a publikációs profil szabályozhatja.',
        tips: ['A jegyzetet ne kézzel begépelt felső indexszel utánozza.', 'A jegyzeten belüli forráshivatkozást ugyanahhoz a bibliográfiai rekordhoz kapcsolhatja, mint a főszöveg idézéseit.'],
      },
      {
        title: '6. Hivatkozások, bibliográfia és idézési stílus',
        body: 'Az idézett művek strukturált bibliográfiai rekordokként tárolódnak. Egy rekord több szövegközi vagy jegyzetbeli idézésben újra felhasználható. A Studio idézési klasztereket és CSL-alapú megjelenítést is kezel, valamint támogat bibliográfiai keresést.',
        tips: ['Ugyanazt a művet ne vegye fel többször; használja újra a meglévő rekordot.', 'Export előtt ellenőrizze a rekord szerző-, cím-, év- és azonosítóadatait.'],
      },
      {
        title: '7. Kereszthivatkozások',
        body: 'A szakaszokra és támogatott dokumentumobjektumokra belső kereszthivatkozás hozható létre. A hivatkozás a célelemhez kapcsolódik, ezért a számozás vagy a dokumentumszerkezet változásakor nem kell kézzel átírni a hivatkozási számokat.',
        tips: ['Kézzel begépelt „lásd 3. ábra” helyett használjon kereszthivatkozást, amikor lehetséges.', 'Törlés vagy átszervezés után ellenőrizze a publikációs diagnosztikát az esetleges hiányzó célok miatt.'],
      },
      {
        title: '8. Ábrák, táblázatok és képletek',
        body: 'A Studio a vizuális tudományos elemeket strukturált blokkokként kezeli. Az ábrákhoz médiaeszköz, képaláírás és azonosítható cél tartozhat; a táblázatok szerkezete és a képletek szemantikus reprezentációja exportkor is feldolgozható.',
        tips: ['A táblázatot ne szóközökkel vagy tabulátorokkal építse fel.', 'Ábráknál használjon beszédes képaláírást és megfelelő alternatív szöveget, amikor rendelkezésre áll.', 'A képleteket a képletelemben adja meg, ne képként, ha nincs rá külön ok.'],
      },
      {
        title: '9. Médiafájlok és OMI-csomag',
        body: 'A kézirathoz tartozó képek és más támogatott médiafájlok eszközként kapcsolódnak a dokumentumhoz. A teljes OMI-csomag ezeket a fájlokat, a szemantikus kéziratot és a kapcsolódó integritási adatokat együtt tudja hordozni.',
        tips: ['A hordozható OMI-csomagot használja, ha nemcsak a szöveget, hanem a kapcsolódó médiaállományokat is át szeretné vinni.', 'A csomag integritási adatai segítenek felismerni a sérült vagy megváltozott tartalmat.'],
      },
      {
        title: '10. DOCX import',
        body: 'Word-dokumentum importálásakor a Studio a szöveg mellett a címsorokat, támogatott karakterformázásokat, jegyzeteket, táblázatokat és más felismerhető szerkezeti elemeket is igyekszik szemantikus OMI-elemekké alakítani.',
        tips: ['A fejezetcímeket Word Címsor 1, Címsor 2 stb. stílussal jelölje.', 'A közvetlen formázás felismerése csak tartalék módszer.', 'Import után ellenőrizze a szakaszhierarchiát, jegyzeteket, táblázatokat és hivatkozásokat.'],
      },
      {
        title: '11. OJS-integráció',
        body: 'OJS-ből indított munkamenetben a Studio az engedélyezett integrációs hatókör szerint képes átvenni a kéziratot és a rendelkezésre álló publikációs metaadatokat. A Studio és az OJS közötti adatmozgás mindig az adott assignment és jogosultság kontextusában történik.',
        tips: ['Csak az OJS-ben ténylegesen tárolt adat importálható.', 'Ha egy metaadat hiányzik a Studioból, először ellenőrizze az OJS Publication adatait és a megfelelő nyelvi változatot.', 'Integrációs munkamenetben figyeljen arra, hogy a megfelelő szerepkörrel és assignmenttel nyitotta-e meg a dokumentumot.'],
      },
      {
        title: '12. Lektori munka és peer review',
        body: 'A Studio peer-review modellje elkülöníti a kéziratot, a lektori assignmentet és a lektori munkát. OJS-integrációban a lektori hozzáférés az assignmenthez kötődik, így a lektor a számára engedélyezett tartalmat és műveleteket kapja meg.',
        tips: ['Lektori munkánál mindig az assignmentből indított Studio-munkamenetet használja.', 'A double-blind munkafolyamatban ne adjon hozzá olyan információt, amely szükségtelenül felfedi a szerző vagy a lektor személyazonosságát.'],
      },
      {
        title: '13. Revíziók, előzmények és integritás',
        body: 'A Studio a kézirat állapotváltozásait revíziókban követi. A revíziókhoz állapotazonosító és integritási lenyomat kapcsolódhat, a törölt szerkezeti elemek pedig tombstone-adatokkal követhetők. Ez segíti a változások auditálhatóságát és a hordozható állapotellenőrzést.',
        tips: ['Nagyobb szerkezeti módosítás előtt érdemes egy egyértelmű revíziós állapotot létrehozni.', 'Export előtt ellenőrizze, hogy a kézirat aktuális állapota a kívánt revízió.'],
      },
      {
        title: '14. Publikációs profilok',
        body: 'A publikációs profil választja el a kézirat tartalmát a kiadvány megjelenési és kiadói szabályaitól. A profil többek között oldalméretet, margókat, tipográfiát, szakasz- és objektumszámozást, jegyzetelhelyezést, képaláírás-pozíciót, metaadatkövetelményeket és támogatott kimeneteket határozhat meg.',
        tips: ['A kézirat tartalmát ne a kívánt kiadói kinézethez igazítsa; a megjelenést a profilban szabályozza.', 'Export előtt figyelje a publikációs készenléti hibákat és figyelmeztetéseket.'],
      },
      {
        title: '15. Saját kiadói profil és profilvédelem',
        body: 'A beépített profilok mellett saját kiadói profilverzió is létrehozható és alkalmazható. A profilverzió rögzíti a kiadói szabályokat; az írásvédett profil közvetlen módosítása helyett új profilverziót kell készíteni.',
        tips: ['Jelentős kiadói szabályváltozásnál készítsen új profilverziót.', 'A profilfájl exportálható, így ugyanaz a szabálykészlet másik telepítésben is újra felhasználható.'],
      },
      {
        title: '16. Export CSS és Nyomtatási/PDF CSS',
        body: 'Egy saját kiadói profilhoz általános publikációs Export CSS és külön Nyomtatási/PDF CSS kapcsolható. Az általános CSS a publikációs HTML megjelenését szabályozza, a nyomtatási réteg pedig erre épülve @page, margó-, oldaltörés- és más print szabályokat adhat a PDF-kimenethez.',
        tips: ['A CSS csak a publikációs kimenetet módosítja, a Studio szerkesztőfelületét nem.', 'A Nyomtatási/PDF CSS később kerül alkalmazásra, ezért felülírhatja az általános exportstílust.', 'A fejlett paged-media fejléc/lábléc szabályok támogatása a használt PDF- vagy böngészőmotortól is függ.'],
      },
      {
        title: '17. Exportformátumok',
        body: 'Az Export és eszközök nézet többféle kimenetet készít. A hordozható OMI és OMI JSON mellett jelenleg JATS XML, szemantikus HTML, DOCX, IDML, XTG, MIF, SLA, LaTeX, EPUB és nyomtatási PDF-munkafolyamat érhető el. Az egyes formátumok ugyanabból a szemantikus kéziratból és az aktív publikációs profilból készülnek.',
        tips: ['Archiváláshoz és további OMI-feldolgozáshoz a hordozható OMI-formátumot részesítse előnyben.', 'Folyóirati XML-munkafolyamathoz használja a JATS exportot.', 'A PDF jelenleg a böngésző nyomtatási nézetén keresztül menthető PDF-ként.'],
      },
      {
        title: '18. HTML és publikációs ellenőrzés',
        body: 'A szemantikus HTML export script nélküli, publikációs célú dokumentumot állít elő. Az export előtt a Studio a publikációs profillal együtt ellenőrzi a kéziratot, és hibákat vagy figyelmeztetéseket jelezhet például hiányzó kötelező metaadat, hibás belső kapcsolat vagy más publikációs probléma esetén.',
        tips: ['A piros hibákat export előtt javítsa.', 'A figyelmeztetések nem minden esetben blokkolják az exportot, de érdemes őket egyenként ellenőrizni.'],
      },
      {
        title: '19. Felhő- és fájltárolás',
        body: 'A Studio támogat helyi és konfigurálható külső tárolási munkafolyamatokat is. A WebDAV/Nextcloud kapcsolat használata a telepítés és a felhasználói beállítások függvénye; a szemantikus OMI-formátum célja, hogy a kézirat ne kötődjön egyetlen tárolási szolgáltatóhoz.',
        tips: ['Külső tárhely használata előtt ellenőrizze a kapcsolat beállításait.', 'Áttelepítéshez vagy biztonsági másolathoz készítsen hordozható OMI-csomagot.'],
      },
      {
        title: '20. Ha valami nem úgy jelenik meg, ahogy várta',
        body: 'Először állapítsa meg, hogy tartalmi, strukturális, metaadat-, integrációs vagy megjelenítési problémáról van-e szó. Ellenőrizze a kézirat és a metaadat nyelvét, a szakaszszerkezetet, az aktív publikációs profilt és az export diagnosztikáját. Importproblémánál vizsgálja meg a forrásdokumentum tényleges struktúráját is.',
        tips: ['DOCX esetén ellenőrizze a Word címsorstílusait és a jegyzet/táblázat szerkezetét.', 'OJS esetén ellenőrizze a Publication metaadatokat, az assignmentet és a jogosultsági kontextust.', 'PDF/HTML megjelenésnél ellenőrizze az aktív profilt, az Export CSS-t és a Nyomtatási/PDF CSS-t.'],
      },
    ],
  },
  en: {
    navigation: 'Help',
    title: 'Open Manuscript Studio Help',
    description: 'Guide to the manuscript, peer-review, publication and export features currently available in Studio 0.1.0-alpha.1.',
    gettingStarted: 'Studio edits a semantic manuscript: headings, sections, notes, citations, figures, tables, equations and metadata are retained as structured objects rather than presentation alone. When a manuscript is opened from OJS, Studio imports the document and available publication data through the integration.',
    topics: [
      { title: '1. Manuscript editing and semantic formatting', body: 'Edit manuscript text and structure in the main editor. Studio preserves the meaning of paragraphs, headings and supported inline formatting so the structure can be carried into other output formats.', tips: ['Use real heading levels for section headings.', 'Do not express document structure with bold, italics or font size alone.', 'Prefer semantic elements to direct presentation formatting.'] },
      { title: '2. Sections, hierarchy and numbering', body: 'Document sections form a hierarchy. Studio manages section levels and publication-profile numbering so the chapter structure can be retained during export.', tips: ['Use heading levels consistently and place subsections under the correct parent section.', 'Prefer profile-driven numbering to manually typed section numbers.'] },
      { title: '3. Manuscript data, front matter and languages', body: 'Scholarly metadata includes the title, subtitle, motto, abstract, keywords and document language. Multilingual publication fields can be stored as separate language variants.', tips: ['The main manuscript language and the language of a metadata value are separate concepts.', 'A Hungarian manuscript may also contain English and German titles, abstracts and keywords.', 'The publication profile may make metadata required or recommended.'] },
      { title: '4. Contributors, affiliations, ORCID and ROR', body: 'Manage authors and other contributors, their roles, affiliations and ORCID identifiers. Affiliations can also be enriched with ROR data where the lookup service is available.', tips: ['Persistent identifiers improve machine-readable publication exports.', 'Check which contributor fields are required by the active publication profile.'] },
      { title: '5. Notes and citations inside notes', body: 'Footnotes and endnotes are semantic note objects. Notes can contain rich text and citations, while placement is controlled by publication-profile rules.', tips: ['Do not imitate notes with manually typed superscript numbers.', 'A source cited in a note can reuse the same bibliographic record as citations in the main text.'] },
      { title: '6. Citations, bibliography and citation style', body: 'Cited works are stored as structured bibliographic records. A record can be reused by multiple inline or note citations. Studio supports citation clusters, CSL-based rendering and bibliographic lookup.', tips: ['Do not add the same work repeatedly; reuse its existing record.', 'Check author, title, year and identifier data before publication export.'] },
      { title: '7. Cross-references', body: 'Internal cross-references can target sections and supported document objects. Because the reference points to the target object, numbering does not have to be rewritten manually when structure changes.', tips: ['Use a cross-reference instead of typing “see Figure 3” manually where possible.', 'After deletion or restructuring, review publication diagnostics for missing targets.'] },
      { title: '8. Figures, tables and equations', body: 'Studio represents scholarly visual content as structured blocks. Figures may have media assets, captions and reference targets; table structure and semantic equation representations can also be carried into supported exports.', tips: ['Do not build tables with spaces or tabs.', 'Use meaningful captions and alternative text for figures when available.', 'Use the equation element instead of an image when there is no specific reason to rasterize a formula.'] },
      { title: '9. Media assets and the OMI package', body: 'Images and other supported media are attached to the manuscript as assets. A full OMI package can carry these files together with the semantic manuscript and integrity information.', tips: ['Use the portable OMI package when media files must travel with the manuscript.', 'Package integrity information helps detect missing, damaged or modified content.'] },
      { title: '10. DOCX import', body: 'When importing a Word document, Studio attempts to convert headings, supported inline formatting, notes, tables and other recognizable structures into semantic OMI elements.', tips: ['Use Word Heading 1, Heading 2, etc. for section headings.', 'Direct-formatting recognition is only a fallback.', 'After import, review section hierarchy, notes, tables and citations.'] },
      { title: '11. OJS integration', body: 'In an OJS-launched session, Studio can import the manuscript and available publication metadata according to the integration scopes granted for that context. Data transfer between Studio and OJS is tied to the relevant assignment and permissions.', tips: ['Only data actually stored in OJS can be imported.', 'If metadata is missing, first check OJS Publication metadata and the relevant locale.', 'Make sure the document was opened with the intended role and assignment.'] },
      { title: '12. Peer review', body: 'Studio separates the manuscript, peer-review assignment and reviewer work in its review model. With OJS integration, reviewer access is tied to the assignment so the reviewer receives the content and operations permitted for that review context.', tips: ['For review work, use the Studio session launched from the relevant assignment.', 'In double-blind review, avoid adding information that unnecessarily reveals author or reviewer identity.'] },
      { title: '13. Revisions, history and integrity', body: 'Studio tracks manuscript state changes as revisions. Revision state can carry an integrity digest, while deleted structural objects can remain traceable through tombstone data. This supports auditability and portable state verification.', tips: ['Create a clear revision checkpoint before major structural changes.', 'Before export, verify that the current manuscript state is the revision you intend to publish.'] },
      { title: '14. Publication profiles', body: 'A publication profile separates manuscript content from publisher presentation and policy. Profiles can define page size, margins, typography, section and object numbering, note placement, caption positions, metadata requirements and supported outputs.', tips: ['Do not reshape manuscript content merely to imitate publisher layout; put presentation rules in the profile.', 'Review publication-readiness errors and warnings before export.'] },
      { title: '15. Custom publisher profiles and protection', body: 'Alongside built-in profiles, a custom publisher profile version can be created and applied. A profile version records publisher rules; read-only profiles should be changed by creating a new version instead of editing them in place.', tips: ['Create a new profile version for significant publisher-rule changes.', 'Profiles can be exported and reused in another installation.'] },
      { title: '16. Export CSS and Print/PDF CSS', body: 'A custom publisher profile can carry general publication Export CSS and a separate Print/PDF CSS layer. General CSS controls publication HTML presentation; the print layer is applied afterwards and can add @page, margin, page-break and other print rules for PDF output.', tips: ['These styles affect publication output, not the Studio editing interface.', 'Print/PDF CSS is applied after general export styling and can therefore override it.', 'Advanced paged-media headers and footers also depend on the PDF or browser engine being used.'] },
      { title: '17. Export formats', body: 'Export & tools provides several outputs from the same semantic manuscript and active publication profile. Current formats include portable OMI and OMI JSON, JATS XML, semantic HTML, DOCX, IDML, XTG, MIF, SLA, LaTeX, EPUB and a print-to-PDF workflow.', tips: ['Prefer portable OMI for archival or further OMI processing.', 'Use JATS for journal XML workflows.', 'PDF is currently saved through the browser print view.'] },
      { title: '18. HTML and publication validation', body: 'Semantic HTML export produces a script-free publication document. Before export, Studio validates the manuscript against the active publication profile and may report errors or warnings for missing required metadata, broken internal relationships or other publication issues.', tips: ['Resolve blocking errors before export.', 'Warnings may not always block export, but they should still be reviewed individually.'] },
      { title: '19. Cloud and file storage', body: 'Studio supports local and configurable external storage workflows. WebDAV/Nextcloud availability depends on the installation and user configuration; the semantic OMI format is designed so a manuscript is not locked to one storage provider.', tips: ['Verify connection settings before using external storage.', 'Create a portable OMI package for migration or backup.'] },
      { title: '20. If something does not look right', body: 'First determine whether the problem concerns content, structure, metadata, integration or presentation. Check manuscript and metadata languages, section structure, the active publication profile and export diagnostics. For import problems, also inspect the actual source-document structure.', tips: ['For DOCX, check Word heading styles and note/table structure.', 'For OJS, check Publication metadata, the assignment and permission context.', 'For PDF/HTML presentation, check the active profile, Export CSS and Print/PDF CSS.'] },
    ],
  },
  de: {
    navigation: 'Hilfe',
    title: 'Open Manuscript Studio – Hilfe',
    description: 'Leitfaden zu den derzeit in Studio 0.1.0-alpha.1 verfügbaren Manuskript-, Peer-Review-, Publikations- und Exportfunktionen.',
    gettingStarted: 'Studio bearbeitet ein semantisches Manuskript: Überschriften, Abschnitte, Anmerkungen, Zitate, Abbildungen, Tabellen, Formeln und Metadaten bleiben als strukturierte Objekte erhalten und sind nicht nur Darstellung. Wird ein Manuskript aus OJS geöffnet, übernimmt Studio das Dokument und verfügbare Publikationsdaten über die Integration.',
    topics: [
      { title: '1. Manuskriptbearbeitung und semantische Formatierung', body: 'Im Haupteditor bearbeiten Sie Text und Struktur des Manuskripts. Studio bewahrt die Bedeutung von Absätzen, Überschriften und unterstützten Zeichenformatierungen, damit die Struktur in andere Ausgabeformate übernommen werden kann.', tips: ['Verwenden Sie echte Überschriftenebenen.', 'Drücken Sie Dokumentstruktur nicht nur durch Fett, Kursiv oder Schriftgröße aus.', 'Bevorzugen Sie semantische Elemente gegenüber reiner Direktformatierung.'] },
      { title: '2. Abschnitte, Hierarchie und Nummerierung', body: 'Dokumentabschnitte bilden eine Hierarchie. Studio verwaltet Abschnittsebenen und die vom Publikationsprofil bestimmte Nummerierung, sodass die Kapitelstruktur beim Export erhalten bleibt.', tips: ['Verwenden Sie Ebenen konsequent und ordnen Sie Unterabschnitte dem richtigen übergeordneten Abschnitt zu.', 'Bevorzugen Sie profilgesteuerte Nummerierung gegenüber manuell eingegebenen Abschnittsnummern.'] },
      { title: '3. Manuskriptdaten, Front Matter und Sprachen', body: 'Zu den wissenschaftlichen Metadaten gehören unter anderem Titel, Untertitel, Motto, Abstract, Schlüsselwörter und Dokumentsprache. Mehrsprachige Publikationsfelder können als getrennte Sprachvarianten gespeichert werden.', tips: ['Hauptsprache des Manuskripts und Sprache eines Metadatenwerts sind getrennte Angaben.', 'Ein ungarisches Manuskript kann auch englische und deutsche Titel, Abstracts und Schlüsselwörter enthalten.', 'Das Publikationsprofil kann Metadaten verpflichtend oder empfohlen machen.'] },
      { title: '4. Mitwirkende, Zugehörigkeiten, ORCID und ROR', body: 'Verwalten Sie Autorinnen, Autoren und weitere Mitwirkende mit Rollen, institutionellen Zugehörigkeiten und ORCID. Zugehörigkeiten können, sofern der Suchdienst verfügbar ist, mit ROR-Daten ergänzt werden.', tips: ['Persistente Identifikatoren verbessern maschinenlesbare Publikationsexporte.', 'Prüfen Sie, welche Angaben das aktive Publikationsprofil verlangt.'] },
      { title: '5. Anmerkungen und Zitate in Anmerkungen', body: 'Fuß- und Endnoten sind semantische Anmerkungsobjekte. Sie können formatierten Text und Zitate enthalten; ihre Platzierung wird durch das Publikationsprofil gesteuert.', tips: ['Imitieren Sie Fußnoten nicht mit manuell eingegebenen hochgestellten Zahlen.', 'Eine Quelle in einer Anmerkung kann denselben bibliografischen Datensatz wie ein Zitat im Haupttext verwenden.'] },
      { title: '6. Zitate, Bibliografie und Zitierstil', body: 'Zitierte Werke werden als strukturierte bibliografische Datensätze gespeichert und können mehrfach verwendet werden. Studio unterstützt Zitatgruppen, CSL-basierte Darstellung und bibliografische Suche.', tips: ['Legen Sie dasselbe Werk nicht mehrfach an, sondern verwenden Sie den vorhandenen Datensatz.', 'Prüfen Sie Autor, Titel, Jahr und Identifikatoren vor dem Publikationsexport.'] },
      { title: '7. Querverweise', body: 'Interne Querverweise können auf Abschnitte und unterstützte Dokumentobjekte zeigen. Da der Verweis mit dem Zielobjekt verbunden ist, müssen Nummern bei Strukturänderungen nicht manuell angepasst werden.', tips: ['Verwenden Sie nach Möglichkeit einen Querverweis statt „siehe Abbildung 3“ manuell einzutippen.', 'Prüfen Sie nach Löschungen oder Umstrukturierungen die Publikationsdiagnostik auf fehlende Ziele.'] },
      { title: '8. Abbildungen, Tabellen und Formeln', body: 'Studio behandelt wissenschaftliche visuelle Inhalte als strukturierte Blöcke. Abbildungen können Mediendatei, Beschriftung und Referenzziel besitzen; Tabellenstruktur und semantische Formeldarstellung können in unterstützte Exporte übernommen werden.', tips: ['Erstellen Sie Tabellen nicht mit Leerzeichen oder Tabulatoren.', 'Verwenden Sie aussagekräftige Beschriftungen und, wenn verfügbar, Alternativtexte.', 'Verwenden Sie für Formeln das Formelelement statt eines Bildes, sofern keine besondere Notwendigkeit besteht.'] },
      { title: '9. Mediendateien und OMI-Paket', body: 'Bilder und andere unterstützte Medien werden als Assets mit dem Manuskript verbunden. Ein vollständiges OMI-Paket kann diese Dateien zusammen mit dem semantischen Manuskript und Integritätsinformationen transportieren.', tips: ['Verwenden Sie das portable OMI-Paket, wenn Medien mit dem Manuskript übertragen werden sollen.', 'Integritätsdaten helfen, fehlende, beschädigte oder veränderte Inhalte zu erkennen.'] },
      { title: '10. DOCX-Import', body: 'Beim Import eines Word-Dokuments versucht Studio neben dem Text auch Überschriften, unterstützte Zeichenformatierungen, Anmerkungen, Tabellen und andere erkennbare Strukturen in semantische OMI-Elemente umzuwandeln.', tips: ['Verwenden Sie Word Überschrift 1, Überschrift 2 usw.', 'Die Erkennung direkter Formatierung ist nur eine Rückfallmethode.', 'Prüfen Sie nach dem Import Abschnittshierarchie, Anmerkungen, Tabellen und Zitate.'] },
      { title: '11. OJS-Integration', body: 'In einer aus OJS gestarteten Sitzung kann Studio das Manuskript und verfügbare Publikationsmetadaten entsprechend den gewährten Integrationsbereichen übernehmen. Der Datenaustausch zwischen Studio und OJS ist an Assignment und Berechtigungen gebunden.', tips: ['Nur tatsächlich in OJS gespeicherte Daten können importiert werden.', 'Fehlen Metadaten, prüfen Sie zuerst die OJS-Publikationsmetadaten und die betreffende Sprachvariante.', 'Achten Sie darauf, das Dokument mit der vorgesehenen Rolle und dem richtigen Assignment zu öffnen.'] },
      { title: '12. Peer Review', body: 'Das Review-Modell von Studio trennt Manuskript, Peer-Review-Assignment und Review-Arbeit. Bei OJS-Integration ist der Reviewer-Zugriff an das Assignment gebunden, sodass nur die für diesen Review-Kontext erlaubten Inhalte und Aktionen verfügbar sind.', tips: ['Starten Sie die Review-Arbeit aus dem betreffenden Assignment.', 'Vermeiden Sie bei Double-Blind-Review Angaben, die unnötig die Identität von Autor oder Reviewer offenlegen.'] },
      { title: '13. Revisionen, Verlauf und Integrität', body: 'Studio verfolgt Zustandsänderungen des Manuskripts als Revisionen. Revisionen können Integritäts-Digests tragen; gelöschte Strukturobjekte können über Tombstone-Daten nachvollziehbar bleiben. Dies unterstützt Auditierbarkeit und portable Zustandsprüfung.', tips: ['Erzeugen Sie vor großen Strukturänderungen einen eindeutigen Revisionsstand.', 'Prüfen Sie vor dem Export, ob der aktuelle Zustand der gewünschten Publikationsrevision entspricht.'] },
      { title: '14. Publikationsprofile', body: 'Ein Publikationsprofil trennt Manuskriptinhalt von Verlagsdarstellung und -regeln. Profile können Seitengröße, Ränder, Typografie, Abschnitts- und Objektnummerierung, Anmerkungsplatzierung, Beschriftungspositionen, Metadatenanforderungen und unterstützte Ausgaben definieren.', tips: ['Verändern Sie Manuskriptinhalte nicht nur, um ein Verlagslayout nachzuahmen; Darstellungsregeln gehören ins Profil.', 'Prüfen Sie vor dem Export Fehler und Warnungen der Publikationsbereitschaft.'] },
      { title: '15. Eigenes Verlagsprofil und Schutz', body: 'Neben eingebauten Profilen kann eine eigene Verlagsprofilversion erstellt und angewendet werden. Eine Profilversion hält Verlagsregeln fest; schreibgeschützte Profile werden nicht direkt geändert, sondern durch eine neue Version weiterentwickelt.', tips: ['Erstellen Sie bei wesentlichen Regeländerungen eine neue Profilversion.', 'Profile können exportiert und in einer anderen Installation wiederverwendet werden.'] },
      { title: '16. Export-CSS und Druck/PDF-CSS', body: 'Ein eigenes Verlagsprofil kann allgemeines Export-CSS und eine getrennte Druck/PDF-CSS-Schicht enthalten. Allgemeines CSS steuert die Publikations-HTML-Darstellung; die Druckschicht wird danach angewandt und kann @page-, Rand-, Seitenumbruch- und weitere Druckregeln für PDF ergänzen.', tips: ['Diese Stile verändern die Publikationsausgabe, nicht die Studio-Bearbeitungsoberfläche.', 'Druck/PDF-CSS wird nach dem allgemeinen Exportstil angewandt und kann ihn überschreiben.', 'Erweiterte Paged-Media-Kopf- und Fußzeilen hängen auch von der verwendeten PDF- oder Browser-Engine ab.'] },
      { title: '17. Exportformate', body: 'Export & Werkzeuge erzeugt verschiedene Ausgaben aus demselben semantischen Manuskript und aktiven Publikationsprofil. Derzeit verfügbar sind portables OMI und OMI JSON, JATS XML, semantisches HTML, DOCX, IDML, XTG, MIF, SLA, LaTeX, EPUB und ein Druck-zu-PDF-Arbeitsablauf.', tips: ['Bevorzugen Sie portables OMI für Archivierung oder weitere OMI-Verarbeitung.', 'Verwenden Sie JATS für Zeitschriften-XML-Workflows.', 'PDF wird derzeit über die Druckansicht des Browsers gespeichert.'] },
      { title: '18. HTML und Publikationsprüfung', body: 'Der semantische HTML-Export erzeugt ein skriptfreies Publikationsdokument. Vor dem Export validiert Studio das Manuskript gegen das aktive Publikationsprofil und kann Fehler oder Warnungen zu fehlenden Pflichtmetadaten, defekten internen Beziehungen oder anderen Publikationsproblemen melden.', tips: ['Beheben Sie blockierende Fehler vor dem Export.', 'Warnungen blockieren nicht immer den Export, sollten aber einzeln geprüft werden.'] },
      { title: '19. Cloud- und Dateispeicherung', body: 'Studio unterstützt lokale und konfigurierbare externe Speicherabläufe. Die Verfügbarkeit von WebDAV/Nextcloud hängt von Installation und Benutzerkonfiguration ab; das semantische OMI-Format soll verhindern, dass ein Manuskript an einen einzelnen Speicheranbieter gebunden ist.', tips: ['Prüfen Sie Verbindungseinstellungen vor Nutzung externen Speichers.', 'Erstellen Sie für Migration oder Sicherung ein portables OMI-Paket.'] },
      { title: '20. Wenn etwas nicht wie erwartet erscheint', body: 'Klären Sie zuerst, ob das Problem Inhalt, Struktur, Metadaten, Integration oder Darstellung betrifft. Prüfen Sie Manuskript- und Metadatensprache, Abschnittsstruktur, aktives Publikationsprofil und Exportdiagnostik. Bei Importproblemen prüfen Sie zusätzlich die tatsächliche Struktur des Quelldokuments.', tips: ['Bei DOCX: Word-Überschriftenstile sowie Anmerkungs- und Tabellenstruktur prüfen.', 'Bei OJS: Publikationsmetadaten, Assignment und Berechtigungskontext prüfen.', 'Bei PDF/HTML: aktives Profil, Export-CSS und Druck/PDF-CSS prüfen.'] },
    ],
  },
};

export function getHelpCopy(locale: SupportedLocale): HelpCopy {
  return copy[locale] ?? copy.en;
}
