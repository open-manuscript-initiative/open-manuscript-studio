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
  id: Extract<HistoryArchiveSourceId, 'uk' | 'italian' | 'spanish' | 'dutch' | 'french' | 'german'>;
  name: string;
  url: string;
}

const archivePortals: ArchivePortal[] = [
  { id: 'uk', name: 'The National Archives (UK)', url: 'https://discovery.nationalarchives.gov.uk/' },
  { id: 'italian', name: 'Sistema Archivistico Nazionale (Italy)', url: 'https://san.beniculturali.it/web/san/ricerca-negli-archivi' },
  { id: 'spanish', name: 'PARES – Spanish Archives', url: 'https://pares.cultura.gob.es/ParesBusquedas20/catalogo/find' },
  { id: 'dutch', name: 'Nationaal Archief (Netherlands)', url: 'https://www.nationaalarchief.nl/onderzoeken/collectie' },
  { id: 'french', name: 'Archives nationales (France)', url: 'https://www.siv.archives-nationales.culture.gouv.fr' },
  { id: 'german', name: 'Bundesarchiv Invenio (Germany)', url: 'https://invenio.bundesarchiv.de/invenio/' },
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
  },
  de: {
    uk: 'Vereinigtes Königreich',
    italian: 'Italien',
    spanish: 'Spanien',
    dutch: 'Niederlande',
    french: 'Frankreich',
    german: 'Deutschland',
  },
  hu: {
    uk: 'Egyesült Királyság',
    italian: 'Olaszország',
    spanish: 'Spanyolország',
    dutch: 'Hollandia',
    french: 'Franciaország',
    german: 'Németország',
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
  const [visibleSources, setVisibleSources] = useState<HistoryArchiveSourceId[]>(
    () => typeof window === 'undefined' ? [...DEFAULT_VISIBLE_HISTORY_ARCHIVE_SOURCE_IDS] : readFromBrowser(storageKey),
  );
  const copy = getLocaleCopy(locale);
  const names = sourceNames[locale] ?? sourceNames.en!;

  useEffect(() => {
    setVisibleSources(readFromBrowser(storageKey));
  }, [storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(visibleSources));
    } catch {
      // Storage may be disabled; source selection still works for this page session.
    }
  }, [storageKey, visibleSources]);

  function toggleSource(sourceId: HistoryArchiveSourceId): void {
    setVisibleSources((current) => current.includes(sourceId)
      ? current.filter((id) => id !== sourceId)
      : HISTORY_ARCHIVE_SOURCE_IDS.filter((id) => id === sourceId || current.includes(id)),
    );
  }

  const visible = new Set(visibleSources);

  return (
    <div className="history-archives-sources">
      <fieldset className="history-archives-source-picker">
        <legend>{copy.choose}</legend>
        <p>{copy.help}</p>
        <div className="history-archives-source-actions">
          <button type="button" onClick={() => setVisibleSources([...HISTORY_ARCHIVE_SOURCE_IDS])}>{copy.selectAll}</button>
          <button type="button" onClick={() => setVisibleSources([])}>{copy.clear}</button>
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
          <p className="history-archives-portal-country">{portalLabels[locale] ?? portalLabels.en![archive.id]}</p>
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
