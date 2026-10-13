import { getResearchModuleCopyByLocale } from '../moduleTranslationCatalog';
import { normalizeModuleLocale } from '../moduleLocale';
interface EleveltarSearchPanelProps {
  locale: string;
}

const copyByLocale: Record<string, { title: string; description: string; open: string; note: string }> = getResearchModuleCopyByLocale('history-archives-eleveltar-search-panel/copyByLocale');

export function EleveltarSearchPanel({ locale }: EleveltarSearchPanelProps) {
  const copy = copyByLocale[normalizeModuleLocale(locale)] ?? copyByLocale.en!;
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
