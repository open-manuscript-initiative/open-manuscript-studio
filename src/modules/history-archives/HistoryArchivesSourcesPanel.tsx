import { useEffect, useState } from 'react';

import type { EuropeanaSearchCopy } from '../moduleShellTranslations';
import { EuropeanaSearchPanel } from './EuropeanaSearchPanel';
import { EleveltarSearchPanel } from './EleveltarSearchPanel';
import { NaraSearchPanel } from './NaraSearchPanel';
import { RomanianArchivesSearchPanel } from './RomanianArchivesSearchPanel';
import {
  DEFAULT_VISIBLE_HISTORY_ARCHIVE_SOURCE_IDS,
  getHistoryArchiveSourcesStorageKey,
  HISTORY_ARCHIVE_SOURCE_IDS,
  readVisibleHistoryArchiveSources,
  type HistoryArchiveSourceId,
} from './sourcePreferences';
import './historyArchivesSources.css';

interface HistoryArchivesSourcesPanelProps {
  europeanaCopy: EuropeanaSearchCopy;
  naraCopy: EuropeanaSearchCopy;
  locale: string;
  userId: string;
  workspaceId: string;
}

interface ArchivePortal {
  id: Exclude<HistoryArchiveSourceId, 'europeana' | 'nara' | 'romanian' | 'hungarian'>;
  url: string;
}

const archivePortals: ArchivePortal[] = [
  { id: 'uk', url: 'https://discovery.nationalarchives.gov.uk/' },
  { id: 'italian', url: 'https://san.beniculturali.it/web/san/ricerca-negli-archivi' },
  { id: 'spanish', url: 'https://pares.cultura.gob.es/ParesBusquedas20/catalogo/find' },
  { id: 'dutch', url: 'https://www.nationaalarchief.nl/onderzoeken/collectie' },
  { id: 'french', url: 'https://www.siv.archives-nationales.culture.gouv.fr' },
  { id: 'german', url: 'https://invenio.bundesarchiv.de/invenio/' },
  { id: 'swedish', url: 'https://sok.riksarkivet.se/en/digitala-forskarsalen' },
  { id: 'polish', url: 'https://www.szukajwarchiwach.gov.pl/en/wyszukiwarka' },
  { id: 'slovak', url: 'https://portal.minv.sk/wps/portal/domov/isea/EA07_PrezeranieObsahuArchivu' },
  { id: 'austrian', url: 'https://www.archivinformationssystem.at/archivplansuche.aspx?ID=13' },
  { id: 'belgian', url: 'https://agatha.arch.be/search/ead/?lang=en' },
  { id: 'bulgarian', url: 'https://sea.archives.government.bg/' },
  { id: 'croatian', url: 'https://hais.arhiv.hr/' },
  { id: 'cypriot', url: 'https://www.gov.cy/culture-sa/en/documents/catalogue-of-archival-collections/' },
  { id: 'czech', url: 'https://digitalnibadatelna.nacr.cz/' },
  { id: 'danish', url: 'https://daisy.rigsarkivet.dk/find_arkivalier' },
  { id: 'estonian', url: 'https://ais.ra.ee/en' },
  { id: 'finnish', url: 'https://astia.narc.fi/uusiastia/' },
  { id: 'greek', url: 'https://greekarchivesinventory.gak.gr/' },
  { id: 'irish', url: 'https://findingaids.nationalarchives.ie/' },
  { id: 'latvian', url: 'https://pakalpojumi.arhivi.gov.lv/' },
  { id: 'lithuanian', url: 'https://eais.archyvai.lt/repo-ext/search' },
  { id: 'luxembourgish', url: 'https://archives.services-publics.lu/' },
  { id: 'maltese', url: 'https://arkivji.org.mt/' },
  { id: 'portuguese', url: 'https://digitarq.arquivos.pt/en' },
  { id: 'slovenian', url: 'https://vac.sjas.gov.si/vac/search/fieldSearch' },
];

const copyByLocale = {
  en: {
    choose: 'Archives to display',
    help: 'Choose which catalogues appear below. Your selection is saved for this workspace.',
    selectAll: 'Show all',
    clear: 'Hide all',
    open: 'Open archive search',
    portalNote: 'Search on the archive’s official catalogue; the link opens in a new tab.',
  },
  de: {
    choose: 'Anzuzeigende Archive',
    help: 'Wählen Sie die Kataloge aus, die unten angezeigt werden. Die Auswahl wird für diesen Arbeitsbereich gespeichert.',
    selectAll: 'Alle anzeigen',
    clear: 'Alle ausblenden',
    open: 'Archivsuche öffnen',
    portalNote: 'Suchen Sie im offiziellen Archivkatalog. Der Link wird in einem neuen Tab geöffnet.',
  },
  hu: {
    choose: 'Megjelenő levéltárak',
    help: 'Jelölje ki, mely katalógusok jelenjenek meg. A választás erre a munkatérre mentődik.',
    selectAll: 'Mind megjelenítése',
    clear: 'Összes elrejtése',
    open: 'Levéltári kereső megnyitása',
    portalNote: 'Keresés a levéltár hivatalos katalógusában; a hivatkozás új lapon nyílik meg.',
  },
} as const;

const portalLabels: Record<string, Record<ArchivePortal['id'], string>> = {
  en: {
    uk: 'United Kingdom',
    italian: 'Italy',
    spanish: 'Spain',
    dutch: 'Netherlands',
    french: 'France',
    german: 'Germany',
    swedish: 'Sweden',
    polish: 'Poland',
    slovak: 'Slovakia',
    austrian: 'Austria',
    belgian: 'Belgium',
    bulgarian: 'Bulgaria',
    croatian: 'Croatia',
    cypriot: 'Cyprus',
    czech: 'Czechia',
    danish: 'Denmark',
    estonian: 'Estonia',
    finnish: 'Finland',
    greek: 'Greece',
    irish: 'Ireland',
    latvian: 'Latvia',
    lithuanian: 'Lithuania',
    luxembourgish: 'Luxembourg',
    maltese: 'Malta',
    portuguese: 'Portugal',
    slovenian: 'Slovenia',
  },
  de: {
    uk: 'Vereinigtes Königreich',
    italian: 'Italien',
    spanish: 'Spanien',
    dutch: 'Niederlande',
    french: 'Frankreich',
    german: 'Deutschland',
    swedish: 'Schweden',
    polish: 'Polen',
    slovak: 'Slowakei',
    austrian: 'Österreich',
    belgian: 'Belgien',
    bulgarian: 'Bulgarien',
    croatian: 'Kroatien',
    cypriot: 'Zypern',
    czech: 'Tschechien',
    danish: 'Dänemark',
    estonian: 'Estland',
    finnish: 'Finnland',
    greek: 'Griechenland',
    irish: 'Irland',
    latvian: 'Lettland',
    lithuanian: 'Litauen',
    luxembourgish: 'Luxemburg',
    maltese: 'Malta',
    portuguese: 'Portugal',
    slovenian: 'Slowenien',
  },
  hu: {
    uk: 'Egyesült Királyság',
    italian: 'Olaszország',
    spanish: 'Spanyolország',
    dutch: 'Hollandia',
    french: 'Franciaország',
    german: 'Németország',
    swedish: 'Svédország',
    polish: 'Lengyelország',
    slovak: 'Szlovákia',
    austrian: 'Ausztria',
    belgian: 'Belgium',
    bulgarian: 'Bulgária',
    croatian: 'Horvátország',
    cypriot: 'Ciprus',
    czech: 'Csehország',
    danish: 'Dánia',
    estonian: 'Észtország',
    finnish: 'Finnország',
    greek: 'Görögország',
    irish: 'Írország',
    latvian: 'Lettország',
    lithuanian: 'Litvánia',
    luxembourgish: 'Luxemburg',
    maltese: 'Málta',
    portuguese: 'Portugália',
    slovenian: 'Szlovénia',
  },
};

const sourceNames: Record<string, Record<HistoryArchiveSourceId, string>> = {
  en: {
    europeana: 'Europeana',
    nara: 'U.S. National Archives Catalog',
    romanian: 'Romanian National Archives',
    hungarian: 'eLevéltár – Hungarian archives',
    uk: 'The National Archives (UK)',
    italian: 'Sistema Archivistico Nazionale (Italy)',
    spanish: 'PARES – Spanish Archives',
    dutch: 'Nationaal Archief (Netherlands)',
    french: 'Archives nationales (France)',
    german: 'Bundesarchiv Invenio (Germany)',
    swedish: 'Swedish National Archives (Riksarkivet)',
    polish: 'Polish State Archives (Szukaj w Archiwach)',
    slovak: 'Slovak Electronic Archives',
    austrian: 'Austrian State Archives (ÖStA)',
    belgian: 'State Archives of Belgium (AGATHA)',
    bulgarian: 'State Agency Archives of Bulgaria',
    croatian: 'Croatian Archival Information System (HAIS)',
    cypriot: 'Cyprus State Archives catalogue',
    czech: 'Czech National Archives Digital Research Room',
    danish: 'Danish National Archives (Daisy)',
    estonian: 'Estonian National Archives (AIS)',
    finnish: 'National Archives of Finland (Astia)',
    greek: 'Greek Archives Inventory',
    irish: 'National Archives of Ireland (Finding Aids)',
    latvian: 'National Archives of Latvia (MeklēLNA)',
    lithuanian: 'Lithuanian Electronic Archive Information System (EAIS)',
    luxembourgish: 'Luxembourg National Archives',
    maltese: 'National Archives of Malta (Arkivji)',
    portuguese: 'Portuguese Archives (Digitarq)',
    slovenian: 'Slovenian Virtual Archival Reading Room (VAČ)',
  },
  de: {
    europeana: 'Europeana',
    nara: 'Katalog des US-Nationalarchivs',
    romanian: 'Nationalarchiv Rumäniens',
    hungarian: 'eLevéltár – Ungarische Archive',
    uk: 'The National Archives (UK)',
    italian: 'Sistema Archivistico Nazionale (Italien)',
    spanish: 'PARES – Spanische Archive',
    dutch: 'Nationaal Archief (Niederlande)',
    french: 'Archives nationales (Frankreich)',
    german: 'Bundesarchiv Invenio (Deutschland)',
    swedish: 'Schwedisches Nationalarchiv (Riksarkivet)',
    polish: 'Polnisches Staatsarchiv (Szukaj w Archiwach)',
    slovak: 'Slowakisches elektronisches Archiv',
    austrian: 'Österreichisches Staatsarchiv (ÖStA)',
    belgian: 'Staatsarchiv Belgien (AGATHA)',
    bulgarian: 'Staatliche Archivagentur Bulgariens',
    croatian: 'Kroatisches Archiv-Informationssystem (HAIS)',
    cypriot: 'Katalog des Staatsarchivs Zypern',
    czech: 'Digitaler Lesesaal des Tschechischen Nationalarchivs',
    danish: 'Dänisches Nationalarchiv (Daisy)',
    estonian: 'Estnisches Nationalarchiv (AIS)',
    finnish: 'Nationalarchiv Finnlands (Astia)',
    greek: 'Griechisches Archivverzeichnis',
    irish: 'Nationalarchiv Irlands (Finding Aids)',
    latvian: 'Nationalarchiv Lettlands (MeklēLNA)',
    lithuanian: 'Litauisches Elektronisches Archiv-Informationssystem (EAIS)',
    luxembourgish: 'Nationalarchiv Luxemburg',
    maltese: 'Nationalarchiv Malta (Arkivji)',
    portuguese: 'Portugiesische Archive (Digitarq)',
    slovenian: 'Virtueller slowenischer Lesesaal (VAČ)',
  },
  hu: {
    europeana: 'Europeana',
    nara: 'USA Nemzeti Levéltárának katalógusa',
    romanian: 'Román Nemzeti Levéltár',
    hungarian: 'eLevéltár – magyar levéltárak',
    uk: 'The National Archives (Egyesült Királyság)',
    italian: 'Sistema Archivistico Nazionale (Olaszország)',
    spanish: 'PARES – Spanyol Levéltárak',
    dutch: 'Nationaal Archief (Hollandia)',
    french: 'Archives nationales (Franciaország)',
    german: 'Bundesarchiv Invenio (Németország)',
    swedish: 'Svéd Nemzeti Levéltár (Riksarkivet)',
    polish: 'Lengyel Állami Levéltárak (Szukaj w Archiwach)',
    slovak: 'Szlovák Elektronikus Levéltár',
    austrian: 'Osztrák Állami Levéltár (ÖStA)',
    belgian: 'Belga Állami Levéltárak (AGATHA)',
    bulgarian: 'Bolgár Állami Levéltári Ügynökség',
    croatian: 'Horvát Levéltári Információs Rendszer (HAIS)',
    cypriot: 'Ciprusi Állami Levéltár katalógusa',
    czech: 'Cseh Nemzeti Levéltár digitális kutatóterme',
    danish: 'Dán Nemzeti Levéltár (Daisy)',
    estonian: 'Észt Nemzeti Levéltár (AIS)',
    finnish: 'Finn Nemzeti Levéltár (Astia)',
    greek: 'Görög Levéltári Nyilvántartás',
    irish: 'Ír Nemzeti Levéltár (Finding Aids)',
    latvian: 'Lett Nemzeti Levéltár (MeklēLNA)',
    lithuanian: 'Litván Elektronikus Levéltári Információs Rendszer (EAIS)',
    luxembourgish: 'Luxemburgi Nemzeti Levéltár',
    maltese: 'Máltai Nemzeti Levéltár (Arkivji)',
    portuguese: 'Portugál Levéltárak (Digitarq)',
    slovenian: 'Szlovén Virtuális Kutatóterem (VAČ)',
  },
};

function readFromBrowser(key: string): HistoryArchiveSourceId[] {
  try {
    return readVisibleHistoryArchiveSources(window.localStorage.getItem(key));
  } catch {
    return [...DEFAULT_VISIBLE_HISTORY_ARCHIVE_SOURCE_IDS];
  }
}

function getLocaleCopy(locale: string) {
  return copyByLocale[locale as keyof typeof copyByLocale] ?? copyByLocale.en;
}

export function HistoryArchivesSourcesPanel({
  europeanaCopy,
  naraCopy,
  locale,
  userId,
  workspaceId,
}: HistoryArchivesSourcesPanelProps) {
  const storageKey = getHistoryArchiveSourcesStorageKey(userId, workspaceId);
  const [selection, setSelection] = useState(() => ({
    storageKey,
    sources: typeof window === 'undefined' ? [...DEFAULT_VISIBLE_HISTORY_ARCHIVE_SOURCE_IDS] : readFromBrowser(storageKey),
  }));
  const copy = getLocaleCopy(locale);
  const names = sourceNames[locale] ?? sourceNames.en!;
  const visibleSources = selection.storageKey === storageKey
    ? selection.sources
    : typeof window === 'undefined' ? [...DEFAULT_VISIBLE_HISTORY_ARCHIVE_SOURCE_IDS] : readFromBrowser(storageKey);

  useEffect(() => {
    if (selection.storageKey !== storageKey) {
      setSelection({ storageKey, sources: readFromBrowser(storageKey) });
      return;
    }
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(selection.sources));
    } catch {
      // Storage may be disabled; source selection still works for this page session.
    }
  }, [storageKey, selection]);

  function updateSources(nextSources: HistoryArchiveSourceId[]): void {
    setSelection({ storageKey, sources: nextSources });
  }

  function toggleSource(sourceId: HistoryArchiveSourceId): void {
    updateSources(visibleSources.includes(sourceId)
      ? visibleSources.filter((id) => id !== sourceId)
      : HISTORY_ARCHIVE_SOURCE_IDS.filter((id) => id === sourceId || visibleSources.includes(id)));
  }

  const visible = new Set(visibleSources);

  return (
    <div className="history-archives-sources">
      <fieldset className="history-archives-source-picker">
        <legend>{copy.choose}</legend>
        <p>{copy.help}</p>
        <div className="history-archives-source-actions">
          <button type="button" onClick={() => updateSources([...HISTORY_ARCHIVE_SOURCE_IDS])}>{copy.selectAll}</button>
          <button type="button" onClick={() => updateSources([])}>{copy.clear}</button>
        </div>
        <div className="history-archives-source-list">
          {HISTORY_ARCHIVE_SOURCE_IDS.map((sourceId) => (
            <label key={sourceId}>
              <input
                type="checkbox"
                checked={visible.has(sourceId)}
                onChange={() => toggleSource(sourceId)}
              />
              <span>{names[sourceId]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {visible.has('europeana') ? <EuropeanaSearchPanel copy={europeanaCopy} locale={locale} /> : null}
      {visible.has('nara') ? <NaraSearchPanel copy={naraCopy} locale={locale} /> : null}
      {visible.has('romanian') ? <RomanianArchivesSearchPanel locale={locale} /> : null}
      {visible.has('hungarian') ? <EleveltarSearchPanel locale={locale} /> : null}
      {archivePortals.filter(({ id }) => visible.has(id)).map((archive) => (
        <section className="europeana-search history-archives-portal" key={archive.id}>
          <div className="europeana-search-heading">
            <h5>{names[archive.id]}</h5>
            <p>{copy.portalNote}</p>
          </div>
          <p className="history-archives-portal-country">{(portalLabels[locale] ?? portalLabels.en!)[archive.id]}</p>
          <div className="europeana-search-controls">
            <a className="europeana-search-more" href={archive.url} target="_blank" rel="noopener noreferrer">
              {copy.open}
            </a>
          </div>
        </section>
      ))}
    </div>
  );
}
