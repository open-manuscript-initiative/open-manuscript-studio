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
    title: 'Súgó szerzőknek',
    description: 'Rövid útmutató a kézirat szerkesztéséhez és a legfontosabb Studio-funkciókhoz.',
    gettingStarted: 'Ha OJS-ből nyitotta meg a kéziratot, a Studio átveszi a dokumentumot és az elérhető publikációs metaadatokat. A módosítások a Studio kéziratmodelljében készülnek.',
    topics: [
      { title: 'A kézirat szerkesztése', body: 'A fő szerkesztőfelületen a kézirat szövegét módosíthatja. A dokumentum szerkezetét a Kézirat menü → Dokumentum alatt ellenőrizheti.', tips: ['A fejezetcímekhez használjon valódi címsorstílust.', 'A szerkezeti elemeket ne pusztán félkövér vagy nagyobb betűmérettel jelölje.'] },
      { title: 'Kézirat adatai és nyelvek', body: 'A Kézirat adatai alatt szerkeszthető az absztrakt, a kulcsszavak és a további tudományos metaadatok. A többnyelvű mezők HU, EN és DE változatai külön kezelhetők.', tips: ['A kézirat fő nyelve és a metaadatok nyelve két külön dolog.', 'Egy magyar tanulmányhoz is megadható angol és német absztrakt és kulcsszólista.'] },
      { title: 'Jegyzetek', body: 'A lábjegyzetek és végjegyzetek szemantikus jegyzetobjektumként maradnak a kéziratban. A Jegyzetek menüpontban áttekinthetők és szerkeszthetők.' },
      { title: 'Hivatkozások', body: 'Az idézett műveket a Hivatkozások részben strukturált bibliográfiai rekordként kezelheti. Egy művet elég egyszer felvenni, majd több helyen is hivatkozhat rá.' },
      { title: 'Közreműködők', body: 'Itt kezelhetők a szerzők és más közreműködők adatai, szerepei, intézményi kapcsolatai és ORCID-azonosítói.' },
      { title: 'Revíziók és mentés', body: 'A Studio a fontos változtatásokat revíziókban követi. Az Előzmények alatt áttekintheti a kézirat változásait és szükség esetén korábbi állapothoz térhet vissza.' },
      { title: 'Import OJS-ből', body: 'Az OJS-ből megnyitott kéziratnál a Studio átveheti a dokumentumot, az absztraktokat, kulcsszavakat és más publikációs metaadatokat. Csak az OJS-ben ténylegesen kitöltött adatok importálhatók.' },
      { title: 'DOCX import', body: 'Word-dokumentum importálásakor a Studio a dokumentum szerkezetét is megpróbálja felismerni.', tips: ['A fejezetcímeket Word Címsor 1, Címsor 2 stb. stílussal jelölje.', 'A közvetlen formázás felismerése csak tartalék módszer.'] },
      { title: 'Export', body: 'Az Export és eszközök menüben hordozható .omi.json kéziratfájl készíthető. Ez a dokumentum szemantikai szerkezetét és OMI-metaadatait őrzi.' },
      { title: 'Ha valami nem úgy jelenik meg, ahogy várta', body: 'Először ellenőrizze a kézirat nyelvét, a kiválasztott metaadatnyelvet és Word-import esetén a címsorstílusokat. OJS-importnál ellenőrizze azt is, hogy az adat az OJS Publication metaadatai között valóban ki van-e töltve.' }
    ]
  },
  en: {
    navigation: 'Help', title: 'Help for authors', description: 'A short guide to editing manuscripts and using the main Studio features.', gettingStarted: 'When a manuscript is opened from OJS, Studio imports the document and available publication metadata. Editing then takes place in the Studio manuscript model.',
    topics: [
      { title: 'Editing the manuscript', body: 'Edit manuscript text in the main editor. Review its structure under Manuscript menu → Document.', tips: ['Use real heading styles for section headings.', 'Do not rely on bold text or font size alone to express structure.'] },
      { title: 'Manuscript data and languages', body: 'Abstracts, keywords and other scholarly metadata are edited under Manuscript data. Multilingual fields can be maintained separately in HU, EN and DE.', tips: ['The manuscript language and metadata language are separate concepts.', 'A Hungarian article may also have English and German abstracts and keywords.'] },
      { title: 'Notes', body: 'Footnotes and endnotes are retained as semantic note objects. Review and edit them under Notes.' },
      { title: 'References', body: 'Cited works are stored as structured bibliographic records. Add a work once and reuse it in multiple citations.' },
      { title: 'Contributors', body: 'Manage authors and other contributors, roles, affiliations and ORCID identifiers here.' },
      { title: 'Revisions and saving', body: 'Studio tracks important changes as revisions. Use History to review changes and, where supported, return to an earlier state.' },
      { title: 'Import from OJS', body: 'Studio can import the document, abstracts, keywords and other publication metadata from OJS. Only metadata actually present in OJS can be imported.' },
      { title: 'DOCX import', body: 'When importing Word documents, Studio also attempts to recover document structure.', tips: ['Use Word Heading 1, Heading 2, etc. for section headings.', 'Direct-formatting recognition is only a fallback.'] },
      { title: 'Export', body: 'Export & tools can create a portable .omi.json manuscript file containing the semantic document structure and OMI metadata.' },
      { title: 'If something looks wrong', body: 'Check the manuscript language, selected metadata language and, for Word imports, heading styles. For OJS imports, also verify that the value is actually filled in under the OJS Publication metadata.' }
    ]
  },
  de: {
    navigation: 'Hilfe', title: 'Hilfe für Autorinnen und Autoren', description: 'Kurzanleitung zur Manuskriptbearbeitung und zu den wichtigsten Studio-Funktionen.', gettingStarted: 'Wird ein Manuskript aus OJS geöffnet, übernimmt Studio das Dokument und die verfügbaren Publikationsmetadaten. Die weitere Bearbeitung erfolgt im Manuskriptmodell von Studio.',
    topics: [
      { title: 'Manuskript bearbeiten', body: 'Bearbeiten Sie den Manuskripttext im Haupteditor. Die Dokumentstruktur finden Sie unter Manuskriptmenü → Dokument.', tips: ['Verwenden Sie echte Überschriftenformatvorlagen.', 'Kennzeichnen Sie Struktur nicht nur durch Fettdruck oder größere Schrift.'] },
      { title: 'Manuskriptdaten und Sprachen', body: 'Abstracts, Schlüsselwörter und weitere wissenschaftliche Metadaten werden unter Manuskriptdaten bearbeitet. Mehrsprachige Felder können getrennt in HU, EN und DE gepflegt werden.', tips: ['Manuskriptsprache und Metadatensprache sind getrennte Angaben.', 'Auch ein ungarischer Beitrag kann englische und deutsche Abstracts und Schlüsselwörter enthalten.'] },
      { title: 'Anmerkungen', body: 'Fuß- und Endnoten bleiben als semantische Anmerkungsobjekte erhalten und können unter Anmerkungen bearbeitet werden.' },
      { title: 'Literatur und Zitate', body: 'Zitierte Werke werden als strukturierte bibliografische Datensätze gespeichert. Ein Werk muss nur einmal angelegt werden.' },
      { title: 'Mitwirkende', body: 'Hier verwalten Sie Autorinnen, Autoren und weitere Mitwirkende einschließlich Rollen, Zugehörigkeiten und ORCID.' },
      { title: 'Revisionen und Speichern', body: 'Studio verfolgt wichtige Änderungen als Revisionen. Unter Verlauf können Änderungen geprüft und gegebenenfalls frühere Zustände wiederhergestellt werden.' },
      { title: 'Import aus OJS', body: 'Studio kann Dokument, Abstracts, Schlüsselwörter und weitere Publikationsmetadaten aus OJS übernehmen. Importiert werden können nur tatsächlich in OJS vorhandene Daten.' },
      { title: 'DOCX-Import', body: 'Beim Word-Import versucht Studio auch die Dokumentstruktur zu erkennen.', tips: ['Verwenden Sie Word Überschrift 1, Überschrift 2 usw.', 'Die Erkennung direkter Formatierung ist nur eine Rückfallmethode.'] },
      { title: 'Export', body: 'Unter Export & Werkzeuge kann eine portable .omi.json-Datei mit semantischer Dokumentstruktur und OMI-Metadaten erzeugt werden.' },
      { title: 'Wenn etwas nicht wie erwartet erscheint', body: 'Prüfen Sie Manuskriptsprache, ausgewählte Metadatensprache und bei Word-Importen die Überschriftenstile. Bei OJS-Importen prüfen Sie außerdem, ob der Wert in den OJS-Publikationsmetadaten tatsächlich ausgefüllt ist.' }
    ]
  }
};

export function getHelpCopy(locale: SupportedLocale): HelpCopy {
  return copy[locale] ?? copy.en;
}
