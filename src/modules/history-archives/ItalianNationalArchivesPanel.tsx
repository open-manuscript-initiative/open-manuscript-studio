import { normalizeModuleLocale } from '../moduleLocale';
import { ITALIAN_NATIONAL_ARCHIVES_LINKS } from './italianNationalArchives';
import './historyArchivesSources.css';

interface ItalianNationalArchivesPanelProps {
  locale: string;
}

const translations = {
  en: {
    title: 'Archivi Nazionali — Italian National Archives',
    description: 'The unified Italian archival discovery portal launched by ICAR in October 2026. Search public and private archival descriptions, producers, finding aids and linked digital objects on the provider site.',
    note: 'Official catalogue navigation: these links open the Italian provider. Studio does not fetch catalogue records, submit searches or obtain private documents on your behalf.',
    links: {
      home: 'Portal home and simple search',
      holdings: 'Archival fonds and collections',
      units: 'Files, registers and individual documents',
      explore: 'Advanced search, finding aids, people and institutions',
      readingRoom: 'Digital reading room and consultation requests',
    },
    readingRoomNote: 'Reading-room reservations and requests for reproductions are handled by the archive. Sign-in may be required; availability depends on the institution.',
    researchNote: 'When citing an item, verify the holding institution, archival fonds, series, unit/reference code, stable record URL and image-use terms. Not all described items have digital scans.',
    official: 'ICAR announcement',
  },
  hu: {
    title: 'Archivi Nazionali – Olasz Nemzeti Levéltári Portál',
    description: 'Az ICAR 2026 októberében elindított egységes olasz levéltári keresője. Állami és magánlevéltári fondok, iratképzők, segédletek és kapcsolódó digitális források kutathatók a szolgáltató oldalán.',
    note: 'Hivatalos levéltári felület: a hivatkozások az olasz portált nyitják meg. A Stúdió nem kérdezi le közvetlenül a katalógus rekordjait, nem indít háttérkeresést és nem szerez hozzáférést korlátozott anyagokhoz.',
    links: {
      home: 'Főoldal és egyszerű keresés',
      holdings: 'Fondok és levéltári gyűjtemények',
      units: 'Iratok, kötetek és egyedi dokumentumok',
      explore: 'Összetett keresés, segédletek, személyek és intézmények',
      readingRoom: 'Digitális kutatóterem, iratbetekintés és másolatkérés',
    },
    readingRoomNote: 'A kutatótermi foglalásokat és másolatigényléseket a levéltár kezeli. Azonosításra lehet szükség, a szolgáltatások intézményenként eltérhetnek.',
    researchNote: 'Hivatkozás előtt ellenőrizze az őrző intézményt, a fondot, az állagot, a jelzetet, a tartós rekordhivatkozást és a képhasználati feltételeket. Nem minden leírt irat digitalizált.',
    official: 'Az ICAR hivatalos közleménye',
  },
  de: {
    title: 'Archivi Nazionali – Italienisches Nationalarchivportal',
    description: 'Das im Oktober 2026 gestartete zentrale italienische Archivportal des ICAR. Archivbestände, Provenienzstellen, Findmittel und digitale Objekte sind beim Anbieter recherchierbar.',
    note: 'Offizielles Archivportal: die Links führen zum italienischen Anbieter. Studio ruft keine Katalogdatensätze ab, führt keine Hintergrundsuche aus und beschafft keine geschützten Dokumente.',
    links: {
      home: 'Startseite und einfache Suche',
      holdings: 'Archivbestände und Sammlungen',
      units: 'Akten, Register und Einzeldokumente',
      explore: 'Erweiterte Suche, Findmittel, Personen und Institutionen',
      readingRoom: 'Digitaler Lesesaal, Einsicht und Reproduktionen',
    },
    readingRoomNote: 'Lesesaalbuchungen und Reproduktionsanfragen werden vom Archiv abgewickelt. Anmeldung kann erforderlich sein; die Angebote unterscheiden sich je nach Institution.',
    researchNote: 'Vor dem Zitieren Archiv, Bestand, Serie, Signatur, dauerhaften Datensatzlink und Bildnutzungsrechte prüfen. Nicht jedes beschriebene Stück ist digitalisiert.',
    official: 'Offizielle ICAR-Mitteilung',
  },
  it: {
    title: 'Archivi Nazionali – Portale degli archivi italiani',
    description: 'Il portale unificato di ricerca archivistica realizzato da ICAR e presentato nell’ottobre 2026. Consulta fondi pubblici e privati, soggetti produttori, strumenti di ricerca e oggetti digitali sul sito ufficiale.',
    note: 'Collegamenti al portale ufficiale: Studio non esegue interrogazioni automatiche, non importa schede e non accede a risorse riservate.',
    links: {
      home: 'Home e ricerca semplice',
      holdings: 'Patrimonio documentario e fondi',
      units: 'Unità archivistiche e documentarie',
      explore: 'Ricerca avanzata, guide, persone ed enti',
      readingRoom: 'Sala studio, consultazione e richieste',
    },
    readingRoomNote: 'Prenotazioni, riproduzioni e richieste sono gestite dai singoli archivi. Potrebbe essere necessaria l’autenticazione.',
    researchNote: 'Verifica istituto conservatore, fondo, serie, segnatura, URL persistente e condizioni d’uso prima della citazione. Non tutte le unità sono digitalizzate.',
    official: 'Comunicato ufficiale ICAR',
  },
} as const;

export function ItalianNationalArchivesPanel({ locale }: ItalianNationalArchivesPanelProps) {
  const language = normalizeModuleLocale(locale);
  const copy = translations[language as keyof typeof translations] ?? translations.en;

  return (
    <section className="europeana-search history-archives-italian-national" aria-labelledby="italian-national-archives-title">
      <div className="europeana-search-heading">
        <h5 id="italian-national-archives-title">{copy.title}</h5>
        <p>{copy.description}</p>
      </div>
      <p className="history-archives-italian-note">{copy.note}</p>
      <nav className="history-archives-italian-links" aria-label={copy.title}>
        {ITALIAN_NATIONAL_ARCHIVES_LINKS.map(({ id, url }) => (
          <a key={id} href={url} target="_blank" rel="noopener noreferrer">
            {copy.links[id]}
          </a>
        ))}
      </nav>
      <p className="history-archives-italian-note">{copy.readingRoomNote}</p>
      <p className="history-archives-italian-note">{copy.researchNote}</p>
      <a
        className="history-archives-italian-reference"
        href="https://icar.cultura.gov.it/archivio-notizie/notizia/nasce-il-portale-archivi-nazionali-un-unico-accesso-al-patrimonio-archivistico-italiano"
        target="_blank"
        rel="noopener noreferrer"
      >
        {copy.official}
      </a>
    </section>
  );
}
