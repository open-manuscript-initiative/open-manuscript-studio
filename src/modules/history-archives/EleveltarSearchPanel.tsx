interface EleveltarSearchPanelProps {
  locale: string;
}

const copyByLocale: Record<string, { title: string; description: string; open: string; note: string }> = {
  hu: {
    title: 'eLevéltár – magyar levéltári források',
    description: 'Az Elektronikus Levéltári Portálon a Magyar Nemzeti Levéltár és Budapest Főváros Levéltára levéltári leírásai és digitális iratai kereshetők.',
    open: 'Iratkereső megnyitása',
    note: 'A keresés a levéltári portálon nyílik meg; a keresőkifejezést ott kell megadni.',
  },
  en: {
    title: 'eLevéltár – Hungarian archival sources',
    description: 'Search archival descriptions and digital records from the Hungarian National Archives and Budapest City Archives in the Electronic Archives Portal.',
    open: 'Open archival search',
    note: 'Search opens on the archive portal; enter the query there.',
  },
  de: {
    title: 'eLevéltár – Ungarische Archivquellen',
    description: 'Durchsuchen Sie archivische Beschreibungen und Digitalisate des Ungarischen Nationalarchivs und des Budapester Stadtarchivs im Elektronischen Archivportal.',
    open: 'Archivrecherche öffnen',
    note: 'Die Suche wird im Archivportal geöffnet; geben Sie die Suchbegriffe dort ein.',
  },
};

export function EleveltarSearchPanel({ locale }: EleveltarSearchPanelProps) {
  const copy = copyByLocale[locale] ?? copyByLocale.en!;
  return (
    <section className="europeana-search eleveltar-search" aria-labelledby="eleveltar-search-title">
      <div className="europeana-search-heading">
        <h5 id="eleveltar-search-title">{copy.title}</h5>
        <p>{copy.description}</p>
        <p>{copy.note}</p>
      </div>
      <div className="europeana-search-controls">
        <a
          className="europeana-search-more"
          href="https://www.eleveltar.hu/kereses"
          target="_blank"
          rel="noopener noreferrer"
        >
          {copy.open}
        </a>
      </div>
    </section>
  );
}
